from typing import Any

import pytest

from indicadores.models import Produto
from zetele.canais import PUBLICO, SISTEMA
from zetele.prompt import (
    PERSONA_PUBLICO,
    PERSONA_SISTEMA,
    catalogo_texto,
    contexto,
    montar_system,
    system_atual,
)


def test_persona_publica_proibe_numero_sem_ferramenta_e_pede_json() -> None:
    assert "Zétele" in PERSONA_PUBLICO
    assert "use as ferramentas" in PERSONA_PUBLICO
    assert "tipo" in PERSONA_PUBLICO and "sugestoes" in PERSONA_PUBLICO


def test_persona_do_sistema_explica_o_uso_responde_o_agro_e_nao_ve_os_dados() -> None:
    assert "sistema interno" in PERSONA_SISTEMA
    assert "não vê os dados da pessoa" in PERSONA_SISTEMA
    # agora responde também números do agro, sempre pelas ferramentas (pedido de 18/10/2026)
    assert "ferramentas" in PERSONA_SISTEMA and "_formatado" in PERSONA_SISTEMA
    assert "tipo" in PERSONA_SISTEMA and "sugestoes" in PERSONA_SISTEMA


def test_system_poe_o_breakpoint_de_cache_no_ultimo_bloco() -> None:
    blocos = montar_system(PERSONA_PUBLICO, "catálogo")
    assert [("cache_control" in b) for b in blocos] == [False, True]
    assert blocos[0]["text"] == PERSONA_PUBLICO
    so_persona = montar_system(PERSONA_SISTEMA, None)
    assert len(so_persona) == 1 and "cache_control" in so_persona[0]


def test_contexto_marca_os_trechos_recuperados() -> None:
    texto = contexto(
        [{"id": "a#0", "fonte": "a.md", "titulo": "Painel", "rota": "/painel", "texto": "Ranking"}]
    )
    assert texto == "<base_de_conhecimento>\n## Painel (/painel)\nRanking\n</base_de_conhecimento>"


@pytest.mark.django_db
def test_catalogo_lista_slugs_em_ordem_fixa(dados_soja: Produto) -> None:
    texto = catalogo_texto()
    assert "soja-em-grao" in texto
    assert "quantidade-produzida" in texto
    assert "1100023 Ariquemes" in texto
    assert texto == catalogo_texto()


@pytest.mark.django_db
def test_system_e_identico_byte_a_byte_entre_montagens(dados_soja: Produto) -> None:
    """Qualquer byte diferente invalida o cache do prompt; nada da base vai no system."""
    a: list[dict[str, Any]] = system_atual(PUBLICO)
    b: list[dict[str, Any]] = system_atual(PUBLICO)
    assert a == b
    assert "Catálogo de dados" in a[-1]["text"]
    sistema = system_atual(SISTEMA)
    assert sistema == system_atual(SISTEMA)
    assert sistema[0]["text"] == PERSONA_SISTEMA
    assert "Catálogo de dados" in sistema[-1]["text"]
