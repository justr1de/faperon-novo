"""Contas da equipe (ADR 0035): o `User` do Django guarda login e senha; o `Perfil`, o resto.

Ninguém é apagado: desativar (`is_active=False`) mantém a autoria dos registros.
"""

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

# Os papéis que o front usa para liberar telas (Funcionario em apps/web/src/lib/sistema/tipos.ts).
PAPEIS = ("administrador", "coordenador", "gestor_frota", "gestor_espacos", "gestor_contas")


class Area(models.TextChoices):
    """As áreas que o front já usa; o valor é o próprio rótulo, que aparece na barra do sistema."""

    ADMINISTRATIVO = "Administrativo", "Administrativo"
    COMUNICACAO = "Comunicação", "Comunicação"
    PRESIDENCIA = "Presidência", "Presidência"
    SINDICAL = "Sindical", "Sindical"
    TECNICA = "Técnica", "Técnica"


telefone_e164 = RegexValidator(
    r"^\+[1-9]\d{7,14}$", "Use o formato internacional, com + e DDI (ex.: +5569999990000)."
)


class Perfil(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="perfil"
    )
    # slug estável: é o `Funcionario.id` do front (os dados de exemplo usam carla, marcos, ana...)
    codigo = models.SlugField(max_length=40, unique=True)
    nome = models.CharField(max_length=120)
    area = models.CharField(max_length=20, choices=Area.choices)
    # opcional; prepara o WhatsApp da ADR 0033
    telefone = models.CharField(max_length=16, blank=True, validators=[telefone_e164])
    administrador = models.BooleanField(default=False)
    coordenador = models.BooleanField(default=False)
    gestor_frota = models.BooleanField(default=False)
    gestor_espacos = models.BooleanField(default=False)
    gestor_contas = models.BooleanField(default=False)
    demonstracao = models.BooleanField(default=False)
    precisa_trocar_senha = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "usuarios_perfil"
        ordering = ["nome"]
        constraints = [
            # o WhatsApp reconhece o funcionário pelo telefone (ADR 0037): um número, uma pessoa
            models.UniqueConstraint(
                fields=["telefone"], condition=~models.Q(telefone=""), name="perfil_telefone_unico"
            )
        ]

    def __str__(self) -> str:
        return f"{self.nome} ({self.codigo})"


class RegistroDeConta(models.Model):
    """Auditoria das contas: quem fez o quê, quando e com quem. Nunca guarda senha nem token."""

    class Acao(models.TextChoices):
        CRIOU = "criou", "Criou a conta"
        EDITOU = "editou", "Editou a conta"
        DESATIVOU = "desativou", "Desativou a conta"
        REATIVOU = "reativou", "Reativou a conta"
        GEROU_SENHA = "gerou_senha_temporaria", "Gerou uma senha temporária"
        TROCOU_SENHA = "trocou_senha", "Trocou a senha"
        ENTROU = "entrou", "Entrou"
        SAIU = "saiu", "Saiu"
        FALHOU_ENTRAR = "falhou_entrar", "Falhou ao entrar"
        BLOQUEOU = "bloqueou", "Bloqueou novas tentativas"

    quando = models.DateTimeField(default=timezone.now, db_index=True)
    acao = models.CharField(max_length=30, choices=Acao.choices)
    # quem fez (vazio quando ninguém estava logado, como numa falha de login ou num comando de gestão)
    ator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    alvo = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    # e-mail digitado numa tentativa de entrada (conta o bloqueio mesmo quando ele não existe)
    email = models.CharField(max_length=254, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    detalhe = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "usuarios_registro_de_conta"
        ordering = ["-quando"]
        indexes = [
            models.Index(fields=["acao", "email", "quando"], name="usuarios_reg_email_idx"),
            models.Index(fields=["acao", "ip", "quando"], name="usuarios_reg_ip_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.quando:%Y-%m-%d %H:%M} {self.acao}"


def perfil_de(usuario: object) -> Perfil:
    """O perfil do usuário (lado reverso do OneToOne), com tipo para o mypy."""
    perfil: Perfil = getattr(usuario, "perfil")  # noqa: B009
    return perfil
