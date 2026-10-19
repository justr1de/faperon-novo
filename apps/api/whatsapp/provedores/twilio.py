"""Twilio (Sandbox de WhatsApp na demonstração). Só o RequestValidator vem do SDK oficial; o envio e o
download são chamadas diretas da API REST, com o requests que o projeto já usa."""

from collections.abc import Mapping
from typing import Any

import requests
from twilio.request_validator import RequestValidator

from whatsapp.provedores.base import Entrada, ErroDefinitivo, ErroTemporario

PREFIXO = "whatsapp:"
TEMPO_LIMITE = 15.0


class ProvedorTwilio:
    nome = "twilio"
    URL_API = "https://api.twilio.com/2010-04-01"

    def __init__(self, account_sid: str, auth_token: str, numero: str) -> None:
        self._sid = account_sid
        self._token = auth_token
        self._numero = numero
        self._validador = RequestValidator(auth_token)

    def assinatura_valida(
        self, url: str, campos: Mapping[str, Any], meta: Mapping[str, Any]
    ) -> bool:
        assinatura = str(meta.get("HTTP_X_TWILIO_SIGNATURE", ""))
        if not assinatura or not self._token:
            return False
        return bool(self._validador.validate(url, campos, assinatura))

    def ler_entrada(self, campos: Mapping[str, Any]) -> Entrada | None:
        sid = str(campos.get("MessageSid", ""))
        remetente = str(campos.get("From", ""))
        if not sid or not remetente.startswith(PREFIXO):
            return None
        tem_midia = str(campos.get("NumMedia", "0")) not in ("", "0")
        return Entrada(
            id_externo=sid,
            telefone=remetente.removeprefix(PREFIXO),
            texto=str(campos.get("Body", "")).strip(),
            url_midia=str(campos.get("MediaUrl0", "")) if tem_midia else "",
            tipo_midia=str(campos.get("MediaContentType0", "")) if tem_midia else "",
        )

    def baixar_midia(self, url: str, limite: int) -> bytes:
        # o Twilio redireciona para o armazenamento dele; o requests não repassa a senha a outro host
        try:
            with requests.get(
                url, auth=(self._sid, self._token), timeout=TEMPO_LIMITE, stream=True
            ) as r:
                self._conferir(r)
                partes: list[bytes] = []
                total = 0
                for parte in r.iter_content(64 * 1024):
                    total += len(parte)
                    if total > limite:
                        raise ErroDefinitivo("mídia acima do limite")
                    partes.append(parte)
                return b"".join(partes)
        except requests.RequestException as exc:
            raise ErroTemporario(type(exc).__name__) from exc

    def enviar_texto(self, telefone: str, texto: str) -> None:
        self._enviar({"To": PREFIXO + telefone, "From": self._numero, "Body": texto})

    def enviar_audio(self, telefone: str, url: str) -> None:
        self._enviar({"To": PREFIXO + telefone, "From": self._numero, "MediaUrl": url})

    def _enviar(self, dados: dict[str, str]) -> None:
        try:
            r = requests.post(
                f"{self.URL_API}/Accounts/{self._sid}/Messages.json",
                data=dados,
                auth=(self._sid, self._token),
                timeout=TEMPO_LIMITE,
            )
        except requests.RequestException as exc:
            raise ErroTemporario(type(exc).__name__) from exc
        self._conferir(r)

    @staticmethod
    def _conferir(r: requests.Response) -> None:
        if r.status_code == 429 or r.status_code >= 500:
            raise ErroTemporario(f"HTTP {r.status_code}")
        if r.status_code >= 400:
            # o corpo traz o código do Twilio (ex.: 63016, fora da janela de 24 h), sem dado pessoal
            codigo = ""
            try:
                codigo = str(r.json().get("code", ""))
            except ValueError:
                pass
            raise ErroDefinitivo(f"HTTP {r.status_code} {codigo}".strip())
