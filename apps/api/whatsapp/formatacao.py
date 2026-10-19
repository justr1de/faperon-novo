"""O Zétele responde em markdown (o do site); o WhatsApp tem a própria marcação e não abre link
relativo. Aqui o texto vira o que o WhatsApp mostra direito, em pedaços de até 1.600 caracteres
(o limite do Twilio por mensagem)."""

import re

LIMITE = 1600

_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
_NEGRITO = re.compile(r"\*\*(.+?)\*\*|__(.+?)__")
_ITALICO = re.compile(r"(?<![\*\w])\*(?!\s)(.+?)(?<!\s)\*(?![\*\w])")
_TITULO = re.compile(r"^#{1,6}\s+(.+?)\s*#*$", re.M)
_ITEM = re.compile(r"^(\s*)\*\s+", re.M)
_SEPARADOR = re.compile(r"^\|?\s*:?-{3,}")
_FIM_DE_FRASE = re.compile(r"[.!?…](?=\s)")
# marca provisória do negrito, para o itálico (asterisco simples) não pegá-lo
_N = "\x00"


def _link(m: re.Match[str], site_url: str) -> str:
    texto, url = m[1], m[2]
    if url.startswith("/"):
        url = site_url.rstrip("/") + url
    return url if texto == url else f"{texto}: {url}"


def _tabelas(texto: str) -> str:
    saida: list[str] = []
    cabecalho: list[str] | None = None
    for linha in texto.split("\n"):
        if linha.strip().startswith("|"):
            celulas = [c.strip() for c in linha.strip().strip("|").split("|")]
            if _SEPARADOR.match(linha.strip()):
                continue
            if cabecalho is None:
                cabecalho = celulas
                continue
            saida.append("; ".join(f"{h}: {v}" for h, v in zip(cabecalho, celulas, strict=False)))
        else:
            cabecalho = None
            saida.append(linha)
    return "\n".join(saida)


def para_whatsapp(texto: str, site_url: str) -> str:
    texto = _tabelas(texto)
    texto = _LINK.sub(lambda m: _link(m, site_url), texto)
    texto = _TITULO.sub(lambda m: f"{_N}{m[1]}{_N}", texto)
    texto = _NEGRITO.sub(lambda m: f"{_N}{m[1] or m[2]}{_N}", texto)
    texto = _ITEM.sub(r"\1- ", texto)
    texto = _ITALICO.sub(r"_\1_", texto)
    return texto.replace(_N, "*").strip()


def dividir(texto: str, limite: int = LIMITE) -> list[str]:
    """Corta no fim de parágrafo mais próximo do limite; sem parágrafo, no fim de frase; sem frase, no
    último espaço; e só em último caso no meio da palavra."""
    partes: list[str] = []
    resto = texto.strip()
    while len(resto) > limite:
        janela = resto[: limite + 1]
        corte = janela.rfind("\n\n")
        if corte <= 0:
            fins = [m.end() for m in _FIM_DE_FRASE.finditer(janela) if m.end() <= limite]
            corte = fins[-1] if fins else janela.rfind(" ")
        if corte <= 0:
            corte = limite
        partes.append(resto[:corte].strip())
        resto = resto[corte:].strip()
    if resto:
        partes.append(resto)
    return partes
