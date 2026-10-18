from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "usuarios"
    verbose_name = "Usuários e login do sistema"

    def ready(self) -> None:
        # registra no drf-spectacular o esquema da sessão (SessaoAutenticacao)
        from usuarios import esquema  # noqa: F401
