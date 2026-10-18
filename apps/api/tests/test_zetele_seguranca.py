"""Correções da auditoria de 18/10/2026: teto diário no banco, ordem do semáforo, só JSON, 4xx sem
disjuntor, link aninhado e expurgo dos contadores."""

import threading
from datetime import timedelta
from typing import Any

import anthropic
import httpx2 as httpx  # o SDK anthropic 1.x usa o httpx2
import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from indicadores.models import Produto
from tests.zetele_falso import ClienteLLMFalso, final
from zetele import disponibilidade, views
from zetele.cliente import ClienteAnthropic, PedidoRecusado, ProvedorIndisponivel
from zetele.expurgo import expurgar_perguntas
from zetele.models import ContagemDiaria
from zetele.verificacao import verificar

pytestmark = pytest.mark.django_db
ROTA = "/api/v1/zetele/perguntar"


@pytest.fixture(autouse=True)
def _limpa() -> None:
    cache.clear()


@pytest.fixture
def com_chave(settings: Any) -> None:
    settings.ANTHROPIC_API_KEY = "chave-de-teste"


def pedir(api: APIClient, **kwargs: Any) -> Any:
    corpo = {"pergunta": "onde fica o ranking?", "historico": [], "pagina": "/painel"}
    return api.post(ROTA, corpo, format="json", HTTP_X_FORWARDED_FOR="198.51.100.40", **kwargs)


def test_teto_diario_fica_no_banco_por_canal_e_nao_some_com_o_cache(
    settings: Any, com_chave: None
) -> None:
    settings.ZETELE_LIMITE_DIARIO = 2
    assert disponibilidade.contar_pergunta("publico") == 1
    assert disponibilidade.contar_pergunta("publico") == 2
    assert disponibilidade.contar_pergunta("sistema") == 1
    cache.clear()  # antes, limpar ou despejar o cache zerava o dia
    assert disponibilidade.perguntas_hoje("publico") == 2
    assert disponibilidade.estado("publico")["motivo"] == "orcamento_diario"
    disponibilidade.devolver_pergunta("publico")
    assert disponibilidade.perguntas_hoje("publico") == 1
    assert ContagemDiaria.objects.get(canal="sistema").total == 1


def test_ocupado_nao_gasta_o_teto_do_dia(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    lotado = threading.BoundedSemaphore(1)
    lotado.acquire()
    monkeypatch.setattr(views, "SEMAFORO", lotado)
    r = pedir(api)
    assert r.json()["motivo"] == "ocupado"
    assert disponibilidade.perguntas_hoje("publico") == 0


def test_teto_estourado_devolve_a_contagem(
    api: APIClient,
    com_chave: None,
    settings: Any,
    monkeypatch: pytest.MonkeyPatch,
    dados_soja: Produto,
) -> None:
    settings.ZETELE_LIMITE_DIARIO = 1
    monkeypatch.setattr(
        views,
        "obter_cliente",
        lambda: ClienteLLMFalso([final("resposta", "Fica no [Painel](/painel).")]),
    )
    assert pedir(api).status_code == 200
    assert pedir(api).json()["motivo"] == "orcamento_diario"
    assert disponibilidade.perguntas_hoje("publico") == 1


# a área do sistema exige login (ADR 0035)
@pytest.mark.usefixtures("api_logado")
def test_so_aceita_json(api: APIClient, com_chave: None) -> None:
    corpo = {"pergunta": "x", "pagina": "/painel"}
    for rota in (ROTA, "/api/v1/sistema/zetele/perguntar", "/api/v1/sistema/interpretar"):
        assert api.post(rota, corpo, HTTP_X_FORWARDED_FOR="198.51.100.41").status_code == 415


def test_pedido_recusado_nao_abre_o_disjuntor(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        views, "obter_cliente", lambda: ClienteLLMFalso([PedidoRecusado("HTTP 400")])
    )
    assert pedir(api).json()["motivo"] == "indisponivel"
    assert disponibilidade.estado("publico") == {"disponivel": True, "motivo": None}


def _erro(status: int) -> anthropic.APIStatusError:
    resposta = httpx.Response(
        status, request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    )
    return anthropic.APIStatusError("erro", response=resposta, body=None)


@pytest.mark.parametrize(
    ("status", "esperado"),
    [
        (400, PedidoRecusado),
        (413, PedidoRecusado),
        (500, ProvedorIndisponivel),
        (529, ProvedorIndisponivel),
    ],
)
def test_cliente_separa_erro_do_pedido_de_falha_do_provedor(
    status: int, esperado: type[Exception], monkeypatch: pytest.MonkeyPatch
) -> None:
    cli = ClienteAnthropic("chave", "modelo")

    def falhar(**_: Any) -> Any:
        raise _erro(status)

    monkeypatch.setattr(cli._cliente.beta.messages, "create", falhar)
    with pytest.raises(esperado):
        cli.criar(system=[], messages=[], tools=[], ultima_rodada=True, timeout=5.0)


def test_link_dentro_de_outro_link_vira_texto() -> None:
    for malicioso in (
        "[a [b](/\\evil.example) c](/painel)",
        "[a [b](https://evil.example) c](/painel)",
    ):
        v = verificar(malicioso, dados=[], referencias=[], urls_ferramentas=set())
        assert "](" not in v.texto
        assert v.links_removidos >= 1


def test_expurgo_apaga_contadores_antigos() -> None:
    hoje = timezone.localdate()
    ContagemDiaria.objects.create(canal="publico", dia=hoje - timedelta(days=120), total=50)
    ContagemDiaria.objects.create(canal="publico", dia=hoje, total=3)
    expurgar_perguntas()
    assert list(ContagemDiaria.objects.values_list("total", flat=True)) == [3]
