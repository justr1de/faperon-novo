import type {
  AnaliseResposta,
  BlocoObservatorio,
  ComparacaoResposta,
  ErroApi,
  Indicador,
  MetaGeral,
  Municipio,
  ProdutoResumo,
  RankingResposta,
  RespostasCredito,
  RespostasObservatorio,
  RotaCredito,
  SerieResposta,
} from "./api-types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public campos?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let corpo: Partial<ErroApi> = {};
    try {
      corpo = (await res.json()) as ErroApi;
    } catch {
      // corpo não é JSON
    }
    throw new ApiError(res.status, corpo.erro ?? `Erro ${res.status} ao consultar a API`, corpo.campos);
  }
  return (await res.json()) as T;
}

export const API_BASE = "/api/v1";

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  produtos: (segmento?: string) => request<ProdutoResumo[]>(`${API_BASE}/produtos${qs({ segmento })}`),
  indicadores: (produto: string) => request<Indicador[]>(`${API_BASE}/indicadores${qs({ produto })}`),
  municipios: () => request<Municipio[]>(`${API_BASE}/municipios`),
  meta: () => request<MetaGeral>(`${API_BASE}/meta`),
  ranking: (query: string) => request<RankingResposta>(`${API_BASE}/ranking?${query}`),
  serie: (query: string) => request<SerieResposta>(`${API_BASE}/serie?${query}`),
  comparacao: (query: string) => request<ComparacaoResposta>(`${API_BASE}/comparacao?${query}`),
  analise: (query: string) => request<AnaliseResposta>(`${API_BASE}/analise?${query}`),
  observatorio: <B extends BlocoObservatorio>(bloco: B, query: string) =>
    request<RespostasObservatorio[B]>(`${API_BASE}/observatorio/${bloco}${query ? `?${query}` : ""}`),
  credito: <R extends RotaCredito>(rota: R, query: string) =>
    request<RespostasCredito[R]>(`${API_BASE}/credito/${rota}${query ? `?${query}` : ""}`),
};

export const relatorioUrl = (query: string) => `${API_BASE}/relatorio.pdf?${query}`;
