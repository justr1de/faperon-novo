import threading
from typing import Any

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from indicadores.models import Produto
from tests.zetele_falso import ClienteLLMFalso, final
from zetele import views
from zetele.cliente import ProvedorIndisponivel
from zetele.models import Pergunta, PerguntaSistema

ROTA = "/api/v1/zetele/perguntar"
pytestmark = pytest.mark.django_db


def pedir(api: APIClient, **corpo: Any) -> Any:
    ip = corpo.pop("ip", "198.51.100.1")
    dados = {"pergunta": "onde fica o ranking?", "historico": [], "pagina": "/painel", **corpo}
    return api.post(ROTA, dados, format="json", HTTP_X_FORWARDED_FOR=ip)


@pytest.fixture
def com_chave(settings: Any) -> None:
    settings.ANTHROPIC_API_KEY = "chave-de-teste"


@pytest.fixture
def cliente_ok(monkeypatch: pytest.MonkeyPatch) -> ClienteLLMFalso:
    cli = ClienteLLMFalso([final("resposta", "Fica no [Painel](/painel).") for _ in range(10)])
    monkeypatch.setattr(views, "obter_cliente", lambda: cli)
    return cli


def test_estado_sem_chave(api: APIClient) -> None:
    assert api.get("/api/v1/zetele/estado").json() == {"disponivel": False, "motivo": "sem_chave"}


def test_estado_com_chave(api: APIClient, com_chave: None) -> None:
    assert api.get("/api/v1/zetele/estado").json() == {"disponivel": True, "motivo": None}


def test_perguntar_sem_chave_devolve_503_e_registra(api: APIClient, dados_soja: Produto) -> None:
    r = pedir(api)
    assert r.status_code == 503
    assert r.json()["motivo"] == "sem_chave"
    assert "Retry-After" in r
    assert Pergunta.objects.get().status == "indisponivel"


def test_perguntar_responde_e_registra_sem_ip(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, dados_soja: Produto
) -> None:
    r = pedir(api, pergunta="meu cpf 123.456.789-09, onde fica o ranking?")
    assert r.status_code == 200
    assert r.json() == {
        "status": "respondida",
        "texto": "Fica no [Painel](/painel).",
        "fontes": [],
        "sugestoes": [],
    }
    p = Pergunta.objects.get()
    assert (p.texto, p.status, p.pagina) == (
        "meu cpf [removido], onde fica o ranking?",
        "respondida",
        "/painel",
    )
    assert p.tokens_entrada > 0


@pytest.mark.parametrize(
    "corpo",
    [
        {"pergunta": ""},
        {"pergunta": "x" * 501},
        {"pagina": "/sobre"},
        {"historico": [{"papel": "visitante", "texto": "a"}] * 7},
        {"historico": [{"papel": "robo", "texto": "a"}]},
        {"historico": [{"papel": "visitante", "texto": "a" * 1201}]},
    ],
)
def test_entrada_invalida_400(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, corpo: dict[str, Any]
) -> None:
    r = pedir(api, **corpo)
    assert r.status_code == 400
    assert r.json()["erro"] == "Parâmetros inválidos"


def test_orcamento_diario(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, settings: Any, dados_soja: Produto
) -> None:
    settings.ZETELE_LIMITE_DIARIO = 1
    assert pedir(api).status_code == 200
    r = pedir(api, ip="198.51.100.2")
    assert (r.status_code, r.json()["motivo"]) == (503, "orcamento_diario")
    assert api.get("/api/v1/zetele/estado").json()["motivo"] == "orcamento_diario"


def test_ocupado(
    api: APIClient,
    com_chave: None,
    cliente_ok: ClienteLLMFalso,
    monkeypatch: pytest.MonkeyPatch,
    dados_soja: Produto,
) -> None:
    cheio = threading.BoundedSemaphore(1)
    cheio.acquire()
    monkeypatch.setattr(views, "SEMAFORO", cheio)
    r = pedir(api)
    assert (r.status_code, r.json()["motivo"], r["Retry-After"]) == (503, "ocupado", "10")


def test_provedor_fora_abre_o_disjuntor(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch, dados_soja: Produto
) -> None:
    monkeypatch.setattr(
        views, "obter_cliente", lambda: ClienteLLMFalso([ProvedorIndisponivel("HTTP 529")])
    )
    r = pedir(api)
    assert (r.status_code, r.json()["motivo"], r["Retry-After"]) == (503, "indisponivel", "60")
    assert api.get("/api/v1/zetele/estado").json() == {
        "disponivel": False,
        "motivo": "indisponivel",
    }
    assert Pergunta.objects.get().status == "erro"


def test_verificacao_falhou_aparece_como_respondida(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch, dados_soja: Produto
) -> None:
    monkeypatch.setattr(
        views,
        "obter_cliente",
        lambda: ClienteLLMFalso([final("resposta", "Rondônia produz 7.777.777 t.")]),
    )
    r = pedir(api)
    assert r.json()["status"] == "respondida"
    assert Pergunta.objects.get().status == "verificacao_falhou"


def test_limite_por_ip(
    api: APIClient,
    com_chave: None,
    cliente_ok: ClienteLLMFalso,
    monkeypatch: pytest.MonkeyPatch,
    dados_soja: Produto,
) -> None:
    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {"anon": "300/min", "zetele": "2/min", "zetele_global": "100/min"},
    )
    cache.clear()
    assert [pedir(api).status_code for _ in range(3)] == [200, 200, 429]
    assert pedir(api, ip="198.51.100.9").status_code == 200


def test_limite_global(
    api: APIClient,
    com_chave: None,
    cliente_ok: ClienteLLMFalso,
    monkeypatch: pytest.MonkeyPatch,
    dados_soja: Produto,
) -> None:
    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {"anon": "300/min", "zetele": "100/min", "zetele_global": "2/min"},
    )
    cache.clear()
    codigos = [pedir(api, ip=f"198.51.100.{i}").status_code for i in range(3)]
    assert codigos == [200, 200, 429]


ROTA_SISTEMA = "/api/v1/sistema/zetele/perguntar"


def pedir_sistema(api: APIClient, **corpo: Any) -> Any:
    dados = {
        "pergunta": "como peço o auditório?",
        "historico": [],
        "pagina": "/sistema/espacos",
        **corpo,
    }
    return api.post(ROTA_SISTEMA, dados, format="json", HTTP_X_FORWARDED_FOR="198.51.100.7")


# a área do sistema exige login (ADR 0035)
@pytest.mark.usefixtures("api_logado")
def test_cada_canal_aceita_so_as_proprias_paginas(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, dados_soja: Produto
) -> None:
    assert pedir(api, pagina="/sistema/espacos").status_code == 400
    assert pedir_sistema(api, pagina="/painel").status_code == 400
    assert pedir_sistema(api).status_code == 200


# a área do sistema exige login (ADR 0035)
@pytest.mark.usefixtures("api_logado")
def test_perguntas_do_sistema_vao_para_tabela_propria(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, dados_soja: Produto
) -> None:
    pedir(api)
    pedir_sistema(api)
    assert Pergunta.objects.count() == 1
    assert PerguntaSistema.objects.get().pagina == "/sistema/espacos"


# a área do sistema exige login (ADR 0035)
@pytest.mark.usefixtures("api_logado")
def test_limite_diario_de_cada_canal_e_independente(
    api: APIClient, com_chave: None, cliente_ok: ClienteLLMFalso, dados_soja: Produto, settings: Any
) -> None:
    settings.ZETELE_LIMITE_DIARIO = 1
    settings.ZETELE_SISTEMA_LIMITE_DIARIO = 2
    assert pedir(api).status_code == 200
    assert pedir(api).json()["motivo"] == "orcamento_diario"
    assert api.get("/api/v1/zetele/estado").json()["motivo"] == "orcamento_diario"
    # o público esgotado não afeta o sistema
    estado = api.get("/api/v1/sistema/zetele/estado").json()
    assert (estado["disponivel"], estado["motivo"]) == (True, None)
    assert pedir_sistema(api).status_code == 200
    assert pedir_sistema(api).status_code == 200
    assert pedir_sistema(api).json()["motivo"] == "orcamento_diario"
