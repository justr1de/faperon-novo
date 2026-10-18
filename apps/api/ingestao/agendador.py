"""Decide quando rodar a ingestão. Regra pura, testável sem relógio nem banco de dados real."""

from datetime import datetime, timedelta

INTERVALO_CARGA = timedelta(days=3)
ESPERA_APOS_TENTATIVA = timedelta(hours=6)


def precisa_ingerir(
    agora: datetime,
    ultima_concluida: datetime | None,
    ultima_tentativa: datetime | None,
    intervalo: timedelta = INTERVALO_CARGA,
) -> bool:
    """Roda se a última carga bem-sucedida (ou inalterada) tem mais de `intervalo` (3 dias no IBGE).

    Depois de qualquer tentativa (mesmo falha), espera 6 h para não martelar o IBGE.
    """
    if ultima_tentativa is not None and agora - ultima_tentativa < ESPERA_APOS_TENTATIVA:
        return False
    return ultima_concluida is None or agora - ultima_concluida >= intervalo
