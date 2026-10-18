"""Rotas /api/v1/credito/*: resumo, série, ranking e produtos do crédito rural."""

from decimal import Decimal
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from credito.models import CargaCredito, CreditoMunicipio, CreditoProduto
from indicadores.models import Municipio

JIPA, CACOAL, VILHENA = "1100122", "1100049", "1100304"


@pytest.fixture
def credito(db: None) -> CargaCredito:
    """2025 completo e 2026 de janeiro a setembro, em três municípios (Vilhena sem contratos em 2026)."""
    for codigo, nome, micro in (
        (JIPA, "Ji-Paraná", "Ji-Paraná"),
        (CACOAL, "Cacoal", "Cacoal"),
        (VILHENA, "Vilhena", "Vilhena"),
    ):
        Municipio.objects.create(codigo_ibge=codigo, nome=nome, microrregiao=micro)
    agora = timezone.now()
    carga = CargaCredito.objects.create(
        ano=2026, iniciada_em=agora, concluida_em=agora, status=CargaCredito.Status.SUCESSO
    )

    def fato(cod: str, ano: int, mes: int, prog: str, fin: str, ativ: str, n: int, v: str) -> None:
        CreditoMunicipio.objects.create(
            municipio_id=cod,
            ano=ano,
            mes=mes,
            programa=prog,
            finalidade=fin,
            atividade=ativ,
            contratos=n,
            valor=Decimal(v),
            area_ha=Decimal("10") if fin == "custeio" else None,
            carga=carga,
        )

    for mes in range(1, 13):
        fato(JIPA, 2025, mes, "pronaf", "custeio", "pecuaria", 2, "100")
        fato(JIPA, 2025, mes, "demais", "investimento", "agricola", 1, "300")
        fato(VILHENA, 2025, mes, "demais", "custeio", "agricola", 1, "1000")
    for mes in range(1, 10):
        fato(JIPA, 2026, mes, "pronaf", "custeio", "pecuaria", 3, "150")
        fato(JIPA, 2026, mes, "demais", "investimento", "agricola", 1, "300")
        fato(CACOAL, 2026, mes, "pronamp", "comercializacao", "agricola", 1, "50")

    def produto(cod: str, mes: int, fin: str, ativ: str, slug: str, nome: str, v: str) -> None:
        CreditoProduto.objects.create(
            municipio_id=cod,
            ano=2026,
            mes=mes,
            programa="pronaf",
            finalidade=fin,
            atividade=ativ,
            produto_slug=slug,
            produto_nome=nome,
            valor=Decimal(v),
            area_ha=None,
            carga=carga,
        )

    produto(JIPA, 1, "custeio", "pecuaria", "bovinos", "Bovinos", "1000")
    produto(JIPA, 2, "custeio", "agricola", "cafe", "Café", "400")
    produto(CACOAL, 2, "investimento", "agricola", "trator", "Trator", "100")
    return carga


def _get(api: APIClient, rota: str, **params: Any) -> Any:
    resposta = api.get(f"/api/v1/credito/{rota}", params)
    assert resposta.status_code == 200, resposta.content
    return resposta.json()


def test_resumo_padrao_usa_o_ultimo_ano_e_compara_os_mesmos_meses(
    api: APIClient, credito: CargaCredito
) -> None:
    d = _get(api, "resumo")
    assert d["filtros"]["valores"] == {
        "ano": 2026,
        "municipio": None,
        "programa": None,
        "finalidade": None,
    }
    assert d["filtros"]["opcoes"]["anos"] == [2025, 2026]
    assert [p["slug"] for p in d["filtros"]["opcoes"]["programas"]] == [
        "pronaf",
        "pronamp",
        "demais",
    ]
    assert [m["slug"] for m in d["filtros"]["opcoes"]["municipios"]] == [
        "cacoal",
        "ji-parana",
        "vilhena",
    ]
    m = d["metricas"]
    # 2026: 9 meses x (150 + 300 + 50)
    assert m["valor_total"] == 4500.0
    assert m["contratos"] == 9 * 5
    assert m["valor_medio"] == 100.0
    assert m["valor_pronaf"] == 1350.0
    assert m["participacao_pronaf_pct"] == 30.0
    # jan–set de 2025: 9 x (100 + 300 + 1000) = 12.600
    assert m["valor_ano_anterior"] == 12600.0
    assert m["variacao_pct"] == pytest.approx((4500 / 12600 - 1) * 100)
    q = d["qualidade"]
    assert q["ano_completo"] is False and q["meses_com_dado"] == 9
    assert q["mes_mais_recente"] == "2026-09"
    assert any("janeiro a setembro" in a for a in q["avisos"])
    assert (
        d["meta"]["fontes"][0]["fonte"]
        == "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)"
    )
    assert d["meta"]["fontes"][0]["licenca"] == "ODbL"
    assert d["meta"]["atualizado_em"] is not None
    assert d["texto"]["manchete"]


def test_resumo_traz_a_divisao_por_programa_finalidade_e_atividade(
    api: APIClient, credito: CargaCredito
) -> None:
    s = _get(api, "resumo")["series"]
    programas = {p["slug"]: p for p in s["programas"]}
    assert programas["pronaf"]["valor"] == 1350.0 and programas["pronaf"]["contratos"] == 27
    assert programas["pronamp"]["valor"] == 450.0
    assert programas["demais"]["participacao"] == pytest.approx(60.0)
    assert {f["slug"] for f in s["finalidades"]} == {
        "custeio",
        "investimento",
        "comercializacao",
        "industrializacao",
    }
    assert next(f for f in s["finalidades"] if f["slug"] == "industrializacao")["valor"] == 0.0
    assert {a["slug"]: a["valor"] for a in s["atividades"]} == {
        "agricola": 3150.0,
        "pecuaria": 1350.0,
    }


def test_ano_completo_compara_o_ano_inteiro_e_sem_ano_anterior_a_variacao_e_nula(
    api: APIClient, credito: CargaCredito
) -> None:
    d = _get(api, "resumo", ano=2025)
    assert d["qualidade"]["ano_completo"] is True and d["qualidade"]["meses_com_dado"] == 12
    assert d["metricas"]["valor_total"] == 12 * 1400.0
    assert d["metricas"]["variacao_pct"] is None  # 2024 não foi carregado
    assert d["metricas"]["valor_ano_anterior"] is None
    assert not any("janeiro a" in a for a in d["qualidade"]["avisos"])


def test_filtros_de_municipio_programa_e_finalidade(api: APIClient, credito: CargaCredito) -> None:
    d = _get(api, "resumo", municipio="ji-parana", programa="pronaf")
    assert d["filtros"]["valores"]["municipio"] == {
        "codigo_ibge": JIPA,
        "nome": "Ji-Paraná",
        "slug": "ji-parana",
    }
    assert d["metricas"]["valor_total"] == 1350.0
    # a participação do Pronaf é sempre no total do recorte, sem o filtro de programa: 1.350 / (1.350 + 2.700)
    assert d["metricas"]["participacao_pronaf_pct"] == pytest.approx(1350 / 4050 * 100)
    assert _get(api, "resumo", municipio=JIPA)["metricas"]["valor_total"] == 4050.0
    d = _get(api, "resumo", finalidade="comercializacao")
    assert d["metricas"]["valor_total"] == 450.0 and d["metricas"]["participacao_pronaf_pct"] == 0.0


def test_municipio_sem_contratos_no_periodo_tem_zero_e_valor_medio_nulo(
    api: APIClient, credito: CargaCredito
) -> None:
    m = _get(api, "resumo", municipio=VILHENA)["metricas"]
    assert m["valor_total"] == 0.0 and m["contratos"] == 0
    assert m["valor_medio"] is None and m["participacao_pronaf_pct"] is None
    assert m["variacao_pct"] == -100.0


def test_serie_mensal_tem_nulo_depois_do_ultimo_mes_publicado(
    api: APIClient, credito: CargaCredito
) -> None:
    d = _get(api, "serie", municipio=JIPA)
    mensal = d["series"]["mensal"]
    assert [p["mes"] for p in mensal] == list(range(1, 13))
    assert mensal[0] == {
        "mes": 1,
        "valor": 450.0,
        "contratos": 4,
        "valor_pronaf": 150.0,
        "valor_ano_anterior": 400.0,
    }
    assert mensal[9] == {
        "mes": 10,
        "valor": None,
        "contratos": None,
        "valor_pronaf": None,
        "valor_ano_anterior": 400.0,
    }
    anual = {p["ano"]: p for p in d["series"]["anual"]}
    assert anual[2025] == {
        "ano": 2025,
        "valor": 4800.0,
        "contratos": 36,
        "valor_pronaf": 1200.0,
        "meses": 12,
        "completo": True,
    }
    assert anual[2026]["completo"] is False and anual[2026]["meses"] == 9


def test_ranking_tem_todos_os_municipios_e_valor_por_contrato(
    api: APIClient, credito: CargaCredito
) -> None:
    d = _get(api, "ranking")
    itens = d["series"]["municipios"]
    assert [i["codigo_ibge"] for i in itens] == [JIPA, CACOAL, VILHENA]
    assert itens[0]["posicao"] == 1 and itens[0]["valor"] == 4050.0 and itens[0]["contratos"] == 36
    assert itens[0]["valor_por_contrato"] == pytest.approx(4050 / 36)
    assert itens[0]["participacao_pct"] == pytest.approx(90.0)
    assert itens[0]["microrregiao"] == "Ji-Paraná"
    assert (itens[2]["valor"], itens[2]["contratos"], itens[2]["valor_por_contrato"]) == (
        0.0,
        0,
        None,
    )
    assert itens[2]["posicao"] == 3
    assert d["metricas"]["valor_total"] == 4500.0
    assert (
        _get(api, "ranking", programa="pronamp")["series"]["municipios"][0]["codigo_ibge"] == CACOAL
    )


def test_por_produto_e_por_atividade(api: APIClient, credito: CargaCredito) -> None:
    d = _get(api, "por-produto")
    produtos = d["series"]["produtos"]
    assert [p["slug"] for p in produtos] == ["bovinos", "cafe", "trator"]
    assert produtos[0] == {
        "slug": "bovinos",
        "nome": "Bovinos",
        "atividade": "pecuaria",
        "valor": 1000.0,
        "participacao_pct": pytest.approx(1000 / 1500 * 100),
        "area_ha": None,
    }
    assert (
        _get(api, "por-produto", finalidade="investimento")["series"]["produtos"][0]["slug"]
        == "trator"
    )
    assert _get(api, "por-produto", municipio=CACOAL)["series"]["produtos"][0]["slug"] == "trator"


def test_comercializacao_nao_tem_detalhe_por_produto(api: APIClient, credito: CargaCredito) -> None:
    d = _get(api, "por-produto", finalidade="comercializacao")
    assert d["series"] == {}
    assert any("por produto" in a for a in d["qualidade"]["avisos"])


def test_produtos_alem_do_limite_viram_demais(api: APIClient, credito: CargaCredito) -> None:
    for n in range(20):
        CreditoProduto.objects.create(
            municipio_id=JIPA,
            ano=2026,
            mes=3,
            programa="demais",
            finalidade="custeio",
            atividade="agricola",
            produto_slug=f"p{n:02d}",
            produto_nome=f"P{n:02d}",
            valor=Decimal(1),
            carga=credito,
        )
    produtos = _get(api, "por-produto")["series"]["produtos"]
    assert len(produtos) == 13
    assert produtos[-1]["slug"] == "demais" and produtos[-1]["valor"] == 11.0


@pytest.mark.parametrize(
    ("rota", "params", "campo"),
    [
        ("resumo", {"ano": 2019}, "ano"),
        ("resumo", {"ano": "x"}, "ano"),
        ("serie", {"programa": "funcafe"}, "programa"),
        ("ranking", {"finalidade": "seguro"}, "finalidade"),
        ("por-produto", {"ano": 1990}, "ano"),
    ],
)
def test_parametro_invalido_e_400(
    api: APIClient, credito: CargaCredito, rota: str, params: dict[str, Any], campo: str
) -> None:
    resposta = api.get(f"/api/v1/credito/{rota}", params)
    assert resposta.status_code == 400
    assert campo in resposta.json()["campos"]


def test_ano_sem_dado_diz_o_intervalo(api: APIClient, credito: CargaCredito) -> None:
    resposta = api.get("/api/v1/credito/resumo", {"ano": 2019})
    assert resposta.json()["campos"]["ano"] == "use um ano entre 2025 e 2026"


def test_municipio_inexistente_e_404(api: APIClient, credito: CargaCredito) -> None:
    resposta = api.get("/api/v1/credito/resumo", {"municipio": "atlantida"})
    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Município 'atlantida' não existe", "campos": {}}


@pytest.mark.django_db
def test_sem_carga_ainda_responde_200_com_aviso(api: APIClient) -> None:
    for rota in ("resumo", "serie", "ranking", "por-produto"):
        d = _get(api, rota)
        assert d["metricas"] == {} and d["series"] == {}
        assert d["filtros"]["valores"]["ano"] is None
        assert any("ainda não foram carregados" in a for a in d["qualidade"]["avisos"])


def test_schema_openapi_sem_nomes_duplicados(api: APIClient, credito: CargaCredito) -> None:
    resposta = api.get("/api/schema/")
    assert resposta.status_code == 200
    texto = resposta.content.decode()
    assert "/api/v1/credito/resumo" in texto and "/api/v1/credito/por-produto" in texto
