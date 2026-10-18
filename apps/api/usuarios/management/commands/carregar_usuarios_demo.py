from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from usuarios import servicos
from usuarios.models import Perfil

# Os 5 funcionários FICTÍCIOS do protótipo (apps/web/src/content/sistema/funcionarios.ts), com os
# mesmos códigos: os dados de exemplo do navegador continuam valendo. O domínio não recebe e-mail.
DOMINIO = "exemplo.faperon.br"
TODOS_OS_PAPEIS = {
    "administrador": True,
    "coordenador": True,
    "gestor_frota": True,
    "gestor_espacos": True,
    "gestor_contas": True,
}
DEMONSTRACAO: list[dict[str, Any]] = [
    {"codigo": "carla", "nome": "Carla Mendes", "area": "Comunicação", "papeis": {}},
    {
        "codigo": "marcos",
        "nome": "Marcos Oliveira",
        "area": "Administrativo",
        "papeis": TODOS_OS_PAPEIS,
    },
    {"codigo": "ana", "nome": "Ana Ribeiro", "area": "Técnica", "papeis": {}},
    {"codigo": "joao", "nome": "João Pereira", "area": "Sindical", "papeis": {}},
    {"codigo": "luiza", "nome": "Luíza Santos", "area": "Presidência", "papeis": {}},
]


class Command(BaseCommand):
    help = "Cria ou atualiza os 5 usuários de demonstração (senha em DEMO_SENHA)."

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        senha = settings.DEMO_SENHA
        if not senha:
            raise CommandError(
                "Defina DEMO_SENHA (no .env.local) antes de carregar a demonstração."
            )
        try:
            validate_password(senha)
        except ValidationError as exc:
            raise CommandError("DEMO_SENHA fraca: " + " ".join(exc.messages)) from exc

        for pessoa in DEMONSTRACAO:
            email = f"{pessoa['codigo']}@{DOMINIO}"
            papeis = {p: bool(pessoa["papeis"].get(p, False)) for p in TODOS_OS_PAPEIS}
            perfil = (
                Perfil.objects.select_related("usuario").filter(codigo=pessoa["codigo"]).first()
            )
            if perfil is None:
                if User.objects.filter(email__iexact=email).exists():
                    raise CommandError(f"{email} já existe sem o perfil {pessoa['codigo']}.")
                servicos.criar_usuario(
                    email=email,
                    nome=pessoa["nome"],
                    area=pessoa["area"],
                    codigo=pessoa["codigo"],
                    senha=senha,
                    papeis=papeis,
                    demonstracao=True,
                    detalhe="manage.py carregar_usuarios_demo",
                )
                self.stdout.write(f"criado: {email}")
                continue
            usuario = perfil.usuario
            usuario.email = usuario.username = email
            usuario.is_active = True
            usuario.set_password(senha)
            usuario.save()
            for campo, valor in {**papeis, "nome": pessoa["nome"], "area": pessoa["area"]}.items():
                setattr(perfil, campo, valor)
            perfil.demonstracao, perfil.precisa_trocar_senha = True, False
            perfil.save()
            self.stdout.write(f"atualizado: {email}")
