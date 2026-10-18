import logging
import time
from typing import Any

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from credito.carga import atualizar_credito
from credito.sicor import SicorCliente
from ingestao.agendador import precisa_ingerir
from ingestao.models import Carga
from ingestao.servico import CargaFalhou, executar_carga
from ingestao.servico_indice import executar_carga_ipca
from ingestao.sidra import SidraCliente
from ingestao.tabelas import TABELA_IPCA, TABELAS
from zetele.expurgo import expurgar_perguntas

log = logging.getLogger(__name__)
VERIFICACAO_A_CADA = 3600  # segundos


def rodar_ciclo(cliente: SidraCliente) -> int:
    """Uma passada por todas as tabelas. Retorna quantas cargas foram tentadas."""
    tentadas = 0
    for tabela in sorted([*TABELAS, TABELA_IPCA]):
        agora = timezone.now()
        concluida = (
            Carga.objects.filter(
                tabela=tabela, status__in=[Carga.Status.SUCESSO, Carga.Status.INALTERADA]
            )
            .order_by("-concluida_em")
            .values_list("concluida_em", flat=True)
            .first()
        )
        tentativa = (
            Carga.objects.filter(tabela=tabela)
            .order_by("-iniciada_em")
            .values_list("iniciada_em", flat=True)
            .first()
        )
        if not precisa_ingerir(agora, concluida, tentativa):
            continue
        tentadas += 1
        try:
            carga = (
                executar_carga_ipca(cliente)
                if tabela == TABELA_IPCA
                else executar_carga(tabela, cliente)
            )
            log.info("scheduler: tabela %s -> %s", tabela, carga.status)
        except CargaFalhou as exc:
            log.error("scheduler: tabela %s falhou: %s", tabela, exc)
    try:
        apagadas = expurgar_perguntas()
        if apagadas:
            log.info("scheduler: %s perguntas do Zétele expurgadas (90 dias)", apagadas)
    except Exception:
        # o expurgo não pode derrubar a ingestão; a próxima passada tenta de novo
        log.exception("scheduler: expurgo do Zétele falhou")
    return tentadas


def rodar_ciclo_credito(cliente: SicorCliente) -> int:
    """Atualiza o crédito rural; uma falha aqui nunca derruba a ingestão do IBGE."""
    try:
        return atualizar_credito(cliente, timezone.now())
    except Exception:
        log.exception("scheduler: atualização do crédito rural falhou")
        return 0


class Command(BaseCommand):
    help = (
        "Roda a ingestão ao subir (se a última carga tem mais de 3 dias) e depois a cada 3 dias; "
        "o crédito rural (SICOR) é conferido uma vez por dia."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--uma-vez", action="store_true", help="faz só uma passada e sai")

    def handle(self, *args: Any, **opts: Any) -> None:
        cliente = SidraCliente()
        sicor = SicorCliente()
        while True:
            close_old_connections()
            # O crédito vem antes: num servidor novo a série completa leva poucos minutos (ADR 0036).
            rodar_ciclo_credito(sicor)
            rodar_ciclo(cliente)
            if opts["uma_vez"]:
                return
            time.sleep(VERIFICACAO_A_CADA)
