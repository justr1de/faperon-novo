import type { EChartsCoreOption } from "echarts/core";
import type { AnoCredito, MesCredito, MunicipioCredito, MunicipioMapa } from "./api-types";
import { formatReais, formatReaisPorExtenso, formatoPorUnidade } from "./format";
import { tema } from "./observatorio-graficos";

/**
 * O SICOR publica valores em reais; os gráficos usam mil R$ para reaproveitar o vocabulário do Observatório
 * (formatoPorUnidade("Mil Reais"): eixo em bilhões ou milhões, balão por extenso).
 */
export const UNIDADE = "Mil Reais";
const emMil = (reais: number | null) => (reais === null ? null : reais / 1000);

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_CURTOS = MESES.map((m) => m.slice(0, 3));

export function reaisPorExtenso(reais: number): string {
  return formatReaisPorExtenso(reais / 1000);
}

export function reaisCompletos(reais: number): string {
  return formatReais(reais / 1000);
}

/** "janeiro a setembro de 2026" para o ano incompleto; "2025" para o ano fechado. */
export function periodoDoAno(ano: number, meses: number): string {
  if (meses >= 12) return String(ano);
  if (meses <= 1) return `janeiro de ${ano}`;
  return `janeiro a ${MESES[meses - 1]} de ${ano}`;
}

export function rotuloAno(a: Pick<AnoCredito, "ano" | "completo" | "meses">): string {
  return a.completo ? String(a.ano) : `${a.ano} (até ${MESES_CURTOS[a.meses - 1] ?? "?"})`;
}

function formatoDe(maxReais: number) {
  // "Mil Reais" sempre tem formato: o ! só documenta isso para o TypeScript.
  return formatoPorUnidade(UNIDADE, maxReais / 1000)!;
}

function eixoValor(escuro: boolean, maxReais: number) {
  const t = tema(escuro);
  const formato = formatoDe(maxReais);
  return {
    t,
    formato,
    yAxis: { type: "value", name: formato.nomeEixo, ...t.eixoY, axisLabel: { ...t.eixoY.axisLabel, formatter: (v: number) => formato.eixo(v) } },
    tooltip: { ...t.tooltip, trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? formato.valor(v) : "–") },
  };
}

/** Barras do ano escolhido mês a mês e linha do mesmo mês no ano anterior. Mês não publicado fica nulo. */
export function optionMensalCredito(mensal: MesCredito[], ano: number, escuro = false): EChartsCoreOption {
  const max = Math.max(0, ...mensal.flatMap((m) => [m.valor ?? 0, m.valor_ano_anterior ?? 0]));
  const { t, yAxis, tooltip } = eixoValor(escuro, max);
  return {
    color: [t.paleta[0]!, t.paleta[1]!], textStyle: t.texto_, tooltip, legend: { top: 0, ...t.legenda },
    grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: MESES_CURTOS, ...t.eixoX },
    yAxis,
    series: [
      { type: "bar", name: String(ano), data: mensal.map((m) => emMil(m.valor)), barMaxWidth: 28 },
      { type: "line", name: String(ano - 1), data: mensal.map((m) => emMil(m.valor_ano_anterior)), symbol: "circle", symbolSize: 6, lineStyle: { width: 2, type: "dashed" } },
    ],
  };
}

/** Ano a ano, com o Pronaf e os demais programas empilhados (a soma é o total do ano). */
export function optionAnualCredito(anual: AnoCredito[], escuro = false): EChartsCoreOption {
  const max = Math.max(0, ...anual.map((a) => a.valor));
  const { t, yAxis, tooltip } = eixoValor(escuro, max);
  return {
    color: [t.paleta[0]!, t.paleta[2]!], textStyle: t.texto_, tooltip, legend: { top: 0, ...t.legenda },
    grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: anual.map(rotuloAno), ...t.eixoX },
    yAxis,
    series: [
      { type: "bar", name: "Pronaf", stack: "total", data: anual.map((a) => a.valor_pronaf / 1000), barMaxWidth: 40 },
      { type: "bar", name: "Demais programas", stack: "total", data: anual.map((a) => (a.valor - a.valor_pronaf) / 1000), barMaxWidth: 40 },
    ],
  };
}

/** Itens para o mapa do Observatório. Município sem contrato num período publicado tem zero de verdade (status ok). */
export function municipiosNoMapa(itens: MunicipioCredito[]): MunicipioMapa[] {
  return itens.map((m) => ({ codigo_ibge: m.codigo_ibge, nome: m.nome, microrregiao: m.microrregiao, valor: m.valor / 1000, status: "ok", categoria: null }));
}

/** Detalhe do balão das barras do ranking (o gráfico escapa o texto): contratos e valor por contrato. */
export function detalhesRanking(itens: MunicipioCredito[]): Record<string, string> {
  return Object.fromEntries(itens.map((m) => [m.nome, `${m.contratos.toLocaleString("pt-BR")} ${m.contratos === 1 ? "contrato" : "contratos"}${m.valor_por_contrato !== null ? `, ${reaisPorExtenso(m.valor_por_contrato)} por contrato` : ""}`]));
}
