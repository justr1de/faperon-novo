// Tipos escritos à mão a partir de docs/api-contract.md.
// Regenerar a partir do OpenAPI do Django: npm run gen:api (gera api-schema.d.ts).

export type Segmento = "agricultura" | "pecuaria";
export type Agregacao = "soma" | "media_ponderada" | "nao_agregavel";
export type StatusValor = "ok" | "sigiloso" | "inexistente";

export interface Meta {
  fonte: string;
  tabela_sidra: number;
  url_fonte: string;
  atualizado_em: string | null;
}

export interface ProdutoResumo {
  slug: string;
  nome: string;
  segmento: Segmento;
  tabela_sidra?: number;
}

export interface Indicador {
  slug: string;
  nome: string;
  unidade: string;
  agregacao: Agregacao;
}

export interface Municipio {
  codigo_ibge: string;
  nome: string;
}

export interface MetaGeral {
  ultima_carga: string | null;
  cargas: { tabela: number; status: string; concluida_em: string | null; linhas: number }[];
  anos: { min: number | null; max: number | null };
}

export interface ItemRanking {
  posicao: number | null;
  municipio: Municipio;
  valor: number | null;
  status: StatusValor;
  percentual_total: number | null;
}

export interface RankingResposta {
  produto: ProdutoResumo;
  indicador: Indicador;
  inicio: number;
  fim: number;
  ano_referencia: number;
  total_estadual: number | null;
  itens: ItemRanking[];
  meta: Meta;
}

export interface Ponto {
  ano: number;
  valor: number | null;
  status: StatusValor;
}

export interface SerieResposta {
  produto: ProdutoResumo;
  indicador: Indicador;
  municipio: Municipio | null;
  inicio: number;
  fim: number;
  pontos: Ponto[];
  meta: Meta;
}

export interface SerieComparada {
  id: string;
  nome: string;
  pontos: Ponto[];
}

export interface ComparacaoResposta {
  modo: "municipios" | "produtos";
  indicador: Indicador;
  unidade: string;
  inicio: number;
  fim: number;
  anos: number[];
  series: SerieComparada[];
  meta: Meta;
}

export interface AnaliseMetricas {
  variacao_absoluta: number | null;
  variacao_percentual: number | null;
  cagr_percentual: number | null;
  maior_ano: { ano: number; valor: number } | null;
  menor_ano: { ano: number; valor: number } | null;
  top5: { municipio: Municipio; valor: number; percentual: number | null }[];
  concentracao_top5_percentual: number | null;
}

export interface AnaliseResposta {
  titulo: string;
  paragrafos: string[];
  metricas: AnaliseMetricas;
  meta: Meta;
}

export interface ErroApi {
  erro: string;
  campos?: Record<string, string>;
}

export interface DestaqueLider {
  municipio: { codigo_ibge: string; nome: string };
  valor: number | null;
  percentual_total: number | null;
}

export interface Destaque {
  chave: string;
  rotulo: string;
  produto: { slug: string; nome: string; segmento: Segmento };
  indicador: { slug: string; nome: string; unidade: string; agregacao: string };
  ano_referencia: number;
  total: number | null;
  serie: Ponto[];
  variacao_percentual: number | null;
  top: DestaqueLider[];
  meta: Meta;
}

export interface Destaques {
  itens: Destaque[];
  meta: { atualizado_em: string | null };
}

// ---- Observatório ----

export type BlocoObservatorio = "panorama" | "crescimento" | "territorio" | "pecuaria";

export interface Opcao {
  slug: string;
  nome: string;
}

export interface ItemValor extends Opcao {
  valor: number | null;
  participacao: number | null;
}

export interface AnoValor {
  ano: number;
  valor: number | null;
}

export interface TextoObservatorio {
  manchete: string;
  como_ler: string[];
}

export interface QualidadeObservatorio {
  municipios_sigilosos: number;
  ano_ref_monetario: number | null;
  avisos: string[];
}

export interface MetaObservatorio {
  fontes: { fonte: string; tabela_sidra: number; url_fonte: string }[];
  atualizado_em: string | null;
}

// metricas/series podem vir vazias (200 com aviso em qualidade.avisos), por isso Partial.
export interface RespostaBase<V, O, M, S> {
  filtros: { valores: V; opcoes: O };
  metricas: Partial<M>;
  series: Partial<S>;
  texto: TextoObservatorio;
  qualidade: QualidadeObservatorio;
  meta: MetaObservatorio;
}

export type PanoramaResposta = RespostaBase<
  { ano: number | null; janela: number; inicio: number | null },
  { anos: number[]; janelas: number[] },
  {
    valor_total_real: number | null;
    valor_lavouras_real: number | null;
    valor_origem_animal_real: number | null;
    variacao_real_pct: number | null;
    area_colhida_ha: number | null;
  },
  {
    composicao: ItemValor[];
    evolucao: { anos: number[]; itens: { slug: string; nome: string; valores: (number | null)[] }[] };
  }
>;

export type CrescimentoResposta = RespostaBase<
  { cultura: string | null; inicio: number | null; fim: number | null },
  { culturas: Opcao[]; anos: number[] },
  {
    variacao_producao_pct: number | null;
    parte_area_pct: number | null;
    parte_rendimento_pct: number | null;
    perda_media_pct: number | null;
    perda_ultimo_ano_pct: number | null;
  },
  {
    indices: { anos: number[]; area: (number | null)[]; rendimento: (number | null)[]; producao: (number | null)[] };
    perda: AnoValor[];
    valor_por_hectare: ItemValor[];
  }
>;

export type MetricaTerritorio = "valor" | "area" | "rebanho" | "dominante";

export interface MunicipioMapa {
  codigo_ibge: string;
  nome: string;
  microrregiao: string;
  valor: number | null;
  status: "ok" | "sigiloso" | "sem_dado";
  categoria: string | null;
}

export type TerritorioResposta = RespostaBase<
  { metrica: MetricaTerritorio; cultura: string | null; ano: number | null },
  { metricas: (Opcao & { unidade: string })[]; culturas: Opcao[]; anos: number[] },
  { unidade: string; total: number | null; top5_pct: number | null; hhi: number | null; concentracao: string | null },
  {
    municipios: MunicipioMapa[];
    microrregioes: { nome: string; valor: number | null }[];
    dependentes: { codigo_ibge: string; nome: string; cultura: string; participacao: number | null }[];
    categorias: Opcao[];
  }
>;

export type PecuariaResposta = RespostaBase<
  { rebanho: string; inicio: number | null; fim: number | null },
  { rebanhos: Opcao[]; anos: number[] },
  {
    efetivo_final: number | null;
    variacao_pct: number | null;
    top5_pct: number | null;
    leite: {
      volume_mil_litros: number | null;
      valor_real: number | null;
      produtividade_l_vaca: number | null;
      variacao_produtividade_pct: number | null;
    } | null;
  },
  {
    efetivo: AnoValor[];
    municipios: { codigo_ibge: string; nome: string; valor: number | null }[];
    composicao: ItemValor[];
    leite_polos: { codigo_ibge: string; nome: string; volume: number | null; produtividade: number | null }[];
  }
>;

export interface RespostasObservatorio {
  panorama: PanoramaResposta;
  crescimento: CrescimentoResposta;
  territorio: TerritorioResposta;
  pecuaria: PecuariaResposta;
}

// ---- Crédito rural (SICOR, Banco Central; ADR 0036) ----

export type RotaCredito = "resumo" | "serie" | "ranking" | "por-produto";

export interface MunicipioRef {
  codigo_ibge: string;
  nome: string;
  slug: string;
}

export interface FiltrosCredito {
  valores: { ano: number | null; municipio: MunicipioRef | null; programa: string | null; finalidade: string | null };
  opcoes: { anos: number[]; municipios: MunicipioRef[]; programas: Opcao[]; finalidades: Opcao[] };
}

export interface QualidadeCredito {
  ano_completo: boolean | null;
  meses_com_dado: number;
  /** "2026-09" */
  mes_mais_recente: string | null;
  avisos: string[];
}

export interface MetaCredito {
  fontes: { fonte: string; url_fonte: string; licenca: string }[];
  atualizado_em: string | null;
}

// metricas/series podem vir vazias (200 com aviso), por isso Partial.
interface BaseCredito<M, S> {
  filtros: FiltrosCredito;
  metricas: Partial<M>;
  series: Partial<S>;
  qualidade: QualidadeCredito;
  meta: MetaCredito;
}

export interface DivisaoCredito extends Opcao {
  valor: number;
  contratos: number;
  participacao: number | null;
}

export type CreditoResumo = BaseCredito<
  {
    valor_total: number;
    contratos: number;
    valor_medio: number | null;
    valor_pronaf: number;
    participacao_pronaf_pct: number | null;
    valor_ano_anterior: number | null;
    variacao_pct: number | null;
    area_custeio_ha: number | null;
  },
  { programas: DivisaoCredito[]; finalidades: DivisaoCredito[]; atividades: DivisaoCredito[] }
> & { texto: TextoObservatorio };

export interface MesCredito {
  mes: number;
  valor: number | null;
  contratos: number | null;
  valor_pronaf: number | null;
  valor_ano_anterior: number | null;
}

export interface AnoCredito {
  ano: number;
  valor: number;
  contratos: number;
  valor_pronaf: number;
  meses: number;
  completo: boolean;
}

export type CreditoSerie = BaseCredito<Record<string, never>, { mensal: MesCredito[]; anual: AnoCredito[] }>;

export interface MunicipioCredito extends MunicipioRef {
  posicao: number;
  microrregiao: string;
  valor: number;
  contratos: number;
  valor_por_contrato: number | null;
  participacao_pct: number | null;
}

export type CreditoRanking = BaseCredito<{ valor_total: number; top5_pct: number | null }, { municipios: MunicipioCredito[] }>;

export interface ProdutoCredito extends Opcao {
  atividade: string | null;
  valor: number;
  participacao_pct: number | null;
  area_ha: number | null;
}

export type CreditoProdutos = BaseCredito<{ valor_total: number; produtos: number }, { produtos: ProdutoCredito[] }>;

export interface RespostasCredito {
  resumo: CreditoResumo;
  serie: CreditoSerie;
  ranking: CreditoRanking;
  "por-produto": CreditoProdutos;
}
