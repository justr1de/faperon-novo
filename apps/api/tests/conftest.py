import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from indicadores.aplicacao import atualizar_views, garantir_indicadores
from indicadores.models import Indicador, Medicao, Municipio, Produto, ProdutoIndicador
from ingestao.models import Carga

FIXTURES = Path(__file__).parent / "fixtures"


def carregar_fixture(nome: str) -> Any:
    return json.loads((FIXTURES / nome).read_text(encoding="utf-8"))


class ClienteFalso:
    """Substitui o SidraCliente: devolve respostas gravadas, sem rede."""

    def __init__(
        self,
        categorias: list[tuple[str, str]],
        respostas: dict[str, Any],
        serie: Any = None,
    ) -> None:
        self._serie = serie
        self._categorias = categorias
        self._respostas = respostas
        self.chamadas = 0

    def categorias(self, tabela: int, classificacao: int) -> list[tuple[str, str]]:
        return self._categorias

    def serie_nacional(self, tabela: int, variavel: str) -> Any:
        if isinstance(self._serie, Exception):
            raise self._serie
        return self._serie

    def dados(
        self, tabela: int, variaveis: tuple[str, ...], classificacao: int | None, categoria: str
    ) -> Any:
        self.chamadas += 1
        resposta = self._respostas[categoria]
        if isinstance(resposta, Exception):
            raise resposta
        return resposta


@pytest.fixture(autouse=True)
def seed_isolado(settings: Any, tmp_path: Path) -> None:
    """Testes nunca leem nem gravam o data/seed/ real do repositório."""
    settings.SEED_DIR = tmp_path / "seed"


@pytest.fixture
def cliente_soja() -> ClienteFalso:
    """Resposta real da tabela 5457: soja, quantidade produzida, 2023 e 2024."""
    resposta = carregar_fixture("sidra_5457_soja_quantidade_2023_2024.json")
    return ClienteFalso(
        [("0", "Total"), ("40124", "Soja (em grão)")],
        {"40124": resposta},
        carregar_fixture("sidra_1737_ipca_2024_2025.json"),
    )


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def carga(db: None) -> Carga:
    agora = timezone.now()
    return Carga.objects.create(
        tabela=5457, iniciada_em=agora, concluida_em=agora, status=Carga.Status.SUCESSO, linhas=1
    )


@pytest.fixture
def municipios(db: None) -> list[Municipio]:
    return [
        Municipio.objects.create(codigo_ibge="1100015", nome="Alta Floresta D'Oeste"),
        Municipio.objects.create(codigo_ibge="1100023", nome="Ariquemes"),
        Municipio.objects.create(codigo_ibge="1100031", nome="Cabixi"),
        Municipio.objects.create(codigo_ibge="1100049", nome="Cacoal"),
    ]


@pytest.fixture
def soja(db: None) -> Produto:
    garantir_indicadores()
    produto = Produto.objects.create(
        slug="soja-em-grao",
        codigo_ibge="40124",
        nome="Soja (em grão)",
        segmento="agricultura",
        tabela_origem=5457,
    )
    for slug, unidade in [
        ("quantidade-produzida", "Toneladas"),
        ("area-colhida", "Hectares"),
        ("rendimento-medio", "Quilogramas por Hectare"),
    ]:
        ProdutoIndicador.objects.create(
            produto=produto, indicador=Indicador.objects.get(slug=slug), unidade=unidade
        )
    return produto


def lancar(
    produto: Produto,
    indicador: str,
    municipio: str,
    ano: int,
    valor: str | int | None,
    carga: Carga,
    status: str = "ok",
) -> None:
    Medicao.objects.create(
        produto=produto,
        indicador=Indicador.objects.get(slug=indicador),
        municipio_id=municipio,
        ano=ano,
        valor=None if valor is None else Decimal(str(valor)),
        status_valor=status,
        carga=carga,
    )


@pytest.fixture
def dados_soja(soja: Produto, municipios: list[Municipio], carga: Carga) -> Produto:
    """Soja com 4 municípios: Cabixi sigiloso em 2024, Cacoal sem dado (inexistente)."""
    q = "quantidade-produzida"
    for ano, valores in {
        2022: (100, 300, 50),
        2023: (120, 330, 60),
        2024: (150, 450, None),
    }.items():
        for codigo, valor in zip(("1100015", "1100023", "1100031"), valores, strict=True):
            if valor is None:
                lancar(soja, q, codigo, ano, None, carga, "sigiloso")
            else:
                lancar(soja, q, codigo, ano, valor, carga)
    # rendimento e área colhida para a média ponderada (2024)
    lancar(soja, "area-colhida", "1100015", 2024, 50, carga)
    lancar(soja, "area-colhida", "1100023", 2024, 150, carga)
    lancar(soja, "rendimento-medio", "1100015", 2024, 2000, carga)
    lancar(soja, "rendimento-medio", "1100023", 2024, 4000, carga)
    atualizar_views()
    return soja


@pytest.fixture(autouse=True)
def cache_limpo() -> None:
    """O throttle por IP vive no cache em arquivo; sem limpar, vaza entre testes."""
    from django.core.cache import cache

    cache.clear()


@pytest.fixture
def dados_observatorio(municipios: list[Municipio], carga: Carga) -> dict[str, Produto]:
    """PAM: soja e café em 2 anos; PPM: bovino, leite e vacas. Cabixi sigiloso na soja 2024."""
    from indicadores.models import IndicePreco

    garantir_indicadores()

    def produto(slug: str, nome: str, tabela: int, segmento: str, codigo: str) -> Produto:
        return Produto.objects.create(
            slug=slug, codigo_ibge=codigo, nome=nome, segmento=segmento, tabela_origem=tabela
        )

    soja = produto("soja-em-grao", "Soja (em grão)", 5457, "agricultura", "40124")
    cafe = produto("cafe-em-grao-canephora", "Café canéfora", 5457, "agricultura", "40139")
    bovino = produto("bovino", "Bovino", 3939, "pecuaria", "2670")
    leite = produto("leite", "Leite", 74, "pecuaria", "2682")
    vacas = produto("vacas-ordenhadas", "Vacas ordenhadas", 94, "pecuaria", "107")
    unidades = {
        "area-plantada": "Hectares", "area-colhida": "Hectares",
        "quantidade-produzida": "Toneladas", "valor-da-producao": "Mil Reais",
    }
    for p in (soja, cafe):
        for slug, unidade in unidades.items():
            ProdutoIndicador.objects.create(produto=p, indicador=Indicador.objects.get(slug=slug), unidade=unidade)
    ProdutoIndicador.objects.create(produto=bovino, indicador=Indicador.objects.get(slug="efetivo"), unidade="Cabeças")
    ProdutoIndicador.objects.create(produto=leite, indicador=Indicador.objects.get(slug="producao-de-origem-animal"), unidade="Mil litros")
    ProdutoIndicador.objects.create(produto=leite, indicador=Indicador.objects.get(slug="valor-da-producao"), unidade="Mil Reais")
    ProdutoIndicador.objects.create(produto=vacas, indicador=Indicador.objects.get(slug="vacas-ordenhadas"), unidade="Cabeças")

    af, ari, cab, cac = "1100015", "1100023", "1100031", "1100049"
    # (produto, indicador, município, ano, valor)
    linhas = [
        (soja, "area-plantada", af, 2015, 110), (soja, "area-colhida", af, 2015, 100),
        (soja, "quantidade-produzida", af, 2015, 300), (soja, "valor-da-producao", af, 2015, 400),
        (soja, "area-plantada", af, 2024, 120), (soja, "area-colhida", af, 2024, 110),
        (soja, "quantidade-produzida", af, 2024, 660), (soja, "valor-da-producao", af, 2024, 1200),
        (soja, "area-colhida", ari, 2024, 1000), (soja, "quantidade-produzida", ari, 2024, 3000),
        (soja, "valor-da-producao", ari, 2024, 3000),
        (soja, "area-plantada", ari, 2024, 1000),
        (soja, "valor-da-producao", af, 1996, 500),
        (cafe, "area-plantada", ari, 2015, 50), (cafe, "area-colhida", ari, 2015, 50),
        (cafe, "quantidade-produzida", ari, 2015, 50), (cafe, "valor-da-producao", ari, 2015, 200),
        (cafe, "area-plantada", ari, 2024, 50), (cafe, "area-colhida", ari, 2024, 50),
        (cafe, "quantidade-produzida", ari, 2024, 100), (cafe, "valor-da-producao", ari, 2024, 600),
        (cafe, "area-colhida", cac, 2024, 2000), (cafe, "valor-da-producao", cac, 2024, 900),
        (bovino, "efetivo", af, 2015, 1000), (bovino, "efetivo", af, 2024, 1500),
        (bovino, "efetivo", ari, 2024, 500),
        (leite, "producao-de-origem-animal", af, 2015, 1000), (leite, "producao-de-origem-animal", af, 2024, 2000),
        (leite, "valor-da-producao", af, 2015, 100), (leite, "valor-da-producao", af, 2024, 300),
        (vacas, "vacas-ordenhadas", af, 2015, 1000), (vacas, "vacas-ordenhadas", af, 2024, 800),
    ]
    for p, ind, mun, ano, valor in linhas:
        lancar(p, ind, mun, ano, valor, carga)
    lancar(soja, "valor-da-producao", cab, 2024, None, carga, "sigiloso")
    for ano, indice in {1995: "1000", 1996: "1200", 2015: "4000", 2024: "6000", 2025: "6300"}.items():
        IndicePreco.objects.create(ano=ano, indice_medio=Decimal(indice), carga=carga)
    Municipio.objects.filter(codigo_ibge__in=[af, ari]).update(microrregiao="Cacoal")
    Municipio.objects.filter(codigo_ibge__in=[cab, cac]).update(microrregiao="Vilhena")
    atualizar_views()
    return {"soja": soja, "cafe": cafe, "bovino": bovino, "leite": leite, "vacas": vacas}


SENHA_DE_TESTE = "senha-de-teste-123"


@pytest.fixture
def criar_conta(db: None) -> Any:
    """Cria uma conta com perfil (por padrão a Carla, sem papéis) e devolve o User."""
    from usuarios.servicos import criar_usuario

    def criar(
        email: str = "carla@exemplo.faperon.br",
        nome: str = "Carla Mendes",
        codigo: str | None = "carla",
        area: str = "Comunicação",
        senha: str = SENHA_DE_TESTE,
        ativo: bool = True,
        **papeis: bool,
    ) -> Any:
        usuario, _ = criar_usuario(
            email=email, nome=nome, area=area, codigo=codigo, senha=senha, papeis=papeis
        )
        if not ativo:
            usuario.is_active = False
            usuario.save(update_fields=["is_active"])
        return usuario

    return criar


@pytest.fixture
def api_logado(api: APIClient, criar_conta: Any) -> APIClient:
    """Cliente com a sessão de uma pessoa da equipe (rotas do sistema exigem login)."""
    api.force_login(criar_conta())
    return api


@pytest.fixture(autouse=True)
def sem_chave_da_anthropic(request: pytest.FixtureRequest, settings: Any) -> None:
    """Nenhum teste fala com a Anthropic de verdade, exceto os marcados com llm."""
    if request.node.get_closest_marker("llm") is None:
        settings.ANTHROPIC_API_KEY = ""
