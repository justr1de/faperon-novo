"""Quem mandou a mensagem: o telefone do WhatsApp contra o cadastro de usuários (ADR 0037)."""

import logging
import re

from usuarios.models import Perfil
from whatsapp.models import MensagemWhatsApp

log = logging.getLogger(__name__)

# +55, DDD (dois dígitos sem zero) e o celular: com o 9 (9 + 8 dígitos) ou sem ele
# (8 dígitos, de 6 a 9)
_COM_NOVE = re.compile(r"^\+55([1-9]{2})9([6-9]\d{7})$")
_SEM_NOVE = re.compile(r"^\+55([1-9]{2})([6-9]\d{7})$")


def variantes_do_telefone(telefone: str) -> set[str]:
    """O WhatsApp identifica muitos celulares brasileiros sem o nono dígito; o cadastro tem os dois
    jeitos. Fixo e número de fora do Brasil ficam como estão."""
    variantes = {telefone}
    if m := _COM_NOVE.match(telefone):
        variantes.add(f"+55{m[1]}{m[2]}")
    elif m := _SEM_NOVE.match(telefone):
        variantes.add(f"+55{m[1]}9{m[2]}")
    return variantes


def perfil_do_telefone(telefone: str) -> Perfil | None:
    if not telefone:
        return None
    encontrados = list(
        Perfil.objects.select_related("usuario").filter(
            telefone__in=variantes_do_telefone(telefone), usuario__is_active=True
        )[:2]
    )
    if len(encontrados) > 1:
        # as duas formas (com e sem o 9) em cadastros diferentes: não dá para saber quem é, então
        # ninguém é atendido em nome do outro
        log.warning(
            "whatsapp: telefone %s bate com mais de um cadastro", mascarar_telefone(telefone)
        )
        return None
    return encontrados[0] if encontrados else None


def mascarar_telefone(telefone: str) -> str:
    """Para os logs: o DDI e o DDD, depois só os dois últimos dígitos."""
    if len(telefone) <= 7:
        return telefone
    return telefone[:5] + "*" * (len(telefone) - 7) + telefone[-2:]


def tipo_da_midia(tipo_midia: str) -> str:
    tipo = tipo_midia.split(";")[0].strip().lower()
    if not tipo:
        return MensagemWhatsApp.Tipo.TEXTO
    if tipo.startswith("audio/"):
        return MensagemWhatsApp.Tipo.AUDIO
    if tipo.startswith("image/") or tipo == "application/pdf" or tipo.startswith("application/"):
        return MensagemWhatsApp.Tipo.DOCUMENTO
    return MensagemWhatsApp.Tipo.OUTRO
