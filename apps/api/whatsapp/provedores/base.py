"""O que o canal precisa de um provedor de WhatsApp. Twilio hoje; a Cloud API da Meta depois (ADR 0037)."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class Entrada:
    id_externo: str
    # E.164, sem o prefixo "whatsapp:"
    telefone: str
    texto: str
    url_midia: str
    tipo_midia: str


class ErroTemporario(Exception):
    """Rede ou provedor fora: vale tentar de novo mais tarde."""


class ErroDefinitivo(Exception):
    """O provedor recusou (número fora da janela de 24 h, mídia grande demais): repetir não adianta."""


class Provedor(Protocol):
    nome: str

    def assinatura_valida(
        self, url: str, campos: Mapping[str, Any], meta: Mapping[str, Any]
    ) -> bool: ...

    def ler_entrada(self, campos: Mapping[str, Any]) -> Entrada | None: ...

    def baixar_midia(self, url: str, limite: int) -> bytes: ...

    def enviar_texto(self, telefone: str, texto: str) -> None: ...

    def enviar_audio(self, telefone: str, url: str) -> None: ...
