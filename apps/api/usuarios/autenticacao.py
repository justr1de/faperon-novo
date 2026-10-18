from typing import Any

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User
from django.http import HttpRequest
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request

from usuarios.servicos import normalizar_email


class BackendPorEmail(ModelBackend):
    """Login pelo e-mail (sem diferenciar maiúsculas). Conta desativada não entra."""

    def authenticate(
        self,
        request: HttpRequest | None,
        username: str | None = None,
        password: str | None = None,
        email: str | None = None,
        **kwargs: Any,
    ) -> User | None:
        email = normalizar_email(email or username or "")
        if not email or password is None:
            return None
        usuario = User.objects.filter(email__iexact=email).first()
        if usuario is None:
            # mesmo custo de uma senha conferida: o tempo de resposta não revela se o e-mail existe
            User().set_password(password)
            return None
        if usuario.check_password(password) and self.user_can_authenticate(usuario):
            return usuario
        return None


class SessaoAutenticacao(SessionAuthentication):
    """Sessão do Django com CSRF (cookie `csrftoken` + cabeçalho `X-CSRFToken`).

    Diferente da classe do DRF, sem login responde 401 (e não 403): o front distingue "faça login"
    de "sem permissão".
    """

    def authenticate_header(self, request: Request) -> str:
        return "Session"
