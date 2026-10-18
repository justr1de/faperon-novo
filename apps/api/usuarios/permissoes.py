from typing import Any

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from usuarios.models import Perfil


def perfil_de(request: Request) -> Perfil | None:
    return getattr(request.user, "perfil", None)


class TemPerfil(IsAuthenticated):
    """Logado e com perfil (conta criada pelo `createsuperuser`, sem perfil, não usa o sistema)."""

    message = "Esta conta não tem acesso ao sistema."

    def has_permission(self, request: Request, view: Any) -> bool:
        return super().has_permission(request, view) and perfil_de(request) is not None


class EstaLogado(TemPerfil):
    """Pessoa da equipe com a senha em dia: com senha temporária, só pode trocá-la ou sair."""

    def has_permission(self, request: Request, view: Any) -> bool:
        if not super().has_permission(request, view):
            return False
        perfil = perfil_de(request)
        if perfil is not None and perfil.precisa_trocar_senha:
            raise PermissionDenied("Troque a senha temporária antes de continuar.")
        return True


class EhAdministrador(EstaLogado):
    message = "Só administradores gerenciam usuários."

    def has_permission(self, request: Request, view: Any) -> bool:
        if not super().has_permission(request, view):
            return False
        perfil = perfil_de(request)
        return perfil is not None and perfil.administrador
