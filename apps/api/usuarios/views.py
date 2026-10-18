"""Login de verdade e gestão das contas (ADR 0035).

Sessão do Django (cookie `sessionid` HttpOnly) com CSRF por cookie `csrftoken` + cabeçalho
`X-CSRFToken`. As rotas públicas do site continuam sem autenticação.
"""

import logging
from typing import Any, cast

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ErroDeSenha
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, BaseThrottle
from rest_framework.views import APIView

from usuarios import servicos
from usuarios.autenticacao import SessaoAutenticacao
from usuarios.models import PAPEIS, Perfil, RegistroDeConta
from usuarios.permissoes import EhAdministrador, EstaLogado, TemPerfil
from usuarios.serializers import (
    CsrfSerializer,
    DadosDoUsuarioSerializer,
    EntrarComGoogleSerializer,
    EntrarSerializer,
    MembroDaEquipeSerializer,
    PerfilDaContaSerializer,
    SenhaTemporariaSerializer,
    TrocarSenhaSerializer,
    UsuarioCriadoSerializer,
    UsuarioDaAdministracaoSerializer,
    dados_validos,
)
from usuarios.throttles import ScopedPorIPThrottle

log = logging.getLogger(__name__)

FALHAS_POR_IP = servicos.FALHAS_POR_IP
ERRO_DE_LOGIN = "E-mail ou senha incorretos."
ERRO_BLOQUEIO = "Muitas tentativas sem sucesso. Tente de novo em 15 minutos."
SEGUNDOS_DO_BLOQUEIO = int(servicos.DURACAO_DO_BLOQUEIO.total_seconds())


def _erro(mensagem: str, status: int, **extra: Any) -> Response:
    return Response({"erro": mensagem, "campos": {}, **extra}, status=status)


def ip_de(request: Request) -> str | None:
    """O mesmo IP que os limites usam (último X-Forwarded-For, ADR 0023)."""
    return BaseThrottle().get_ident(request) or None


def usuario_de(request: Request) -> User:
    """Quem está logado (as views com sessão só chegam aqui depois da permissão)."""
    return cast(User, request.user)


def exigir_csrf(request: Request) -> None:
    """Login também confere o CSRF: sem isso, outro site poderia logar a pessoa numa conta dele."""
    SessaoAutenticacao().enforce_csrf(request)


def verificar_credencial_google(credencial: str, cliente_id: str) -> dict[str, Any]:
    """Confere assinatura, validade, emissor e `aud` do ID token. Lança ValueError se não vale."""
    return dict(id_token.verify_oauth2_token(credencial, google_requests.Request(), cliente_id))


class Publica(APIView):
    """Rotas de entrada: sem sessão obrigatória, com limite por IP e só JSON."""

    authentication_classes: list[type] = []
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedPorIPThrottle]
    throttle_scope = "auth"
    parser_classes = [JSONParser]


class ComSessao(APIView):
    authentication_classes = [SessaoAutenticacao]
    permission_classes: list[type] = [EstaLogado]
    parser_classes = [JSONParser]


def _entrou(request: Request, usuario: User, detalhe: str = "") -> Response:
    # o login gira a chave da sessão e o token de CSRF (o front relê o cookie depois)
    login(request._request, usuario, backend="usuarios.autenticacao.BackendPorEmail")
    servicos.registrar(
        RegistroDeConta.Acao.ENTROU, ator=usuario, alvo=usuario, ip=ip_de(request), detalhe=detalhe
    )
    return Response(PerfilDaContaSerializer(usuario.perfil).data)


class CsrfView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(responses={200: CsrfSerializer})
    def get(self, request: Request) -> Response:
        resposta = Response({"csrf": get_token(request._request)})
        resposta["Cache-Control"] = "no-store"
        return resposta


class EntrarView(Publica):
    @extend_schema(
        request=EntrarSerializer,
        responses={200: PerfilDaContaSerializer, 400: OpenApiResponse(description=ERRO_DE_LOGIN)},
    )
    def post(self, request: Request) -> Response:
        exigir_csrf(request)
        d = dados_validos(EntrarSerializer(data=request.data))
        email, ip = servicos.normalizar_email(d["email"]), ip_de(request)
        if servicos.bloqueado(email, ip):
            r = _erro(ERRO_BLOQUEIO, 429)
            r["Retry-After"] = str(SEGUNDOS_DO_BLOQUEIO)
            return r
        usuario = authenticate(request._request, email=email, password=d["senha"])
        if usuario is None or not hasattr(usuario, "perfil"):
            servicos.anotar_falha(email, ip)
            return _erro(ERRO_DE_LOGIN, 400)
        return _entrou(request, usuario)


class GoogleView(Publica):
    @extend_schema(request=EntrarComGoogleSerializer, responses={200: PerfilDaContaSerializer})
    def post(self, request: Request) -> Response:
        exigir_csrf(request)
        if not settings.GOOGLE_CLIENT_ID:
            return _erro("O login com o Google está desligado.", 503, motivo="google_desligado")
        d = dados_validos(EntrarComGoogleSerializer(data=request.data))
        try:
            dados = verificar_credencial_google(d["credential"], settings.GOOGLE_CLIENT_ID)
        except ValueError as exc:
            log.info("google: credencial recusada (%s)", exc)
            return _erro("Não foi possível confirmar o login com o Google.", 400)
        if dados.get("email_verified") is not True or not dados.get("email"):
            return _erro("Não foi possível confirmar o login com o Google.", 400)
        email, ip = servicos.normalizar_email(str(dados["email"])), ip_de(request)
        # só entra quem já foi cadastrado pelo administrador: o Google nunca cria conta
        usuario = User.objects.filter(
            email__iexact=email, is_active=True, perfil__isnull=False
        ).first()
        if usuario is None:
            servicos.registrar(
                RegistroDeConta.Acao.FALHOU_ENTRAR, email=email, ip=ip, detalhe="google"
            )
            return _erro(
                "Este e-mail do Google não tem acesso ao sistema. Peça acesso ao administrador.",
                403,
            )
        return _entrou(request, usuario, detalhe="google")


class SairView(ComSessao):
    permission_classes = [TemPerfil]

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        servicos.registrar(
            RegistroDeConta.Acao.SAIU,
            ator=usuario_de(request),
            alvo=usuario_de(request),
            ip=ip_de(request),
        )
        logout(request._request)
        return Response(status=204)


class EuView(ComSessao):
    # com senha temporária também: o front precisa saber que deve pedir a troca
    permission_classes = [TemPerfil]

    @extend_schema(responses={200: PerfilDaContaSerializer})
    def get(self, request: Request) -> Response:
        return Response(PerfilDaContaSerializer(usuario_de(request).perfil).data)


class TrocarSenhaView(ComSessao):
    permission_classes = [TemPerfil]
    throttle_classes = [ScopedPorIPThrottle]
    throttle_scope = "auth"

    @extend_schema(request=TrocarSenhaSerializer, responses={200: PerfilDaContaSerializer})
    def post(self, request: Request) -> Response:
        d = dados_validos(TrocarSenhaSerializer(data=request.data))
        usuario = usuario_de(request)
        if not usuario.check_password(d["senha_atual"]):
            return Response(
                {
                    "erro": "A senha atual não confere.",
                    "campos": {"senha_atual": "A senha atual não confere."},
                },
                status=400,
            )
        if d["senha_nova"] == d["senha_atual"]:
            mensagem = "A nova senha precisa ser diferente da atual."
            return Response({"erro": mensagem, "campos": {"senha_nova": mensagem}}, status=400)
        try:
            validate_password(d["senha_nova"], usuario)
        except ErroDeSenha as exc:
            mensagem = " ".join(exc.messages)
            return Response({"erro": mensagem, "campos": {"senha_nova": mensagem}}, status=400)
        usuario.set_password(d["senha_nova"])
        usuario.save(update_fields=["password"])
        Perfil.objects.filter(usuario=usuario).update(precisa_trocar_senha=False)
        # a troca muda o hash da sessão: sem isso, a própria pessoa sairia
        update_session_auth_hash(request._request, usuario)
        servicos.registrar(
            RegistroDeConta.Acao.TROCOU_SENHA, ator=usuario, alvo=usuario, ip=ip_de(request)
        )
        usuario.perfil.refresh_from_db()
        return Response(PerfilDaContaSerializer(usuario.perfil).data)


# ---------- equipe e administração ----------


class EquipeView(ComSessao):
    @extend_schema(responses={200: MembroDaEquipeSerializer(many=True)})
    def get(self, request: Request) -> Response:
        ativos = Perfil.objects.filter(usuario__is_active=True).order_by("nome")
        return Response(MembroDaEquipeSerializer(ativos, many=True).data)


def _perfis_da_administracao() -> Any:
    return Perfil.objects.select_related("usuario").order_by("nome")


class UsuariosView(ComSessao):
    permission_classes = [EhAdministrador]

    @extend_schema(responses={200: UsuarioDaAdministracaoSerializer(many=True)})
    def get(self, request: Request) -> Response:
        return Response(
            UsuarioDaAdministracaoSerializer(_perfis_da_administracao(), many=True).data
        )

    @extend_schema(request=DadosDoUsuarioSerializer, responses={201: UsuarioCriadoSerializer})
    def post(self, request: Request) -> Response:
        d = dados_validos(DadosDoUsuarioSerializer(data=request.data))
        papeis = {p: d.pop(p) for p in PAPEIS if p in d}
        usuario, senha = servicos.criar_usuario(
            email=d["email"],
            nome=d["nome"],
            area=d["area"],
            telefone=d.get("telefone", ""),
            papeis=papeis,
            ator=usuario_de(request),
        )
        corpo = {
            "usuario": UsuarioDaAdministracaoSerializer(usuario.perfil).data,
            "senha_temporaria": senha,
        }
        return Response(corpo, status=201)


class UsuarioView(ComSessao):
    permission_classes = [EhAdministrador]

    @extend_schema(
        request=DadosDoUsuarioSerializer, responses={200: UsuarioDaAdministracaoSerializer}
    )
    def patch(self, request: Request, codigo: str) -> Response:
        perfil = get_object_or_404(Perfil.objects.select_related("usuario"), codigo=codigo)
        entrada = DadosDoUsuarioSerializer(
            data=request.data, partial=True, context={"perfil": perfil}
        )
        d = dados_validos(entrada)
        tira_admin = perfil.administrador and d.get("administrador") is False
        if tira_admin and perfil.usuario.is_active and servicos.administradores_ativos() <= 1:
            return _erro("Não dá para tirar o último administrador.", 400)
        servicos.atualizar_perfil(perfil, d, ator=usuario_de(request))
        perfil.refresh_from_db()
        return Response(UsuarioDaAdministracaoSerializer(perfil).data)


class AcaoNoUsuario(ComSessao):
    permission_classes = [EhAdministrador]

    def alvo(self, codigo: str) -> Perfil:
        return get_object_or_404(Perfil.objects.select_related("usuario"), codigo=codigo)


class DesativarView(AcaoNoUsuario):
    @extend_schema(request=None, responses={200: UsuarioDaAdministracaoSerializer})
    def post(self, request: Request, codigo: str) -> Response:
        perfil = self.alvo(codigo)
        if perfil.usuario == usuario_de(request):
            return _erro("Você não pode desativar a própria conta.", 400)
        if (
            perfil.administrador
            and perfil.usuario.is_active
            and servicos.administradores_ativos() <= 1
        ):
            return _erro("Não dá para desativar o último administrador.", 400)
        if perfil.usuario.is_active:
            # desativar, não apagar: a autoria continua; a sessão aberta deixa de valer na hora
            perfil.usuario.is_active = False
            perfil.usuario.save(update_fields=["is_active"])
            servicos.registrar(
                RegistroDeConta.Acao.DESATIVOU, ator=usuario_de(request), alvo=perfil.usuario
            )
        return Response(UsuarioDaAdministracaoSerializer(perfil).data)


class ReativarView(AcaoNoUsuario):
    @extend_schema(request=None, responses={200: UsuarioDaAdministracaoSerializer})
    def post(self, request: Request, codigo: str) -> Response:
        perfil = self.alvo(codigo)
        if not perfil.usuario.is_active:
            perfil.usuario.is_active = True
            perfil.usuario.save(update_fields=["is_active"])
            servicos.registrar(
                RegistroDeConta.Acao.REATIVOU, ator=usuario_de(request), alvo=perfil.usuario
            )
        return Response(UsuarioDaAdministracaoSerializer(perfil).data)


class SenhaTemporariaView(AcaoNoUsuario):
    @extend_schema(request=None, responses={200: SenhaTemporariaSerializer})
    def post(self, request: Request, codigo: str) -> Response:
        perfil = self.alvo(codigo)
        senha = servicos.definir_senha_temporaria(perfil.usuario, ator=usuario_de(request))
        if perfil.usuario == usuario_de(request):
            update_session_auth_hash(request._request, perfil.usuario)
        resposta = Response({"senha_temporaria": senha})
        resposta["Cache-Control"] = "no-store"
        return resposta
