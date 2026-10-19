"""Markdown do Zétele -> formatação do WhatsApp, e divisão em mensagens de até 1.600 caracteres."""

from whatsapp.formatacao import LIMITE, dividir, para_whatsapp

SITE = "https://exemplo.sslip.io"


def test_negrito_e_italico() -> None:
    assert para_whatsapp("um **forte** e __outro__", SITE) == "um *forte* e *outro*"
    assert para_whatsapp("um *leve* aqui", SITE) == "um _leve_ aqui"


def test_titulo_vira_negrito() -> None:
    assert para_whatsapp("## Frotas\nTexto", SITE) == "*Frotas*\nTexto"


def test_links_ficam_por_extenso_e_absolutos() -> None:
    assert para_whatsapp("Abra [Frotas](/sistema/frotas).", SITE) == (
        "Abra Frotas: https://exemplo.sslip.io/sistema/frotas."
    )
    assert para_whatsapp("[site](https://faperon.org.br)", SITE) == "site: https://faperon.org.br"


def test_lista_com_asterisco_vira_hifen() -> None:
    assert para_whatsapp("* um\n* dois", SITE) == "- um\n- dois"
    assert para_whatsapp("- um\n- dois", SITE) == "- um\n- dois"


def test_tabela_vira_linhas_coluna_valor() -> None:
    tabela = "| Veículo | Placa |\n|---|---|\n| Hilux | ABC1D23 |\n| Strada | XYZ9K87 |"
    assert (
        para_whatsapp(tabela, SITE)
        == "Veículo: Hilux; Placa: ABC1D23\nVeículo: Strada; Placa: XYZ9K87"
    )


def test_texto_curto_nao_divide() -> None:
    assert dividir("Olá") == ["Olá"]


def test_divide_no_paragrafo() -> None:
    a, b = "a" * 1000, "b" * 1000
    assert dividir(f"{a}\n\n{b}") == [a, b]


def test_divide_na_frase_e_nunca_passa_do_limite() -> None:
    frase = "Esta é uma frase de teste. "
    partes = dividir(frase * 200)
    assert len(partes) > 1
    assert all(len(p) <= LIMITE for p in partes)
    assert all(p.endswith(".") for p in partes)
    assert " ".join(partes).split() == (frase * 200).split()


def test_palavra_gigante_corta_no_limite() -> None:
    partes = dividir("x" * 3500)
    assert [len(p) for p in partes] == [1600, 1600, 300]
