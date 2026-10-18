"""Quais anos do SICOR atualizar e quando. Regras puras, sem relógio nem banco."""

from datetime import timedelta

# Início da série do painel. O SICOR v2 tem dados desde 2013; 2018 cobre os Planos Safra recentes.
ANO_INICIAL = 2018
# O BCB atualiza a matriz uma vez por mês, sem data fixa: uma verificação por dia basta.
INTERVALO = timedelta(days=1)


def anos_da_rodada(ano_atual: int, anos_com_sucesso: set[int]) -> list[int]:
    """Os dois últimos anos (o BCB ainda revisa o ano anterior) e todo ano da série que nunca carregou."""
    pendentes = [a for a in range(ANO_INICIAL, ano_atual - 1) if a not in anos_com_sucesso]
    return [*pendentes, ano_atual - 1, ano_atual]
