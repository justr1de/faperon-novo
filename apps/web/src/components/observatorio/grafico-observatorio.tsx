"use client";

import { MapChart, TreemapChart } from "echarts/charts";
import { TitleComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";
import { Grafico } from "@/components/painel/grafico";
import { useEscuro } from "./use-escuro";

// Registra só o que o Observatório acrescenta; o Grafico registra o restante antes do init.
echarts.use([MapChart, TreemapChart, TitleComponent, VisualMapComponent]);

export type OpcaoDoTema = EChartsCoreOption | ((escuro: boolean) => EChartsCoreOption);

/**
 * As opções do Observatório trazem as próprias cores de cada tema (lib/observatorio-graficos), por isso o Grafico
 * não aplica comTemaEscuro: ele presume eixos e uma única área, o que quebraria mapa, treemap e áreas empilhadas.
 * Passe uma função `(escuro) => option` para receber o tema atual.
 */
export function GraficoObservatorio({ option, descricao, altura = 360, alturaMovel, idEntrada }: { option: OpcaoDoTema; descricao: string; altura?: number; alturaMovel?: number; idEntrada?: string }) {
  const escuro = useEscuro();
  const resolvida = useMemo(() => (typeof option === "function" ? option(escuro) : option), [option, escuro]);
  // No celular o padrão encolhe para 320 px; barras com muitos itens passam a própria altura.
  return <Grafico option={resolvida} descricao={descricao} altura={altura} alturaMovel={alturaMovel ?? Math.min(altura, 320)} idEntrada={idEntrada} temaProprio />;
}
