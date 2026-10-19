from django.conf import settings

from whatsapp.provedores.base import Provedor
from whatsapp.provedores.falso import ProvedorFalso
from whatsapp.provedores.twilio import ProvedorTwilio


def obter_provedor() -> Provedor:
    if settings.WHATSAPP_PROVEDOR == "falso":
        return ProvedorFalso()
    return ProvedorTwilio(
        settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.WHATSAPP_NUMERO
    )
