"""Cliente do OData do SICOR (Matriz de Dados do Crédito Rural, Banco Central), sempre filtrado por RO.

Cuidados verificados na fonte (ADR 0036):
- `cdEstado` é um código do BCB; o de Rondônia é '22'. Os filtros comparam texto ('2026', não 2026).
- O serviço não aceita `$skip` (responde 500 "Erro desconhecido"). A paginação é por período: se o ano
  enche o `$top`, a carga pede mês a mês; se um mês ainda enche, é erro (nunca soma pela metade).
- Cada chamada leva de 5 a 20 s e chamadas simultâneas costumam receber 500: o cliente pede uma por vez.
- Erro vem como texto `/*{"codigo": 500, "mensagem": "..."}*/`, não JSON.
"""

import json
import logging
import re
import time
from collections.abc import Callable
from decimal import Decimal
from typing import Any

import requests

log = logging.getLogger(__name__)

BASE_URL = "https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata"
ESTADO_RO = "22"
LIMITE_PADRAO = 20000

# recurso lógico → (recurso do OData, campos pedidos no $select)
RECURSOS: dict[str, tuple[str, tuple[str, ...]]] = {
    "municipio": (
        "CusteioInvestimentoComercialIndustrialSemFiltros",
        (
            "cdMunicipio",
            "codMunicIbge",
            "MesEmissao",
            "AnoEmissao",
            "cdPrograma",
            "Atividade",
            "QtdCusteio",
            "VlCusteio",
            "QtdInvestimento",
            "VlInvestimento",
            "QtdComercializacao",
            "VlComercializacao",
            "QtdIndustrializacao",
            "VlIndustrializacao",
            "AreaCusteio",
            "AreaInvestimento",
        ),
    ),
    "custeio": (
        "CusteioMunicipioProduto",
        (
            "codIbge",
            "nomeProduto",
            "MesEmissao",
            "AnoEmissao",
            "cdPrograma",
            "Atividade",
            "VlCusteio",
            "AreaCusteio",
        ),
    ),
    "investimento": (
        "InvestMunicipioProduto",
        (
            "cdMunicipio",
            "nomeProduto",
            "MesEmissao",
            "AnoEmissao",
            "cdPrograma",
            "Atividade",
            "VlInvest",
            "AreaInvest",
        ),
    ),
}


class ErroSicor(Exception):
    pass


class ErroSicorDefinitivo(ErroSicor):
    """Erro 4xx (exceto 429) ou resposta fora do formato: repetir não adianta."""


def _mensagem(resposta: requests.Response) -> str:
    """Extrai a mensagem do corpo de erro do Olinda (`/*{...}*/`)."""
    texto = resposta.text or ""
    bruto = re.sub(r"^\s*/\*|\*/\s*$", "", texto)
    try:
        return str(json.loads(bruto).get("mensagem") or texto[:200])
    except (ValueError, AttributeError):
        return texto[:200]


class SicorCliente:
    def __init__(
        self,
        sessao: requests.Session | None = None,
        tentativas: int = 4,
        espera_base: float = 5.0,
        dormir: Callable[[float], None] = time.sleep,
        timeout: float = 120.0,
        limite: int = LIMITE_PADRAO,
    ) -> None:
        self.sessao = sessao or requests.Session()
        self.tentativas = tentativas
        self.espera_base = espera_base
        self.dormir = dormir
        self.timeout = timeout
        self.limite = limite

    def _get(self, url: str, params: dict[str, str]) -> list[dict[str, Any]]:
        ultimo_erro: Exception | None = None
        for tentativa in range(1, self.tentativas + 1):
            try:
                resposta = self.sessao.get(url, params=params, timeout=self.timeout)
                if resposta.status_code == 429 or resposta.status_code >= 500:
                    raise ErroSicor(f"HTTP {resposta.status_code}: {_mensagem(resposta)}")
                if resposta.status_code >= 400:
                    raise ErroSicorDefinitivo(f"HTTP {resposta.status_code}: {_mensagem(resposta)}")
                corpo = resposta.json(parse_float=Decimal)
                linhas = corpo.get("value") if isinstance(corpo, dict) else None
                if not isinstance(linhas, list):
                    raise ErroSicorDefinitivo(f"Resposta sem a lista 'value' em {url}")
                return linhas
            except ErroSicorDefinitivo:
                raise
            except (requests.RequestException, ValueError, ErroSicor) as exc:
                ultimo_erro = exc
            if tentativa < self.tentativas:
                espera = self.espera_base * (2 ** (tentativa - 1))
                log.warning(
                    "SICOR falhou (%s); tentativa %s, nova tentativa em %.0fs",
                    ultimo_erro,
                    tentativa,
                    espera,
                )
                self.dormir(espera)
        raise ErroSicor(f"SICOR indisponível após {self.tentativas} tentativas: {ultimo_erro}")

    def _consultar(self, recurso: str, ano: int, mes: int | None) -> list[dict[str, Any]]:
        nome, campos = RECURSOS[recurso]
        filtro = f"cdEstado eq '{ESTADO_RO}' and AnoEmissao eq '{ano}'"
        if mes is not None:
            filtro += f" and MesEmissao eq '{mes:02d}'"
        params = {
            "$filter": filtro,
            "$select": ",".join(campos),
            "$top": str(self.limite),
            "$format": "json",
        }
        return self._get(f"{BASE_URL}/{nome}", params)

    def dados(self, recurso: str, ano: int) -> list[dict[str, Any]]:
        """Todas as linhas de RO do recurso no ano de emissão."""
        if recurso not in RECURSOS:
            raise ValueError(f"Recurso do SICOR desconhecido: {recurso}")
        linhas = self._consultar(recurso, ano, None)
        if len(linhas) < self.limite:
            return linhas
        log.info(
            "SICOR %s %s encheu o limite de %s linhas; pedindo mês a mês", recurso, ano, self.limite
        )
        todas: list[dict[str, Any]] = []
        for mes in range(1, 13):
            do_mes = self._consultar(recurso, ano, mes)
            if len(do_mes) >= self.limite:
                raise ErroSicorDefinitivo(
                    f"Resposta truncada: {recurso} {mes:02d}/{ano} passou de {self.limite} linhas"
                )
            todas.extend(do_mes)
        return todas
