"""Provedor em memória: os testes conferem o que seria enviado, sem rede."""

from collections.abc import Mapping
from typing import Any

from whatsapp.provedores.base import Entrada


class ProvedorFalso:
    nome = "falso"

    def __init__(self) -> None:
        self.enviadas: list[tuple[str, str, str]] = []
        self.midias: dict[str, bytes] = {}
        # exceções devolvidas, em ordem, pelos próximos envios ou downloads
        self.falhas: list[Exception] = []

    def _talvez_falhar(self) -> None:
        if self.falhas:
            raise self.falhas.pop(0)

    def assinatura_valida(
        self, url: str, campos: Mapping[str, Any], meta: Mapping[str, Any]
    ) -> bool:
        return True

    def ler_entrada(self, campos: Mapping[str, Any]) -> Entrada | None:
        return None

    def baixar_midia(self, url: str, limite: int) -> bytes:
        self._talvez_falhar()
        return self.midias[url]

    def enviar_texto(self, telefone: str, texto: str) -> None:
        self._talvez_falhar()
        self.enviadas.append(("texto", telefone, texto))

    def enviar_audio(self, telefone: str, url: str) -> None:
        self._talvez_falhar()
        self.enviadas.append(("audio", telefone, url))
