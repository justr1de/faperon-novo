"""Formatos das rotas /api/v1/credito/*. Nomes com o prefixo Credito: o drf-spectacular exige nomes únicos."""

from typing import Any

from rest_framework import serializers

from credito.models import Finalidade, Programa


class _SoPresentesSerializer(serializers.Serializer):
    """Métricas vazias continuam vazias ({}): campo nulável ausente não vira null."""

    def to_representation(self, instance: Any) -> Any:
        saida = super().to_representation(instance)
        return {k: v for k, v in saida.items() if k in instance}


class CreditoConsultaSerializer(serializers.Serializer):
    ano = serializers.IntegerField(required=False, min_value=2000, max_value=2100)
    municipio = serializers.RegexField(r"^(\d{7}|[a-z0-9-]{2,80})$", required=False)
    programa = serializers.ChoiceField(choices=Programa.choices, required=False)
    finalidade = serializers.ChoiceField(choices=Finalidade.choices, required=False)


class CreditoOpcaoSerializer(serializers.Serializer):
    slug = serializers.CharField()
    nome = serializers.CharField()


class CreditoMunicipioRefSerializer(serializers.Serializer):
    codigo_ibge = serializers.CharField()
    nome = serializers.CharField()
    slug = serializers.CharField()


class CreditoValoresSerializer(serializers.Serializer):
    ano = serializers.IntegerField(allow_null=True)
    municipio = CreditoMunicipioRefSerializer(allow_null=True)
    programa = serializers.CharField(allow_null=True)
    finalidade = serializers.CharField(allow_null=True)


class CreditoOpcoesSerializer(serializers.Serializer):
    anos = serializers.ListField(child=serializers.IntegerField())
    municipios = CreditoMunicipioRefSerializer(many=True)
    programas = CreditoOpcaoSerializer(many=True)
    finalidades = CreditoOpcaoSerializer(many=True)


class CreditoFiltrosSerializer(serializers.Serializer):
    valores = CreditoValoresSerializer()
    opcoes = CreditoOpcoesSerializer()


class CreditoQualidadeSerializer(serializers.Serializer):
    ano_completo = serializers.BooleanField(allow_null=True)
    meses_com_dado = serializers.IntegerField()
    mes_mais_recente = serializers.CharField(allow_null=True)
    avisos = serializers.ListField(child=serializers.CharField())


class CreditoFonteSerializer(serializers.Serializer):
    fonte = serializers.CharField()
    url_fonte = serializers.URLField()
    licenca = serializers.CharField()


class CreditoMetaSerializer(serializers.Serializer):
    fontes = CreditoFonteSerializer(many=True)
    atualizado_em = serializers.CharField(allow_null=True)


class CreditoTextoSerializer(serializers.Serializer):
    manchete = serializers.CharField()
    como_ler = serializers.ListField(child=serializers.CharField())


class _CreditoBaseSerializer(serializers.Serializer):
    filtros = CreditoFiltrosSerializer()
    qualidade = CreditoQualidadeSerializer()
    meta = CreditoMetaSerializer()


class CreditoResumoMetricasSerializer(_SoPresentesSerializer):
    valor_total = serializers.FloatField(required=False)
    contratos = serializers.IntegerField(required=False)
    valor_medio = serializers.FloatField(required=False, allow_null=True)
    valor_pronaf = serializers.FloatField(required=False)
    participacao_pronaf_pct = serializers.FloatField(required=False, allow_null=True)
    valor_ano_anterior = serializers.FloatField(required=False, allow_null=True)
    variacao_pct = serializers.FloatField(required=False, allow_null=True)
    area_custeio_ha = serializers.FloatField(required=False, allow_null=True)


class CreditoDivisaoSerializer(serializers.Serializer):
    slug = serializers.CharField()
    nome = serializers.CharField()
    valor = serializers.FloatField()
    contratos = serializers.IntegerField()
    participacao = serializers.FloatField(allow_null=True)


class CreditoResumoSeriesSerializer(serializers.Serializer):
    programas = CreditoDivisaoSerializer(many=True, required=False)
    finalidades = CreditoDivisaoSerializer(many=True, required=False)
    atividades = CreditoDivisaoSerializer(many=True, required=False)


class CreditoResumoSerializer(_CreditoBaseSerializer):
    metricas = CreditoResumoMetricasSerializer()
    series = CreditoResumoSeriesSerializer()
    texto = CreditoTextoSerializer()


class CreditoMesSerializer(serializers.Serializer):
    mes = serializers.IntegerField()
    valor = serializers.FloatField(allow_null=True)
    contratos = serializers.IntegerField(allow_null=True)
    valor_pronaf = serializers.FloatField(allow_null=True)
    valor_ano_anterior = serializers.FloatField(allow_null=True)


class CreditoAnoSerializer(serializers.Serializer):
    ano = serializers.IntegerField()
    valor = serializers.FloatField()
    contratos = serializers.IntegerField()
    valor_pronaf = serializers.FloatField()
    meses = serializers.IntegerField()
    completo = serializers.BooleanField()


class CreditoSerieSeriesSerializer(serializers.Serializer):
    mensal = CreditoMesSerializer(many=True, required=False)
    anual = CreditoAnoSerializer(many=True, required=False)


class CreditoSerieSerializer(_CreditoBaseSerializer):
    metricas = serializers.DictField()
    series = CreditoSerieSeriesSerializer()


class CreditoItemRankingSerializer(serializers.Serializer):
    posicao = serializers.IntegerField()
    codigo_ibge = serializers.CharField()
    nome = serializers.CharField()
    slug = serializers.CharField()
    microrregiao = serializers.CharField(allow_blank=True)
    valor = serializers.FloatField()
    contratos = serializers.IntegerField()
    valor_por_contrato = serializers.FloatField(allow_null=True)
    participacao_pct = serializers.FloatField(allow_null=True)


class CreditoRankingMetricasSerializer(_SoPresentesSerializer):
    valor_total = serializers.FloatField(required=False)
    top5_pct = serializers.FloatField(required=False, allow_null=True)


class CreditoRankingSeriesSerializer(serializers.Serializer):
    municipios = CreditoItemRankingSerializer(many=True, required=False)


class CreditoRankingSerializer(_CreditoBaseSerializer):
    metricas = CreditoRankingMetricasSerializer()
    series = CreditoRankingSeriesSerializer()


class CreditoProdutoSerializer(serializers.Serializer):
    slug = serializers.CharField()
    nome = serializers.CharField()
    atividade = serializers.CharField(allow_null=True)
    valor = serializers.FloatField()
    participacao_pct = serializers.FloatField(allow_null=True)
    area_ha = serializers.FloatField(allow_null=True)


class CreditoProdutosMetricasSerializer(_SoPresentesSerializer):
    valor_total = serializers.FloatField(required=False)
    produtos = serializers.IntegerField(required=False)


class CreditoProdutosSeriesSerializer(serializers.Serializer):
    produtos = CreditoProdutoSerializer(many=True, required=False)


class CreditoProdutosSerializer(_CreditoBaseSerializer):
    metricas = CreditoProdutosMetricasSerializer()
    series = CreditoProdutosSeriesSerializer()
