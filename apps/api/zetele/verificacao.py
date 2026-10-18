"""Confere a resposta do modelo antes de entregar: números, links e idioma (ADR 0029).

Todo número do texto precisa existir nos resultados das ferramentas, na base de conhecimento ou na
própria conversa. Links só para rotas reais e para as URLs que as ferramentas devolveram.
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlsplit

from django.conf import settings

ROTAS_PERMITIDAS = frozenset(
    {
        "/",
        "/central-de-inteligencia",
        "/central-de-inteligencia/observatorio",
        "/painel",
        "/credito-rural",
        "/sobre",
        "/informativos-tecnicos",
        "/noticias",
        "/fale-conosco",
        "/ipagro",
        "/sindicatos-rurais",
        "/galeria",
        "/comissao-mulheres",
        "/politica-de-privacidade",
        "/login",
        "/sistema",
        "/sistema/agenda",
        "/sistema/frotas",
        "/sistema/espacos",
        "/sistema/contas",
        "/sistema/relatorios",
        "/sistema/atividades",
        "/sistema/indicadores",
    }
)
HOSTS_EXTERNOS = frozenset(
    {
        "sidra.ibge.gov.br",
        "www.bcb.gov.br",
        "www.faperon.com.br",
        "sistemafaperon.org.br",
        "www.cnabrasil.org.br",
    }
)
# Qualquer número cabe em wa.me: só o WhatsApp oficial (CONTATO.whatsapp no front) ou o que a
# ferramenta devolveu.
WHATSAPP_OFICIAL = "https://wa.me/556932247620"
# Palavras inglesas comuns que não existem em português: sinal de raciocínio vazado em inglês
# (um bot já trocou "camisinha" por "condomínio" passando por "condom").
PALAVRAS_EM_INGLES = ("the", "with", "from", "which", "this", "and", "you", "your", "condom")
# Contagens pequenas ("os 5 maiores") passam sem fonte; porcentagens nunca.
PEQUENOS = frozenset(str(n) for n in range(11))

# O token engole todos os separadores ("8.1", "1.234.567,5") para "8.1" não virar só "8".
RE_NUMERO = re.compile(r"(?<![\d.,])(\d+(?:[.,]\d+)*)(?!\d)(\s?%)?")
RE_NUMERO_PT_BR = re.compile(r"\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?")
# Texto com um nível de colchetes ("[a [b]]") e título opcional ('(url "título")').
RE_LINK_MD = re.compile(r'\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
# Sem lookbehind: a URL de um link que RE_LINK_MD não reconheceu ainda é conferida como solta.
RE_URL_SOLTA = re.compile(r"https?://[^\s)\]]+")
_LETRA = r"[^\W\d_]"


def _canonico(valor: Decimal) -> str:
    texto = format(valor.normalize(), "f")
    return "0" if texto in {"-0", ""} else texto


def normalizar(token: str) -> str:
    if RE_NUMERO_PT_BR.fullmatch(token):
        return _canonico(Decimal(token.replace(".", "").replace(",", ".")))
    # Ponto fora do milhar pt-BR ("8.1", "7.5"): vale a leitura decimal, que é a do leitor.
    try:
        return _canonico(Decimal(token.replace(",", "")))
    except InvalidOperation:
        return token  # "17.10.2026" não tem leitura numérica: só passa se vier igual da fonte


def numeros_permitidos(fontes: Iterable[Any]) -> set[str]:
    permitidos: set[str] = set()

    def visitar(valor: Any) -> None:
        if isinstance(valor, bool) or valor is None:
            return
        if isinstance(valor, int | float | Decimal):
            permitidos.add(_canonico(Decimal(str(valor))))
        elif isinstance(valor, str):
            permitidos.update(normalizar(m.group(1)) for m in RE_NUMERO.finditer(valor))
        elif isinstance(valor, dict):
            for item in valor.values():
                visitar(item)
        elif isinstance(valor, list | tuple | set):
            for item in valor:
                visitar(item)

    for fonte in fontes:
        visitar(fonte)
    return permitidos


def _link_permitido(url: str, urls_ferramentas: set[str]) -> bool:
    try:
        partes = urlsplit(url)
    except ValueError:  # "https://[golpe": colchete sem par, urlsplit não lê
        return False
    if url.startswith("/"):
        # "//golpe.example/painel" começa com "/" mas aponta para outro host
        if partes.netloc or partes.scheme:
            return False
        if partes.query:
            return url in urls_ferramentas
        return partes.path in ROTAS_PERMITIDAS
    if partes.scheme == "https" and partes.hostname == "wa.me":
        return url == WHATSAPP_OFICIAL or url in urls_ferramentas
    return partes.scheme == "https" and partes.hostname in HOSTS_EXTERNOS


def limpar_links(texto: str, urls_ferramentas: set[str]) -> tuple[str, int]:
    """Link reprovado vira só o texto (Markdown) ou some (URL solta). Não derruba a resposta."""
    removidos = 0

    def markdown(m: re.Match[str]) -> str:
        nonlocal removidos
        rotulo = m.group(1)
        if RE_LINK_MD.search(rotulo) or "](" in rotulo:
            # link dentro do texto de outro link: o front leria o de dentro, que não foi conferido
            removidos += 1
            return RE_LINK_MD.sub(r"\1", rotulo).replace("](", " ")
        if _link_permitido(m.group(2), urls_ferramentas):
            return m.group(0)
        removidos += 1
        return m.group(1)

    def solta(m: re.Match[str]) -> str:
        nonlocal removidos
        url = m.group(0).rstrip(".,;:")
        resto = m.group(0)[len(url) :]
        if _link_permitido(url, urls_ferramentas):
            return m.group(0)
        removidos += 1
        return resto

    texto = RE_LINK_MD.sub(markdown, texto)
    texto = RE_URL_SOLTA.sub(solta, texto)
    return texto, removidos


def _termos_proibidos(texto: str) -> list[str]:
    termos = [*PALAVRAS_EM_INGLES, *settings.ZETELE_TERMOS_BLOQUEADOS]
    return [
        t
        for t in termos
        if re.search(rf"(?<!{_LETRA}){re.escape(t)}(?!{_LETRA})", texto, re.IGNORECASE)
    ]


@dataclass(frozen=True)
class Verificacao:
    aprovada: bool
    texto: str
    motivos: tuple[str, ...]
    links_removidos: int


def verificar(
    texto: str, *, dados: Iterable[Any], referencias: Iterable[str], urls_ferramentas: set[str]
) -> Verificacao:
    limpo, removidos = limpar_links(texto, urls_ferramentas)
    permitidos = numeros_permitidos([*dados, *referencias])
    # números dentro de URLs (ano no filtro, tabela do SIDRA, WhatsApp) não são afirmações
    sem_links = RE_URL_SOLTA.sub(" ", RE_LINK_MD.sub(r"\1", limpo))
    motivos: list[str] = []
    for m in RE_NUMERO.finditer(sem_links):
        token, porcentagem = m.group(1), m.group(2)
        n = normalizar(token)
        if n in permitidos or (not porcentagem and n in PEQUENOS):
            continue
        motivos.append(f"número sem fonte: {token}")
    motivos.extend(f"termo proibido: {t}" for t in _termos_proibidos(limpo))
    return Verificacao(not motivos, limpo, tuple(motivos), removidos)
