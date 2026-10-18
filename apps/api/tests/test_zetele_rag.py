from zetele.rag import PASTA_CONHECIMENTO, recuperador_do_canal
from zetele.rag.documentos import carregar, fatiar, ler_secoes
from zetele.rag.indice import IndiceBM25, tokenizar
from zetele.rag.recuperador import RecuperadorLexico


def test_le_secoes_com_rota_e_sem_rota() -> None:
    trechos = ler_secoes("## [/painel] Painel\nTexto A\n\n## [-] Geral\nTexto B\n", fonte="x.md")
    assert trechos == [
        {
            "id": "x.md#0",
            "fonte": "x.md",
            "titulo": "Painel",
            "rota": "/painel",
            "texto": "Texto A",
        },
        {"id": "x.md#1", "fonte": "x.md", "titulo": "Geral", "rota": None, "texto": "Texto B"},
    ]


def test_fatia_secao_longa_sem_cortar_item_e_mantem_titulo_e_rota() -> None:
    itens = "\n".join(f"- Item {i}: " + "texto " * 30 for i in range(8))
    secao = ler_secoes(f"## [/sistema/frotas] Frotas\n{itens}\n", fonte="f.md")[0]
    fatias = fatiar(secao, limite=500)
    assert len(fatias) > 1
    assert all(f["rota"] == "/sistema/frotas" and f["titulo"] == "Frotas" for f in fatias)
    assert all(len(f["texto"]) <= 500 for f in fatias)
    assert "".join(f["texto"] for f in fatias).count("- Item") == 8
    assert len({f["id"] for f in fatias}) == len(fatias)


def test_tokenizar_ignora_acento_caixa_plural_e_palavras_vazias() -> None:
    assert tokenizar("Como faço as Reservas do veículo?") == ["reserva", "veiculo"]
    assert tokenizar("devoluções") == tokenizar("devolução")


def test_bm25_prefere_o_trecho_do_assunto() -> None:
    trechos = ler_secoes(
        "## [/a] Reservas\nComo reservar um veículo da frota.\n\n"
        "## [/b] Despesas\nComo lançar uma despesa com comprovante.\n\n"
        "## [/c] Espaços\nPedido do auditório e coffee break.\n",
        fonte="t.md",
    )
    ranking = IndiceBM25(trechos).pontuar("onde lanço o comprovante da despesa")
    assert ranking[0][1]["titulo"] == "Despesas"
    assert IndiceBM25(trechos).pontuar("xyz inexistente") == []


def test_recuperador_poe_a_pagina_atual_primeiro_e_respeita_o_limite() -> None:
    trechos = ler_secoes(
        "## [-] Geral\nSobre o assistente.\n\n## [/x] Página X\nTexto de X.\n\n"
        "## [/y] Despesas\nLançar despesa.\n",
        fonte="t.md",
    )
    r = RecuperadorLexico(trechos)
    assert [t["titulo"] for t in r.buscar("despesa", "/x", 2)] == ["Página X", "Despesas"]
    assert [t["titulo"] for t in r.buscar("despesa", "/z", 1)] == ["Despesas"]
    # sem acerto nenhum, vão os trechos gerais
    assert [t["titulo"] for t in r.buscar("qwerty", "/z", 3)] == ["Geral"]


def test_bases_dos_canais_sao_separadas() -> None:
    publico = carregar(PASTA_CONHECIMENTO / "publico")
    sistema = carregar(PASTA_CONHECIMENTO / "sistema")
    rotas_publico = {t["rota"] for t in publico}
    rotas_sistema = {t["rota"] for t in sistema}
    assert {
        "/",
        "/painel",
        "/central-de-inteligencia",
        "/central-de-inteligencia/observatorio",
        "/credito-rural",
    } <= rotas_publico
    assert not any((r or "").startswith("/sistema") for r in rotas_publico)
    assert {
        "/sistema",
        "/sistema/agenda",
        "/sistema/espacos",
        "/sistema/atividades",
        "/sistema/indicadores",
    } <= rotas_sistema
    assert rotas_sistema - {None} <= {r for r in rotas_sistema if (r or "").startswith("/sistema")}
    assert "(69) 3214-8371" in recuperador_do_canal("publico").texto_completo()


def test_recuperador_real_do_sistema_acha_o_modulo_certo() -> None:
    r = recuperador_do_canal("sistema")
    achados = r.buscar("como devolvo um pedido de espaço com conflito?", "/sistema", 4)
    assert any(t["rota"] == "/sistema/espacos" for t in achados)
    achados = r.buscar("onde lanço a nota fiscal de uma despesa", "/sistema/agenda", 4)
    assert any(t["rota"] == "/sistema/contas" for t in achados)
