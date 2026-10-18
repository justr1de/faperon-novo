"""Voz do Zétele do sistema (ADR 0034): ouvir (áudio → texto) e falar (texto → áudio), sem rede."""

import base64
import json
import logging
import threading
from typing import Any

import pytest
import requests
import responses
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from tests.zetele_falso import ClienteLLMFalso, final
from zetele import audio, disponibilidade, views
from zetele.audio.sintese import URL_GEMINI, SintetizadorGemini, texto_para_fala
from zetele.audio.transcricao import URL_GROQ, TranscritorGroq
from zetele.cliente import PedidoRecusado, ProvedorIndisponivel

pytestmark = pytest.mark.django_db

@pytest.fixture(autouse=True)
def logado(api_logado: APIClient) -> None:
    """Todas as rotas daqui são da área do sistema, que exige login (ADR 0035)."""

ROTA_OUVIR = "/api/v1/sistema/zetele/ouvir"
ROTA_FALAR = "/api/v1/sistema/zetele/falar"
ROTA_ESTADO = "/api/v1/sistema/zetele/estado"
WAV = b"RIFF" + b"\x00" * 40
IP = "198.51.100.20"


class TranscritorFalso:
    def __init__(self, *roteiro: str | Exception) -> None:
        self.roteiro = list(roteiro)
        self.chamadas: list[tuple[bytes, str, str]] = []

    def transcrever(self, conteudo: bytes, nome: str, tipo: str) -> str:
        self.chamadas.append((conteudo, nome, tipo))
        item = self.roteiro.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class SintetizadorFalso:
    def __init__(self, *roteiro: bytes | Exception) -> None:
        self.roteiro = list(roteiro)
        self.textos: list[str] = []

    def sintetizar(self, texto: str) -> bytes:
        self.textos.append(texto)
        item = self.roteiro.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture(autouse=True)
def sem_chaves_reais(settings: Any) -> None:
    """Nenhum teste comum vê chave de verdade (o .env.local fica fora)."""
    settings.GROQ_API_KEY = ""
    settings.GEMINI_API_KEY = ""
    settings.ZETELE_OUVIR_PROVEDOR = "groq"
    settings.ZETELE_FALAR_PROVEDOR = "gemini"


@pytest.fixture
def com_chaves(settings: Any) -> None:
    settings.GROQ_API_KEY = "groq-de-teste"
    settings.GEMINI_API_KEY = "gemini-de-teste"


def usar_transcritor(
    monkeypatch: pytest.MonkeyPatch, *roteiro: str | Exception
) -> TranscritorFalso:
    t = TranscritorFalso(*roteiro)
    monkeypatch.setattr(views, "obter_transcritor", lambda: t)
    return t


def usar_sintetizador(
    monkeypatch: pytest.MonkeyPatch, *roteiro: bytes | Exception
) -> SintetizadorFalso:
    s = SintetizadorFalso(*roteiro)
    monkeypatch.setattr(views, "obter_sintetizador", lambda: s)
    return s


def arquivo(
    nome: str = "pergunta.webm", tipo: str = "audio/webm", tamanho: int = 2000
) -> SimpleUploadedFile:
    return SimpleUploadedFile(
        nome, b"\x1a\x45\xdf\xa3" + b"\x00" * (tamanho - 4), content_type=tipo
    )


def ouvir(api: APIClient, **campos: Any) -> Any:
    dados = {"audio": arquivo(), **campos}
    return api.post(ROTA_OUVIR, dados, format="multipart", HTTP_X_FORWARDED_FOR=IP)


def falar(api: APIClient, texto: str = "Abra a **Agenda** e clique em Novo evento.") -> Any:
    return api.post(ROTA_FALAR, {"texto": texto}, format="json", HTTP_X_FORWARDED_FOR=IP)


# ---------- estado ----------


def test_estado_do_sistema_informa_a_voz_conforme_as_chaves(api: APIClient, settings: Any) -> None:
    assert api.get(ROTA_ESTADO).json()["voz"] == {"ouvir": False, "falar": False}
    settings.GROQ_API_KEY = "x"
    assert api.get(ROTA_ESTADO).json()["voz"] == {"ouvir": True, "falar": False}
    settings.GEMINI_API_KEY = "y"
    assert api.get(ROTA_ESTADO).json()["voz"] == {"ouvir": True, "falar": True}


def test_fornecedor_desconhecido_desliga_a_voz(
    api: APIClient, com_chaves: None, settings: Any
) -> None:
    settings.ZETELE_OUVIR_PROVEDOR = "openai"
    settings.ZETELE_FALAR_PROVEDOR = ""
    assert api.get(ROTA_ESTADO).json()["voz"] == {"ouvir": False, "falar": False}
    assert audio.obter_transcritor() is None and audio.obter_sintetizador() is None


def test_estado_do_site_publico_nao_muda(api: APIClient, com_chaves: None) -> None:
    assert "voz" not in api.get("/api/v1/zetele/estado").json()


def test_fabricas_usam_modelo_e_voz_da_configuracao(com_chaves: None, settings: Any) -> None:
    settings.ZETELE_FALAR_MODELO = "gemini-3.8-flash-tts"
    settings.ZETELE_FALAR_VOZ = "Puck"
    t = audio.obter_transcritor()
    s = audio.obter_sintetizador()
    assert isinstance(t, TranscritorGroq) and t.modelo == "whisper-large-v3-turbo"
    assert isinstance(s, SintetizadorGemini) and (s.modelo, s.voz) == (
        "gemini-3.8-flash-tts",
        "Puck",
    )


# ---------- ouvir ----------


def test_ouvir_devolve_o_texto_e_nao_gasta_o_teto(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    t = usar_transcritor(monkeypatch, "  Como reservo a Hilux?  ")
    r = ouvir(api)
    assert r.status_code == 200
    assert r.json() == {"texto": "Como reservo a Hilux?"}
    conteudo, nome, tipo = t.chamadas[0]
    assert (len(conteudo), nome, tipo) == (2000, "pergunta.webm", "audio/webm")
    assert disponibilidade.perguntas_hoje("sistema") == 0


def test_ouvir_corta_a_transcricao_no_tamanho_da_pergunta(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    usar_transcritor(monkeypatch, "palavra " * 200)
    assert len(ouvir(api).json()["texto"]) <= 500


@pytest.mark.parametrize(
    ("nome", "tipo"),
    [
        ("pergunta.m4a", "audio/mp4"),
        ("pergunta.mp4", "audio/mp4"),
        ("pergunta.ogg", "audio/ogg"),
        ("pergunta.wav", "audio/wav"),
        ("pergunta.mp3", "audio/mpeg"),
        ("pergunta.flac", "audio/flac"),
    ],
)
def test_ouvir_aceita_os_formatos_do_whisper(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, nome: str, tipo: str
) -> None:
    usar_transcritor(monkeypatch, "oi")
    assert ouvir(api, audio=arquivo(nome, tipo)).status_code == 200


@pytest.mark.parametrize(
    ("nome", "tipo"),
    [
        ("pergunta.txt", "text/plain"),
        ("pergunta.webm", "text/html"),  # extensão certa, tipo errado
        ("pergunta.exe", "audio/webm"),  # tipo certo, extensão errada
        ("pergunta", "audio/webm"),
    ],
)
def test_ouvir_recusa_tipo_ou_extensao_fora_da_lista(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, nome: str, tipo: str
) -> None:
    t = usar_transcritor(monkeypatch, "oi")
    r = ouvir(api, audio=arquivo(nome, tipo))
    assert r.status_code == 400
    assert "audio" in r.json()["campos"]
    assert t.chamadas == []


def test_ouvir_aceita_ate_3_mb(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    t = usar_transcritor(monkeypatch, "oi", "oi")
    assert ouvir(api, audio=arquivo(tamanho=3 * 1024 * 1024)).status_code == 200
    r = ouvir(api, audio=arquivo(tamanho=3 * 1024 * 1024 + 1))
    assert r.status_code == 400
    assert len(t.chamadas) == 1


def test_ouvir_corta_corpo_grande_antes_de_ler(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    t = usar_transcritor(monkeypatch, "oi")
    r = ouvir(api, audio=arquivo(tamanho=5 * 1024 * 1024))
    assert r.status_code == 413
    assert t.chamadas == []


def test_ouvir_sem_arquivo_e_400(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    usar_transcritor(monkeypatch, "oi")
    r = api.post(ROTA_OUVIR, {}, format="multipart", HTTP_X_FORWARDED_FOR=IP)
    assert r.status_code == 400


def test_ouvir_so_aceita_multipart(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    usar_transcritor(monkeypatch, "oi")
    r = api.post(ROTA_OUVIR, {"audio": "x"}, format="json", HTTP_X_FORWARDED_FOR=IP)
    assert r.status_code == 415


def test_ouvir_sem_chave_fica_desligado(api: APIClient) -> None:
    r = ouvir(api)
    assert (r.status_code, r.json()["motivo"]) == (503, "voz_desligada")
    assert "Retry-After" in r


def test_ouvir_audio_sem_fala_e_422(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    usar_transcritor(monkeypatch, "   ")
    assert ouvir(api).status_code == 422


def test_ouvir_fornecedor_fora_abre_o_disjuntor_so_da_voz(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    settings.ANTHROPIC_API_KEY = "chave-de-teste"
    t = usar_transcritor(monkeypatch, ProvedorIndisponivel("HTTP 503"), "oi")
    r = ouvir(api)
    assert (r.status_code, r.json()["motivo"], r["Retry-After"]) == (503, "indisponivel", "60")
    # o segundo pedido nem chega ao fornecedor
    assert ouvir(api).json()["motivo"] == "indisponivel"
    assert len(t.chamadas) == 1
    # o texto do Zétele continua de pé
    assert api.get(ROTA_ESTADO).json()["disponivel"] is True


def test_ouvir_pedido_recusado_nao_abre_o_disjuntor(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    t = usar_transcritor(monkeypatch, PedidoRecusado("HTTP 400"), "oi")
    assert ouvir(api).status_code == 503
    assert ouvir(api).status_code == 200
    assert len(t.chamadas) == 2


def test_ouvir_respeita_o_teto_do_dia(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    settings.ZETELE_SISTEMA_LIMITE_DIARIO = 1
    disponibilidade.contar_pergunta("sistema")
    t = usar_transcritor(monkeypatch, "oi")
    assert ouvir(api).json()["motivo"] == "orcamento_diario"
    assert t.chamadas == []


def test_ouvir_respeita_o_semaforo(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    cheio = threading.BoundedSemaphore(1)
    cheio.acquire()
    monkeypatch.setattr(views, "SEMAFORO", cheio)
    usar_transcritor(monkeypatch, "oi")
    assert ouvir(api).json()["motivo"] == "ocupado"


# ---------- falar ----------


def test_falar_devolve_wav_e_conta_no_teto(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    s = usar_sintetizador(monkeypatch, WAV)
    r = falar(api, "Abra a **Agenda** e veja o [Guia](/sistema/agenda).")
    assert r.status_code == 200
    assert r["Content-Type"] == "audio/wav"
    assert r["Cache-Control"] == "no-store"
    assert r.content == WAV
    assert s.textos == ["Abra a Agenda e veja o Guia."]
    assert disponibilidade.perguntas_hoje("sistema") == 1
    assert disponibilidade.perguntas_hoje("publico") == 0


def test_falar_divide_o_teto_com_as_perguntas(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    settings.ANTHROPIC_API_KEY = "chave-de-teste"
    settings.ZETELE_SISTEMA_LIMITE_DIARIO = 2
    cli = ClienteLLMFalso([final("resposta", "Pela Agenda.") for _ in range(3)])
    monkeypatch.setattr(views, "obter_cliente", lambda: cli)
    s = usar_sintetizador(monkeypatch, WAV, WAV)
    corpo = {"pergunta": "como crio evento?", "historico": [], "pagina": "/sistema/agenda"}
    rota = "/api/v1/sistema/zetele/perguntar"
    assert api.post(rota, corpo, format="json").status_code == 200
    assert falar(api).status_code == 200
    assert api.post(rota, corpo, format="json").json()["motivo"] == "orcamento_diario"
    assert falar(api).json()["motivo"] == "orcamento_diario"
    assert len(s.textos) == 1


def test_falar_falha_devolve_a_contagem_e_abre_o_disjuntor(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    s = usar_sintetizador(monkeypatch, ProvedorIndisponivel("tempo esgotado"), WAV)
    r = falar(api)
    assert (r.status_code, r.json()["motivo"]) == (503, "indisponivel")
    assert disponibilidade.perguntas_hoje("sistema") == 0
    assert falar(api).json()["motivo"] == "indisponivel"
    assert len(s.textos) == 1


def test_falar_recusado_devolve_a_contagem_sem_disjuntor(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    usar_sintetizador(monkeypatch, PedidoRecusado("HTTP 400"), WAV)
    assert falar(api).status_code == 503
    assert disponibilidade.perguntas_hoje("sistema") == 0
    assert falar(api).status_code == 200


def test_falar_ocupado_nao_gasta_o_teto(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    cheio = threading.BoundedSemaphore(1)
    cheio.acquire()
    monkeypatch.setattr(views, "SEMAFORO", cheio)
    usar_sintetizador(monkeypatch, WAV)
    assert falar(api).json()["motivo"] == "ocupado"
    assert disponibilidade.perguntas_hoje("sistema") == 0


def test_falar_respeita_o_disjuntor_do_zetele(
    api: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    disponibilidade.abrir_disjuntor()
    s = usar_sintetizador(monkeypatch, WAV)
    assert falar(api).json()["motivo"] == "indisponivel"
    assert s.textos == []


def test_falar_sem_chave_fica_desligado(api: APIClient) -> None:
    assert falar(api).json()["motivo"] == "voz_desligada"
    assert disponibilidade.perguntas_hoje("sistema") == 0


@pytest.mark.parametrize("texto", ["", "   ", "**", "x" * 4001])
def test_falar_texto_invalido_e_400(
    api: APIClient, monkeypatch: pytest.MonkeyPatch, texto: str
) -> None:
    s = usar_sintetizador(monkeypatch, WAV)
    assert falar(api, texto).status_code == 400
    assert s.textos == []
    assert disponibilidade.perguntas_hoje("sistema") == 0


def test_falar_so_aceita_json(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    usar_sintetizador(monkeypatch, WAV)
    r = api.post(ROTA_FALAR, {"texto": "oi"}, format="multipart", HTTP_X_FORWARDED_FOR=IP)
    assert r.status_code == 415


# ---------- limites por minuto ----------


def taxas(**valores: str) -> dict[str, str]:
    base = {"anon": "300/min", "zetele_voz": "100/min", "zetele_voz_global": "100/min"}
    return {**base, **valores}


def test_limite_da_voz_por_ip(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", taxas(zetele_voz="2/min"))
    cache.clear()
    usar_transcritor(monkeypatch, "oi", "oi", "oi")
    usar_sintetizador(monkeypatch, WAV)
    # ouvir e falar dividem o mesmo limite
    assert [ouvir(api).status_code, falar(api).status_code, ouvir(api).status_code] == [
        200,
        200,
        429,
    ]
    outro = api.post(
        ROTA_OUVIR, {"audio": arquivo()}, format="multipart", HTTP_X_FORWARDED_FOR="198.51.100.99"
    )
    assert outro.status_code == 200


def test_limite_global_da_voz(api: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", taxas(zetele_voz_global="2/min"))
    cache.clear()
    usar_transcritor(monkeypatch, "oi", "oi", "oi")
    codigos = [
        api.post(
            ROTA_OUVIR, {"audio": arquivo()}, format="multipart", HTTP_X_FORWARDED_FOR=f"10.0.0.{i}"
        ).status_code
        for i in range(3)
    ]
    assert codigos == [200, 200, 429]


# ---------- texto lido em voz alta ----------


def test_texto_para_fala_tira_markdown_links_listas_e_emojis() -> None:
    texto = (
        "## Como reservar\n"
        "Abra a **Agenda** 😀 e veja o [Guia da frota](/sistema/frotas).\n"
        "- Escolha o veículo;\n"
        "* Informe o destino.\n"
        "1. Salve.\n"
        "Mais em https://faperon.org.br/ajuda e `código` _aqui_."
    )
    assert texto_para_fala(texto) == (
        "Como reservar. Abra a Agenda e veja o Guia da frota. Escolha o veículo; "
        "Informe o destino. Salve. Mais em e código aqui."
    )


def test_texto_para_fala_pronuncia_ze_tele() -> None:
    assert texto_para_fala("Eu sou o Zétele. O ZETELE e o zetele também.") == (
        "Eu sou o Zé TÉle. O Zé TÉle e o Zé TÉle também."
    )


def test_texto_para_fala_corta_na_ultima_frase_inteira() -> None:
    frase = "Esta é uma frase de teste com algumas palavras. "
    texto = frase * 40  # ~1.960 caracteres
    lido = texto_para_fala(texto)
    assert len(lido) <= 1200
    assert lido.endswith("palavras.")


def test_texto_para_fala_sem_ponto_corta_na_ultima_palavra() -> None:
    lido = texto_para_fala("palavra " * 300)
    assert len(lido) <= 1200
    assert lido.endswith("palavra")


# ---------- REST da Groq (ouvir) ----------


@responses.activate
def test_groq_manda_multipart_com_modelo_lingua_e_chave() -> None:
    responses.post(URL_GROQ, json={"text": " Como reservo a Hilux? "})
    t = TranscritorGroq("groq-de-teste", "whisper-large-v3-turbo")
    assert t.transcrever(b"abc", "pergunta.webm", "audio/webm") == "Como reservo a Hilux?"
    pedido = responses.calls[0].request
    assert pedido.headers["Authorization"] == "Bearer groq-de-teste"
    corpo = pedido.body if isinstance(pedido.body, bytes) else str(pedido.body).encode()
    for trecho in (
        b"whisper-large-v3-turbo",
        b'name="language"',
        b"pt",
        b"FAPERON",
        b"pergunta.webm",
    ):
        assert trecho in corpo


@pytest.mark.parametrize("status", [429, 500, 503])
@responses.activate
def test_groq_5xx_e_429_viram_indisponivel(status: int) -> None:
    responses.post(URL_GROQ, status=status, json={"error": {"message": "x"}})
    with pytest.raises(ProvedorIndisponivel):
        TranscritorGroq("k", "m").transcrever(b"abc", "a.webm", "audio/webm")


@pytest.mark.parametrize("status", [400, 401, 413])
@responses.activate
def test_groq_4xx_vira_pedido_recusado(status: int) -> None:
    responses.post(URL_GROQ, status=status, json={"error": {"message": "x"}})
    with pytest.raises(PedidoRecusado):
        TranscritorGroq("k", "m").transcrever(b"abc", "a.webm", "audio/webm")


@responses.activate
def test_groq_tempo_esgotado_vira_indisponivel() -> None:
    responses.post(URL_GROQ, body=requests.Timeout("lento"))
    with pytest.raises(ProvedorIndisponivel):
        TranscritorGroq("k", "m").transcrever(b"abc", "a.webm", "audio/webm")


# ---------- REST do Gemini (falar) ----------


def resposta_gemini(dados: bytes) -> dict[str, Any]:
    return {
        "steps": [
            {"type": "thinking", "content": []},
            {
                "type": "model_output",
                "content": [{"type": "audio", "data": base64.b64encode(dados).decode()}],
            },
        ]
    }


@responses.activate
def test_gemini_manda_o_corpo_da_interactions_api_e_devolve_o_wav() -> None:
    responses.post(URL_GEMINI, json=resposta_gemini(WAV))
    s = SintetizadorGemini("gemini-de-teste", "gemini-3.8-flash-lite-tts", "Kore")
    assert s.sintetizar("Olá, tudo bem?") == WAV
    pedido = responses.calls[0].request
    assert pedido.headers["x-goog-api-key"] == "gemini-de-teste"
    corpo = json.loads(pedido.body)
    assert corpo["model"] == "gemini-3.8-flash-lite-tts"
    assert corpo["response_format"] == {"type": "audio"}
    assert corpo["generation_config"] == {"speech_config": [{"voice": "Kore"}]}
    bloco = corpo["input"][0]["content"][0]
    assert corpo["input"][0]["type"] == "user_input"
    assert (bloco["type"], bloco["text"]) == ("text", "Olá, tudo bem?")
    assert bloco["annotations"][0]["type"] == "speech_metadata"
    assert "português do Brasil neutro e urbano" in bloco["annotations"][0]["style"]


@responses.activate
def test_gemini_pcm_sem_cabecalho_vira_wav() -> None:
    pcm = b"\x01\x00" * 100
    responses.post(URL_GEMINI, json=resposta_gemini(pcm))
    wav = SintetizadorGemini("k", "m", "Kore").sintetizar("oi")
    assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"
    assert wav.endswith(pcm)
    assert int.from_bytes(wav[24:28], "little") == 24000


@responses.activate
def test_gemini_sem_audio_vira_pedido_recusado() -> None:
    responses.post(URL_GEMINI, json={"steps": [{"type": "model_output", "content": []}]})
    with pytest.raises(PedidoRecusado):
        SintetizadorGemini("k", "m", "Kore").sintetizar("oi")


@pytest.mark.parametrize(
    ("status", "erro"),
    [(503, ProvedorIndisponivel), (429, ProvedorIndisponivel), (403, PedidoRecusado)],
)
@responses.activate
def test_gemini_4xx_contra_5xx(status: int, erro: type[Exception]) -> None:
    responses.post(URL_GEMINI, status=status, json={"error": {"message": "x"}})
    with pytest.raises(erro):
        SintetizadorGemini("k", "m", "Kore").sintetizar("oi")


@responses.activate
def test_falha_nunca_leva_a_chave_nem_o_audio_ao_log(
    api: APIClient, settings: Any, caplog: pytest.LogCaptureFixture
) -> None:
    settings.GROQ_API_KEY = "segredo-groq-123"
    responses.post(URL_GROQ, status=500, json={"error": {"message": "segredo-groq-123"}})
    with caplog.at_level(logging.DEBUG):
        r = ouvir(api)
    assert r.status_code == 503
    assert "segredo-groq-123" not in caplog.text
    assert "\x1a\x45" not in caplog.text
