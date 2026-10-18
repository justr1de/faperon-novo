"""Leituras do crédito rural para a API (/api/v1/credito/*).

Período comparável: o ano escolhido vai até o último mês publicado no estado (ex.: jan–set de 2026) e é
comparado com os mesmos meses do ano anterior. Municípios sem linha num mês já publicado têm zero
(não contrataram); meses ainda não publicados são nulos. Ausente nunca é zero.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db.models import Count, Max, QuerySet, Sum
from django.utils.text import slugify

from credito.models import (
    Atividade,
    CargaCredito,
    CreditoMunicipio,
    CreditoProduto,
    Finalidade,
    Programa,
)
from indicadores.erros import ConsultaInvalida, NaoEncontrado
from indicadores.models import Municipio
from indicadores.servicos import formatar_data

FONTE = {
    "fonte": "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)",
    "url_fonte": "https://www.bcb.gov.br/estabilidadefinanceira/micrrural",
    "licenca": "ODbL",
}
MESES = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)  # fmt: skip
LIMITE_PRODUTOS = 12
AVISO_SEM_CARGA = (
    "Os dados do crédito rural ainda não foram carregados; a primeira carga leva alguns minutos."
)
AVISO_SEM_PRODUTO = (
    "O Banco Central não detalha por produto o crédito de comercialização e industrialização; "
    "o detalhe por produto existe só para custeio e investimento."
)


@dataclass(frozen=True)
class Filtros:
    ano: int | None
    municipio: Municipio | None
    programa: str | None
    finalidade: str | None


def _f(valor: Decimal | int | None) -> float | None:
    return None if valor is None else float(valor)


def _pct(parte: Decimal | None, todo: Decimal | None) -> float | None:
    if parte is None or not todo:
        return None
    return float(parte / todo * 100)


def _opcoes(escolhas: Any) -> list[dict[str, str]]:
    return [{"slug": valor, "nome": nome} for valor, nome in escolhas.choices]


def _municipio_publico(m: Municipio) -> dict[str, str]:
    return {"codigo_ibge": m.codigo_ibge, "nome": m.nome, "slug": slugify(m.nome)}


def obter_municipio(chave: str) -> Municipio:
    """Aceita o código IBGE de 7 dígitos ou o slug do nome (ji-parana)."""
    if chave.isdigit():
        municipio = Municipio.objects.filter(codigo_ibge=chave).first()
    else:
        municipio = next((m for m in Municipio.objects.all() if slugify(m.nome) == chave), None)
    if municipio is None:
        raise NaoEncontrado(f"Município '{chave}' não existe")
    return municipio


def anos_com_dados() -> list[int]:
    return list(CreditoMunicipio.objects.order_by("ano").values_list("ano", flat=True).distinct())


def ultimo_mes(ano: int) -> int | None:
    """Último mês publicado do ano no estado inteiro (define o período comparável)."""
    return CreditoMunicipio.objects.filter(ano=ano).aggregate(m=Max("mes"))["m"]


def resolver_filtros(dados: dict[str, Any]) -> tuple[Filtros, list[int]]:
    anos = anos_com_dados()
    municipio = obter_municipio(dados["municipio"]) if dados.get("municipio") else None
    ano = dados.get("ano")
    if anos and ano is not None and ano not in anos:
        raise ConsultaInvalida(
            "Parâmetros inválidos", {"ano": f"use um ano entre {anos[0]} e {anos[-1]}"}
        )
    if ano is None and anos:
        ano = anos[-1]
    return Filtros(ano, municipio, dados.get("programa"), dados.get("finalidade")), anos


def _base(qs: QuerySet[Any], f: Filtros, *, com_programa: bool = True) -> QuerySet[Any]:
    if f.municipio is not None:
        qs = qs.filter(municipio=f.municipio)
    if com_programa and f.programa:
        qs = qs.filter(programa=f.programa)
    if f.finalidade:
        qs = qs.filter(finalidade=f.finalidade)
    return qs


def _periodo(qs: QuerySet[Any], ano: int, ate_mes: int) -> QuerySet[Any]:
    return qs.filter(ano=ano, mes__lte=ate_mes)


def _somas(qs: QuerySet[Any]) -> tuple[Decimal, int]:
    r = qs.aggregate(valor=Sum("valor"), contratos=Sum("contratos"))
    return r["valor"] or Decimal(0), r["contratos"] or 0


def _meta() -> dict[str, Any]:
    ultima = (
        CargaCredito.objects.filter(status=CargaCredito.Status.SUCESSO)
        .order_by("-concluida_em")
        .values_list("concluida_em", flat=True)
        .first()
    )
    return {"fontes": [FONTE], "atualizado_em": formatar_data(ultima)}


def _qualidade(ano: int | None) -> dict[str, Any]:
    """Meses publicados do ano escolhido e o mês mais recente da série."""
    avisos: list[str] = []
    if ano is None:
        return {
            "ano_completo": None,
            "meses_com_dado": 0,
            "mes_mais_recente": None,
            "avisos": [AVISO_SEM_CARGA],
        }
    meses = ultimo_mes(ano) or 0
    recente = CreditoMunicipio.objects.aggregate(a=Max("ano"))["a"]
    mes_recente = ultimo_mes(recente) if recente else None
    if 0 < meses < 12:
        avisos.append(
            f"{ano} tem dados de janeiro a {MESES[meses - 1]}: o Banco Central publica a matriz com cerca de "
            f"um mês de defasagem. A variação compara com o mesmo período de {ano - 1}."
        )
    return {
        "ano_completo": meses == 12,
        "meses_com_dado": meses,
        "mes_mais_recente": f"{recente}-{mes_recente:02d}" if recente and mes_recente else None,
        "avisos": avisos,
    }


def _filtros_publicos(f: Filtros, anos: list[int]) -> dict[str, Any]:
    return {
        "valores": {
            "ano": f.ano,
            "municipio": _municipio_publico(f.municipio) if f.municipio else None,
            "programa": f.programa,
            "finalidade": f.finalidade,
        },
        "opcoes": {
            "anos": anos,
            "municipios": sorted(
                (_municipio_publico(m) for m in Municipio.objects.all()), key=lambda m: m["slug"]
            ),
            "programas": _opcoes(Programa),
            "finalidades": _opcoes(Finalidade),
        },
    }


def _vazio(f: Filtros, anos: list[int], **extra: Any) -> dict[str, Any]:
    return {
        "filtros": _filtros_publicos(f, anos),
        "metricas": {},
        "series": {},
        "qualidade": _qualidade(f.ano),
        "meta": _meta(),
        **extra,
    }


def _divisao(qs: QuerySet[Any], campo: str, escolhas: Any) -> list[dict[str, Any]]:
    linhas = {
        r[campo]: r
        for r in qs.values(campo).annotate(valor=Sum("valor"), contratos=Sum("contratos"))
    }
    total = sum((r["valor"] for r in linhas.values()), Decimal(0))
    saida = []
    for slug, nome in escolhas.choices:
        r = linhas.get(slug, {"valor": Decimal(0), "contratos": 0})
        saida.append(
            {
                "slug": slug,
                "nome": nome,
                "valor": float(r["valor"]),
                "contratos": r["contratos"],
                "participacao": _pct(r["valor"], total),
            }
        )
    return saida


def _decimal_br(numero: float) -> str:
    return f"{numero:.1f}".replace(".", ",")


def _brl(valor: Decimal) -> str:
    """R$ 4,41 bilhões / R$ 850,3 milhões / R$ 12,5 mil, para a manchete."""
    for div, singular, plural in (
        (Decimal(10**9), "bilhão", "bilhões"),
        (Decimal(10**6), "milhão", "milhões"),
        (Decimal(10**3), "mil", "mil"),
    ):
        if valor >= div:
            n = valor / div
            texto = f"{n:.1f}".replace(".", ",")
            return f"R$ {texto} {singular if n < 2 else plural}"
    return f"R$ {valor:.0f}"


def resumo(dados: dict[str, Any]) -> dict[str, Any]:
    f, anos = resolver_filtros(dados)
    if f.ano is None:
        return _vazio(
            f,
            anos,
            texto={
                "manchete": "Os dados do crédito rural ainda não foram carregados.",
                "como_ler": [],
            },
        )
    ate = ultimo_mes(f.ano) or 12
    sem_programa = _periodo(
        _base(CreditoMunicipio.objects.all(), f, com_programa=False), f.ano, ate
    )
    recorte = sem_programa.filter(programa=f.programa) if f.programa else sem_programa
    valor, contratos = _somas(recorte)
    total_sem_programa, _ = _somas(sem_programa)
    pronaf, _ = _somas(sem_programa.filter(programa=Programa.PRONAF))
    anterior = None
    if f.ano - 1 in anos:
        anterior, _ = _somas(_periodo(_base(CreditoMunicipio.objects.all(), f), f.ano - 1, ate))
    variacao = float((valor / anterior - 1) * 100) if anterior else None
    custeio = recorte.filter(finalidade=Finalidade.CUSTEIO).aggregate(a=Sum("area_ha"))["a"]
    metricas = {
        "valor_total": float(valor),
        "contratos": contratos,
        "valor_medio": float(valor / contratos) if contratos else None,
        "valor_pronaf": float(pronaf),
        "participacao_pronaf_pct": _pct(pronaf, total_sem_programa),
        "valor_ano_anterior": _f(anterior),
        "variacao_pct": variacao,
        "area_custeio_ha": _f(custeio),
    }
    onde = f.municipio.nome if f.municipio else "Rondônia"
    periodo = f"em {f.ano}" if ate == 12 else f"de janeiro a {MESES[ate - 1]} de {f.ano}"
    contratos_txt = f"{contratos:,}".replace(",", ".")
    manchete = (
        f"{onde} contratou {_brl(valor)} em crédito rural {periodo}, em {contratos_txt} contratos."
    )
    como_ler = []
    participacao = metricas["participacao_pronaf_pct"]
    if participacao is not None:
        como_ler.append(
            f"O Pronaf, crédito da agricultura familiar, responde por {_decimal_br(participacao)}% "
            "do valor contratado."
        )
    if variacao is not None:
        sentido = "a mais" if variacao >= 0 else "a menos"
        comparado = f"que em {f.ano - 1}" if ate == 12 else f"que no mesmo período de {f.ano - 1}"
        como_ler.append(f"São {_decimal_br(abs(variacao))}% {sentido} {comparado}.")
    return {
        "filtros": _filtros_publicos(f, anos),
        "metricas": metricas,
        "series": {
            "programas": _divisao(sem_programa, "programa", Programa),
            "finalidades": _divisao(recorte, "finalidade", Finalidade),
            "atividades": _divisao(recorte, "atividade", Atividade),
        },
        "texto": {"manchete": manchete, "como_ler": como_ler},
        "qualidade": _qualidade(f.ano),
        "meta": _meta(),
    }


def serie(dados: dict[str, Any]) -> dict[str, Any]:
    f, anos = resolver_filtros(dados)
    if f.ano is None:
        return _vazio(f, anos)
    base = _base(CreditoMunicipio.objects.all(), f)
    sem_programa = _base(CreditoMunicipio.objects.all(), f, com_programa=False)

    def por_mes(qs: QuerySet[Any], ano: int) -> dict[int, dict[str, Any]]:
        return {
            r["mes"]: r
            for r in qs.filter(ano=ano)
            .values("mes")
            .annotate(valor=Sum("valor"), contratos=Sum("contratos"))
        }

    ate = ultimo_mes(f.ano) or 0
    atual, pronaf = (
        por_mes(base, f.ano),
        por_mes(sem_programa.filter(programa=Programa.PRONAF), f.ano),
    )
    if f.programa and f.programa != Programa.PRONAF:
        pronaf = {}
    ate_anterior = ultimo_mes(f.ano - 1) if f.ano - 1 in anos else None
    anterior = por_mes(base, f.ano - 1) if ate_anterior else {}
    mensal = []
    for mes in range(1, 13):
        publicado = mes <= ate
        r = atual.get(mes, {"valor": Decimal(0), "contratos": 0})
        mensal.append(
            {
                "mes": mes,
                "valor": float(r["valor"]) if publicado else None,
                "contratos": r["contratos"] if publicado else None,
                "valor_pronaf": float(pronaf.get(mes, {"valor": Decimal(0)})["valor"])
                if publicado
                else None,
                "valor_ano_anterior": float(anterior.get(mes, {"valor": Decimal(0)})["valor"])
                if ate_anterior and mes <= ate_anterior
                else None,
            }
        )
    meses = dict(
        CreditoMunicipio.objects.values("ano").annotate(m=Max("mes")).values_list("ano", "m")
    )
    totais = {
        r["ano"]: r
        for r in base.values("ano").annotate(valor=Sum("valor"), contratos=Sum("contratos"))
    }
    pronaf_ano = dict(
        sem_programa.filter(programa=Programa.PRONAF)
        .values("ano")
        .annotate(v=Sum("valor"))
        .values_list("ano", "v")
    )
    anual = [
        {
            "ano": a,
            "valor": float(totais.get(a, {"valor": Decimal(0)})["valor"]),
            "contratos": totais.get(a, {"contratos": 0})["contratos"],
            "valor_pronaf": float(pronaf_ano.get(a, Decimal(0)))
            if f.programa in (None, Programa.PRONAF)
            else 0.0,
            "meses": meses[a],
            "completo": meses[a] == 12,
        }
        for a in anos
    ]
    return {
        "filtros": _filtros_publicos(f, anos),
        "metricas": {},
        "series": {"mensal": mensal, "anual": anual},
        "qualidade": _qualidade(f.ano),
        "meta": _meta(),
    }


def ranking(dados: dict[str, Any]) -> dict[str, Any]:
    f, anos = resolver_filtros({**dados, "municipio": None})
    if f.ano is None:
        return _vazio(f, anos)
    ate = ultimo_mes(f.ano) or 12
    qs = _periodo(_base(CreditoMunicipio.objects.all(), f), f.ano, ate)
    por = {
        r["municipio_id"]: r
        for r in qs.values("municipio_id").annotate(valor=Sum("valor"), contratos=Sum("contratos"))
    }
    total = sum((r["valor"] for r in por.values()), Decimal(0))
    itens = []
    for m in Municipio.objects.all():
        r = por.get(m.codigo_ibge, {"valor": Decimal(0), "contratos": 0})
        itens.append(
            {
                "codigo_ibge": m.codigo_ibge,
                "nome": m.nome,
                "slug": slugify(m.nome),
                "microrregiao": m.microrregiao,
                "valor": float(r["valor"]),
                "contratos": r["contratos"],
                "valor_por_contrato": float(r["valor"] / r["contratos"])
                if r["contratos"]
                else None,
                "participacao_pct": _pct(r["valor"], total),
            }
        )
    itens.sort(key=lambda i: (-i["valor"], i["slug"]))
    for posicao, item in enumerate(itens, start=1):
        item["posicao"] = posicao
    top5 = sum(i["valor"] for i in itens[:5])
    metricas = {
        "valor_total": float(total),
        "top5_pct": top5 / float(total) * 100 if total else None,
    }
    return {
        "filtros": _filtros_publicos(f, anos),
        "metricas": metricas,
        "series": {"municipios": itens},
        "qualidade": _qualidade(f.ano),
        "meta": _meta(),
    }


def por_produto(dados: dict[str, Any]) -> dict[str, Any]:
    f, anos = resolver_filtros(dados)
    if f.ano is None:
        return _vazio(f, anos)
    if f.finalidade in (Finalidade.COMERCIALIZACAO, Finalidade.INDUSTRIALIZACAO):
        resposta = _vazio(f, anos)
        resposta["qualidade"]["avisos"].append(AVISO_SEM_PRODUTO)
        return resposta
    ate = ultimo_mes(f.ano) or 12
    qs = _periodo(_base(CreditoProduto.objects.all(), f), f.ano, ate)
    linhas = list(
        qs.values("produto_slug", "atividade")
        .annotate(valor=Sum("valor"), area=Sum("area_ha"), nome=Max("produto_nome"), n=Count("id"))
        .order_by("-valor", "produto_slug")
    )
    # Um mesmo produto pode aparecer nas duas atividades (ex.: trator): soma, e fica a atividade de maior valor.
    unidos: dict[str, dict[str, Any]] = {}
    for r in linhas:
        u = unidos.setdefault(
            r["produto_slug"],
            {
                "slug": r["produto_slug"],
                "nome": r["nome"],
                "atividade": r["atividade"],
                "valor": Decimal(0),
                "area": None,
            },
        )
        u["valor"] += r["valor"]
        if r["area"]:
            u["area"] = (u["area"] or Decimal(0)) + r["area"]
    ordenados = sorted(unidos.values(), key=lambda u: (-u["valor"], u["slug"]))
    total = sum((u["valor"] for u in ordenados), Decimal(0))
    visiveis, resto = ordenados[:LIMITE_PRODUTOS], ordenados[LIMITE_PRODUTOS:]
    produtos = [
        {
            "slug": u["slug"],
            "nome": u["nome"],
            "atividade": u["atividade"],
            "valor": float(u["valor"]),
            "participacao_pct": _pct(u["valor"], total),
            "area_ha": _f(u["area"]),
        }
        for u in visiveis
    ]
    if resto:
        valor_resto = sum((u["valor"] for u in resto), Decimal(0))
        produtos.append(
            {
                "slug": "demais",
                "nome": f"Demais produtos ({len(resto)})",
                "atividade": None,
                "valor": float(valor_resto),
                "participacao_pct": _pct(valor_resto, total),
                "area_ha": None,
            }
        )
    return {
        "filtros": _filtros_publicos(f, anos),
        "metricas": {"valor_total": float(total), "produtos": len(ordenados)},
        "series": {"produtos": produtos} if produtos else {},
        "qualidade": _qualidade(f.ano),
        "meta": _meta(),
    }
