"""Reconhecimento do funcionário pelo telefone do WhatsApp (ADR 0037)."""

import logging
from typing import Any

import pytest

from usuarios.models import Perfil
from whatsapp.identificacao import (
    mascarar_telefone,
    perfil_do_telefone,
    tipo_da_midia,
    variantes_do_telefone,
)
from whatsapp.models import MensagemWhatsApp

pytestmark = pytest.mark.django_db


def test_variantes_com_e_sem_o_nono_digito() -> None:
    assert variantes_do_telefone("+5569999990000") == {"+5569999990000", "+556999990000"}
    assert variantes_do_telefone("+556999990000") == {"+556999990000", "+5569999990000"}


def test_variantes_de_fixo_e_de_outro_pais_ficam_iguais() -> None:
    # fixo brasileiro começa com 2 a 5: não ganha o 9
    assert variantes_do_telefone("+556932140000") == {"+556932140000"}
    assert variantes_do_telefone("+14155238886") == {"+14155238886"}


def _com_telefone(criar_conta: Any, telefone: str, **kw: Any) -> Perfil:
    usuario = criar_conta(**kw)
    Perfil.objects.filter(usuario=usuario).update(telefone=telefone)
    return Perfil.objects.get(usuario=usuario)


def test_reconhece_o_cadastro_mesmo_sem_o_nono_digito(criar_conta: Any) -> None:
    carla = _com_telefone(criar_conta, "+5569999990000")
    assert perfil_do_telefone("+556999990000") == carla
    assert perfil_do_telefone("+5569999990000") == carla


def test_nao_reconhece_desconhecido_nem_inativo(criar_conta: Any) -> None:
    _com_telefone(criar_conta, "+5569999990000", ativo=False)
    assert perfil_do_telefone("+5569999990000") is None
    assert perfil_do_telefone("+5569888880000") is None
    assert perfil_do_telefone("") is None


def test_numero_ambiguo_nao_e_atendido(criar_conta: Any, caplog: pytest.LogCaptureFixture) -> None:
    # pelo nono dígito, as duas formas são o mesmo celular: com dois cadastros, não se sabe quem é
    _com_telefone(criar_conta, "+5569999990000")
    _com_telefone(
        criar_conta,
        "+556999990000",
        email="marcos@exemplo.faperon.br",
        nome="Marcos",
        codigo="marcos",
    )
    with caplog.at_level(logging.WARNING, logger="whatsapp.identificacao"):
        assert perfil_do_telefone("+5569999990000") is None
        assert perfil_do_telefone("+556999990000") is None
    avisos = " ".join(r.getMessage() for r in caplog.records if r.levelno == logging.WARNING)
    assert mascarar_telefone("+5569999990000") in avisos
    assert "+5569999990000" not in avisos
    assert "+556999990000" not in avisos


def test_mascara_o_meio_do_numero() -> None:
    assert mascarar_telefone("+5569999990000") == "+5569*******00"
    assert mascarar_telefone("") == ""


@pytest.mark.parametrize(
    ("tipo_midia", "esperado"),
    [
        ("", MensagemWhatsApp.Tipo.TEXTO),
        ("audio/ogg", MensagemWhatsApp.Tipo.AUDIO),
        ("audio/ogg; codecs=opus", MensagemWhatsApp.Tipo.AUDIO),
        ("application/pdf", MensagemWhatsApp.Tipo.DOCUMENTO),
        ("image/jpeg", MensagemWhatsApp.Tipo.DOCUMENTO),
        ("text/vcard", MensagemWhatsApp.Tipo.OUTRO),
        ("video/mp4", MensagemWhatsApp.Tipo.OUTRO),
    ],
)
def test_tipo_da_midia(tipo_midia: str, esperado: str) -> None:
    assert tipo_da_midia(tipo_midia) == esperado


def test_id_externo_e_unico(criar_conta: Any) -> None:
    from django.db import IntegrityError, transaction

    MensagemWhatsApp.objects.create(id_externo="SM1", tipo="texto")
    with pytest.raises(IntegrityError), transaction.atomic():
        MensagemWhatsApp.objects.create(id_externo="SM1", tipo="texto")
