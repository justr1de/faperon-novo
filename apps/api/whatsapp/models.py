"""Fila e histórico do Zétele no WhatsApp (ADR 0037).

Cada linha é uma mensagem recebida. O texto, a resposta e a URL da mídia são apagados em 24 h; a
linha de controle (quem, quando, tipo, situação) fica 90 dias. O áudio recebido nunca é gravado.
"""

from django.db import models
from django.utils import timezone


class MensagemWhatsApp(models.Model):
    class Tipo(models.TextChoices):
        TEXTO = "texto", "Texto"
        AUDIO = "audio", "Áudio"
        DOCUMENTO = "documento", "Documento ou foto"
        OUTRO = "outro", "Outro"

    class Situacao(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        PROCESSANDO = "processando", "Processando"
        RESPONDIDA = "respondida", "Respondida"
        IGNORADA = "ignorada", "Ignorada"
        ERRO = "erro", "Erro"

    # MessageSid do Twilio: o reenvio do webhook bate no unique e não vira segunda resposta
    id_externo = models.CharField(max_length=64, unique=True)
    provedor = models.CharField(max_length=20, default="twilio")
    # o remetente como chegou (E.164); vazio quando o número não é de um funcionário
    telefone = models.CharField(max_length=16, blank=True)
    perfil = models.ForeignKey(
        "usuarios.Perfil", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    texto = models.TextField(blank=True)
    resposta = models.TextField(blank=True)
    url_midia = models.URLField(max_length=500, blank=True)
    tipo_midia = models.CharField(max_length=80, blank=True)
    situacao = models.CharField(max_length=12, choices=Situacao.choices, default=Situacao.PENDENTE)
    motivo = models.CharField(max_length=40, blank=True)
    tentativas = models.PositiveSmallIntegerField(default=0)
    # partes da resposta já entregues: a nova tentativa não repete o que a pessoa já recebeu
    partes_enviadas = models.PositiveSmallIntegerField(default=0)
    recebida_em = models.DateTimeField(default=timezone.now)
    proxima_tentativa_em = models.DateTimeField(default=timezone.now)
    iniciada_em = models.DateTimeField(null=True, blank=True)
    processada_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "whatsapp_mensagem"
        ordering = ["recebida_em"]
        indexes = [
            models.Index(fields=["situacao", "proxima_tentativa_em"], name="whatsapp_fila_idx"),
            models.Index(fields=["perfil", "recebida_em"], name="whatsapp_pessoa_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.id_externo} {self.tipo} {self.situacao}"
