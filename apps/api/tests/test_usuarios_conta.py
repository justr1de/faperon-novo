"""Login de verdade (ADR 0035): sessão do Django, CSRF, bloqueio, troca obrigatória e Google."""

from datetime import timedelta
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from tests.conftest import SENHA_DE_TESTE
from usuarios import views
from usuarios.models import RegistroDeConta

pytestmark = pytest.mark.django_db
IP = "198.51.100.60"


@pytest.fixture
def navegador() -> APIClient:
    """Cliente que confere o CSRF como o navegador de verdade (o APIClient comum pula a conferência)."""
    return APIClient(enforce_csrf_checks=True)


def token(cliente: APIClient) -> str:
    r = cliente.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    return str(r.json()["csrf"])


def entrar(cliente: APIClient, email: str, senha: str = SENHA_DE_TESTE, ip: str = IP) -> Any:
    return cliente.post(
        "/api/v1/auth/entrar",
        {"email": email, "senha": senha},
        format="json",
        HTTP_X_CSRFTOKEN=token(cliente),
        HTTP_X_FORWARDED_FOR=ip,
    )


# ---------- CSRF e entrada ----------


def test_csrf_devolve_o_token_e_grava_o_cookie(navegador: APIClient) -> None:
    r = navegador.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    assert r.json()["csrf"]
    assert "csrftoken" in r.cookies
    assert r.cookies["csrftoken"]["samesite"] == "Lax"


def test_entrar_com_email_e_senha(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    r = entrar(navegador, "  CARLA@exemplo.faperon.br ")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["codigo"] == "carla"
    assert corpo["email"] == "carla@exemplo.faperon.br"
    assert corpo["precisa_trocar_senha"] is False
    cookie = r.cookies["sessionid"]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Lax"
    # os testes rodam com DJANGO_DEBUG=0, como a produção
    assert cookie["secure"] is True
    assert navegador.get("/api/v1/auth/eu").json()["codigo"] == "carla"
    registro = RegistroDeConta.objects.get(acao=RegistroDeConta.Acao.ENTROU)
    assert registro.ator is not None and registro.ator.email == "carla@exemplo.faperon.br"


def test_entrar_gira_a_sessao(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    navegador.get("/api/v1/auth/csrf")
    sessao = navegador.session
    sessao["antes"] = "1"
    sessao.save()
    antes = sessao.session_key
    entrar(navegador, "carla@exemplo.faperon.br")
    assert navegador.cookies["sessionid"].value != antes


def test_entrar_exige_csrf(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    r = navegador.post(
        "/api/v1/auth/entrar",
        {"email": "carla@exemplo.faperon.br", "senha": SENHA_DE_TESTE},
        format="json",
    )
    assert r.status_code == 403
    assert "sessionid" not in r.cookies


def test_senha_errada_e_email_desconhecido_dao_a_mesma_resposta(
    navegador: APIClient, criar_conta: Any
) -> None:
    criar_conta()
    errada = entrar(navegador, "carla@exemplo.faperon.br", "outra-senha-qualquer")
    desconhecido = entrar(navegador, "ninguem@exemplo.faperon.br", "outra-senha-qualquer")
    assert errada.status_code == desconhecido.status_code == 400
    assert (
        errada.json()
        == desconhecido.json()
        == {"erro": "E-mail ou senha incorretos.", "campos": {}}
    )
    falhas = RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.FALHOU_ENTRAR)
    assert sorted(f.email for f in falhas) == [
        "carla@exemplo.faperon.br",
        "ninguem@exemplo.faperon.br",
    ]


def test_conta_desativada_nao_entra(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta(ativo=False)
    r = entrar(navegador, "carla@exemplo.faperon.br")
    assert r.status_code == 400
    assert r.json()["erro"] == "E-mail ou senha incorretos."


def test_registro_nunca_guarda_a_senha(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    entrar(navegador, "carla@exemplo.faperon.br", "senha-errada-digitada")
    entrar(navegador, "carla@exemplo.faperon.br")
    for registro in RegistroDeConta.objects.all():
        valores = " ".join(str(v) for v in registro.__dict__.values())
        assert "senha-errada-digitada" not in valores
        assert SENHA_DE_TESTE not in valores


def test_bloqueia_por_15_minutos_depois_de_5_falhas(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    for _ in range(5):
        assert entrar(navegador, "carla@exemplo.faperon.br", "errada-errada").status_code == 400
    # bloqueada: nem a senha certa entra
    r = entrar(navegador, "carla@exemplo.faperon.br")
    assert r.status_code == 429
    assert r["Retry-After"] == "900"
    assert "15 minutos" in r.json()["erro"]
    assert RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.BLOQUEOU).count() == 1
    # passados 15 minutos, volta a entrar
    RegistroDeConta.objects.update(quando=timezone.now() - timedelta(minutes=16))
    assert entrar(navegador, "carla@exemplo.faperon.br").status_code == 200


def test_bloqueio_por_email_vale_de_qualquer_ip(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    for i in range(5):
        entrar(navegador, "carla@exemplo.faperon.br", "errada-errada", ip=f"10.0.0.{i}")
    assert entrar(navegador, "carla@exemplo.faperon.br", ip="10.0.0.99").status_code == 429


def test_bloqueio_por_ip_com_muitos_emails(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    for i in range(views.FALHAS_POR_IP):
        entrar(navegador, f"pessoa{i}@exemplo.faperon.br", "errada-errada")
    assert entrar(navegador, "carla@exemplo.faperon.br").status_code == 429
    assert entrar(navegador, "carla@exemplo.faperon.br", ip="10.0.0.7").status_code == 200


def test_limite_de_tentativas_por_ip(
    navegador: APIClient, criar_conta: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {"anon": "300/min", "auth": "2/min"})
    cache.clear()
    criar_conta()
    codigos = [entrar(navegador, "carla@exemplo.faperon.br").status_code for _ in range(3)]
    assert codigos == [200, 200, 429]


# ---------- eu, sair e troca de senha ----------


def test_eu_sem_login_e_401(api: APIClient) -> None:
    r = api.get("/api/v1/auth/eu")
    assert r.status_code == 401


def test_eu_devolve_o_perfil(api: APIClient, criar_conta: Any) -> None:
    api.force_login(criar_conta(coordenador=True, gestor_frota=True))
    corpo = api.get("/api/v1/auth/eu").json()
    assert corpo == {
        "codigo": "carla",
        "nome": "Carla Mendes",
        "email": "carla@exemplo.faperon.br",
        "area": "Comunicação",
        "telefone": "",
        "administrador": False,
        "coordenador": True,
        "gestor_frota": True,
        "gestor_espacos": False,
        "gestor_contas": False,
        "demonstracao": False,
        "precisa_trocar_senha": False,
    }


def test_sair_encerra_a_sessao(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    entrar(navegador, "carla@exemplo.faperon.br")
    r = navegador.post("/api/v1/auth/sair", HTTP_X_CSRFTOKEN=navegador.cookies["csrftoken"].value)
    assert r.status_code == 204
    assert navegador.get("/api/v1/auth/eu").status_code == 401
    assert RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.SAIU).count() == 1


def test_sair_exige_csrf(navegador: APIClient, criar_conta: Any) -> None:
    criar_conta()
    entrar(navegador, "carla@exemplo.faperon.br")
    assert navegador.post("/api/v1/auth/sair").status_code == 403
    assert navegador.get("/api/v1/auth/eu").status_code == 200


def trocar(cliente: APIClient, atual: str, nova: str) -> Any:
    return cliente.post(
        "/api/v1/auth/trocar-senha", {"senha_atual": atual, "senha_nova": nova}, format="json"
    )


def test_trocar_senha(api: APIClient, criar_conta: Any) -> None:
    usuario = criar_conta()
    usuario.perfil.precisa_trocar_senha = True
    usuario.perfil.save()
    api.force_login(usuario)
    # a troca é obrigatória: as outras rotas recusam até lá
    assert api.get("/api/v1/usuarios/equipe").status_code == 403
    assert api.get("/api/v1/auth/eu").json()["precisa_trocar_senha"] is True

    assert trocar(api, "nao-e-a-atual", "nova-senha-bem-longa").status_code == 400
    curta = trocar(api, SENHA_DE_TESTE, "curta")
    assert curta.status_code == 400
    assert "senha_nova" in curta.json()["campos"]
    igual = trocar(api, SENHA_DE_TESTE, SENHA_DE_TESTE)
    assert igual.status_code == 400

    r = trocar(api, SENHA_DE_TESTE, "nova-senha-bem-longa")
    assert r.status_code == 200
    assert r.json()["precisa_trocar_senha"] is False
    # continua logada e as rotas voltam a abrir
    assert api.get("/api/v1/usuarios/equipe").status_code == 200
    usuario.refresh_from_db()
    assert usuario.check_password("nova-senha-bem-longa")
    assert RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.TROCOU_SENHA).count() == 1


def test_trocar_senha_sem_login_e_401(api: APIClient) -> None:
    assert trocar(api, "a", "b").status_code == 401


# ---------- Google ----------


def google(cliente: APIClient, credencial: str = "token-do-google") -> Any:
    return cliente.post(
        "/api/v1/auth/google",
        {"credential": credencial},
        format="json",
        HTTP_X_CSRFTOKEN=token(cliente),
        HTTP_X_FORWARDED_FOR=IP,
    )


@pytest.fixture
def com_google(settings: Any) -> None:
    settings.GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com"


def simular_google(monkeypatch: pytest.MonkeyPatch, **dados: Any) -> list[str]:
    vistos: list[str] = []

    def verificar(credencial: str, cliente_id: str) -> dict[str, Any]:
        vistos.append(cliente_id)
        if isinstance(dados.get("erro"), Exception):
            raise dados["erro"]
        return {"email": "carla@exemplo.faperon.br", "email_verified": True, **dados}

    monkeypatch.setattr(views, "verificar_credencial_google", verificar)
    return vistos


def test_google_sem_client_id_e_503(navegador: APIClient, settings: Any) -> None:
    settings.GOOGLE_CLIENT_ID = ""
    r = google(navegador)
    assert r.status_code == 503
    assert r.json()["motivo"] == "google_desligado"


def test_google_entra_quem_ja_esta_cadastrado(
    navegador: APIClient, criar_conta: Any, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    criar_conta()
    vistos = simular_google(monkeypatch, email="Carla@Exemplo.Faperon.br")
    r = google(navegador)
    assert r.status_code == 200
    assert r.json()["codigo"] == "carla"
    assert vistos == ["cliente.apps.googleusercontent.com"]
    assert navegador.get("/api/v1/auth/eu").status_code == 200


def test_google_nao_cria_conta(
    navegador: APIClient, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    simular_google(monkeypatch, email="novo@gmail.com")
    r = google(navegador)
    assert r.status_code == 403
    assert not User.objects.exists()
    assert RegistroDeConta.objects.filter(acao=RegistroDeConta.Acao.FALHOU_ENTRAR).count() == 1


def test_google_recusa_conta_desativada(
    navegador: APIClient, criar_conta: Any, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    criar_conta(ativo=False)
    simular_google(monkeypatch)
    assert google(navegador).status_code == 403
    assert navegador.get("/api/v1/auth/eu").status_code == 401


def test_google_exige_email_verificado(
    navegador: APIClient, criar_conta: Any, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    criar_conta()
    simular_google(monkeypatch, email_verified=False)
    assert google(navegador).status_code == 400


def test_google_token_invalido(
    navegador: APIClient, criar_conta: Any, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    criar_conta()
    simular_google(monkeypatch, erro=ValueError("assinatura inválida"))
    r = google(navegador)
    assert r.status_code == 400
    assert navegador.get("/api/v1/auth/eu").status_code == 401


def test_google_exige_csrf(
    navegador: APIClient, criar_conta: Any, com_google: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    criar_conta()
    simular_google(monkeypatch)
    r = navegador.post("/api/v1/auth/google", {"credential": "x"}, format="json")
    assert r.status_code == 403


def test_verificador_do_google_usa_o_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    chamadas: list[tuple[str, Any, str]] = []

    def falso(credencial: str, pedido: Any, audiencia: str) -> dict[str, Any]:
        chamadas.append((credencial, pedido, audiencia))
        return {"email": "x@y.z"}

    monkeypatch.setattr(views.id_token, "verify_oauth2_token", falso)
    assert views.verificar_credencial_google("abc", "meu-cliente") == {"email": "x@y.z"}
    assert chamadas[0][0] == "abc" and chamadas[0][2] == "meu-cliente"
