"""Crédito rural de Rondônia agregado por município e mês (SICOR, Banco Central; ADR 0036).

Ausente nunca é zero: só existem linhas para o que a fonte publicou com valor ou contratos. Um município
sem linha num mês já publicado não contratou crédito naquele mês (zero de verdade); um mês ainda não
publicado não tem linha em nenhum município.
"""

from django.db import models


class Programa(models.TextChoices):
    PRONAF = "pronaf", "Pronaf"
    PRONAMP = "pronamp", "Pronamp"
    DEMAIS = "demais", "Demais programas e sem programa"


class Finalidade(models.TextChoices):
    CUSTEIO = "custeio", "Custeio"
    INVESTIMENTO = "investimento", "Investimento"
    COMERCIALIZACAO = "comercializacao", "Comercialização"
    INDUSTRIALIZACAO = "industrializacao", "Industrialização"


class Atividade(models.TextChoices):
    AGRICOLA = "agricola", "Agrícola"
    PECUARIA = "pecuaria", "Pecuária"


class CargaCredito(models.Model):
    """Uma carga do SICOR para um ano de emissão (os três recursos do OData)."""

    class Status(models.TextChoices):
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        SUCESSO = "sucesso", "Sucesso"
        FALHA = "falha", "Falha"

    ano = models.PositiveSmallIntegerField(db_index=True)
    iniciada_em = models.DateTimeField()
    concluida_em = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EM_ANDAMENTO)
    linhas = models.PositiveIntegerField(default=0)
    linhas_produtos = models.PositiveIntegerField(default=0)
    erro = models.TextField(blank=True, default="")

    class Meta:
        db_table = "carga_credito"
        ordering = ["-iniciada_em"]

    def __str__(self) -> str:
        return f"Carga do crédito {self.pk} ano {self.ano} ({self.status})"


class _FatoCredito(models.Model):
    municipio = models.ForeignKey(
        "indicadores.Municipio", on_delete=models.CASCADE, related_name="+"
    )
    ano = models.PositiveSmallIntegerField()
    mes = models.PositiveSmallIntegerField()
    programa = models.CharField(max_length=10, choices=Programa.choices)
    finalidade = models.CharField(max_length=20, choices=Finalidade.choices)
    atividade = models.CharField(max_length=10, choices=Atividade.choices)
    valor = models.DecimalField(max_digits=16, decimal_places=2)
    # Área financiada (hectares). Só o custeio e o investimento informam; nos demais fica nula.
    area_ha = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    carga = models.ForeignKey(CargaCredito, on_delete=models.PROTECT, related_name="+")

    class Meta:
        abstract = True


class CreditoMunicipio(_FatoCredito):
    """Contratos e valor contratado por município, mês, programa, finalidade e atividade."""

    contratos = models.PositiveIntegerField()

    class Meta:
        db_table = "fato_credito"
        constraints = [
            models.UniqueConstraint(
                fields=["municipio", "ano", "mes", "programa", "finalidade", "atividade"],
                name="credito_unico",
            ),
            models.CheckConstraint(
                condition=models.Q(mes__gte=1, mes__lte=12), name="credito_mes_valido"
            ),
        ]
        indexes = [models.Index(fields=["ano", "mes"], name="credito_periodo")]


class CreditoProduto(_FatoCredito):
    """Valor contratado por produto (só custeio e investimento: o BCB não publica contratos por produto)."""

    produto_slug = models.SlugField(max_length=140)
    produto_nome = models.CharField(max_length=200)

    class Meta:
        db_table = "fato_credito_produto"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "municipio",
                    "ano",
                    "mes",
                    "programa",
                    "finalidade",
                    "atividade",
                    "produto_slug",
                ],
                name="credito_produto_unico",
            ),
            models.CheckConstraint(
                condition=models.Q(mes__gte=1, mes__lte=12), name="credito_produto_mes_valido"
            ),
        ]
        indexes = [models.Index(fields=["ano", "mes"], name="credito_produto_periodo")]
