import logging
import threading
from pathlib import Path
from typing import Any, cast

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.autenticacao import SessaoAutenticacao
from usuarios.permissoes import EstaLogado
from usuarios.throttles import ScopedPorIPThrottle
from zetele import agente, audio, disponibilidade, registro, voz
from zetele.audio.sintese import texto_para_fala
from zetele.canais import PUBLICO, SISTEMA, Canal
from zetele.cliente import (
    ClienteAnthropic,
    ClienteLLM,
    PedidoRecusado,
    ProvedorIndisponivel,
    TempoEsgotado,
)
from zetele.models import Pergunta
from zetele.throttles import (
    ZeteleGlobalThrottle,
    ZeteleSistemaGlobalThrottle,
    ZeteleVozGlobalThrottle,
)

log = logging.getLogger(__name__)

PAGINAS_COM_ZETELE = PUBLICO.paginas + SISTEMA.paginas
# Uma pergunta prende uma thread do gunicorn por até 40 s: no máximo N por processo (ADR 0025).
SEMAFORO = threading.BoundedSemaphore(settings.ZETELE_SIMULTANEOS)
MENSAGENS = {
    "sem_chave": "O assistente está desligado; use as perguntas prontas.",
    "orcamento_diario": "O assistente atingiu o limite de hoje; use as perguntas prontas.",
    "indisponivel": "O assistente está indisponível no momento; tente de novo em instantes.",
    "ocupado": "O assistente está atendendo muitas pessoas; tente de novo em instantes.",
    "voz_desligada": "A voz do assistente está desligada; digite a pergunta.",
}
RETRY = {
    "sem_chave": 3600,
    "orcamento_diario": 3600,
    "indisponivel": 60,
    "ocupado": 10,
    "voz_desligada": 3600,
}


def obter_cliente() -> ClienteLLM:
    return ClienteAnthropic(settings.ANTHROPIC_API_KEY, settings.ZETELE_MODELO)


def obter_transcritor() -> audio.Transcritor | None:
    return audio.obter_transcritor()


def obter_sintetizador() -> audio.Sintetizador | None:
    return audio.obter_sintetizador()


class MensagemSerializer(serializers.Serializer):
    papel = serializers.ChoiceField(choices=["visitante", "zetele"])
    texto = serializers.CharField(max_length=1200)


class PerguntaSerializer(serializers.Serializer):
    """Pergunta ao Zétele do site público."""

    pergunta = serializers.CharField(max_length=500)
    historico = MensagemSerializer(many=True, required=False, default=list)
    pagina = serializers.ChoiceField(choices=PUBLICO.paginas)

    def validate_historico(self, valor: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(valor) > 6:
            raise serializers.ValidationError("No máximo 6 mensagens.")
        return valor


class EstadoSerializer(serializers.Serializer):
    disponivel = serializers.BooleanField()
    motivo = serializers.CharField(allow_null=True)


class FonteZeteleSerializer(serializers.Serializer):
    rotulo = serializers.CharField()
    url_fonte = serializers.CharField()
    url_interna = serializers.CharField(allow_null=True)
    atualizado_em = serializers.CharField(allow_null=True)


class RespostaSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["respondida", "recusada", "erro"])
    texto = serializers.CharField()
    fontes = FonteZeteleSerializer(many=True)
    sugestoes = serializers.ListField(child=serializers.CharField())


def _indisponivel(motivo: str) -> Response:
    r = Response({"erro": MENSAGENS[motivo], "motivo": motivo}, status=503)
    r["Retry-After"] = str(RETRY[motivo])
    return r


class PerguntaSistemaSerializer(PerguntaSerializer):
    """Pergunta ao Zétele da área do sistema: só as páginas do sistema."""

    pagina = serializers.ChoiceField(choices=SISTEMA.paginas)


class EstadoView(APIView):
    canal: Canal = PUBLICO

    @extend_schema(responses={200: EstadoSerializer})
    def get(self, request: Request) -> Response:
        return Response(disponibilidade.estado(self.canal.nome))


class EstadoVozZeteleSerializer(serializers.Serializer):
    ouvir = serializers.BooleanField()
    falar = serializers.BooleanField()


class EstadoSistemaZeteleSerializer(EstadoSerializer):
    voz = EstadoVozZeteleSerializer()


class SoComLogin(APIView):
    """Área do sistema: só a equipe logada (ADR 0035). Antes era aberta, porque o login só existia no
    navegador (ADR 0032); as perguntas continuam anônimas, sem ligação com a conta."""

    authentication_classes = [SessaoAutenticacao]
    permission_classes = [EstaLogado]


class EstadoSistemaView(SoComLogin, EstadoView):
    canal = SISTEMA

    @extend_schema(responses={200: EstadoSistemaZeteleSerializer})
    def get(self, request: Request) -> Response:
        return Response({**disponibilidade.estado(SISTEMA.nome), "voz": audio.estado_voz()})


class LimitesDoZetele(APIView):
    """Limite por IP e teto global de quem gasta a cota da Anthropic; cada canal tem os seus."""

    throttle_classes = [ScopedPorIPThrottle, ZeteleGlobalThrottle]
    throttle_scope = "zetele"
    # só JSON: formulário simples de outro site não chega aqui sem preflight de CORS
    parser_classes = [JSONParser]

    def check_throttles(self, request: Request) -> None:
        """Para no primeiro limite que recusa: pedido barrado por IP não gasta o teto global."""
        for throttle in self.get_throttles():
            if not throttle.allow_request(request, self):
                self.throttled(request, cast(float, throttle.wait()))


class LimitesDoZeteleSistema(SoComLogin, LimitesDoZetele):
    throttle_classes = [ScopedPorIPThrottle, ZeteleSistemaGlobalThrottle]
    throttle_scope = "zetele_sistema"


class PerguntarView(LimitesDoZetele):
    canal: Canal = PUBLICO
    serializer_class: type[PerguntaSerializer] = PerguntaSerializer

    @extend_schema(request=PerguntaSerializer, responses={200: RespostaSerializer})
    def post(self, request: Request) -> Response:
        return self.responder(request)

    def responder(self, request: Request) -> Response:
        canal = self.canal.nome
        entrada = self.serializer_class(data=request.data)
        entrada.is_valid(raise_exception=True)
        d: dict[str, Any] = dict(entrada.validated_data)
        pergunta, pagina = d["pergunta"], d["pagina"]
        historico = [dict(m) for m in d["historico"]]

        situacao = disponibilidade.estado(canal)
        if not situacao["disponivel"]:
            registro.registrar(pergunta, Pergunta.Status.INDISPONIVEL, pagina, canal=canal)
            return _indisponivel(situacao["motivo"])
        # o orçamento só é gasto por quem conseguiu vaga: "ocupado" não consome o teto do dia
        if not SEMAFORO.acquire(blocking=False):
            registro.registrar(pergunta, Pergunta.Status.INDISPONIVEL, pagina, canal=canal)
            return _indisponivel("ocupado")
        if disponibilidade.contar_pergunta(canal) > self.canal.limite_diario:
            disponibilidade.devolver_pergunta(canal)
            SEMAFORO.release()
            registro.registrar(pergunta, Pergunta.Status.INDISPONIVEL, pagina, canal=canal)
            return _indisponivel("orcamento_diario")
        try:
            resposta = agente.responder(
                obter_cliente(), pergunta, historico, pagina, canal=self.canal
            )
        except ProvedorIndisponivel as exc:
            log.warning("zetele: provedor indisponível (%s)", exc)
            disponibilidade.abrir_disjuntor()
            registro.registrar(pergunta, Pergunta.Status.ERRO, pagina, canal=canal)
            return _indisponivel("indisponivel")
        except PedidoRecusado as exc:
            log.warning("zetele: pedido recusado pela Anthropic (%s)", exc)
            registro.registrar(pergunta, Pergunta.Status.ERRO, pagina, canal=canal)
            return _indisponivel("indisponivel")
        finally:
            SEMAFORO.release()

        registro.registrar(
            pergunta,
            resposta.status,
            pagina,
            resposta.tokens_entrada,
            resposta.tokens_saida,
            canal=canal,
        )
        # a reserva determinística é uma resposta válida: o visitante não precisa saber da falha
        status = "respondida" if resposta.status == "verificacao_falhou" else resposta.status
        return Response(
            {
                "status": status,
                "texto": resposta.texto,
                "fontes": resposta.fontes,
                "sugestoes": resposta.sugestoes,
            }
        )


class OpcaoVozSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=40)
    descricao = serializers.CharField(max_length=80)


class InterpretarSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=list(voz.FORMATOS))
    texto = serializers.CharField(max_length=500)
    hoje = serializers.DateField()
    veiculos = OpcaoVozSerializer(many=True, required=False, default=list)
    espacos = OpcaoVozSerializer(many=True, required=False, default=list)

    def validate_veiculos(self, valor: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(valor) > 20:
            raise serializers.ValidationError("No máximo 20 veículos.")
        return valor

    def validate_espacos(self, valor: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(valor) > 10:
            raise serializers.ValidationError("No máximo 10 espaços.")
        return valor


class InterpretacaoSerializer(serializers.Serializer):
    tipo = serializers.CharField()
    campos = serializers.DictField()
    faltando = serializers.ListField(child=serializers.CharField())


class PerguntarSistemaView(LimitesDoZeteleSistema, PerguntarView):
    canal = SISTEMA
    serializer_class = PerguntaSistemaSerializer

    @extend_schema(request=PerguntaSistemaSerializer, responses={200: RespostaSerializer})
    def post(self, request: Request) -> Response:
        return self.responder(request)


class InterpretarView(LimitesDoZeteleSistema):
    """Agendamento por voz do protótipo do sistema: mesmos limites do Zétele, transcrição não gravada."""

    @extend_schema(request=InterpretarSerializer, responses={200: InterpretacaoSerializer})
    def post(self, request: Request) -> Response:
        entrada = InterpretarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        d: dict[str, Any] = dict(entrada.validated_data)
        veiculos = [dict(o) for o in d["veiculos"]]
        espacos = [dict(o) for o in d["espacos"]]

        # a voz gasta o orçamento do Zétele do sistema (o mesmo teto diário das perguntas de lá)
        situacao = disponibilidade.estado(SISTEMA.nome)
        if not situacao["disponivel"]:
            return _indisponivel(situacao["motivo"])
        if not SEMAFORO.acquire(blocking=False):
            return _indisponivel("ocupado")
        if disponibilidade.contar_pergunta(SISTEMA.nome) > SISTEMA.limite_diario:
            disponibilidade.devolver_pergunta(SISTEMA.nome)
            SEMAFORO.release()
            return _indisponivel("orcamento_diario")
        try:
            resultado = voz.interpretar(
                obter_cliente(), d["tipo"], d["texto"], d["hoje"], veiculos, espacos
            )
        except ProvedorIndisponivel as exc:
            log.warning("voz: provedor indisponível (%s)", exc)
            disponibilidade.abrir_disjuntor()
            return _indisponivel("indisponivel")
        except (TempoEsgotado, PedidoRecusado):
            return _indisponivel("indisponivel")
        except voz.InterpretacaoFalhou as exc:
            log.info("voz: interpretação falhou (%s)", exc)
            return Response(
                {"erro": "Não consegui entender o pedido. Tente de novo ou preencha o formulário."},
                status=422,
            )
        finally:
            SEMAFORO.release()
        log.info(
            "voz: %s interpretado (%s/%s tokens)",
            d["tipo"],
            resultado.tokens_entrada,
            resultado.tokens_saida,
        )
        return Response(
            {"tipo": d["tipo"], "campos": resultado.campos, "faltando": resultado.faltando}
        )


# ---------- voz do Zétele do sistema (ADR 0034) ----------

TAMANHO_MAXIMO_AUDIO = 3 * 1024 * 1024
# folga para os cabeçalhos do multipart: acima disso, recusa sem ler o corpo
FOLGA_MULTIPART = 64 * 1024
EXTENSOES_DE_AUDIO = frozenset({"flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm"})
TIPOS_DE_AUDIO = frozenset(
    {
        "audio/flac",
        "audio/x-flac",
        "audio/mpeg",
        "audio/mp3",
        "audio/mpga",
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/aac",
        "audio/ogg",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/webm",
        # alguns navegadores rotulam a gravação só de áudio com o tipo do contêiner de vídeo
        "video/mp4",
        "video/webm",
    }
)


class OuvirZeteleSerializer(serializers.Serializer):
    audio = serializers.FileField(allow_empty_file=False)

    def validate_audio(self, arquivo: UploadedFile) -> UploadedFile:
        if (arquivo.size or 0) > TAMANHO_MAXIMO_AUDIO:
            raise serializers.ValidationError("O áudio passa de 3 MB.")
        tipo = (arquivo.content_type or "").split(";")[0].strip().lower()
        extensao = Path(arquivo.name or "").suffix.lower().lstrip(".")
        if tipo not in TIPOS_DE_AUDIO or extensao not in EXTENSOES_DE_AUDIO:
            raise serializers.ValidationError("Formato de áudio não aceito.")
        return arquivo


class TranscricaoZeteleSerializer(serializers.Serializer):
    texto = serializers.CharField()


class FalarZeteleSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=4000)


class LimitesDaVoz(SoComLogin, LimitesDoZetele):
    """Ouvir e falar dividem um limite por IP e um teto por minuto próprios."""

    throttle_classes = [ScopedPorIPThrottle, ZeteleVozGlobalThrottle]
    throttle_scope = "zetele_voz"


class OuvirView(LimitesDaVoz):
    """Transcreve a pergunta falada. Não conta no teto do dia (a pergunta conta no /perguntar)."""

    parser_classes = [MultiPartParser]

    @extend_schema(
        request={"multipart/form-data": OuvirZeteleSerializer},
        responses={200: TranscricaoZeteleSerializer},
    )
    def post(self, request: Request) -> Response:
        try:
            tamanho = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            tamanho = 0
        if tamanho > TAMANHO_MAXIMO_AUDIO + FOLGA_MULTIPART:
            return Response({"erro": "O áudio passa de 3 MB."}, status=413)
        entrada = OuvirZeteleSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        arquivo: UploadedFile = entrada.validated_data["audio"]

        transcritor = obter_transcritor()
        if transcritor is None:
            return _indisponivel("voz_desligada")
        motivo = disponibilidade.voz_bloqueada("ouvir")
        if motivo:
            return _indisponivel(motivo)
        if not SEMAFORO.acquire(blocking=False):
            return _indisponivel("ocupado")
        try:
            texto = transcritor.transcrever(
                arquivo.read(), arquivo.name or "audio", arquivo.content_type or ""
            )
        except ProvedorIndisponivel as exc:
            log.warning("voz: transcrição indisponível (%s)", exc)
            disponibilidade.abrir_disjuntor_voz("ouvir")
            return _indisponivel("indisponivel")
        except PedidoRecusado as exc:
            log.warning("voz: transcrição recusada (%s)", exc)
            return _indisponivel("indisponivel")
        finally:
            SEMAFORO.release()
        texto = " ".join(texto.split())[:500].strip()
        if not texto:
            return Response(
                {"erro": "Não entendi o áudio. Tente de novo ou digite a pergunta."}, status=422
            )
        return Response({"texto": texto})


class FalarView(LimitesDaVoz):
    """Lê a resposta em voz alta. Conta no teto diário do sistema, como uma pergunta."""

    parser_classes = [JSONParser]

    @extend_schema(
        request=FalarZeteleSerializer,
        responses={(200, "audio/wav"): OpenApiResponse(OpenApiTypes.BINARY)},
    )
    def post(self, request: Request) -> HttpResponse:
        entrada = FalarZeteleSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        texto = texto_para_fala(entrada.validated_data["texto"])
        if not texto:
            raise serializers.ValidationError({"texto": ["Nada para ler em voz alta."]})

        sintetizador = obter_sintetizador()
        if sintetizador is None:
            return _indisponivel("voz_desligada")
        motivo = disponibilidade.voz_bloqueada("falar")
        if motivo:
            return _indisponivel(motivo)
        if not SEMAFORO.acquire(blocking=False):
            return _indisponivel("ocupado")
        if disponibilidade.contar_pergunta(SISTEMA.nome) > SISTEMA.limite_diario:
            disponibilidade.devolver_pergunta(SISTEMA.nome)
            SEMAFORO.release()
            return _indisponivel("orcamento_diario")
        try:
            wav = sintetizador.sintetizar(texto)
        except ProvedorIndisponivel as exc:
            log.warning("voz: síntese indisponível (%s)", exc)
            disponibilidade.devolver_pergunta(SISTEMA.nome)
            disponibilidade.abrir_disjuntor_voz("falar")
            return _indisponivel("indisponivel")
        except PedidoRecusado as exc:
            log.warning("voz: síntese recusada (%s)", exc)
            disponibilidade.devolver_pergunta(SISTEMA.nome)
            return _indisponivel("indisponivel")
        finally:
            SEMAFORO.release()
        resposta = HttpResponse(wav, content_type="audio/wav")
        resposta["Cache-Control"] = "no-store"
        return resposta
