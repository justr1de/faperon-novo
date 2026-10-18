import { ESPACOS } from "@/content/sistema/exemplo";
import { itensDaAgenda } from "./agenda";
import { horasDaAtividade, resumoPorFuncionario, ROTULO_TIPO_ATIVIDADE } from "./atividades";
import { ROTULO_CATEGORIA, totaisPorCentro, type TotalDoCentro } from "./contas";
import { nomeDoMes, somarDias, somarMeses } from "./datas";
import { TIPO_DA_ATIVIDADE, tipoDoEvento, tiposPresentes } from "./legenda";
import { formatarPlaca } from "./placa";
import { alertaDeRevisao } from "./revisao";
import { comTag, podeGerirTags } from "./tags";
import type {
  Atividade,
  CategoriaDespesa,
  Despesa,
  EstadoFrota,
  Evento,
  Funcionario,
  IdEspaco,
  PedidoEspaco,
  Reserva,
  StatusPedido,
  TipoAtividade,
  TipoLegenda,
  Veiculo,
} from "./tipos";

/** Indicadores da área logada: números e séries por área, calculados só com o que já está no estado do protótipo. */

export type PeriodoIndicadores = "mes" | "3m" | "6m" | "12m";

export const PERIODOS_INDICADORES: { valor: PeriodoIndicadores; rotulo: string }[] = [
  { valor: "mes", rotulo: "Este mês" },
  { valor: "3m", rotulo: "3 meses" },
  { valor: "6m", rotulo: "6 meses" },
  { valor: "12m", rotulo: "12 meses" },
];

const QUANTOS_MESES: Record<PeriodoIndicadores, number> = { mes: 1, "3m": 3, "6m": 6, "12m": 12 };

/** Meses do calendário inteiros, do primeiro dia do mais antigo ao último dia do mês atual (o já agendado nele conta). */
export interface Intervalo {
  de: string;
  ate: string;
  /** `YYYY-MM`, do mais antigo ao atual. */
  meses: string[];
}

export function intervaloDoPeriodo(periodo: PeriodoIndicadores, hoje: string): Intervalo {
  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const quantos = QUANTOS_MESES[periodo];
  const meses = Array.from({ length: quantos }, (_, i) => somarMeses(inicioDoMes, i - quantos + 1).slice(0, 7));
  return { de: `${meses[0]}-01`, ate: somarDias(somarMeses(inicioDoMes, 1), -1), meses };
}

const mesPorExtenso = (mes: string) => `${nomeDoMes(Number(mes.slice(5, 7)) - 1)} de ${mes.slice(0, 4)}`;

/** "agosto a outubro de 2026"; com anos diferentes, "novembro de 2025 a outubro de 2026". */
export function descreverIntervalo({ meses }: Intervalo): string {
  const primeiro = meses[0]!;
  const ultimo = meses.at(-1)!;
  if (primeiro === ultimo) return mesPorExtenso(ultimo);
  if (primeiro.slice(0, 4) === ultimo.slice(0, 4)) return `${nomeDoMes(Number(primeiro.slice(5, 7)) - 1)} a ${mesPorExtenso(ultimo)}`;
  return `${mesPorExtenso(primeiro)} a ${mesPorExtenso(ultimo)}`;
}

/** Quem vê os números de toda a equipe: o coordenador ou qualquer gestor (os mesmos que gerem as tags). */
export function podeVerEquipe(f: Funcionario | null): boolean {
  return podeGerirTags(f);
}

/** `pessoa` null quer dizer todos; o funcionário comum fica sempre com os próprios números. */
export interface Escopo {
  equipe: boolean;
  pessoa: string | null;
}

export function escopoDe(funcionario: Funcionario, escolhido: string): Escopo {
  if (!podeVerEquipe(funcionario)) return { equipe: false, pessoa: funcionario.id };
  return { equipe: true, pessoa: escolhido || null };
}

export interface Filtro {
  intervalo: Intervalo;
  hoje: string;
  /** Vazio: todas as tags. */
  tagId: string;
  escopo: Escopo;
}

const arredondar = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const noIntervalo = (data: string, { de, ate }: Intervalo) => data.slice(0, 10) >= de && data.slice(0, 10) <= ate;
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const daPessoa = <T extends { funcionarioId: string }>(itens: T[], pessoa: string | null) => (pessoa ? itens.filter((i) => i.funcionarioId === pessoa) : itens);
/** O uso geral da frota e dos espaços é de todos; só quem vê a equipe recorta por pessoa. */
const pessoaDoUsoGeral = (e: Escopo) => (e.equipe ? e.pessoa : null);

// ---------- Agenda ----------

/** A agenda de cada pessoa da lista, junta; os eventos da FAPERON (iguais para todos) entram uma vez. */
export function agendaDaEquipe(
  ids: string[],
  pessoaisDe: (id: string) => Evento[],
  institucionais: Evento[],
  reservas: Reserva[],
  veiculos: Veiculo[],
  pedidos: PedidoEspaco[],
): Evento[] {
  const vistos = new Set<string>();
  return ids
    .flatMap((id) => itensDaAgenda(id, pessoaisDe(id), institucionais, reservas, veiculos, pedidos))
    .filter((e) => (vistos.has(e.id) ? false : (vistos.add(e.id), true)));
}

/** A viagem de vários dias vira um item por dia (`frota-r1-2026-10-20`): para contar eventos, conta uma vez. */
const chaveDoEvento = (e: Evento) => e.id.replace(/-\d{4}-\d{2}-\d{2}$/, "");

export interface IndicadoresAgenda {
  eventos: number;
  porTipo: { tipo: TipoLegenda; total: number }[];
  proximos7: number;
  diasComViagem: number;
}

const unicos = (itens: Evento[]) => new Set(itens.map(chaveDoEvento)).size;

/** Recebe os itens já montados (de `itensDaAgenda` ou `agendaDaEquipe`). Os próximos 7 dias não dependem do período. */
export function indicadoresAgenda(itens: Evento[], f: Filtro): IndicadoresAgenda {
  const comFiltro = comTag(itens, f.tagId);
  const doPeriodo = comFiltro.filter((e) => noIntervalo(e.data, f.intervalo));
  const tipoPorChave = new Map(doPeriodo.map((e) => [chaveDoEvento(e), tipoDoEvento(e)]));
  const tipos = [...tipoPorChave.values()];
  const semana = somarDias(f.hoje, 6);
  return {
    eventos: tipoPorChave.size,
    porTipo: tiposPresentes(tipos).map((tipo) => ({ tipo, total: tipos.filter((t) => t === tipo).length })),
    proximos7: unicos(comFiltro.filter((e) => e.data >= f.hoje && e.data <= semana)),
    diasComViagem: new Set(doPeriodo.filter((e) => tipoDoEvento(e) === "viagem").map((e) => e.data)).size,
  };
}

// ---------- Frota ----------

export interface CustoDoVeiculo {
  veiculoId: string;
  nome: string;
  combustivel: number;
  manutencao: number;
  total: number;
}

export interface IndicadoresFrota {
  porMes: { mes: string; viagens: number; km: number }[];
  viagens: number;
  km: number;
  /** Só para quem não vê a equipe: as viagens da própria pessoa no período. */
  minhasViagens: number | null;
  /** Abastecimento e manutenção não têm tag nem são de uma pessoa: os custos são sempre da frota toda. */
  custoPorVeiculo: CustoDoVeiculo[];
  custoTotal: number;
  /** km/l pelo hodômetro dos abastecimentos do período (veículos com dois ou mais). */
  consumoMedio: number | null;
  revisao: { proxima: number; vencida: number };
}

const rodado = (r: Reserva) => (r.situacao === "concluida" && r.kmInicial != null && r.kmFinal != null ? r.kmFinal - r.kmInicial : 0);

export function indicadoresFrota({ veiculos, reservas, abastecimentos, manutencoes }: EstadoFrota, f: Filtro): IndicadoresFrota {
  const { intervalo } = f;
  const ativas = comTag(reservas, f.tagId).filter((r) => r.situacao !== "cancelada");
  const doUso = daPessoa(ativas, pessoaDoUsoGeral(f.escopo));
  const porMes = intervalo.meses.map((mes) => ({
    mes,
    viagens: doUso.filter((r) => r.saida.startsWith(mes)).length,
    km: doUso.filter((r) => r.retorno.startsWith(mes)).reduce((s, r) => s + rodado(r), 0),
  }));
  const minhas = f.escopo.equipe ? null : daPessoa(ativas, f.escopo.pessoa).filter((r) => noIntervalo(r.saida, intervalo)).length;

  const abastDoPeriodo = abastecimentos.filter((a) => noIntervalo(a.data, intervalo));
  const custoPorVeiculo = veiculos
    .map((v) => {
      const combustivel = arredondar(abastDoPeriodo.filter((a) => a.veiculoId === v.id).reduce((s, a) => s + a.valor, 0));
      const manutencao = arredondar(manutencoes.filter((m) => m.veiculoId === v.id && noIntervalo(m.data, intervalo)).reduce((s, m) => s + m.valor, 0));
      return { veiculoId: v.id, nome: `${v.modelo} (${formatarPlaca(v.placa)})`, combustivel, manutencao, total: arredondar(combustivel + manutencao) };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

  // consumo: km entre o primeiro e o último abastecimento, sobre os litros postos depois do primeiro
  let kmMedidos = 0;
  let litrosMedidos = 0;
  for (const v of veiculos) {
    const doVeiculo = abastDoPeriodo.filter((a) => a.veiculoId === v.id).sort((a, b) => a.km - b.km);
    if (doVeiculo.length < 2) continue;
    kmMedidos += doVeiculo.at(-1)!.km - doVeiculo[0]!.km;
    litrosMedidos += doVeiculo.slice(1).reduce((s, a) => s + a.litros, 0);
  }

  const alertas = veiculos.map((v) => alertaDeRevisao(v, manutencoes, f.hoje).estado);
  return {
    porMes,
    viagens: porMes.reduce((s, m) => s + m.viagens, 0),
    km: porMes.reduce((s, m) => s + m.km, 0),
    minhasViagens: minhas,
    custoPorVeiculo,
    custoTotal: arredondar(custoPorVeiculo.reduce((s, c) => s + c.total, 0)),
    consumoMedio: litrosMedidos > 0 && kmMedidos > 0 ? arredondar(kmMedidos / litrosMedidos, 1) : null,
    revisao: { proxima: alertas.filter((e) => e === "proxima").length, vencida: alertas.filter((e) => e === "vencida").length },
  };
}

// ---------- Espaços ----------

export const SITUACOES_DOS_PEDIDOS: StatusPedido[] = ["aprovado", "pendente", "devolvido", "recusado"];

export interface IndicadoresEspacos {
  /** Ocupação aprovada, em horas, por espaço (todos os espaços, na ordem do cadastro). */
  horasPorEspaco: { espacoId: IdEspaco; nome: string; horas: number }[];
  horasAprovadas: number;
  porSituacao: { status: StatusPedido; total: number }[];
  pedidos: number;
  coffeeBreaks: number;
}

/** A ocupação é geral; os pedidos (situação e coffee break) são os da pessoa, para quem não vê a equipe. */
export function indicadoresEspacos(pedidos: PedidoEspaco[], f: Filtro): IndicadoresEspacos {
  const doPeriodo = comTag(pedidos, f.tagId).filter((p) => p.status !== "cancelado" && noIntervalo(p.data, f.intervalo));
  const aprovados = daPessoa(doPeriodo, pessoaDoUsoGeral(f.escopo)).filter((p) => p.status === "aprovado");
  const horasPorEspaco = ESPACOS.map((e) => ({
    espacoId: e.id,
    nome: e.nome,
    horas: arredondar(aprovados.filter((p) => p.espacoId === e.id).reduce((s, p) => s + (minutos(p.fim) - minutos(p.inicio)) / 60, 0), 1),
  }));
  const proprios = daPessoa(doPeriodo, f.escopo.pessoa);
  return {
    horasPorEspaco,
    horasAprovadas: arredondar(horasPorEspaco.reduce((s, e) => s + e.horas, 0), 1),
    porSituacao: SITUACOES_DOS_PEDIDOS.map((status) => ({ status, total: proprios.filter((p) => p.status === status).length })),
    pedidos: proprios.length,
    coffeeBreaks: proprios.filter((p) => p.coffeeBreak).length,
  };
}

// ---------- Contas ----------

export interface IndicadoresContas {
  /** Enviadas e aprovadas (a despesa reconhecida), por centro e categoria. */
  porCentro: TotalDoCentro[];
  /** Categorias que aparecem, na ordem do catálogo (a cor de cada uma é fixa). */
  categorias: CategoriaDespesa[];
  porMes: { mes: string; aprovado: number; enviado: number }[];
  aprovado: number;
  /** Enviadas, aguardando a aprovação do gestor. */
  pendente: number;
  devolvidas: number;
}

export function indicadoresContas(despesas: Despesa[], f: Filtro): IndicadoresContas {
  const lista = daPessoa(comTag(despesas, f.tagId), f.escopo.pessoa).filter((d) => noIntervalo(d.data, f.intervalo));
  const porCentro = totaisPorCentro(lista, f.intervalo.de, f.intervalo.ate);
  const presentes = new Set(porCentro.flatMap((c) => Object.keys(c.porCategoria)));
  const soma = (itens: Despesa[]) => arredondar(itens.reduce((s, d) => s + d.valor, 0));
  return {
    porCentro,
    categorias: (Object.keys(ROTULO_CATEGORIA) as CategoriaDespesa[]).filter((c) => presentes.has(c)),
    porMes: f.intervalo.meses.map((mes) => ({
      mes,
      aprovado: soma(lista.filter((d) => d.status === "aprovada" && d.data.startsWith(mes))),
      enviado: soma(lista.filter((d) => d.status === "enviada" && d.data.startsWith(mes))),
    })),
    aprovado: soma(lista.filter((d) => d.status === "aprovada")),
    pendente: soma(lista.filter((d) => d.status === "enviada")),
    devolvidas: lista.filter((d) => d.status === "devolvida").length,
  };
}

// ---------- Atividades ----------

export const LIMITE_MUNICIPIOS = 10;

export interface IndicadoresAtividades {
  atividades: number;
  horas: number;
  publico: number;
  horasPorTipo: { tipo: TipoAtividade; legenda: TipoLegenda; horas: number }[];
  publicoPorMes: { mes: string; publico: number }[];
  municipios: { municipio: string; atividades: number; publico: number }[];
  /** Só na visão da equipe com "Todos": null quando os números são de uma pessoa. */
  porFuncionario: { funcionarioId: string; nome: string; atividades: number; horas: number; publico: number }[] | null;
}

/** `nomes`: código do funcionário -> nome (a equipe vem da API desde a ADR 0035). */
export function indicadoresAtividades(atividades: Atividade[], f: Filtro, nomes: ReadonlyMap<string, string> = new Map()): IndicadoresAtividades {
  const lista = daPessoa(comTag(atividades, f.tagId), f.escopo.pessoa).filter((a) => noIntervalo(a.data, f.intervalo));
  const horasPorTipo = (Object.keys(ROTULO_TIPO_ATIVIDADE) as TipoAtividade[])
    .map((tipo) => ({ tipo, legenda: TIPO_DA_ATIVIDADE[tipo], horas: arredondar(lista.filter((a) => a.tipo === tipo).reduce((s, a) => s + horasDaAtividade(a), 0)) }))
    .filter((t) => t.horas > 0);
  const porMunicipio = new Map<string, { municipio: string; atividades: number; publico: number }>();
  for (const a of lista) {
    const nome = a.municipio.trim();
    if (!nome) continue;
    const m = porMunicipio.get(nome) ?? { municipio: nome, atividades: 0, publico: 0 };
    m.atividades += 1;
    m.publico += a.publico;
    porMunicipio.set(nome, m);
  }
  const municipios = [...porMunicipio.values()]
    .sort((a, b) => b.atividades - a.atividades || b.publico - a.publico || a.municipio.localeCompare(b.municipio))
    .slice(0, LIMITE_MUNICIPIOS);
  return {
    atividades: lista.length,
    horas: arredondar(lista.reduce((s, a) => s + horasDaAtividade(a), 0), 1),
    publico: lista.reduce((s, a) => s + a.publico, 0),
    horasPorTipo,
    publicoPorMes: f.intervalo.meses.map((mes) => ({ mes, publico: lista.filter((a) => a.data.startsWith(mes)).reduce((s, a) => s + a.publico, 0) })),
    municipios,
    porFuncionario:
      f.escopo.equipe && !f.escopo.pessoa
        ? resumoPorFuncionario(lista, f.intervalo.de, f.intervalo.ate).map((r) => ({ ...r, nome: nomes.get(r.funcionarioId) ?? r.funcionarioId }))
        : null,
  };
}
