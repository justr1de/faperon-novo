import json
from datetime import date
from typing import Any

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from tests.zetele_falso import Bloco, ClienteLLMFalso, RespostaFalsa
from zetele import views, voz
from zetele.cliente import ProvedorIndisponivel
from zetele.models import Pergunta

ROTA = "/api/v1/sistema/interpretar"
pytestmark = pytest.mark.django_db

@pytest.fixture(autouse=True)
def logado(api_logado: APIClient) -> None:
    """Todas as rotas daqui são da área do sistema, que exige login (ADR 0035)."""
VEICULOS = [
    {"id": "v-hilux", "descricao": "Toyota Hilux (QRT4E21)"},
    {"id": "v-gol", "descricao": "VW Gol (NEB-1234)"},
]
ESPACOS = [
    {"id": "auditorio", "descricao": "Auditório"},
    {"id": "hub", "descricao": "Hub de inovação"},
]


def saida(campos: dict[str, Any]) -> RespostaFalsa:
    return RespostaFalsa("end_turn", [Bloco("text", text=json.dumps(campos, ensure_ascii=False))])


def pedir(api: APIClient, **corpo: Any) -> Any:
    dados = {
        "tipo": "evento",
        "texto": "reunião com o sindicato terça às nove",
        "hoje": "2026-10-17",
        **corpo,
    }
    return api.post(ROTA, dados, format="json", HTTP_X_FORWARDED_FOR="198.51.100.9")


@pytest.fixture
def com_chave(settings: Any) -> None:
    settings.ANTHROPIC_API_KEY = "chave-de-teste"


def usar(monkeypatch: pytest.MonkeyPatch, *roteiro: RespostaFalsa | Exception) -> ClienteLLMFalso:
    cli = ClienteLLMFalso(list(roteiro))
    monkeypatch.setattr(views, "obter_cliente", lambda: cli)
    return cli


EVENTO = {
    "titulo": "Reunião com o sindicato",
    "data": "2026-10-20",
    "inicio": "09:00",
    "fim": "10:00",
    "local": "",
    "tipo": "reuniao",
    "descricao": "",
}


def test_evento_interpretado_com_formato_proprio_e_dia_da_semana(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    cli = usar(monkeypatch, saida(EVENTO))
    r = pedir(api)
    assert r.status_code == 200
    assert r.json() == {"tipo": "evento", "campos": EVENTO, "faltando": []}
    pedido = cli.pedidos[0]
    assert pedido["formato"] == voz.FORMATOS["evento"]
    assert pedido["tools"] == []
    conteudo = pedido["messages"][0]["content"]
    assert "Hoje é sábado, 2026-10-17." in conteudo
    assert "<transcricao>reunião com o sindicato terça às nove</transcricao>" in conteudo
    # a transcrição não é registrada
    assert Pergunta.objects.count() == 0


def test_conferencia_esvazia_o_que_nao_passa() -> None:
    evento = voz.conferir(
        "evento",
        {**EVENTO, "data": "2026-02-30", "inicio": "25:00", "fim": "08:00", "tipo": "festa"},
        [],
        [],
    )
    assert (evento["data"], evento["inicio"], evento["fim"], evento["tipo"]) == (
        "",
        "",
        "08:00",
        "reuniao",
    )
    assert voz.faltando("evento", evento) == ["data", "início"]

    reserva = voz.conferir(
        "reserva",
        {
            "veiculoId": "v-inventado",
            "dataSaida": "2026-10-22",
            "horaSaida": "07:00",
            "dataRetorno": "2026-10-22",
            "horaRetorno": "06:00",
            "destino": "Cacoal",
            "motivo": "",
        },
        VEICULOS,
        [],
    )
    assert (reserva["veiculoId"], reserva["dataRetorno"], reserva["horaRetorno"]) == ("", "", "")
    assert voz.faltando("reserva", reserva) == ["veículo", "data de retorno", "hora de retorno"]

    espaco = voz.conferir(
        "espaco",
        {
            "espacoId": "auditorio",
            "data": "2026-10-20",
            "periodo": "tarde",
            "inicio": "13:00",
            "fim": "17:00",
            "tipo": "palestra",
            "nome": "Palestra",
            "participantes": True,
            "coffeeBreak": "sim",
            "observacoes": "",
        },
        [],
        ESPACOS,
    )
    assert (espaco["inicio"], espaco["fim"], espaco["participantes"], espaco["coffeeBreak"]) == (
        "",
        "",
        0,
        False,
    )
    assert voz.faltando("espaco", espaco) == ["participantes"]
    assert voz.faltando("espaco", {**espaco, "periodo": "horario", "participantes": 80}) == [
        "início",
        "fim",
    ]


def test_reserva_manda_a_lista_de_veiculos_e_aceita_id_da_lista(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    campos = {
        "veiculoId": "v-hilux",
        "dataSaida": "2026-10-22",
        "horaSaida": "07:00",
        "dataRetorno": "2026-10-22",
        "horaRetorno": "18:00",
        "destino": "Cacoal",
        "motivo": "Visita técnica",
    }
    cli = usar(monkeypatch, saida(campos))
    r = pedir(
        api,
        tipo="reserva",
        texto="preciso da hilux quinta das sete às dezoito para Cacoal",
        veiculos=VEICULOS,
    )
    assert r.json()["campos"] == campos
    assert "- v-hilux: Toyota Hilux (QRT4E21)" in cli.pedidos[0]["messages"][0]["content"]


def test_entrada_invalida(api: APIClient, com_chave: None) -> None:
    assert pedir(api, tipo="festa").status_code == 400
    assert pedir(api, texto="x" * 501).status_code == 400
    assert pedir(api, hoje="ontem").status_code == 400
    assert (
        pedir(
            api, tipo="reserva", veiculos=[{"id": str(i), "descricao": "v"} for i in range(21)]
        ).status_code
        == 400
    )


def test_sem_chave_503(api: APIClient) -> None:
    r = pedir(api)
    assert r.status_code == 503
    assert r.json()["motivo"] == "sem_chave"


def test_recusa_ou_saida_quebrada_vira_422(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    usar(
        monkeypatch,
        RespostaFalsa("refusal", []),
        RespostaFalsa("end_turn", [Bloco("text", text="não é json")]),
    )
    assert pedir(api).status_code == 422
    assert pedir(api).status_code == 422


def test_provedor_fora_abre_o_disjuntor(
    api: APIClient, com_chave: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    usar(monkeypatch, ProvedorIndisponivel("HTTP 529"))
    assert pedir(api).json()["motivo"] == "indisponivel"
    assert api.get("/api/v1/zetele/estado").json()["disponivel"] is False


def test_conta_no_limite_diario(
    api: APIClient, com_chave: None, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings.ZETELE_SISTEMA_LIMITE_DIARIO = 1
    usar(monkeypatch, saida(EVENTO), saida(EVENTO))
    assert pedir(api).status_code == 200
    assert pedir(api).json()["motivo"] == "orcamento_diario"


def test_contexto_inclui_espacos(monkeypatch: pytest.MonkeyPatch) -> None:
    cli = ClienteLLMFalso(
        [
            saida(
                {
                    "espacoId": "hub",
                    "data": "2026-10-20",
                    "periodo": "manha",
                    "inicio": "",
                    "fim": "",
                    "tipo": "curso",
                    "nome": "Curso de drones",
                    "participantes": 25,
                    "coffeeBreak": True,
                    "observacoes": "",
                }
            )
        ]
    )
    resultado = voz.interpretar(
        cli,
        "espaco",
        "hub terça de manhã, curso de drones para 25 com coffee",
        date(2026, 10, 17),
        [],
        ESPACOS,
    )
    assert resultado.faltando == []
    assert resultado.campos["coffeeBreak"] is True
    assert "- hub: Hub de inovação" in cli.pedidos[0]["messages"][0]["content"]


@pytest.fixture(autouse=True)
def _limpa_cache() -> None:
    cache.clear()


def test_atividade_relato_no_passado(monkeypatch: pytest.MonkeyPatch) -> None:
    bruto = {
        "titulo": "Visita técnica a produtores de café",
        "data": "2026-10-17",
        "inicio": "08:00",
        "fim": "12:00",
        "tipo": "visita_tecnica",
        "municipio": "Cacoal",
        "publico": 12,
        "descricao": "Visita às lavouras",
        "resultados": "Três encaminhados para análise de solo",
    }
    cli = ClienteLLMFalso([saida(bruto)])
    r = voz.interpretar(
        cli, "atividade", "hoje das oito ao meio-dia visitei...", date(2026, 10, 17), [], []
    )
    assert r.campos == bruto
    assert r.faltando == []
    assert cli.pedidos[0]["formato"] == voz.FORMATOS["atividade"]
    estranho = voz.conferir(
        "atividade", {**bruto, "tipo": "festa", "publico": -3, "fim": "07:00"}, [], []
    )
    assert (estranho["tipo"], estranho["publico"], estranho["fim"]) == ("outro", 0, "")
    assert voz.faltando("atividade", estranho) == ["fim"]


def test_voz_gasta_o_orcamento_do_sistema_e_nao_o_publico(
    api: APIClient, com_chave: None, settings: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings.ZETELE_SISTEMA_LIMITE_DIARIO = 1
    usar(monkeypatch, saida(EVENTO))
    assert pedir(api).status_code == 200
    assert api.get("/api/v1/sistema/zetele/estado").json()["motivo"] == "orcamento_diario"
    assert api.get("/api/v1/zetele/estado").json() == {"disponivel": True, "motivo": None}
