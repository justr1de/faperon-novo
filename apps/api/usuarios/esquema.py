from typing import Any

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessaoEsquema(OpenApiAuthenticationExtension):
    """Documenta no OpenAPI a sessão do Django (cookie `sessionid`) das rotas da área logada."""

    target_class = "usuarios.autenticacao.SessaoAutenticacao"
    name = "sessao"

    def get_security_definition(self, auto_schema: Any) -> dict[str, str]:
        return {"type": "apiKey", "in": "cookie", "name": "sessionid"}
