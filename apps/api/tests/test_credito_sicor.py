"""Cliente OData do SICOR: filtro por RO, divisão por mês quando a resposta enche, novas tentativas."""

import re
from urllib.parse import parse_qs, urlsplit

import pytest
import requests
import responses

from credito.sicor import BASE_URL, ErroSicor, ErroSicorDefinitivo, SicorCliente
from tests.conftest import carregar_fixture

URL_MUNICIPIO = re.compile(
    re.escape(f"{BASE_URL}/CusteioInvestimentoComercialIndustrialSemFiltros") + r".*"
)


def _cliente(esperas: list[float] | None = None, limite: int = 20000) -> SicorCliente:
    destino = esperas if esperas is not None else []
    return SicorCliente(tentativas=3, espera_base=1.0, dormir=destino.append, limite=limite)


def _filtro(chamada: int) -> str:
    consulta = parse_qs(urlsplit(responses.calls[chamada].request.url).query)
    return consulta["$filter"][0]


@responses.activate
def test_filtra_sempre_por_ro_e_pelo_ano_e_pede_so_os_campos_usados() -> None:
    corpo = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")
    responses.add(responses.GET, URL_MUNICIPIO, json=corpo)
    linhas = _cliente().dados("municipio", 2026)
    assert len(linhas) == 83
    assert _filtro(0) == "cdEstado eq '22' and AnoEmissao eq '2026'"
    consulta = parse_qs(urlsplit(responses.calls[0].request.url).query)
    assert "codMunicIbge" in consulta["$select"][0]
    assert consulta["$format"] == ["json"]
    assert consulta["$top"] == ["20000"]
    # o Olinda não aceita '+' no lugar do espaço (responde 400 "Edm.Boolean and Edm.String")
    url = responses.calls[0].request.url
    assert "+" not in url and "cdEstado%20eq%20'22'" in url


@responses.activate
def test_resposta_cheia_e_dividida_por_mes() -> None:
    # O OData do BCB não aceita $skip (responde 500): quando o ano enche o $top, a carga pede mês a mês.
    linha = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")["value"][0]
    responses.add(responses.GET, URL_MUNICIPIO, json={"value": [linha, linha, linha]})
    for _ in range(12):
        responses.add(responses.GET, URL_MUNICIPIO, json={"value": [linha]})
    linhas = _cliente(limite=3).dados("municipio", 2026)
    assert len(linhas) == 12
    assert len(responses.calls) == 13
    assert _filtro(1) == "cdEstado eq '22' and AnoEmissao eq '2026' and MesEmissao eq '01'"
    assert _filtro(12) == "cdEstado eq '22' and AnoEmissao eq '2026' and MesEmissao eq '12'"


@responses.activate
def test_mes_que_ainda_enche_o_limite_e_erro_para_nao_somar_pela_metade() -> None:
    linha = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")["value"][0]
    responses.add(responses.GET, URL_MUNICIPIO, json={"value": [linha, linha]})
    with pytest.raises(ErroSicorDefinitivo, match="truncada"):
        _cliente(limite=2).dados("municipio", 2026)


@responses.activate
def test_erro_500_do_bcb_tenta_de_novo_com_espera_crescente() -> None:
    erro = '/*{\n  "codigo" : 500,\n  "mensagem" : "Erro desconhecido"\n}*/'
    responses.add(responses.GET, URL_MUNICIPIO, body=erro, status=500)
    responses.add(responses.GET, URL_MUNICIPIO, body=requests.ConnectionError("sem rede"))
    responses.add(responses.GET, URL_MUNICIPIO, json={"value": []})
    esperas: list[float] = []
    assert _cliente(esperas).dados("municipio", 2026) == []
    assert esperas == [1.0, 2.0]


@responses.activate
def test_fonte_fora_do_ar_vira_erro_com_a_mensagem_do_bcb() -> None:
    erro = '/*{\n  "codigo" : 500,\n  "mensagem" : "Erro desconhecido"\n}*/'
    responses.add(responses.GET, URL_MUNICIPIO, body=erro, status=500)
    with pytest.raises(ErroSicor, match="Erro desconhecido"):
        _cliente().dados("municipio", 2026)
    assert len(responses.calls) == 3


@responses.activate
def test_filtro_recusado_400_nao_repete() -> None:
    erro = '/*{\n  "codigo" : 400,\n  "mensagem" : "The types \'Edm.String\' and \'Edm.SByte\' are not compatible."\n}*/'
    responses.add(responses.GET, URL_MUNICIPIO, body=erro, status=400)
    esperas: list[float] = []
    with pytest.raises(ErroSicorDefinitivo, match="not compatible"):
        _cliente(esperas).dados("municipio", 2026)
    assert esperas == [] and len(responses.calls) == 1


@responses.activate
def test_resposta_sem_lista_value_e_recusada() -> None:
    responses.add(responses.GET, URL_MUNICIPIO, json={"erro": "x"})
    with pytest.raises(ErroSicorDefinitivo):
        _cliente().dados("municipio", 2026)


def test_recurso_desconhecido() -> None:
    with pytest.raises(ValueError):
        _cliente().dados("comercializacao", 2026)
