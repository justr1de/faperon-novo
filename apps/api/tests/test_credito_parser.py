"""Tradução das linhas do SICOR (BCB) para o modelo agregado do crédito rural."""

from decimal import Decimal

import pytest

from credito.parser import (
    ErroFormatoSicor,
    agregar_municipios,
    agregar_produtos,
    atividade_de,
    mapa_bcb_para_ibge,
    normalizar_produto,
    programa_de,
)
from tests.conftest import carregar_fixture


def test_programa_pronaf_pronamp_e_demais() -> None:
    assert programa_de("0001") == "pronaf"
    assert programa_de("0050") == "pronamp"
    assert programa_de("0999") == "demais"  # sem programa
    assert programa_de("0162") == "demais"  # Inovagro e os outros programas


def test_atividade_agricola_e_pecuaria() -> None:
    assert atividade_de("1") == "agricola"
    assert atividade_de("2") == "pecuaria"
    with pytest.raises(ErroFormatoSicor):
        atividade_de("9")


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ('"SOJA"', ("soja", "Soja")),
        (
            '"MANDIOCA (AIPIM, MACAXEIRA)"',
            ("mandioca-aipim-macaxeira", "Mandioca (aipim, macaxeira)"),
        ),
        ('  "MÁQUINAS  E IMPLEMENTOS" ', ("maquinas-e-implementos", "Máquinas e implementos")),
        ("CAFÉ", ("cafe", "Café")),
    ],
)
def test_nome_do_produto_normalizado(bruto: str, esperado: tuple[str, str]) -> None:
    assert normalizar_produto(bruto) == esperado


def test_uma_linha_vira_uma_medida_por_finalidade_com_valor() -> None:
    linhas = [
        {
            "cdMunicipio": "47018",
            "codMunicIbge": "1101807",
            "MesEmissao": "03",
            "AnoEmissao": "2026",
            "cdPrograma": "0001",
            "Atividade": "2",
            "QtdCusteio": 2,
            "VlCusteio": 100.5,
            "QtdInvestimento": 1,
            "VlInvestimento": 50.0,
            "QtdComercializacao": 0,
            "VlComercializacao": 0.0,
            "QtdIndustrializacao": 0,
            "VlIndustrializacao": 0.0,
            "AreaCusteio": 10.0,
            "AreaInvestimento": 0.0,
        },
        {  # mesma chave agregada (outro subprograma do Pronaf): soma
            "cdMunicipio": "47018",
            "codMunicIbge": "1101807",
            "MesEmissao": "03",
            "AnoEmissao": "2026",
            "cdPrograma": "0001",
            "Atividade": "2",
            "QtdCusteio": 1,
            "VlCusteio": 9.5,
            "QtdInvestimento": 0,
            "VlInvestimento": 0.0,
            "QtdComercializacao": 0,
            "VlComercializacao": 0.0,
            "QtdIndustrializacao": 0,
            "VlIndustrializacao": 0.0,
            "AreaCusteio": 2.5,
            "AreaInvestimento": 0.0,
        },
    ]
    agregado = agregar_municipios(linhas)
    custeio = agregado[("1101807", 2026, 3, "pronaf", "custeio", "pecuaria")]
    assert (custeio.contratos, custeio.valor, custeio.area_ha) == (
        3,
        Decimal("110.0"),
        Decimal("12.5"),
    )
    invest = agregado[("1101807", 2026, 3, "pronaf", "investimento", "pecuaria")]
    assert (invest.contratos, invest.valor) == (1, Decimal("50.0"))
    # comercialização e industrialização zeradas não viram linha (ausente nunca é zero)
    assert len(agregado) == 2


def test_amostra_real_soma_o_mesmo_que_a_fonte() -> None:
    linhas = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")["value"]
    agregado = agregar_municipios(linhas)
    assert sum(m.valor for m in agregado.values()) == Decimal("46185692.84")
    assert sum(m.contratos for m in agregado.values()) == 235
    pronaf = sum(m.valor for k, m in agregado.items() if k[3] == "pronaf")
    assert pronaf == Decimal("12624700.81")
    assert {k[2] for k in agregado} == set(range(1, 10))  # jan a set


def test_linha_de_outro_estado_ou_ano_e_recusada() -> None:
    linha = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")["value"][0]
    with pytest.raises(ErroFormatoSicor):
        agregar_municipios([{**linha, "codMunicIbge": "5103403"}])
    with pytest.raises(ErroFormatoSicor):
        agregar_municipios([{**linha, "MesEmissao": "13"}])
    with pytest.raises(ErroFormatoSicor):
        agregar_municipios([{**linha, "VlCusteio": "abc"}])


def test_produtos_de_custeio_e_investimento_com_mapa_de_municipios() -> None:
    municipios = carregar_fixture("sicor_municipio_vale_do_paraiso_2026.json")["value"]
    mapa = mapa_bcb_para_ibge(municipios)
    assert mapa == {"47018": "1101807"}
    custeio = carregar_fixture("sicor_custeio_produto_vale_do_paraiso_2026.json")["value"]
    invest = carregar_fixture("sicor_invest_produto_vale_do_paraiso_2026.json")["value"]
    agregado, sem_municipio = agregar_produtos(custeio, invest, mapa)
    assert sem_municipio == 0
    assert sum(p.valor for k, p in agregado.items() if k[4] == "custeio") == Decimal("23655187.94")
    assert sum(p.valor for k, p in agregado.items() if k[4] == "investimento") == Decimal(
        "22530504.90"
    )
    bovinos = sum(p.valor for k, p in agregado.items() if k[6] == "bovinos")
    assert bovinos == Decimal("31608882.38")
    assert next(p.nome for k, p in agregado.items() if k[6] == "bovinos") == "Bovinos"


def test_investimento_de_municipio_fora_do_mapa_e_contado_e_descartado() -> None:
    invest = carregar_fixture("sicor_invest_produto_vale_do_paraiso_2026.json")["value"]
    agregado, sem_municipio = agregar_produtos([], invest, {})
    assert agregado == {}
    assert sem_municipio == len(invest)
