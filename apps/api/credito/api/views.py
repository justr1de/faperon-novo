from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from credito import consultas
from credito.api import serializers as sz
from indicadores.api.parametros import validar_consulta
from indicadores.api.views import ERROS


class ResumoView(APIView):
    @extend_schema(
        parameters=[sz.CreditoConsultaSerializer],
        responses={200: sz.CreditoResumoSerializer, **ERROS},
    )
    def get(self, request: Request) -> Response:
        dados = validar_consulta(sz.CreditoConsultaSerializer, request)
        return Response(sz.CreditoResumoSerializer(consultas.resumo(dados)).data)


class SerieView(APIView):
    @extend_schema(
        parameters=[sz.CreditoConsultaSerializer],
        responses={200: sz.CreditoSerieSerializer, **ERROS},
    )
    def get(self, request: Request) -> Response:
        dados = validar_consulta(sz.CreditoConsultaSerializer, request)
        return Response(sz.CreditoSerieSerializer(consultas.serie(dados)).data)


class RankingView(APIView):
    @extend_schema(
        parameters=[sz.CreditoConsultaSerializer],
        responses={200: sz.CreditoRankingSerializer, **ERROS},
    )
    def get(self, request: Request) -> Response:
        dados = validar_consulta(sz.CreditoConsultaSerializer, request)
        return Response(sz.CreditoRankingSerializer(consultas.ranking(dados)).data)


class PorProdutoView(APIView):
    @extend_schema(
        parameters=[sz.CreditoConsultaSerializer],
        responses={200: sz.CreditoProdutosSerializer, **ERROS},
    )
    def get(self, request: Request) -> Response:
        dados = validar_consulta(sz.CreditoConsultaSerializer, request)
        return Response(sz.CreditoProdutosSerializer(consultas.por_produto(dados)).data)
