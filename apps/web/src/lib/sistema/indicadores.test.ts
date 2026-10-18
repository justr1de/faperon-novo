import { describe, expect, it } from "vitest";
import { FUNCIONARIOS } from "@/content/sistema/funcionarios";
import {
  agendaDaEquipe,
  descreverIntervalo,
  escopoDe,
  indicadoresAgenda,
  indicadoresAtividades,
  indicadoresContas,
  indicadoresEspacos,
  indicadoresFrota,
  intervaloDoPeriodo,
  podeVerEquipe,
  type Filtro,
} from "./indicadores";
import type { Atividade, Despesa, EstadoFrota, Evento, PedidoEspaco } from "./tipos";

const HOJE = "2026-10-18";
const carla = FUNCIONARIOS.find((f) => f.id === "carla")!;
const marcos = FUNCIONARIOS.find((f) => f.id === "marcos")!;

function filtro(parcial: Partial<Filtro> = {}): Filtro {
  return { intervalo: intervaloDoPeriodo("3m", HOJE), hoje: HOJE, tagId: "", escopo: { equipe: true, pessoa: null }, ...parcial };
}
const daCarla = (p: Partial<Filtro> = {}) => filtro({ escopo: { equipe: false, pessoa: "carla" }, ...p });

describe("período", () => {
  it("conta meses do calendário inteiros, com o mês atual", () => {
    expect(intervaloDoPeriodo("mes", HOJE)).toEqual({ de: "2026-10-01", ate: "2026-10-31", meses: ["2026-10"] });
    expect(intervaloDoPeriodo("3m", HOJE)).toEqual({ de: "2026-08-01", ate: "2026-10-31", meses: ["2026-08", "2026-09", "2026-10"] });
    const doze = intervaloDoPeriodo("12m", HOJE);
    expect(doze.de).toBe("2025-11-01");
    expect(doze.meses).toHaveLength(12);
    expect(intervaloDoPeriodo("6m", "2026-02-28")).toMatchObject({ de: "2025-09-01", ate: "2026-02-28" });
  });

  it("descreve o intervalo por extenso", () => {
    expect(descreverIntervalo(intervaloDoPeriodo("mes", HOJE))).toBe("outubro de 2026");
    expect(descreverIntervalo(intervaloDoPeriodo("3m", HOJE))).toBe("agosto a outubro de 2026");
    expect(descreverIntervalo(intervaloDoPeriodo("12m", HOJE))).toBe("novembro de 2025 a outubro de 2026");
  });
});

describe("visibilidade", () => {
  it("o coordenador e qualquer gestor veem a equipe; os demais, só os próprios números", () => {
    expect(podeVerEquipe(marcos)).toBe(true);
    expect(podeVerEquipe({ ...carla, gestorEspacos: true })).toBe(true);
    expect(podeVerEquipe(carla)).toBe(false);
    expect(podeVerEquipe(null)).toBe(false);
  });

  it("o funcionário comum fica preso aos próprios números, mesmo escolhendo outra pessoa", () => {
    expect(escopoDe(carla, "ana")).toEqual({ equipe: false, pessoa: "carla" });
    expect(escopoDe(marcos, "")).toEqual({ equipe: true, pessoa: null });
    expect(escopoDe(marcos, "ana")).toEqual({ equipe: true, pessoa: "ana" });
  });
});

const evento = (p: Partial<Evento> & Pick<Evento, "id" | "data">): Evento => ({
  titulo: p.id,
  inicio: "09:00",
  fim: "10:00",
  local: "",
  descricao: "",
  tipo: "reuniao",
  origem: "pessoal",
  ...p,
});

const frota: EstadoFrota = {
  veiculos: [
    { id: "v1", placa: "ABC1D23", modelo: "Hilux", ano: 2022, km: 50_000 },
    { id: "v2", placa: "XYZ9K87", modelo: "Gol", ano: 2020, km: 80_000 },
  ],
  reservas: [
    { id: "r1", veiculoId: "v1", funcionarioId: "carla", saida: "2026-10-02T07:00", retorno: "2026-10-02T18:00", destino: "Cacoal", motivo: "", kmInicial: 49_000, kmFinal: 49_500, situacao: "concluida", tags: ["t1"] },
    { id: "r2", veiculoId: "v1", funcionarioId: "ana", saida: "2026-09-10T07:00", retorno: "2026-09-11T18:00", destino: "Vilhena", motivo: "", kmInicial: 48_000, kmFinal: 48_800, situacao: "concluida" },
    { id: "r3", veiculoId: "v2", funcionarioId: "carla", saida: "2026-10-20T07:00", retorno: "2026-10-22T18:00", destino: "Ji-Paraná", motivo: "", kmInicial: null, kmFinal: null, situacao: "agendada" },
    { id: "r4", veiculoId: "v2", funcionarioId: "ana", saida: "2026-10-05T07:00", retorno: "2026-10-05T18:00", destino: "Jaru", motivo: "", kmInicial: null, kmFinal: null, situacao: "cancelada" },
    // fora do período (julho)
    { id: "r5", veiculoId: "v2", funcionarioId: "ana", saida: "2026-07-10T07:00", retorno: "2026-07-10T18:00", destino: "Jaru", motivo: "", kmInicial: 1, kmFinal: 900, situacao: "concluida" },
  ],
  abastecimentos: [
    { id: "a1", veiculoId: "v1", funcionarioId: "carla", data: "2026-08-05", litros: 40, valor: 250, km: 48_000 },
    { id: "a2", veiculoId: "v1", funcionarioId: "carla", data: "2026-09-05", litros: 50, valor: 310, km: 48_600 },
    { id: "a3", veiculoId: "v1", funcionarioId: "ana", data: "2026-10-05", litros: 50, valor: 320, km: 49_200 },
    // um abastecimento só não mede consumo
    { id: "a4", veiculoId: "v2", funcionarioId: "ana", data: "2026-09-20", litros: 30, valor: 190, km: 79_000 },
  ],
  manutencoes: [
    { id: "m1", veiculoId: "v2", data: "2026-10-08", tipo: "pneus", valor: 1_200, km: 80_000, concluida: true },
    // v2: última revisão a 70.500 km, próxima a 80.500 (faltam 500 km: próxima)
    { id: "m2", veiculoId: "v2", data: "2026-03-01", tipo: "revisao", valor: 900, km: 70_500, concluida: true },
    // v1: revisão há mais de 12 meses (vencida)
    { id: "m3", veiculoId: "v1", data: "2025-09-01", tipo: "revisao", valor: 800, km: 45_000, concluida: true },
  ],
};

describe("agenda", () => {
  const itens: Evento[] = [
    evento({ id: "e1", data: "2026-10-19", tipo: "reuniao", tags: ["t1"] }),
    evento({ id: "e2", data: "2026-10-24", tipo: "compromisso" }),
    evento({ id: "e3", data: "2026-10-26", tipo: "compromisso" }),
    evento({ id: "f1", data: "2026-10-21", tipo: "reuniao", tipoNaLegenda: "institucional", origem: "faperon" }),
    // viagem de três dias: um evento, três dias com viagem
    evento({ id: "frota-r3-2026-10-20", data: "2026-10-20", tipo: "viagem", origem: "frota", trecho: "ida" }),
    evento({ id: "frota-r3-2026-10-21", data: "2026-10-21", tipo: "viagem", origem: "frota", trecho: "meio" }),
    evento({ id: "frota-r3-2026-10-22", data: "2026-10-22", tipo: "viagem", origem: "frota", trecho: "volta" }),
    evento({ id: "velho", data: "2026-06-01", tipo: "reuniao" }),
  ];

  it("conta eventos (a viagem uma vez só) por tipo, os próximos 7 dias e os dias com viagem", () => {
    const r = indicadoresAgenda(itens, filtro());
    expect(r.eventos).toBe(5);
    expect(r.porTipo).toEqual([
      { tipo: "reuniao", total: 1 },
      { tipo: "viagem", total: 1 },
      { tipo: "compromisso", total: 2 },
      { tipo: "institucional", total: 1 },
    ]);
    // 18 a 24/10: e1, e2, f1 e a viagem
    expect(r.proximos7).toBe(4);
    expect(r.diasComViagem).toBe(3);
  });

  it("o filtro de tag vale para todos os números", () => {
    const r = indicadoresAgenda(itens, filtro({ tagId: "t1" }));
    expect(r).toMatchObject({ eventos: 1, proximos7: 1, diasComViagem: 0 });
  });

  it("sem itens, tudo zerado", () => {
    expect(indicadoresAgenda([], filtro())).toEqual({ eventos: 0, porTipo: [], proximos7: 0, diasComViagem: 0 });
  });

  it("a agenda da equipe junta a de cada pessoa sem repetir os eventos da FAPERON", () => {
    const fap = [evento({ id: "faperon-x", data: "2026-10-21", origem: "faperon" })];
    const pessoais: Record<string, Evento[]> = { carla: [evento({ id: "c1", data: "2026-10-19" })], ana: [evento({ id: "a1", data: "2026-10-19" })] };
    const lista = agendaDaEquipe(["carla", "ana"], (id) => pessoais[id] ?? [], fap, frota.reservas, frota.veiculos, []);
    const ids = lista.map((e) => e.id);
    expect(ids.filter((id) => id === "faperon-x")).toHaveLength(1);
    expect(ids).toEqual(expect.arrayContaining(["c1", "a1", "frota-r3-2026-10-20", "frota-r2-2026-09-10"]));
  });
});

describe("frota", () => {
  it("viagens e km por mês, custo por veículo, consumo e revisões", () => {
    const r = indicadoresFrota(frota, filtro());
    expect(r.porMes).toEqual([
      { mes: "2026-08", viagens: 0, km: 0 },
      { mes: "2026-09", viagens: 1, km: 800 },
      { mes: "2026-10", viagens: 2, km: 500 },
    ]);
    expect(r.viagens).toBe(3);
    expect(r.km).toBe(1_300);
    expect(r.minhasViagens).toBeNull();
    expect(r.custoPorVeiculo).toEqual([
      { veiculoId: "v2", nome: "Gol (XYZ9K87)", combustivel: 190, manutencao: 1_200, total: 1_390 },
      { veiculoId: "v1", nome: "Hilux (ABC1D23)", combustivel: 880, manutencao: 0, total: 880 },
    ]);
    expect(r.custoTotal).toBe(2_270);
    // v1: 1.200 km com os 100 litros depois do primeiro abastecimento
    expect(r.consumoMedio).toBe(12);
    expect(r.revisao).toEqual({ proxima: 1, vencida: 1 });
  });

  it("o funcionário comum vê o uso geral da frota e as próprias viagens", () => {
    const r = indicadoresFrota(frota, daCarla());
    expect(r.viagens).toBe(3);
    expect(r.minhasViagens).toBe(2);
  });

  it("quem vê a equipe pode escolher uma pessoa; a tag filtra as viagens, não os custos", () => {
    expect(indicadoresFrota(frota, filtro({ escopo: { equipe: true, pessoa: "ana" } }))).toMatchObject({ viagens: 1, km: 800 });
    const comTag = indicadoresFrota(frota, filtro({ tagId: "t1" }));
    expect(comTag).toMatchObject({ viagens: 1, km: 500, custoTotal: 2_270 });
  });

  it("sem dados no período", () => {
    const vazio = indicadoresFrota({ veiculos: [], reservas: [], abastecimentos: [], manutencoes: [] }, filtro());
    expect(vazio).toMatchObject({ viagens: 0, km: 0, custoTotal: 0, consumoMedio: null, custoPorVeiculo: [], revisao: { proxima: 0, vencida: 0 } });
  });
});

function pedido(p: Partial<PedidoEspaco> & Pick<PedidoEspaco, "id">): PedidoEspaco {
  return {
    espacoId: "auditorio",
    funcionarioId: "carla",
    data: "2026-10-10",
    periodo: "horario",
    inicio: "08:00",
    fim: "12:00",
    tipo: "palestra",
    nome: p.id,
    participantes: 50,
    coffeeBreak: false,
    observacoes: "",
    status: "aprovado",
    motivoRecusa: "",
    criadoEm: "2026-10-01T10:00",
    ...p,
  };
}

describe("espaços", () => {
  const pedidos = [
    pedido({ id: "p1", coffeeBreak: true, tags: ["t1"] }),
    pedido({ id: "p2", espacoId: "hub", funcionarioId: "ana", inicio: "13:00", fim: "18:00" }),
    pedido({ id: "p3", espacoId: "hub", funcionarioId: "ana", status: "pendente", coffeeBreak: true }),
    pedido({ id: "p4", status: "devolvido" }),
    pedido({ id: "p5", status: "recusado", funcionarioId: "ana" }),
    pedido({ id: "p6", status: "cancelado", coffeeBreak: true }),
    pedido({ id: "p7", data: "2026-05-02" }),
  ];

  it("ocupação aprovada por espaço, pedidos por situação e coffee breaks", () => {
    const r = indicadoresEspacos(pedidos, filtro());
    expect(r.horasPorEspaco.find((e) => e.espacoId === "auditorio")?.horas).toBe(4);
    expect(r.horasPorEspaco.find((e) => e.espacoId === "hub")?.horas).toBe(5);
    expect(r.horasPorEspaco).toHaveLength(5);
    expect(r.horasAprovadas).toBe(9);
    expect(r.porSituacao).toEqual([
      { status: "aprovado", total: 2 },
      { status: "pendente", total: 1 },
      { status: "devolvido", total: 1 },
      { status: "recusado", total: 1 },
    ]);
    expect(r.pedidos).toBe(5);
    expect(r.coffeeBreaks).toBe(2);
  });

  it("o funcionário comum vê a ocupação geral, mas só os próprios pedidos", () => {
    const r = indicadoresEspacos(pedidos, daCarla());
    expect(r.horasAprovadas).toBe(9);
    expect(r).toMatchObject({ pedidos: 2, coffeeBreaks: 1 });
  });

  it("com tag, só os pedidos dela", () => {
    expect(indicadoresEspacos(pedidos, filtro({ tagId: "t1" }))).toMatchObject({ horasAprovadas: 4, pedidos: 1, coffeeBreaks: 1 });
  });
});

function despesa(p: Partial<Despesa> & Pick<Despesa, "id">): Despesa {
  return {
    funcionarioId: "carla",
    data: "2026-10-05",
    centro: "Comunicação",
    categoria: "material",
    descricao: p.id,
    fornecedor: "",
    valor: 100,
    comprovante: null,
    status: "aprovada",
    observacaoGestor: "",
    criadaEm: "2026-10-05T10:00",
    ...p,
  };
}

describe("contas", () => {
  const despesas = [
    despesa({ id: "d1", valor: 100.5 }),
    despesa({ id: "d2", categoria: "servicos", valor: 200, status: "enviada", data: "2026-09-02", tags: ["t1"] }),
    despesa({ id: "d3", funcionarioId: "ana", centro: "Técnica", categoria: "hospedagem", valor: 340, status: "aprovada", data: "2026-08-20" }),
    despesa({ id: "d4", funcionarioId: "ana", valor: 50, status: "devolvida" }),
    despesa({ id: "d5", valor: 999, status: "rascunho" }),
    despesa({ id: "d6", valor: 999, data: "2026-01-10" }),
  ];

  it("por centro e categoria, evolução mensal, aprovado e pendente", () => {
    const r = indicadoresContas(despesas, filtro());
    expect(r.porCentro.map((c) => [c.centro, c.total])).toEqual([
      ["Técnica", 340],
      ["Comunicação", 300.5],
    ]);
    expect(r.categorias).toEqual(["material", "hospedagem", "servicos"]);
    expect(r.porMes).toEqual([
      { mes: "2026-08", aprovado: 340, enviado: 0 },
      { mes: "2026-09", aprovado: 0, enviado: 200 },
      { mes: "2026-10", aprovado: 100.5, enviado: 0 },
    ]);
    expect(r).toMatchObject({ aprovado: 440.5, pendente: 200, devolvidas: 1 });
  });

  it("o funcionário comum vê só as próprias; a tag filtra", () => {
    expect(indicadoresContas(despesas, daCarla())).toMatchObject({ aprovado: 100.5, pendente: 200, devolvidas: 0 });
    expect(indicadoresContas(despesas, filtro({ tagId: "t1" }))).toMatchObject({ aprovado: 0, pendente: 200 });
  });

  it("sem despesas", () => {
    const r = indicadoresContas([], filtro());
    expect(r).toMatchObject({ porCentro: [], categorias: [], aprovado: 0, pendente: 0, devolvidas: 0 });
    expect(r.porMes.every((m) => m.aprovado === 0 && m.enviado === 0)).toBe(true);
  });
});

function atividade(p: Partial<Atividade> & Pick<Atividade, "id">): Atividade {
  return {
    funcionarioId: "carla",
    data: "2026-10-05",
    inicio: "08:00",
    fim: "10:00",
    tipo: "reuniao",
    titulo: p.id,
    municipio: "Porto Velho",
    publico: 0,
    descricao: "",
    resultados: "",
    criadaEm: "2026-10-05T18:00",
    ...p,
  };
}

describe("atividades", () => {
  const atividades = [
    atividade({ id: "a1" }),
    atividade({ id: "a2", funcionarioId: "ana", tipo: "visita_tecnica", inicio: "07:30", fim: "16:00", municipio: "Cacoal", publico: 9, data: "2026-09-12", tags: ["t1"] }),
    atividade({ id: "a3", funcionarioId: "ana", tipo: "capacitacao", inicio: "08:00", fim: "12:00", municipio: "Cacoal", publico: 28 }),
    atividade({ id: "a4", funcionarioId: "joao", tipo: "atendimento", inicio: "08:00", fim: "17:00", municipio: "Vilhena", publico: 17 }),
    atividade({ id: "a5", data: "2026-04-01", publico: 500 }),
  ];

  it("horas por tipo, público por mês, municípios e horas por funcionário", () => {
    // os nomes vêm da equipe da API; aqui, os funcionários de demonstração
    const r = indicadoresAtividades(atividades, filtro(), new Map(FUNCIONARIOS.map((f) => [f.id, f.nome])));
    expect(r).toMatchObject({ atividades: 4, horas: 23.5, publico: 54 });
    expect(r.horasPorTipo).toEqual([
      { tipo: "visita_tecnica", legenda: "visita_tecnica", horas: 8.5 },
      { tipo: "atendimento", legenda: "atendimento", horas: 9 },
      { tipo: "reuniao", legenda: "reuniao", horas: 2 },
      { tipo: "capacitacao", legenda: "capacitacao", horas: 4 },
    ]);
    expect(r.publicoPorMes).toEqual([
      { mes: "2026-08", publico: 0 },
      { mes: "2026-09", publico: 9 },
      { mes: "2026-10", publico: 45 },
    ]);
    expect(r.municipios).toEqual([
      { municipio: "Cacoal", atividades: 2, publico: 37 },
      { municipio: "Vilhena", atividades: 1, publico: 17 },
      { municipio: "Porto Velho", atividades: 1, publico: 0 },
    ]);
    expect(r.porFuncionario?.map((f) => [f.nome, f.horas])).toEqual([
      ["Ana Ribeiro", 12.5],
      ["João Pereira", 9],
      ["Carla Mendes", 2],
    ]);
  });

  it("o top de municípios para em 10", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => atividade({ id: `m${i}`, municipio: `Município ${String(i).padStart(2, "0")}` }));
    expect(indicadoresAtividades(muitas, filtro()).municipios).toHaveLength(10);
  });

  it("o funcionário comum vê só as próprias e não tem horas por funcionário", () => {
    const r = indicadoresAtividades(atividades, daCarla());
    expect(r).toMatchObject({ atividades: 1, horas: 2, porFuncionario: null });
  });

  it("com uma pessoa escolhida, sem horas por funcionário; com tag, só as dela", () => {
    expect(indicadoresAtividades(atividades, filtro({ escopo: { equipe: true, pessoa: "ana" } }))).toMatchObject({ atividades: 2, porFuncionario: null });
    expect(indicadoresAtividades(atividades, filtro({ tagId: "t1" }))).toMatchObject({ atividades: 1, publico: 9 });
  });

  it("sem atividades no período", () => {
    const r = indicadoresAtividades([], filtro());
    expect(r).toMatchObject({ atividades: 0, horas: 0, publico: 0, horasPorTipo: [], municipios: [], porFuncionario: [] });
  });
});

