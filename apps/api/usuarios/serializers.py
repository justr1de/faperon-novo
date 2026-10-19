from typing import Any

from rest_framework import serializers

from usuarios.models import Area, Perfil, telefone_e164
from usuarios.servicos import email_em_uso, normalizar_email


class PapeisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Perfil
        fields = ["administrador", "coordenador", "gestor_frota", "gestor_espacos", "gestor_contas"]


class MembroDaEquipeSerializer(PapeisSerializer):
    """O que qualquer pessoa logada vê dos colegas (sem e-mail nem telefone)."""

    class Meta(PapeisSerializer.Meta):
        fields = ["codigo", "nome", "area", *PapeisSerializer.Meta.fields]


class PerfilDaContaSerializer(PapeisSerializer):
    """Resposta do `/auth/eu` e do login: o perfil de quem está logado."""

    email = serializers.EmailField(source="usuario.email", read_only=True)

    class Meta(PapeisSerializer.Meta):
        fields = [
            "codigo",
            "nome",
            "email",
            "area",
            "telefone",
            *PapeisSerializer.Meta.fields,
            "demonstracao",
            "precisa_trocar_senha",
        ]


class UsuarioDaAdministracaoSerializer(PerfilDaContaSerializer):
    """Linha da tela Usuários: inclui a situação e o último acesso."""

    ativo = serializers.BooleanField(source="usuario.is_active", read_only=True)
    ultimo_acesso = serializers.DateTimeField(
        source="usuario.last_login", read_only=True, allow_null=True
    )

    class Meta(PerfilDaContaSerializer.Meta):
        fields = [*PerfilDaContaSerializer.Meta.fields, "ativo", "ultimo_acesso", "criado_em"]


class DadosDoUsuarioSerializer(serializers.Serializer):
    """Criar (todos os campos) ou editar (parcial) uma conta."""

    nome = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    area = serializers.ChoiceField(choices=Area.choices)
    telefone = serializers.CharField(
        max_length=16, required=False, allow_blank=True, validators=[telefone_e164]
    )
    administrador = serializers.BooleanField(required=False)
    coordenador = serializers.BooleanField(required=False)
    gestor_frota = serializers.BooleanField(required=False)
    gestor_espacos = serializers.BooleanField(required=False)
    gestor_contas = serializers.BooleanField(required=False)

    def validate_nome(self, valor: str) -> str:
        valor = " ".join(valor.split())
        if not valor:
            raise serializers.ValidationError("Informe o nome.")
        return valor

    def validate_email(self, valor: str) -> str:
        valor = normalizar_email(valor)
        perfil: Perfil | None = self.context.get("perfil")
        if email_em_uso(valor, exceto=perfil.usuario if perfil else None):
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return valor

    def validate_telefone(self, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            return valor
        perfil: Perfil | None = self.context.get("perfil")
        outros = Perfil.objects.filter(telefone=valor)
        if perfil is not None:
            outros = outros.exclude(pk=perfil.pk)
        if outros.exists():
            raise serializers.ValidationError("Este telefone já está no cadastro de outro usuário.")
        return valor


class UsuarioCriadoSerializer(serializers.Serializer):
    usuario = UsuarioDaAdministracaoSerializer()
    senha_temporaria = serializers.CharField()


class SenhaTemporariaSerializer(serializers.Serializer):
    senha_temporaria = serializers.CharField()


class EntrarSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)
    senha = serializers.CharField(max_length=128, trim_whitespace=False)


class EntrarComGoogleSerializer(serializers.Serializer):
    # o ID token do Google Identity Services (um JWT de ~1 KB)
    credential = serializers.CharField(max_length=4096)


class TrocarSenhaSerializer(serializers.Serializer):
    senha_atual = serializers.CharField(max_length=128, trim_whitespace=False)
    senha_nova = serializers.CharField(max_length=128, trim_whitespace=False)


class CsrfSerializer(serializers.Serializer):
    csrf = serializers.CharField()


def dados_validos(serializer: serializers.Serializer) -> dict[str, Any]:
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)
