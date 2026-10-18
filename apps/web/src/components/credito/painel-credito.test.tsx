import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PainelCredito } from "./painel-credito";

const replace = vi.fn();
let busca = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(busca),
  useRouter: () => ({ replace }),
  usePathname: () => "/credito-rural",
}));

vi.mock("@/components/observatorio/grafico-observatorio", () => ({
  GraficoObservatorio: (p: { descricao: string }) => <div data-testid="grafico" aria-label={p.descricao} />,
}));

const municipios = [
  { codigo_ibge: "1100049", nome: "Cacoal", slug: "cacoal" },
  { codigo_ibge: "1100122", nome: "Ji-Paraná", slug: "ji-parana" },
];
const filtros = {
  valores: { ano: 2026, municipio: null, programa: null, finalidade: null },
  opcoes: {
    anos: [2025, 2026],
    municipios,
    programas: [{ slug: "pronaf", nome: "Pronaf" }, { slug: "pronamp", nome: "Pronamp" }, { slug: "demais", nome: "Demais programas e sem programa" }],
    finalidades: [{ slug: "custeio", nome: "Custeio" }, { slug: "comercializacao", nome: "Comercialização" }],
  },
};
const qualidade = {
  ano_completo: false,
  meses_com_dado: 9,
  mes_mais_recente: "2026-09",
  avisos: ["2026 tem dados de janeiro a setembro: o Banco Central publica a matriz com cerca de um mês de defasagem."],
};
const meta = { fontes: [{ fonte: "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)", url_fonte: "https://www.bcb.gov.br/estabilidadefinanceira/micrrural", licenca: "ODbL" }], atualizado_em: "2026-10-18T12:00:00Z" };
const base = { filtros, qualidade, meta };
const divisao = (slug: string, nome: string, valor: number, participacao: number) => ({ slug, nome, valor, contratos: 10, participacao });

const RESPOSTAS: Record<string, unknown> = {
  resumo: {
    ...base,
    metricas: { valor_total: 4_413_004_512, contratos: 25_842, valor_medio: 170_768, valor_pronaf: 1_525_762_027, participacao_pronaf_pct: 34.57, valor_ano_anterior: 4_000_000_000, variacao_pct: 10.33, area_custeio_ha: 1000 },
    series: {
      programas: [divisao("pronaf", "Pronaf", 1_525_762_027, 34.57), divisao("pronamp", "Pronamp", 1e9, 22.7), divisao("demais", "Demais programas e sem programa", 1.9e9, 42.7)],
      finalidades: [divisao("custeio", "Custeio", 2.6e9, 59.4)],
      atividades: [divisao("agricola", "Agrícola", 1e9, 30), divisao("pecuaria", "Pecuária", 3.4e9, 70)],
    },
    texto: { manchete: "Rondônia contratou R$ 4,4 bilhões em crédito rural de janeiro a setembro de 2026, em 25.842 contratos.", como_ler: ["O Pronaf, crédito da agricultura familiar, responde por 34,6% do valor contratado."] },
  },
  serie: {
    ...base,
    metricas: {},
    series: {
      mensal: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: i < 9 ? 1e8 : null, contratos: i < 9 ? 10 : null, valor_pronaf: i < 9 ? 3e7 : null, valor_ano_anterior: 9e7 })),
      anual: [
        { ano: 2025, valor: 5e9, contratos: 30000, valor_pronaf: 2e9, meses: 12, completo: true },
        { ano: 2026, valor: 4.4e9, contratos: 25842, valor_pronaf: 1.5e9, meses: 9, completo: false },
      ],
    },
  },
  ranking: {
    ...base,
    metricas: { valor_total: 4.05e8, top5_pct: 100 },
    series: {
      municipios: [
        { posicao: 1, codigo_ibge: "1100122", nome: "Ji-Paraná", slug: "ji-parana", microrregiao: "Ji-Paraná", valor: 4_000_000, contratos: 36, valor_por_contrato: 111_111, participacao_pct: 98.8 },
        { posicao: 2, codigo_ibge: "1100049", nome: "Cacoal", slug: "cacoal", microrregiao: "Cacoal", valor: 0, contratos: 0, valor_por_contrato: null, participacao_pct: 0 },
      ],
    },
  },
  "por-produto": {
    ...base,
    metricas: { valor_total: 1500, produtos: 2 },
    series: { produtos: [{ slug: "bovinos", nome: "Bovinos", atividade: "pecuaria", valor: 1000, participacao_pct: 66.7, area_ha: null }] },
  },
};

function roteador(sobrepor: Record<string, { status: number; corpo: unknown }> = {}) {
  return vi.fn(async (url: string) => {
    if (url.startsWith("/geo/")) return { ok: true, json: async () => ({ type: "FeatureCollection", features: [] }) };
    const rota = url.replace(/^\/api\/v1\/credito\//, "").split("?")[0]!;
    const especial = sobrepor[rota];
    if (especial) return { ok: especial.status < 400, status: especial.status, json: async () => especial.corpo };
    return { ok: true, status: 200, json: async () => RESPOSTAS[rota] };
  });
}

function comCliente({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  busca = "";
  replace.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("Painel de crédito rural", () => {
  it("mostra os números em destaque, o aviso de ano incompleto e a fonte com a licença", async () => {
    vi.stubGlobal("fetch", roteador());
    render(<PainelCredito />, { wrapper: comCliente });
    expect(await screen.findByTestId("manchete")).toHaveTextContent("R$ 4,4 bilhões");
    const cartoes = screen.getAllByTestId("cartao-credito");
    expect(cartoes.map((c) => within(c).getByRole("term").textContent)).toEqual(["Total contratado", "Contratos", "Valor médio por contrato", "Participação do Pronaf"]);
    expect(cartoes[0]).toHaveTextContent("+10,3%");
    expect(cartoes[1]).toHaveTextContent("25.842");
    expect(cartoes[3]).toHaveTextContent("34,6%");
    expect(screen.getByText(/2026 tem dados de janeiro a setembro/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Crédito rural contratado, janeiro a setembro de 2026" })).toBeInTheDocument();
    const fonte = screen.getByRole("complementary", { name: "Fonte e atualização" });
    expect(within(fonte).getByRole("link", { name: /Banco Central do Brasil, Matriz de Dados do Crédito Rural \(SICOR\)/ })).toHaveAttribute("href", "https://www.bcb.gov.br/estabilidadefinanceira/micrrural");
    expect(within(fonte).getByRole("link", { name: /ODbL/ })).toBeInTheDocument();
    expect(fonte).toHaveTextContent("Dados até setembro de 2026");
  });

  it("o ano incompleto aparece marcado no seletor e os filtros vão para o link", async () => {
    vi.stubGlobal("fetch", roteador());
    const user = userEvent.setup();
    render(<PainelCredito />, { wrapper: comCliente });
    const ano = await screen.findByLabelText("Ano");
    await screen.findByRole("option", { name: "2026 (até set)" });
    expect(ano).toHaveValue("2026");
    await user.selectOptions(screen.getByLabelText("Programa"), "pronaf");
    expect(replace).toHaveBeenLastCalledWith("/credito-rural?programa=pronaf", { scroll: false });
    await user.selectOptions(screen.getByLabelText("Município"), "ji-parana");
    expect(replace).toHaveBeenLastCalledWith("/credito-rural?municipio=ji-parana", { scroll: false });
  });

  it("cada gráfico tem a tabela de dados, com zero de verdade e mês sem dado separados", async () => {
    vi.stubGlobal("fetch", roteador());
    const user = userEvent.setup();
    render(<PainelCredito />, { wrapper: comCliente });
    const secao = await screen.findByRole("region", { name: "Onde o crédito foi contratado" });
    await user.click(await within(secao).findByRole("button", { name: "Ver como tabela" }));
    const tabela = within(secao).getByRole("table", { name: "Crédito rural por município" });
    const cacoal = within(tabela).getAllByRole("row").find((r) => r.textContent?.includes("Cacoal"))!;
    expect(cacoal).toHaveTextContent("R$ 0");
    expect(within(tabela).getByText("R$ 4.000.000")).toBeInTheDocument();

    const evolucao = screen.getByRole("region", { name: "Como o crédito evoluiu" });
    await user.click(within(evolucao).getByRole("button", { name: "Ver como tabela" }));
    const mensal = within(evolucao).getByRole("table", { name: "Crédito rural mês a mês em 2026" });
    const outubro = within(mensal).getAllByRole("row").find((r) => r.textContent?.startsWith("outubro"))!;
    expect(outubro).toHaveTextContent("sem dado");
    expect(within(evolucao).getByRole("table", { name: "Crédito rural ano a ano" })).toHaveTextContent("2026 (até set)");
  });

  it("município escolhido mostra a posição no ranking", async () => {
    busca = "municipio=ji-parana";
    vi.stubGlobal("fetch", roteador());
    render(<PainelCredito />, { wrapper: comCliente });
    expect(await screen.findByText(/Ji-Paraná está em 1º lugar entre os 52 municípios/)).toBeInTheDocument();
  });

  it("sem detalhe por produto, a seção explica o motivo", async () => {
    vi.stubGlobal("fetch", roteador({
      "por-produto": { status: 200, corpo: { ...base, metricas: {}, series: {}, qualidade: { ...qualidade, avisos: [...qualidade.avisos, "O Banco Central não detalha por produto o crédito de comercialização e industrialização."] } } },
    }));
    render(<PainelCredito />, { wrapper: comCliente });
    const secao = await screen.findByRole("region", { name: "O que o crédito financiou" });
    expect(await within(secao).findByText(/não detalha por produto/)).toBeInTheDocument();
    expect(within(secao).queryByRole("button", { name: "Ver como tabela" })).not.toBeInTheDocument();
  });

  it("parâmetro inválido no link oferece voltar ao padrão", async () => {
    busca = "ano=1999";
    const erro = { status: 400, corpo: { erro: "Parâmetros inválidos", campos: { ano: "use um ano entre 2018 e 2026" } } };
    vi.stubGlobal("fetch", roteador({ serie: erro }));
    const user = userEvent.setup();
    render(<PainelCredito />, { wrapper: comCliente });
    const secao = await screen.findByRole("region", { name: "Como o crédito evoluiu" });
    await user.click(await within(secao).findByRole("button", { name: "Voltar ao padrão" }));
    expect(replace).toHaveBeenLastCalledWith("/credito-rural", { scroll: false });
  });
});
