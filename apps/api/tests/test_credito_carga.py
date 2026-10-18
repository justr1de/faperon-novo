"""Carga do SICOR no banco: upsert idempotente por ano, registro da carga e agendador."""

from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
from django.core.management import call_command
from django.db.models import Sum
from django.utils import timezone

from credito import agendador
from credito.carga import CargaCreditoFalhou, atualizar_credito, executar_carga_ano
from credito.models import CargaCredito, CreditoMunicipio, CreditoProduto
from credito.sicor import ErroSicor
from indicadores.models import Municipio
from tests.conftest import carregar_fixture

VP = "1101807"


class SicorFalso:
    """Substitui o SicorCliente: devolve as amostras gravadas de Vale do Paraíso, sem rede."""

    def __init__(self, respostas: dict[tuple[str, int], Any] | None = None) -> None:
        self.respostas = respostas or {}
        self.chamadas: list[tuple[str, int]] = []

    def dados(self, recurso: str, ano: int) -> list[dict[str, Any]]:
        self.chamadas.append((recurso, ano))
        resposta = self.respostas.get((recurso, ano), [])
        if isinstance(resposta, Exception):
            raise resposta
        return list(resposta)


def amostra(ano: int) -> dict[tuple[str, int], Any]:
    respostas: dict[tuple[str, int], Any] = {
        ("municipio", ano): carregar_fixture(f"sicor_municipio_vale_do_paraiso_{ano}.json")["value"]
    }
    if ano == 2026:
        respostas[("custeio", ano)] = carregar_fixture(
            "sicor_custeio_produto_vale_do_paraiso_2026.json"
        )["value"]
        respostas[("investimento", ano)] = carregar_fixture(
            "sicor_invest_produto_vale_do_paraiso_2026.json"
        )["value"]
    return respostas


@pytest.fixture
def vale_do_paraiso(db: None) -> Municipio:
    return Municipio.objects.create(
        codigo_ibge=VP, nome="Vale do Paraíso", microrregiao="Ji-Paraná"
    )


def _total(ano: int) -> Decimal:
    return CreditoMunicipio.objects.filter(ano=ano).aggregate(s=Sum("valor"))["s"] or Decimal(0)


def test_carga_do_ano_grava_totais_e_produtos(vale_do_paraiso: Municipio) -> None:
    carga = executar_carga_ano(2026, SicorFalso(amostra(2026)))
    assert carga.status == CargaCredito.Status.SUCESSO
    assert carga.ano == 2026 and carga.concluida_em is not None
    assert carga.linhas == CreditoMunicipio.objects.count() > 0
    assert carga.linhas_produtos == CreditoProduto.objects.count() > 0
    assert _total(2026) == Decimal("46185692.84")
    assert CreditoMunicipio.objects.aggregate(s=Sum("contratos"))["s"] == 235
    produtos = CreditoProduto.objects.aggregate(s=Sum("valor"))["s"]
    assert produtos == Decimal("23655187.94") + Decimal("22530504.90")


def test_carga_repetida_e_idempotente(vale_do_paraiso: Municipio) -> None:
    cliente = SicorFalso(amostra(2026))
    executar_carga_ano(2026, cliente)
    antes = (CreditoMunicipio.objects.count(), CreditoProduto.objects.count(), _total(2026))
    segunda = executar_carga_ano(2026, cliente)
    assert (CreditoMunicipio.objects.count(), CreditoProduto.objects.count(), _total(2026)) == antes
    assert set(CreditoMunicipio.objects.values_list("carga_id", flat=True)) == {segunda.pk}
    assert CargaCredito.objects.count() == 2


def test_linha_que_some_da_fonte_sai_so_daquele_ano(vale_do_paraiso: Municipio) -> None:
    executar_carga_ano(2025, SicorFalso(amostra(2025)))
    executar_carga_ano(2026, SicorFalso(amostra(2026)))
    total_2025 = _total(2025)
    so_janeiro = [r for r in amostra(2026)[("municipio", 2026)] if r["MesEmissao"] == "01"]
    executar_carga_ano(2026, SicorFalso({("municipio", 2026): so_janeiro}))
    assert set(CreditoMunicipio.objects.filter(ano=2026).values_list("mes", flat=True)) == {1}
    assert not CreditoProduto.objects.filter(ano=2026).exists()
    assert _total(2025) == total_2025


def test_erro_da_fonte_registra_falha_e_mantem_os_dados(vale_do_paraiso: Municipio) -> None:
    executar_carga_ano(2026, SicorFalso(amostra(2026)))
    total = _total(2026)
    quebrado = SicorFalso({**amostra(2026), ("investimento", 2026): ErroSicor("BCB fora")})
    with pytest.raises(CargaCreditoFalhou, match="BCB fora"):
        executar_carga_ano(2026, quebrado)
    falha = CargaCredito.objects.order_by("-iniciada_em").first()
    assert falha is not None and falha.status == CargaCredito.Status.FALHA
    assert "BCB fora" in falha.erro and falha.concluida_em is not None
    assert _total(2026) == total


def test_fonte_vazia_nao_apaga_ano_que_ja_tinha_dados(vale_do_paraiso: Municipio) -> None:
    executar_carga_ano(2026, SicorFalso(amostra(2026)))
    with pytest.raises(CargaCreditoFalhou, match="nenhuma linha"):
        executar_carga_ano(2026, SicorFalso())
    assert _total(2026) == Decimal("46185692.84")


def test_ano_sem_dados_publicados_ainda_e_sucesso_com_zero_linhas(
    vale_do_paraiso: Municipio,
) -> None:
    carga = executar_carga_ano(2027, SicorFalso())
    assert carga.status == CargaCredito.Status.SUCESSO and carga.linhas == 0


def test_municipio_fora_do_cadastro_e_descartado(vale_do_paraiso: Municipio) -> None:
    linhas = amostra(2026)[("municipio", 2026)]
    estranho = {**linhas[0], "codMunicIbge": "1199999", "cdMunicipio": "99999"}
    carga = executar_carga_ano(2026, SicorFalso({("municipio", 2026): [*linhas, estranho]}))
    assert carga.status == CargaCredito.Status.SUCESSO
    assert not CreditoMunicipio.objects.filter(municipio_id="1199999").exists()
    assert _total(2026) == Decimal("46185692.84")


@pytest.mark.django_db
def test_sem_cadastro_de_municipios_a_carga_falha() -> None:
    with pytest.raises(CargaCreditoFalhou, match="municípios"):
        executar_carga_ano(2026, SicorFalso(amostra(2026)))


def test_anos_da_rodada() -> None:
    assert agendador.anos_da_rodada(2026, set()) == list(range(2018, 2027))
    # com dados: os dois últimos anos e os que nunca carregaram com sucesso
    assert agendador.anos_da_rodada(2026, set(range(2018, 2027))) == [2025, 2026]
    assert agendador.anos_da_rodada(2026, {2018, 2019, 2021, 2022, 2023, 2024}) == [
        2020,
        2025,
        2026,
    ]


@pytest.mark.django_db
def test_atualizacao_carrega_tudo_quando_vazia_e_depois_so_os_dois_ultimos_anos(
    vale_do_paraiso: Municipio,
) -> None:
    agora = timezone.now()
    anos = set(range(2018, agora.year + 1))
    cliente = SicorFalso({**amostra(2025), **amostra(2026)})
    assert atualizar_credito(cliente, agora) == len(anos)
    assert {a for _, a in cliente.chamadas} == anos
    # uma passada por dia: uma hora depois não roda de novo
    assert atualizar_credito(cliente, agora + timedelta(hours=1)) == 0
    cliente.chamadas.clear()
    assert atualizar_credito(cliente, agora + timedelta(days=1, hours=1)) == 2
    assert {a for _, a in cliente.chamadas} == {agora.year - 1, agora.year}


@pytest.mark.django_db
def test_falha_na_atualizacao_nao_derruba_e_espera_6_horas(vale_do_paraiso: Municipio) -> None:
    agora = timezone.now()
    anos = range(2018, agora.year + 1)
    quebrado = SicorFalso({("municipio", a): ErroSicor("BCB fora") for a in anos})
    assert atualizar_credito(quebrado, agora) == len(anos)
    assert CargaCredito.objects.filter(status=CargaCredito.Status.FALHA).count() == len(anos)
    assert atualizar_credito(quebrado, agora + timedelta(hours=1)) == 0
    # depois da espera, tenta de novo tudo o que nunca deu certo
    assert atualizar_credito(quebrado, agora + timedelta(hours=7)) == len(anos)


@pytest.mark.django_db
def test_comando_carregar_sicor(
    vale_do_paraiso: Municipio, monkeypatch: pytest.MonkeyPatch
) -> None:
    cliente = SicorFalso({**amostra(2025), **amostra(2026)})
    monkeypatch.setattr("credito.management.commands.carregar_sicor.SicorCliente", lambda: cliente)
    call_command("carregar_sicor", "--ano", "2026")
    assert {a for _, a in cliente.chamadas} == {2026}
    cliente.chamadas.clear()
    call_command("carregar_sicor", "--desde", "2025", "--ate", "2026")
    assert sorted({a for _, a in cliente.chamadas}) == [2025, 2026]
