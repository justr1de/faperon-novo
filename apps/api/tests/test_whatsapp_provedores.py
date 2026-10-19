"""Provedores do canal WhatsApp (ADR 0037): Twilio de verdade (sem rede) e o falso dos testes."""

import base64
import hashlib
import hmac
import traceback
from typing import Any

import pytest
import requests
import responses
from django.http import QueryDict

from whatsapp.provedores import obter_provedor
from whatsapp.provedores.base import ErroDefinitivo, ErroTemporario
from whatsapp.provedores.falso import ProvedorFalso
from whatsapp.provedores.twilio import ProvedorTwilio

SID = "AC" + "0" * 32
TOKEN = "token-de-teste"
URL = "https://exemplo.sslip.io/api/v1/whatsapp/webhook"
MENSAGENS = f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json"


def assinar(url: str, campos: dict[str, str], token: str = TOKEN) -> str:
    """O algoritmo publicado pelo Twilio: URL + chaves ordenadas com os valores, HMAC-SHA1, base64."""
    dados = url + "".join(f"{k}{campos[k]}" for k in sorted(campos))
    return base64.b64encode(
        hmac.new(token.encode(), dados.encode(), hashlib.sha1).digest()
    ).decode()


def campos_de(**extra: str) -> dict[str, str]:
    return {
        "MessageSid": "SM123",
        "From": "whatsapp:+556999990000",
        "To": "whatsapp:+14155238886",
        "Body": "Oi",
        "NumMedia": "0",
        **extra,
    }


@pytest.fixture
def twilio() -> ProvedorTwilio:
    return ProvedorTwilio(SID, TOKEN, "whatsapp:+14155238886")


def test_assinatura_valida_e_invalida(twilio: ProvedorTwilio) -> None:
    campos = campos_de()
    qd = QueryDict(mutable=True)
    qd.update(campos)
    meta = {"HTTP_X_TWILIO_SIGNATURE": assinar(URL, campos)}
    assert twilio.assinatura_valida(URL, qd, meta) is True
    assert twilio.assinatura_valida(URL + "x", qd, meta) is False
    assert twilio.assinatura_valida(URL, qd, {"HTTP_X_TWILIO_SIGNATURE": "errada"}) is False
    assert twilio.assinatura_valida(URL, qd, {}) is False


def test_le_texto_e_tira_o_prefixo(twilio: ProvedorTwilio) -> None:
    e = twilio.ler_entrada(campos_de(Body="  Oi, Zétele  "))
    assert e is not None
    assert (e.id_externo, e.telefone, e.texto, e.url_midia, e.tipo_midia) == (
        "SM123",
        "+556999990000",
        "Oi, Zétele",
        "",
        "",
    )


def test_le_audio(twilio: ProvedorTwilio) -> None:
    e = twilio.ler_entrada(
        campos_de(
            Body="",
            NumMedia="1",
            MediaUrl0="https://api.twilio.com/2010-04-01/Accounts/x/Messages/SM123/Media/ME1",
            MediaContentType0="audio/ogg",
        )
    )
    assert e is not None and e.tipo_midia == "audio/ogg" and e.url_midia.endswith("/ME1")


def test_sem_sid_ou_remetente_nao_e_mensagem(twilio: ProvedorTwilio) -> None:
    assert twilio.ler_entrada({"From": "whatsapp:+5569"}) is None
    assert twilio.ler_entrada({"MessageSid": "SM1", "From": "+5569999990000"}) is None


@responses.activate
def test_envia_texto_com_autenticacao(twilio: ProvedorTwilio) -> None:
    responses.post(MENSAGENS, json={"sid": "SM9"}, status=201)
    twilio.enviar_texto("+556999990000", "Olá")
    pedido = responses.calls[0].request
    assert pedido.headers["Authorization"].startswith("Basic ")
    corpo = QueryDict(pedido.body)
    assert corpo["To"] == "whatsapp:+556999990000"
    assert corpo["From"] == "whatsapp:+14155238886"
    assert corpo["Body"] == "Olá"


@responses.activate
def test_envia_audio_pela_url(twilio: ProvedorTwilio) -> None:
    responses.post(MENSAGENS, json={"sid": "SM9"}, status=201)
    twilio.enviar_audio("+556999990000", "https://exemplo/midia/tok")
    corpo = QueryDict(responses.calls[0].request.body)
    assert corpo["MediaUrl"] == "https://exemplo/midia/tok"
    assert "Body" not in corpo


@responses.activate
@pytest.mark.parametrize(
    ("status", "erro"), [(500, ErroTemporario), (429, ErroTemporario), (400, ErroDefinitivo)]
)
def test_erros_do_envio(twilio: ProvedorTwilio, status: int, erro: type[Exception]) -> None:
    responses.post(MENSAGENS, json={"code": 63016}, status=status)
    with pytest.raises(erro) as info:
        twilio.enviar_texto("+556999990000", "Olá")
    assert SID not in str(info.value)
    assert "+5569" not in str(info.value)


@responses.activate
def test_rede_fora_e_temporario(twilio: ProvedorTwilio) -> None:
    responses.post(MENSAGENS, body=requests.ConnectionError("fora"))
    with pytest.raises(ErroTemporario):
        twilio.enviar_texto("+556999990000", "Olá")


def rastro(exc: BaseException) -> str:
    """O que o logger.exception imprimiria: a exceção e a cadeia de causas."""
    return "".join(traceback.format_exception(exc))


@responses.activate
def test_rede_fora_nao_leva_sid_nem_telefone_ao_traceback(twilio: ProvedorTwilio) -> None:
    # a mensagem do urllib3 traz a URL, com o SID da conta
    responses.post(
        MENSAGENS,
        body=requests.ConnectionError(
            f"Max retries exceeded with url: /2010-04-01/Accounts/{SID}/Messages.json"
        ),
    )
    # o telefone vai numa variável para não aparecer na linha do teste dentro do traceback
    telefone = "+556999990000"
    with pytest.raises(ErroTemporario) as info:
        twilio.enviar_texto(telefone, "Olá")
    assert SID not in rastro(info.value)
    assert telefone not in rastro(info.value)


@responses.activate
def test_download_fora_nao_leva_sid_nem_url_ao_traceback(twilio: ProvedorTwilio) -> None:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/MM1/Media/ME1"
    responses.get(url, body=requests.ConnectionError(f"Max retries exceeded with url: {url}"))
    with pytest.raises(ErroTemporario) as info:
        twilio.baixar_midia(url, limite=100)
    assert SID not in rastro(info.value)
    assert "/Media/ME1" not in rastro(info.value)


@responses.activate
def test_baixa_midia_e_respeita_o_limite(twilio: ProvedorTwilio) -> None:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/MM1/Media/ME1"
    responses.get(url, body=b"OggS" + b"0" * 10, status=200)
    assert twilio.baixar_midia(url, limite=100) == b"OggS" + b"0" * 10
    with pytest.raises(ErroDefinitivo):
        twilio.baixar_midia(url, limite=5)


@responses.activate
@pytest.mark.parametrize(
    "url",
    [
        "https://exemplo.com/2010-04-01/Accounts/x/Messages/MM1/Media/ME1",
        "https://api.twilio.com.exemplo.com/2010-04-01/Accounts/x/Messages/MM1/Media/ME1",
        "http://api.twilio.com/2010-04-01/Accounts/x/Messages/MM1/Media/ME1",
        "https://api.twilio.com/2010-04-01/Outra/x",
    ],
)
def test_download_so_da_api_do_twilio(twilio: ProvedorTwilio, url: str) -> None:
    # sem rota registrada: se o provedor tentasse baixar, o responses daria ConnectionError
    with pytest.raises(ErroDefinitivo, match="mídia fora do Twilio"):
        twilio.baixar_midia(url, limite=100)
    assert len(responses.calls) == 0


def test_falso_registra_e_falha_em_ordem() -> None:
    p = ProvedorFalso()
    p.falhas.append(ErroTemporario("uma vez"))
    with pytest.raises(ErroTemporario):
        p.enviar_texto("+55", "a")
    p.enviar_texto("+55", "b")
    p.enviar_audio("+55", "https://x/a.ogg")
    assert p.enviadas == [("texto", "+55", "b"), ("audio", "+55", "https://x/a.ogg")]


def test_fabrica(settings: Any) -> None:
    settings.WHATSAPP_PROVEDOR = "twilio"
    settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN = SID, TOKEN
    assert isinstance(obter_provedor(), ProvedorTwilio)
    settings.WHATSAPP_PROVEDOR = "falso"
    assert isinstance(obter_provedor(), ProvedorFalso)
