"""Equipe e tela Usuários (ADR 0035): só administrador gere; desativar em vez de apagar."""

from typing import Any

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from tests.conftest import SENHA_DE_TESTE
from usuarios.models import Perfil, RegistroDeConta

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(criar_conta: Any) -> User:
    return criar_conta(
        email="marcos@exemplo.faperon.br",
        nome="Marcos Oliveira",
        codigo="marcos",
        area="Administrativo",
        administrador=True,
        coordenador=True,
    )


@pytest.fixture
def api_admin(api: APIClient, admin: User) -> APIClient:
    api.force_login(admin)
    return api


def novo(api: APIClient, **campos: Any) -> Any:
    dados = {"nome": "Ana Ribeiro", "email": "ana@exemplo.faperon.br", "area": "Técnica", **campos}
    return api.post("/api/v1/usuarios", dados, format="json")


# ---------- equipe ----------


def test_equipe_exige_login(api: APIClient) -> None:
    assert api.get("/api/v1/usuarios/equipe").status_code == 401


def test_equipe_lista_so_os_ativos_sem_email(api: APIClient, criar_conta: Any, admin: User) -> None:
    criar_conta(
        email="joao@exemplo.faperon.br",
        nome="João Pereira",
        codigo="joao",
        area="Sindical",
        ativo=False,
    )
    api.force_login(criar_conta())
    equipe = api.get("/api/v1/usuarios/equipe").json()
    assert [m["codigo"] for m in equipe] == ["carla", "marcos"]
    assert equipe[1] == {
        "codigo": "marcos",
        "nome": "Marcos Oliveira",
        "area": "Administrativo",
        "administrador": True,
        "coordenador": True,
        "gestor_frota": False,
        "gestor_espacos": False,
        "gestor_contas": False,
    }


# ---------- permissões ----------


def test_so_administrador_gere_usuarios(api_logado: APIClient, admin: User) -> None:
    assert api_logado.get("/api/v1/usuarios").status_code == 403
    assert novo(api_logado).status_code == 403
    assert (
        api_logado.patch("/api/v1/usuarios/marcos", {"nome": "X"}, format="json").status_code == 403
    )
    for acao in ("desativar", "reativar", "senha-temporaria"):
        assert api_logado.post(f"/api/v1/usuarios/marcos/{acao}").status_code == 403


def test_sem_login_e_401(api: APIClient) -> None:
    assert api.get("/api/v1/usuarios").status_code == 401


def test_admin_precisa_de_csrf(admin: User) -> None:
    navegador = APIClient(enforce_csrf_checks=True)
    navegador.force_login(admin)
    assert novo(navegador).status_code == 403
    assert navegador.get("/api/v1/usuarios").status_code == 200


# ---------- listar e criar ----------


def test_lista_inclui_inativos_com_email_e_ultimo_acesso(
    api_admin: APIClient, criar_conta: Any
) -> None:
    criar_conta(ativo=False)
    lista = api_admin.get("/api/v1/usuarios").json()
    carla = next(u for u in lista if u["codigo"] == "carla")
    assert carla["email"] == "carla@exemplo.faperon.br"
    assert carla["ativo"] is False
    assert carla["ultimo_acesso"] is None
    marcos = next(u for u in lista if u["codigo"] == "marcos")
    assert marcos["ultimo_acesso"] is not None  # force_login atualiza o último acesso


def test_criar_gera_senha_temporaria_mostrada_uma_vez(api_admin: APIClient, admin: User) -> None:
    r = novo(
        api_admin, email="  Ana@Exemplo.Faperon.br ", telefone="+5569999990000", gestor_frota=True
    )
    assert r.status_code == 201
    corpo = r.json()
    senha = corpo["senha_temporaria"]
    assert len(senha) >= 12
    assert corpo["usuario"]["codigo"] == "ana-ribeiro"
    assert corpo["usuario"]["email"] == "ana@exemplo.faperon.br"
    assert corpo["usuario"]["gestor_frota"] is True
    assert corpo["usuario"]["precisa_trocar_senha"] is True
    usuario = User.objects.get(email="ana@exemplo.faperon.br")
    assert usuario.username == "ana@exemplo.faperon.br"
    assert usuario.check_password(senha)
    # a senha não volta em nenhuma outra resposta
    assert senha not in api_admin.get("/api/v1/usuarios").content.decode()
    registro = RegistroDeConta.objects.get(acao=RegistroDeConta.Acao.CRIOU, alvo=usuario)
    assert registro.ator == admin
    assert senha not in " ".join(str(v) for v in registro.__dict__.values())


def test_criar_recusa_email_repetido_sem_diferenciar_maiusculas(
    api_admin: APIClient, criar_conta: Any
) -> None:
    criar_conta()
    r = novo(api_admin, email="CARLA@exemplo.faperon.br")
    assert r.status_code == 400
    assert "email" in r.json()["campos"]


def test_criar_valida_area_e_telefone(api_admin: APIClient) -> None:
    assert "area" in novo(api_admin, area="Marketing").json()["campos"]
    assert "telefone" in novo(api_admin, telefone="69 9999-0000").json()["campos"]


def test_codigo_gerado_nao_repete(api_admin: APIClient) -> None:
    novo(api_admin)
    r = novo(api_admin, email="ana2@exemplo.faperon.br")
    assert r.json()["usuario"]["codigo"] == "ana-ribeiro-2"


# ---------- editar ----------


def test_editar_muda_dados_e_papeis(api_admin: APIClient, criar_conta: Any) -> None:
    criar_conta()
    r = api_admin.patch(
        "/api/v1/usuarios/carla",
        {
            "nome": "Carla M. Mendes",
            "email": "carla.mendes@exemplo.faperon.br",
            "gestor_contas": True,
        },
        format="json",
    )
    assert r.status_code == 200
    assert r.json()["nome"] == "Carla M. Mendes"
    usuario = User.objects.get(perfil__codigo="carla")
    assert usuario.email == usuario.username == "carla.mendes@exemplo.faperon.br"
    assert usuario.perfil.gestor_contas is True
    assert RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.EDITOU, alvo=usuario).exists()


def test_editar_nao_tira_o_ultimo_administrador(api_admin: APIClient) -> None:
    r = api_admin.patch("/api/v1/usuarios/marcos", {"administrador": False}, format="json")
    assert r.status_code == 400
    assert "último administrador" in r.json()["erro"]
    assert Perfil.objects.get(codigo="marcos").administrador is True


def test_editar_tira_administrador_quando_ha_outro(api_admin: APIClient, criar_conta: Any) -> None:
    criar_conta(administrador=True)
    r = api_admin.patch("/api/v1/usuarios/carla", {"administrador": False}, format="json")
    assert r.status_code == 200


def test_editar_codigo_inexistente_e_404(api_admin: APIClient) -> None:
    assert (
        api_admin.patch("/api/v1/usuarios/ninguem", {"nome": "X"}, format="json").status_code == 404
    )


# ---------- desativar, reativar e senha temporária ----------


def test_desativar_e_reativar(api_admin: APIClient, criar_conta: Any) -> None:
    carla = criar_conta()
    sessao_da_carla = APIClient()
    sessao_da_carla.force_login(carla)

    r = api_admin.post("/api/v1/usuarios/carla/desativar")
    assert r.status_code == 200
    assert r.json()["ativo"] is False
    carla.refresh_from_db()
    assert carla.is_active is False
    assert User.objects.filter(pk=carla.pk).exists()  # não apaga: a autoria continua
    # a sessão aberta da Carla deixa de valer
    assert sessao_da_carla.get("/api/v1/auth/eu").status_code == 401

    assert api_admin.post("/api/v1/usuarios/carla/reativar").json()["ativo"] is True
    acoes = set(RegistroDeConta.objects.values_list("acao", flat=True))
    assert {RegistroDeConta.Acao.DESATIVOU, RegistroDeConta.Acao.REATIVOU} <= acoes


def test_administrador_nao_desativa_a_si_mesmo(api_admin: APIClient) -> None:
    r = api_admin.post("/api/v1/usuarios/marcos/desativar")
    assert r.status_code == 400
    assert "própria conta" in r.json()["erro"]


def test_nao_ha_rota_para_apagar(api_admin: APIClient, criar_conta: Any) -> None:
    criar_conta()
    assert api_admin.delete("/api/v1/usuarios/carla").status_code == 405


def test_senha_temporaria(api_admin: APIClient, criar_conta: Any) -> None:
    carla = criar_conta()
    r = api_admin.post("/api/v1/usuarios/carla/senha-temporaria")
    assert r.status_code == 200
    senha = r.json()["senha_temporaria"]
    carla.refresh_from_db()
    assert carla.check_password(senha)
    assert not carla.check_password(SENHA_DE_TESTE)
    assert carla.perfil.precisa_trocar_senha is True
    registro = RegistroDeConta.objects.get(acao=RegistroDeConta.Acao.GEROU_SENHA)
    assert senha not in " ".join(str(v) for v in registro.__dict__.values())


def test_senha_temporaria_para_si_mesmo_mantem_a_sessao(api_admin: APIClient) -> None:
    assert api_admin.post("/api/v1/usuarios/marcos/senha-temporaria").status_code == 200
    assert api_admin.get("/api/v1/auth/eu").json()["precisa_trocar_senha"] is True


# ---------- Zétele do sistema exige login ----------


@pytest.mark.parametrize(
    ("metodo", "rota"),
    [
        ("get", "/api/v1/sistema/zetele/estado"),
        ("post", "/api/v1/sistema/zetele/perguntar"),
        ("post", "/api/v1/sistema/zetele/ouvir"),
        ("post", "/api/v1/sistema/zetele/falar"),
        ("post", "/api/v1/sistema/interpretar"),
    ],
)
def test_zetele_do_sistema_exige_login(api: APIClient, metodo: str, rota: str) -> None:
    assert getattr(api, metodo)(rota).status_code == 401


def test_zetele_publico_continua_aberto(api: APIClient) -> None:
    assert api.get("/api/v1/zetele/estado").status_code == 200


def test_zetele_do_sistema_abre_com_login(api_logado: APIClient) -> None:
    assert api_logado.get("/api/v1/sistema/zetele/estado").status_code == 200


# ---------- telefone (WhatsApp, ADR 0037) ----------


def test_criar_recusa_telefone_de_outro_usuario(api_admin: APIClient) -> None:
    assert novo(api_admin, telefone="+5569999990000").status_code == 201
    r = novo(api_admin, email="ana2@exemplo.faperon.br", telefone="+5569999990000")
    assert r.status_code == 400
    assert r.json()["campos"]["telefone"] == "Este telefone já está no cadastro de outro usuário."


def test_varios_usuarios_sem_telefone(api_admin: APIClient) -> None:
    assert novo(api_admin).status_code == 201
    assert novo(api_admin, email="ana2@exemplo.faperon.br", telefone="").status_code == 201


def test_editar_mantem_o_proprio_telefone_e_registra_a_troca(
    api_admin: APIClient, criar_conta: Any
) -> None:
    criar_conta()
    rota = "/api/v1/usuarios/carla"
    assert api_admin.patch(rota, {"telefone": "+5569999990000"}, format="json").status_code == 200
    assert api_admin.patch(rota, {"telefone": "+5569999990000"}, format="json").status_code == 200
    registro = RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.EDITOU).first()
    assert registro is not None and "telefone" in registro.detalhe
    # o registro guarda o nome do campo, nunca o número
    assert "9999" not in registro.detalhe


def test_editar_recusa_telefone_de_outro(api_admin: APIClient, criar_conta: Any) -> None:
    criar_conta()
    novo(api_admin, telefone="+5569999990000")
    r = api_admin.patch("/api/v1/usuarios/carla", {"telefone": "+5569999990000"}, format="json")
    assert r.status_code == 400
    assert "telefone" in r.json()["campos"]


def test_banco_recusa_telefone_repetido(criar_conta: Any) -> None:
    from django.db import IntegrityError, transaction

    a = criar_conta()
    b = criar_conta(email="ana@exemplo.faperon.br", nome="Ana Ribeiro", codigo="ana")
    Perfil.objects.filter(usuario=a).update(telefone="+5569999990000")
    with pytest.raises(IntegrityError), transaction.atomic():
        Perfil.objects.filter(usuario=b).update(telefone="+5569999990000")
