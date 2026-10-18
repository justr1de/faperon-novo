from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from usuarios import servicos
from usuarios.models import Area, Perfil, RegistroDeConta

ORIGEM = "manage.py criar_admin"


class Command(BaseCommand):
    help = "Cria (ou promove) um administrador do sistema e imprime uma senha temporária, uma única vez."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--email", required=True)
        parser.add_argument("--nome", required=True)
        parser.add_argument("--area", default=Area.ADMINISTRATIVO.value)

    @transaction.atomic
    def handle(self, *args: Any, **opts: Any) -> None:
        if opts["area"] not in Area.values:
            raise CommandError(f"Área desconhecida. Use uma destas: {', '.join(Area.values)}.")
        email = servicos.normalizar_email(opts["email"])
        nome = " ".join(opts["nome"].split())
        usuario = User.objects.filter(email__iexact=email).first()
        if usuario is None:
            usuario, senha = servicos.criar_usuario(
                email=email,
                nome=nome,
                area=opts["area"],
                papeis={"administrador": True},
                detalhe=ORIGEM,
            )
            assert senha is not None
            self.stdout.write(f"Administrador criado: {email}")
        else:
            perfil = Perfil.objects.filter(usuario=usuario).first()
            if perfil is None:
                Perfil.objects.create(
                    usuario=usuario,
                    codigo=servicos.gerar_codigo(nome),
                    nome=nome,
                    area=opts["area"],
                    administrador=True,
                )
            else:
                perfil.nome, perfil.area, perfil.administrador = nome, opts["area"], True
                perfil.save()
            if not usuario.is_active:
                usuario.is_active = True
                usuario.save(update_fields=["is_active"])
            servicos.registrar(
                RegistroDeConta.Acao.EDITOU, alvo=usuario, detalhe=f"{ORIGEM}: administrador"
            )
            senha = servicos.definir_senha_temporaria(usuario, detalhe=ORIGEM)
            self.stdout.write(f"Conta promovida a administrador: {email}")
        self.stdout.write(
            f"Senha temporária (aparece só agora; troque no primeiro acesso): {senha}"
        )
