"""Os dois Zétele: o do site público e o da área do sistema (ADR 0032).

Cada canal tem páginas, base de conhecimento (RAG), tabela de perguntas, limite diário e limites por
minuto próprios. O modelo, a chave da Anthropic e o disjuntor são compartilhados.
"""

from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class Canal:
    nome: str
    paginas: tuple[str, ...]
    # páginas sem ferramentas de dados: o Zétele só orienta
    so_orientacao: frozenset[str]
    # nome do ajuste em settings com o teto diário de chamadas ao modelo
    ajuste_limite: str

    @property
    def limite_diario(self) -> int:
        return int(getattr(settings, self.ajuste_limite))


PUBLICO = Canal(
    nome="publico",
    paginas=(
        "/",
        "/central-de-inteligencia",
        "/central-de-inteligencia/observatorio",
        "/painel",
        "/credito-rural",
    ),
    so_orientacao=frozenset({"/"}),
    ajuste_limite="ZETELE_LIMITE_DIARIO",
)

PAGINAS_DO_SISTEMA = (
    "/sistema",
    "/sistema/agenda",
    "/sistema/frotas",
    "/sistema/espacos",
    "/sistema/contas",
    "/sistema/relatorios",
    "/sistema/atividades",
    "/sistema/indicadores",
    "/sistema/usuarios",
)
SISTEMA = Canal(
    nome="sistema",
    paginas=PAGINAS_DO_SISTEMA,
    # explica o uso do sistema e responde números do agro pelas ferramentas (pedido de 18/10/2026);
    # os dados da pessoa (eventos, reservas) ainda ficam no navegador dela
    so_orientacao=frozenset(),
    ajuste_limite="ZETELE_SISTEMA_LIMITE_DIARIO",
)

CANAIS = {c.nome: c for c in (PUBLICO, SISTEMA)}
