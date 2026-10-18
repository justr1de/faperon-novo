import type { EChartsCoreOption } from "echarts/core";
import type { AnoValor, ItemValor, MunicipioMapa, Opcao } from "./api-types";
import { PALETA, PALETA_ESCURA } from "./chart-options";
import { escapar, formatCompacto, formatNumero, formatPercentual, type FormatoUnidade } from "./format";

/** Bege neutro: matiz e luminosidade distintos de toda a escala verde, no tema claro e no escuro. */
export const COR_SEM_DADO = "#c2b8a8";
export const COR_SEM_DADO_ESCURO = "#7a6f5f";
/** A última cor é reservada para "outras". */
export const CORES_CATEGORIA = [...PALETA, "#a3324b", "#0f7c8c", "#8a6d1f", "#7a8a84"];
export const CORES_CATEGORIA_ESCURA = [...PALETA_ESCURA, "#e58aa0", "#5ec7d6", "#d9bf63", "#a9b8b1"];
const ESCALA = ["#e6f2ec", "#9fd0b5", "#3f9a73", "#00604e", "#003329"];
const ESCALA_ESCURA = ["#2a5a49", "#3f8f72", "#4cc9a6", "#8fe3c8", "#d4f7ea"];
/**
 * Quanto a longitude é encurtada em relação à latitude no mapa. O ECharts usa 0,75 (latitudes médias), o que deixava
 * Rondônia estreita e alta (0,92 de largura/altura). O estado fica a cerca de 11° Sul, onde o fator é cos(11°) ≈ 0,98
 * e a proporção real é de 1,21 (mais largo que alto).
 */
export const ASPECTO_MAPA = 0.98;
/** Como o ECharts mostra um valor de série: pt-BR, e traço (nunca zero) quando não há dado. */
export type FormatoValor = { eixo: (v: number) => string; valor: (v: number) => string };

function valorPtBr(v: unknown): string {
  if (typeof v === "number") return formatNumero(v);
  return v === null || v === undefined || Array.isArray(v) ? "–" : String(v);
}

const fonte = { fontFamily: "Poppins, system-ui, sans-serif" };

const CLARO = { texto: "#14261f", muted: "#46564f", linha: "#d3e1d8", card: "#ffffff", borda: "#ffffff", rotuloTreemap: "#ffffff" };
const ESCURO = { texto: "#e8f0ec", muted: "#a8bab1", linha: "#2f453b", card: "#172a23", borda: "#172a23", rotuloTreemap: "#0e1c17" };

/** As opções do Observatório trazem as próprias cores do tema (o Grafico não aplica comTemaEscuro nelas). */
export function tema(escuro: boolean) {
  const t = escuro ? ESCURO : CLARO;
  return {
    ...t,
    cores: escuro ? CORES_CATEGORIA_ESCURA : CORES_CATEGORIA,
    paleta: escuro ? PALETA_ESCURA : PALETA,
    semDado: escuro ? COR_SEM_DADO_ESCURO : COR_SEM_DADO,
    texto_: { ...fonte, color: t.texto },
    tooltip: { backgroundColor: t.card, borderColor: t.linha, textStyle: { color: t.texto }, valueFormatter: valorPtBr },
    legenda: { textStyle: { color: t.texto } },
    eixoX: { axisLabel: { color: t.muted }, axisLine: { lineStyle: { color: t.linha } } },
    eixoY: { nameTextStyle: { color: t.muted, align: "left" }, axisLabel: { color: t.muted }, splitLine: { lineStyle: { color: t.linha } } },
  };
}

export { escapar };


export function optionTreemap(itens: ItemValor[], unidade: string, escuro = false, formatar?: (v: number) => string): EChartsCoreOption {
  const t = tema(escuro);
  return {
    color: t.cores,
    textStyle: t.texto_,
    tooltip: { ...t.tooltip, formatter: (p: { name: string; value: number }) => formatar
      ? `${escapar(p.name)}: <strong>${escapar(formatar(p.value))}</strong>`
      : `${escapar(p.name)}: <strong>${formatNumero(p.value)}</strong> ${escapar(unidade.toLowerCase())}` },
    series: [{
      type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false },
      label: { formatter: "{b}", color: t.rotuloTreemap },
      itemStyle: { borderColor: t.borda, borderWidth: 2, gapWidth: 2 },
      data: itens.filter((i) => i.valor !== null).map((i) => ({ name: i.nome, value: i.valor as number })),
    }],
  };
}

/**
 * Evolução ano a ano em linhas sólidas, sem preenchimento. As linhas são empilhadas: cada uma soma o seu item aos de baixo,
 * então a de cima é a soma de todos os itens; essa soma do último ano aparece como "Soma: …" no canto superior direito.
 */
export function optionLinhasEmpilhadas(evolucao: { anos: number[]; itens: { nome: string; valores: (number | null)[] }[] }, unidade: string, escuro = false, formato?: FormatoValor): EChartsCoreOption {
  const t = tema(escuro);
  const ultimo = evolucao.anos.length - 1;
  const valoresDoUltimo = evolucao.itens.map((i) => i.valores[ultimo]).filter((v): v is number => typeof v === "number");
  const somaFinal = valoresDoUltimo.length > 0 ? valoresDoUltimo.reduce((a, b) => a + b, 0) : null;
  return {
    color: t.cores, textStyle: t.texto_,
    // A soma fica num título no canto superior direito, acima da área do gráfico, para nunca cair sobre as linhas.
    ...(somaFinal !== null
      ? { title: { text: `Soma: ${formato ? formato.valor(somaFinal) : formatCompacto(somaFinal)}`, right: 16, top: 26, textStyle: { color: t.texto, fontSize: 13, fontWeight: 600 } } }
      : {}),
    tooltip: { ...t.tooltip, trigger: "axis", ...(formato ? { valueFormatter: (v: unknown) => (typeof v === "number" ? formato.valor(v) : "–") } : {}) }, legend: { type: "scroll", top: 0, ...t.legenda },
    grid: { left: 8, right: 16, top: somaFinal !== null ? 64 : 48, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: evolucao.anos.map(String), boundaryGap: false, ...t.eixoX },
    yAxis: { type: "value", name: unidade, ...t.eixoY, axisLabel: { ...t.eixoY.axisLabel, formatter: (v: number) => (formato ? formato.eixo(v) : formatCompacto(v)) } },
    series: evolucao.itens.map((i) => ({
      type: "line", name: i.nome, stack: "total", symbol: "none", data: i.valores, lineStyle: { width: 2 },
    })),
  };
}

export function optionIndices(indices: { anos: number[]; area: (number | null)[]; rendimento: (number | null)[]; producao: (number | null)[] }, escuro = false): EChartsCoreOption {
  const t = tema(escuro);
  return {
    color: t.paleta, textStyle: t.texto_, tooltip: { ...t.tooltip, trigger: "axis" }, legend: { top: 0, ...t.legenda },
    grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: indices.anos.map(String), ...t.eixoX },
    yAxis: { type: "value", name: "Índice (início = 100)", ...t.eixoY },
    series: [
      { type: "line", name: "Produção", data: indices.producao },
      { type: "line", name: "Área colhida", data: indices.area },
      { type: "line", name: "Rendimento", data: indices.rendimento },
    ],
  };
}

export function optionDecomposicao(parteArea: number, parteRendimento: number, escuro = false): EChartsCoreOption {
  const t = tema(escuro);
  const valido = Number.isFinite(parteArea) && Number.isFinite(parteRendimento);
  return {
    color: [t.paleta[2]!, t.paleta[0]!], textStyle: t.texto_, legend: { top: 0, ...t.legenda },
    tooltip: { ...t.tooltip, formatter: (p: { seriesName: string; value: number }) => `${escapar(p.seriesName)}: <strong>${formatPercentual(p.value)}</strong>` },
    grid: { left: 16, right: 40, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: "value", ...t.eixoY, axisLabel: { ...t.eixoY.axisLabel, formatter: "{value}%" } },
    yAxis: { type: "category", data: ["Contribuição"], ...t.eixoX },
    series: [
      { type: "bar", name: "Expansão de área", stack: "c", data: valido ? [parteArea] : [], label: { show: true, formatter: (p: { value: number }) => formatPercentual(p.value) } },
      { type: "bar", name: "Ganho de produtividade", stack: "c", data: valido ? [parteRendimento] : [], label: { show: true, formatter: (p: { value: number }) => formatPercentual(p.value) } },
    ],
  };
}

/**
 * Barras horizontais. Com `formato`, o eixo e o balão usam a mesma escala e o mesmo vocabulário do mapa (por extenso),
 * e `detalhes` acrescenta uma linha ao balão de cada barra (por exemplo, quantos municípios ela reúne).
 */
export function optionBarrasHorizontais(itens: { nome: string; valor: number | null }[], unidade: string, escuro = false, formato?: FormatoUnidade | null, detalhes?: Record<string, string>): EChartsCoreOption {
  const t = tema(escuro);
  const ordenados = [...itens].filter((i) => i.valor !== null).reverse();
  const balao = formato
    ? {
      formatter: (itensBalao: { name: string; value: number; marker?: string }[]) => itensBalao.map((i) =>
        `${escapar(i.name)}<br/>${i.marker ?? ""} <strong>${escapar(formato.valor(i.value))}</strong>${detalhes?.[i.name] ? `<br/>${escapar(detalhes[i.name]!)}` : ""}`).join("<br/>"),
    }
    : {};
  return {
    color: t.paleta, textStyle: t.texto_, tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" }, ...balao },
    grid: { left: 16, right: 40, top: 8, bottom: 40, containLabel: true },
    xAxis: { type: "value", name: formato ? formato.nomeEixo : unidade, nameLocation: "middle", nameGap: 28, ...t.eixoY, nameTextStyle: { color: t.muted }, axisLabel: { ...t.eixoY.axisLabel, formatter: (v: number) => (formato ? formato.eixo(v) : formatCompacto(v)) } },
    // Nomes longos de município quebram em linhas em vez de serem cortados.
    yAxis: { type: "category", data: ordenados.map((i) => i.nome), ...t.eixoX, axisLabel: { ...t.eixoX.axisLabel, width: 130, overflow: "break" } },
    series: [{ type: "bar", data: ordenados.map((i) => i.valor) }],
  };
}

export function optionLinha(pontos: AnoValor[], nome: string, unidade: string, escuro = false): EChartsCoreOption {
  const t = tema(escuro);
  return {
    color: t.paleta, textStyle: t.texto_, tooltip: { ...t.tooltip, trigger: "axis" },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: pontos.map((p) => String(p.ano)), ...t.eixoX },
    yAxis: { type: "value", name: unidade, ...t.eixoY, axisLabel: { ...t.eixoY.axisLabel, formatter: (v: number) => formatCompacto(v) } },
    series: [{ type: "line", name: nome, data: pontos.map((p) => p.valor), areaStyle: { opacity: 0.15 } }],
  };
}

function corDaCategoria(cores: string[], slug: string, indice: number): string {
  if (slug === "outras") return cores[cores.length - 1]!;
  // Evita a cor reservada de "outras" e nunca fica sem cor (o ECharts descarta categorias sem cor).
  return cores[indice % (cores.length - 1)]!;
}

export function optionMapa(municipios: MunicipioMapa[], unidade: string, categorias: Opcao[], escuro = false, formato?: FormatoUnidade | null): EChartsCoreOption {
  const t = tema(escuro);
  const porCategoria = categorias.length > 0;
  const nomeCat = new Map(categorias.map((c) => [c.slug, c.nome]));
  const valores = municipios.map((m) => m.valor).filter((v): v is number => v !== null);
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 1;
  // Em séries de mapa o ECharts só aplica o visualMap a números (valor de texto vira transparente): cada categoria
  // vira o índice numérico de uma peça com cor e rótulo próprios.
  const indiceCat = new Map(categorias.map((c, i) => [c.slug, i]));
  const dados = municipios.map((m) => {
    const indice = m.categoria ? indiceCat.get(m.categoria) ?? null : null;
    const valor = porCategoria ? indice : m.valor;
    return {
      name: m.codigo_ibge,
      value: valor,
      nome: m.nome,
      microrregiao: m.microrregiao,
      rotulo: porCategoria && m.categoria ? nomeCat.get(m.categoria) ?? null : null,
      status: m.status,
      // Sigiloso e sem dado ficam cinza: nunca entram na escala como zero.
      ...(valor === null ? { itemStyle: { areaColor: t.semDado } } : {}),
    };
  });
  return {
    textStyle: t.texto_,
    tooltip: {
      ...t.tooltip,
      formatter: (p: { data?: { nome: string; value: number | null; rotulo?: string | null; status: string; microrregiao?: string } }) => {
        if (!p.data) return "";
        const v = p.data.value;
        const rotulo = v === null || v === undefined
          ? (p.data.status === "sigiloso" ? "sigiloso" : "sem dado")
          : p.data.rotulo ? escapar(p.data.rotulo) : typeof v === "number" ? (formato ? escapar(formato.valor(v)) : `${formatNumero(v)} ${escapar(unidade.toLowerCase())}`.trim()) : "";
        // A microrregião leva o nome de um município (o principal): dizer a qual o município pertence evita confundir os dois valores.
        const micro = p.data.microrregiao ? `<br/>Microrregião: ${escapar(p.data.microrregiao)}` : "";
        return `${escapar(p.data.nome)}: <strong>${rotulo}</strong>${micro}`;
      },
    },
    visualMap: porCategoria
      ? {
        type: "piecewise",
        pieces: categorias.map((c, i) => ({ value: i, label: c.nome, color: corDaCategoria(t.cores, c.slug, i) })),
        selectedMode: false, left: 0, bottom: 0, textStyle: t.texto_,
      }
      : {
        type: "continuous", min, max: max > min ? max : min + 1,
        inRange: { color: escuro ? ESCALA_ESCURA : ESCALA }, text: formato && valores.length ? [`Maior: ${formato.valor(max)}`, `Menor: ${formato.valor(min)}`] : ["Maior", "Menor"], calculable: false, left: 0, bottom: 0, textStyle: t.texto_,
      },
    series: [{
      type: "map", map: "rondonia", nameProperty: "codigo_ibge", roam: false, data: dados, aspectScale: ASPECTO_MAPA,
      itemStyle: { borderColor: t.borda, borderWidth: 0.8 },
      emphasis: { label: { show: false }, itemStyle: { borderColor: t.texto, borderWidth: 1.5 } },
      select: { disabled: true },
    }],
  };
}
