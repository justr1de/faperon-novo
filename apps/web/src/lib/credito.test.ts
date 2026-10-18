import { describe, expect, it } from "vitest";
import type { AnoCredito, MesCredito, MunicipioCredito } from "./api-types";
import {
  municipiosNoMapa,
  optionAnualCredito,
  optionMensalCredito,
  periodoDoAno,
  reaisCompletos,
  reaisPorExtenso,
  rotuloAno,
} from "./credito";

describe("crédito: formatos", () => {
  it("escreve reais por extenso e completos, no formato brasileiro", () => {
    expect(reaisPorExtenso(4_413_004_512.26)).toBe("R$ 4,4 bilhões");
    expect(reaisPorExtenso(624_039_407)).toBe("R$ 624 milhões");
    expect(reaisPorExtenso(0)).toBe("R$ 0");
    expect(reaisCompletos(1_234_567.89)).toBe("R$ 1.234.568");
  });

  it("descreve o período publicado do ano", () => {
    expect(periodoDoAno(2026, 9)).toBe("janeiro a setembro de 2026");
    expect(periodoDoAno(2025, 12)).toBe("2025");
    expect(periodoDoAno(2026, 1)).toBe("janeiro de 2026");
  });

  it("marca o ano incompleto no eixo", () => {
    expect(rotuloAno({ ano: 2026, completo: false, meses: 9 } as AnoCredito)).toBe("2026 (até set)");
    expect(rotuloAno({ ano: 2025, completo: true, meses: 12 } as AnoCredito)).toBe("2025");
  });
});

describe("crédito: gráficos", () => {
  const mensal: MesCredito[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    valor: i < 9 ? 1_000_000 * (i + 1) : null,
    contratos: i < 9 ? 10 : null,
    valor_pronaf: i < 9 ? 400_000 : null,
    valor_ano_anterior: 900_000,
  }));

  it("mês sem dado publicado fica nulo no gráfico, nunca zero", () => {
    const opt = optionMensalCredito(mensal, 2026, false) as { series: { name: string; data: (number | null)[] }[] };
    expect(opt.series.map((s) => s.name)).toEqual(["2026", "2025"]);
    expect(opt.series[0]!.data[9]).toBeNull();
    // valores em mil R$, como o formato do mapa e do Observatório
    expect(opt.series[0]!.data[0]).toBe(1000);
    expect(opt.series[1]!.data[11]).toBe(900);
  });

  it("anual empilha Pronaf e demais e marca o ano incompleto", () => {
    const anual: AnoCredito[] = [
      { ano: 2025, valor: 10_000_000, contratos: 10, valor_pronaf: 4_000_000, meses: 12, completo: true },
      { ano: 2026, valor: 6_000_000, contratos: 5, valor_pronaf: 1_000_000, meses: 9, completo: false },
    ];
    const opt = optionAnualCredito(anual, false) as { xAxis: { data: string[] }; series: { name: string; data: number[]; stack: string }[] };
    expect(opt.xAxis.data).toEqual(["2025", "2026 (até set)"]);
    expect(opt.series.map((s) => [s.name, s.data])).toEqual([
      ["Pronaf", [4000, 1000]],
      ["Demais programas", [6000, 5000]],
    ]);
    expect(new Set(opt.series.map((s) => s.stack)).size).toBe(1);
  });

  it("o mapa recebe os municípios em mil R$ e com status ok (zero é zero de verdade)", () => {
    const itens = [
      { codigo_ibge: "1100122", nome: "Ji-Paraná", slug: "ji-parana", microrregiao: "Ji-Paraná", posicao: 1, valor: 2_500_000, contratos: 3, valor_por_contrato: 1, participacao_pct: 100 },
      { codigo_ibge: "1100304", nome: "Vilhena", slug: "vilhena", microrregiao: "Vilhena", posicao: 2, valor: 0, contratos: 0, valor_por_contrato: null, participacao_pct: 0 },
    ] satisfies MunicipioCredito[];
    expect(municipiosNoMapa(itens)).toEqual([
      { codigo_ibge: "1100122", nome: "Ji-Paraná", microrregiao: "Ji-Paraná", valor: 2500, status: "ok", categoria: null },
      { codigo_ibge: "1100304", nome: "Vilhena", microrregiao: "Vilhena", valor: 0, status: "ok", categoria: null },
    ]);
  });
});
