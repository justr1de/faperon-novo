"""Comandos de gestão das contas (ADR 0035): criar_admin e carregar_usuarios_demo."""

import re
from io import StringIO
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.management import CommandError, call_command

from usuarios.models import Perfil

pytestmark = pytest.mark.django_db


def rodar(comando: str, *args: str) -> str:
    saida = StringIO()
    call_command(comando, *args, stdout=saida)
    return saida.getvalue()


def senha_impressa(saida: str) -> str:
    achado = re.search(r"Senha temporária[^:]*: (\S+)", saida)
    assert achado, saida
    return achado.group(1)


def test_criar_admin_cria_e_imprime_a_senha_uma_vez() -> None:
    saida = rodar("criar_admin", "--email", "Admin@Faperon.org.br", "--nome", "Pessoa Admin")
    senha = senha_impressa(saida)
    usuario = User.objects.get(email="admin@faperon.org.br")
    assert usuario.check_password(senha)
    assert usuario.perfil.administrador is True
    assert usuario.perfil.area == "Administrativo"
    assert usuario.perfil.precisa_trocar_senha is True
    assert usuario.perfil.demonstracao is False


def test_criar_admin_promove_quem_ja_existe(criar_conta: Any) -> None:
    criar_conta()
    saida = rodar(
        "criar_admin",
        "--email",
        "carla@exemplo.faperon.br",
        "--nome",
        "Carla Mendes",
        "--area",
        "Comunicação",
    )
    carla = User.objects.get(email="carla@exemplo.faperon.br")
    assert carla.perfil.administrador is True
    assert carla.perfil.area == "Comunicação"
    assert carla.check_password(senha_impressa(saida))
    assert User.objects.count() == 1


def test_criar_admin_recusa_area_desconhecida() -> None:
    with pytest.raises(CommandError):
        rodar("criar_admin", "--email", "a@b.cd", "--nome", "X", "--area", "Marketing")


def test_carregar_demo_exige_demo_senha(settings: Any) -> None:
    settings.DEMO_SENHA = ""
    with pytest.raises(CommandError, match="DEMO_SENHA"):
        rodar("carregar_usuarios_demo")
    assert not User.objects.exists()


def test_carregar_demo_recusa_senha_fraca(settings: Any) -> None:
    settings.DEMO_SENHA = "curta"
    with pytest.raises(CommandError):
        rodar("carregar_usuarios_demo")


def test_carregar_demo_cria_os_5_funcionarios_ficticios(settings: Any) -> None:
    settings.DEMO_SENHA = "demonstracao-local"
    rodar("carregar_usuarios_demo")
    rodar("carregar_usuarios_demo")  # rodar de novo não duplica
    perfis = {p.codigo: p for p in Perfil.objects.select_related("usuario")}
    assert sorted(perfis) == ["ana", "carla", "joao", "luiza", "marcos"]
    assert all(p.demonstracao and not p.precisa_trocar_senha for p in perfis.values())
    assert all(p.usuario.email.endswith("@exemplo.faperon.br") for p in perfis.values())
    assert all(p.usuario.check_password("demonstracao-local") for p in perfis.values())
    marcos = perfis["marcos"]
    assert (marcos.nome, marcos.area) == ("Marcos Oliveira", "Administrativo")
    assert all(
        [
            marcos.administrador,
            marcos.coordenador,
            marcos.gestor_frota,
            marcos.gestor_espacos,
            marcos.gestor_contas,
        ]
    )
    assert not any(
        [perfis["carla"].administrador, perfis["carla"].coordenador, perfis["carla"].gestor_frota]
    )
    assert perfis["luiza"].nome == "Luíza Santos"
