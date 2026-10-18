"""ACL do SICOR: traduz as linhas do OData do BCB para as chaves do modelo agregado.

Funções puras, sem banco. Chave dos totais: (município IBGE, ano, mês, programa, finalidade, atividade).
Chave dos produtos: a mesma, mais o slug do produto.
"""

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.utils.text import slugify

# Códigos do próprio BCB (recurso ProgramaSubprogramaRegiaoUF).
PROGRAMA_PRONAF = "0001"
PROGRAMA_PRONAMP = "0050"
ATIVIDADES = {"1": "agricola", "2": "pecuaria"}
# Campos de quantidade, valor e área de cada finalidade no recurso por município.
FINALIDADES = {
    "custeio": ("QtdCusteio", "VlCusteio", "AreaCusteio"),
    "investimento": ("QtdInvestimento", "VlInvestimento", "AreaInvestimento"),
    "comercializacao": ("QtdComercializacao", "VlComercializacao", None),
    "industrializacao": ("QtdIndustrializacao", "VlIndustrializacao", None),
}

ChaveTotal = tuple[str, int, int, str, str, str]
ChaveProduto = tuple[str, int, int, str, str, str, str]


class ErroFormatoSicor(Exception):
    """Linha fora do formato esperado: a carga inteira falha em vez de gravar dado errado."""


@dataclass
class Medida:
    contratos: int = 0
    valor: Decimal = Decimal(0)
    area_ha: Decimal | None = None


@dataclass
class MedidaProduto:
    nome: str
    valor: Decimal = Decimal(0)
    area_ha: Decimal | None = None


def programa_de(codigo: str) -> str:
    if codigo == PROGRAMA_PRONAF:
        return "pronaf"
    if codigo == PROGRAMA_PRONAMP:
        return "pronamp"
    return "demais"


def atividade_de(codigo: str) -> str:
    try:
        return ATIVIDADES[str(codigo)]
    except KeyError:
        raise ErroFormatoSicor(f"Atividade desconhecida: {codigo!r}") from None


def normalizar_produto(bruto: str) -> tuple[str, str]:
    """'"MANDIOCA (AIPIM, MACAXEIRA)"' → ('mandioca-aipim-macaxeira', 'Mandioca (aipim, macaxeira)')."""
    texto = re.sub(r"\s+", " ", unicodedata.normalize("NFC", bruto).strip().strip('"').strip())
    if not texto:
        raise ErroFormatoSicor("Produto sem nome")
    nome = texto[0].upper() + texto[1:].lower()
    return slugify(nome)[:140], nome


def _decimal(valor: Any, campo: str) -> Decimal:
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError):
        raise ErroFormatoSicor(f"Valor inválido em {campo}: {valor!r}") from None
    if not numero.is_finite() or numero < 0:
        raise ErroFormatoSicor(f"Valor inválido em {campo}: {valor!r}")
    return numero


def _inteiro(valor: Any, campo: str) -> int:
    numero = _decimal(valor, campo)
    if numero != numero.to_integral_value():
        raise ErroFormatoSicor(f"Quantidade inválida em {campo}: {valor!r}")
    return int(numero)


def _periodo(linha: dict[str, Any]) -> tuple[int, int]:
    try:
        ano, mes = int(linha["AnoEmissao"]), int(linha["MesEmissao"])
    except (KeyError, TypeError, ValueError):
        raise ErroFormatoSicor(
            f"Período inválido: {linha.get('AnoEmissao')}/{linha.get('MesEmissao')}"
        ) from None
    if not 1 <= mes <= 12:
        raise ErroFormatoSicor(f"Mês inválido: {mes}")
    return ano, mes


def _municipio_ro(codigo: Any) -> str:
    texto = str(codigo or "")
    if not re.fullmatch(r"11\d{5}", texto):
        raise ErroFormatoSicor(f"Código IBGE fora de Rondônia: {codigo!r}")
    return texto


def mapa_bcb_para_ibge(linhas: Iterable[dict[str, Any]]) -> dict[str, str]:
    """O recurso de investimento por produto só traz o código de município do BCB; o por município traz os dois."""
    return {
        str(r["cdMunicipio"]): str(r["codMunicIbge"])
        for r in linhas
        if r.get("cdMunicipio") and r.get("codMunicIbge")
    }


def agregar_municipios(linhas: Iterable[dict[str, Any]]) -> dict[ChaveTotal, Medida]:
    """Recurso CusteioInvestimentoComercialIndustrialSemFiltros: uma linha vira até quatro finalidades."""
    saida: dict[ChaveTotal, Medida] = {}
    for linha in linhas:
        municipio = _municipio_ro(linha.get("codMunicIbge"))
        ano, mes = _periodo(linha)
        programa = programa_de(str(linha.get("cdPrograma", "")))
        atividade = atividade_de(linha.get("Atividade", ""))
        for finalidade, (campo_qtd, campo_valor, campo_area) in FINALIDADES.items():
            contratos = _inteiro(linha.get(campo_qtd, 0), campo_qtd)
            valor = _decimal(linha.get(campo_valor, 0), campo_valor)
            if contratos == 0 and valor == 0:
                continue  # sem operação dessa finalidade: não vira linha
            medida = saida.setdefault(
                (municipio, ano, mes, programa, finalidade, atividade), Medida()
            )
            medida.contratos += contratos
            medida.valor += valor
            if campo_area is not None:
                medida.area_ha = (medida.area_ha or Decimal(0)) + _decimal(
                    linha.get(campo_area, 0), campo_area
                )
    return saida


def _somar_produtos(
    saida: dict[ChaveProduto, MedidaProduto],
    linha: dict[str, Any],
    municipio: str,
    finalidade: str,
    campo_valor: str,
    campo_area: str,
) -> None:
    ano, mes = _periodo(linha)
    valor = _decimal(linha.get(campo_valor, 0), campo_valor)
    if valor == 0:
        return
    slug, nome = normalizar_produto(str(linha.get("nomeProduto", "")))
    chave = (
        municipio,
        ano,
        mes,
        programa_de(str(linha.get("cdPrograma", ""))),
        finalidade,
        atividade_de(linha.get("Atividade", "")),
        slug,
    )
    medida = saida.setdefault(chave, MedidaProduto(nome=nome))
    medida.valor += valor
    medida.area_ha = (medida.area_ha or Decimal(0)) + _decimal(linha.get(campo_area, 0), campo_area)


def agregar_produtos(
    custeio: Iterable[dict[str, Any]],
    investimento: Iterable[dict[str, Any]],
    mapa_municipios: dict[str, str],
) -> tuple[dict[ChaveProduto, MedidaProduto], int]:
    """Custeio (CusteioMunicipioProduto) e investimento (InvestMunicipioProduto) por produto.

    Devolve também quantas linhas de investimento ficaram fora por não achar o município no mapa.
    """
    saida: dict[ChaveProduto, MedidaProduto] = {}
    for linha in custeio:
        _somar_produtos(
            saida, linha, _municipio_ro(linha.get("codIbge")), "custeio", "VlCusteio", "AreaCusteio"
        )
    sem_municipio = 0
    for linha in investimento:
        codigo = mapa_municipios.get(str(linha.get("cdMunicipio", "")))
        if codigo is None:
            sem_municipio += 1
            continue
        _somar_produtos(
            saida, linha, _municipio_ro(codigo), "investimento", "VlInvest", "AreaInvest"
        )
    return saida, sem_municipio
