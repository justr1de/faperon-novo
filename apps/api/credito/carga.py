"""Carga do SICOR: buscar → traduzir (parser) → upsert idempotente do ano → registrar a carga.

A carga é por ano de emissão. Tudo do ano entra numa transação: se qualquer recurso falhar, os dados
anteriores ficam como estavam e a falha fica registrada em `carga_credito`.
"""

import logging
from datetime import datetime
from typing import Any, Protocol

from django.db import transaction
from django.utils import timezone

from credito.agendador import INTERVALO, anos_da_rodada
from credito.models import CargaCredito, CreditoMunicipio, CreditoProduto
from credito.parser import agregar_municipios, agregar_produtos, mapa_bcb_para_ibge
from indicadores.models import Municipio
from ingestao.agendador import precisa_ingerir

log = logging.getLogger(__name__)
LOTE = 5000
CAMPOS_CHAVE = ["municipio", "ano", "mes", "programa", "finalidade", "atividade"]


class ClienteSicor(Protocol):
    def dados(self, recurso: str, ano: int) -> list[dict[str, Any]]: ...


class CargaCreditoFalhou(Exception):
    pass


def _gravar(carga: CargaCredito, ano: int, linhas: list[Any], produtos: list[Any]) -> None:
    CreditoMunicipio.objects.bulk_create(
        linhas,
        batch_size=LOTE,
        update_conflicts=True,
        unique_fields=CAMPOS_CHAVE,
        update_fields=["contratos", "valor", "area_ha", "carga"],
    )
    CreditoProduto.objects.bulk_create(
        produtos,
        batch_size=LOTE,
        update_conflicts=True,
        unique_fields=[*CAMPOS_CHAVE, "produto_slug"],
        update_fields=["produto_nome", "valor", "area_ha", "carga"],
    )
    # O que a fonte deixou de publicar no ano (revisões do BCB) sai; os outros anos ficam intactos.
    CreditoMunicipio.objects.filter(ano=ano).exclude(carga=carga).delete()
    CreditoProduto.objects.filter(ano=ano).exclude(carga=carga).delete()


def executar_carga_ano(ano: int, cliente: ClienteSicor) -> CargaCredito:
    carga = CargaCredito.objects.create(ano=ano, iniciada_em=timezone.now())
    try:
        cadastrados = set(Municipio.objects.values_list("codigo_ibge", flat=True))
        if not cadastrados:
            raise CargaCreditoFalhou(
                "O cadastro de municípios está vazio; rode o seed ou a ingestão do IBGE antes"
            )
        brutas = cliente.dados("municipio", ano)
        custeio = cliente.dados("custeio", ano)
        investimento = cliente.dados("investimento", ano)
        totais = agregar_municipios(brutas)
        por_produto, sem_municipio = agregar_produtos(
            custeio, investimento, mapa_bcb_para_ibge(brutas)
        )
        if sem_municipio:
            log.warning(
                "SICOR %s: %s linhas de investimento sem município conhecido", ano, sem_municipio
            )
        fora = {k[0] for k in totais if k[0] not in cadastrados} | {
            k[0] for k in por_produto if k[0] not in cadastrados
        }
        if fora:
            log.warning("SICOR %s: municípios fora do cadastro descartados: %s", ano, sorted(fora))
        linhas = [
            CreditoMunicipio(
                municipio_id=k[0],
                ano=k[1],
                mes=k[2],
                programa=k[3],
                finalidade=k[4],
                atividade=k[5],
                contratos=m.contratos,
                valor=m.valor,
                area_ha=m.area_ha,
                carga=carga,
            )
            for k, m in totais.items()
            if k[0] in cadastrados and k[1] == ano
        ]
        produtos = [
            CreditoProduto(
                municipio_id=k[0],
                ano=k[1],
                mes=k[2],
                programa=k[3],
                finalidade=k[4],
                atividade=k[5],
                produto_slug=k[6],
                produto_nome=p.nome,
                valor=p.valor,
                area_ha=p.area_ha,
                carga=carga,
            )
            for k, p in por_produto.items()
            if k[0] in cadastrados and k[1] == ano
        ]
        if not linhas and CreditoMunicipio.objects.filter(ano=ano).exists():
            raise CargaCreditoFalhou(
                f"O SICOR não devolveu nenhuma linha de {ano}, que já tinha dados"
            )
        with transaction.atomic():
            _gravar(carga, ano, linhas, produtos)
            # A baixa de SUCESSO fica na transação: se o save falhar, a gravação é revertida.
            carga.status = CargaCredito.Status.SUCESSO
            carga.linhas = len(linhas)
            carga.linhas_produtos = len(produtos)
            carga.concluida_em = timezone.now()
            carga.save()
        log.info("SICOR %s: %s linhas, %s de produtos", ano, carga.linhas, carga.linhas_produtos)
        return carga
    except Exception as exc:
        carga.status = CargaCredito.Status.FALHA
        carga.erro = str(exc)[:2000]
        carga.concluida_em = timezone.now()
        try:
            carga.save()
        except Exception:  # banco fora do ar: o erro original ainda precisa chegar ao chamador
            log.exception("SICOR %s: não foi possível registrar a falha da carga %s", ano, carga.pk)
        log.error("SICOR %s: carga %s falhou: %s", ano, carga.pk, exc)
        if isinstance(exc, CargaCreditoFalhou):
            raise
        raise CargaCreditoFalhou(str(exc)) from exc


def atualizar_credito(cliente: ClienteSicor, agora: datetime) -> int:
    """Uma passada do agendador. Retorna quantos anos foram tentados."""
    concluida = (
        CargaCredito.objects.filter(status=CargaCredito.Status.SUCESSO)
        .order_by("-concluida_em")
        .values_list("concluida_em", flat=True)
        .first()
    )
    tentativa = (
        CargaCredito.objects.order_by("-iniciada_em").values_list("iniciada_em", flat=True).first()
    )
    if not precisa_ingerir(agora, concluida, tentativa, INTERVALO):
        return 0
    com_sucesso = set(
        CargaCredito.objects.filter(status=CargaCredito.Status.SUCESSO).values_list(
            "ano", flat=True
        )
    )
    anos = anos_da_rodada(timezone.localtime(agora).year, com_sucesso)
    for ano in anos:
        try:
            executar_carga_ano(ano, cliente)
        except CargaCreditoFalhou as exc:
            log.error("scheduler: crédito %s falhou: %s", ano, exc)
    return len(anos)
