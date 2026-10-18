import { ESPACOS } from "@/content/sistema/exemplo";
import { ROTULO_ORIGEM } from "./agenda";
import { atividadesVisiveis, horasDaAtividade, ROTULO_TIPO_ATIVIDADE } from "./atividades";
import { ROTULO_CATEGORIA, ROTULO_STATUS_DESPESA } from "./contas";
import { formatarDataBR } from "./datas";
import { conflitosDoPedido } from "./espacos";
import { km, litros, reais } from "./formato";
import { LEGENDA, TIPO_DA_ATIVIDADE, tipoDoEvento, tiposPresentes } from "./legenda";
import { formatarPlaca } from "./placa";
import { comTag, nomesDasTags } from "./tags";
import type { Atividade, Despesa, EstadoFrota, Evento, Funcionario, PedidoEspaco, StatusDespesa, Tag, TipoLegenda } from "./tipos";

export type TipoRelatorio = "frota" | "espacos" | "agenda" | "contas" | "atividades";
export type FormatoColuna = "texto" | "inteiro" | "reais" | "km" | "litros" | "horas";
export type Celula = string | number | null;

export interface Coluna {
  rotulo: string;
  formato: FormatoColuna;
  /** Coluna de tipo: na tela, cada célula vira um selo na cor da legenda (`Relatorio.tipos`). */
  selo?: boolean;
}

/** Tabela pronta para a prévia, a impressão e o CSV: os três saem da mesma fonte. */
export interface Relatorio {
  titulo: string;
  resumo: string[];
  colunas: Coluna[];
  linhas: Celula[][];
  total: Celula[] | null;
  /** Tipo da legenda de cada linha, para o selo da coluna de tipo. */
  tipos?: TipoLegenda[];
}

export const ROTULO_RELATORIO: Record<TipoRelatorio, string> = {
  frota: "Frota",
  espacos: "Espaços",
  agenda: "Agenda",
  contas: "Prestação de contas",
  atividades: "Atividades",
};

const arredondar = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const noPeriodo = (data: string, de: string, ate: string) => data.slice(0, 10) >= de && data.slice(0, 10) <= ate;
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Nome na equipe vinda da API (ADR 0035); quem não está mais nela aparece pelo código. */
const nomeNaEquipe = (equipe: Funcionario[], id: string) => equipe.find((f) => f.id === id)?.nome ?? id;

/** Com tag, contam só as viagens com ela. Abastecimento e manutenção não têm tag: as colunas de custo ficam
 *  vazias, para não atribuir à tag gastos que não são dela (nem dividir o custo do período pelos km da tag). */
export function relatorioFrota({ veiculos, reservas: todas, abastecimentos, manutencoes }: EstadoFrota, de: string, ate: string, tag: Tag | null = null): Relatorio {
  const reservas = tag ? comTag(todas, tag.id) : todas;
  const linhas: Celula[][] = veiculos.map((v) => {
    const viagens = reservas.filter((r) => r.veiculoId === v.id && r.situacao !== "cancelada" && noPeriodo(r.saida, de, ate)).length;
    const rodado = reservas
      .filter((r) => r.veiculoId === v.id && r.situacao === "concluida" && noPeriodo(r.retorno, de, ate) && r.kmInicial != null && r.kmFinal != null)
      .reduce((s, r) => s + (r.kmFinal! - r.kmInicial!), 0);
    const abast = abastecimentos.filter((a) => a.veiculoId === v.id && noPeriodo(a.data, de, ate));
    const combustivel = arredondar(abast.reduce((s, a) => s + a.valor, 0));
    const manutencao = arredondar(manutencoes.filter((m) => m.veiculoId === v.id && noPeriodo(m.data, de, ate)).reduce((s, m) => s + m.valor, 0));
    const total = arredondar(combustivel + manutencao);
    const uso = [`${v.modelo} (${formatarPlaca(v.placa)})`, viagens, rodado];
    if (tag) return [...uso, null, null, null, null, null];
    return [...uso, arredondar(abast.reduce((s, a) => s + a.litros, 0), 1), combustivel, manutencao, total, rodado > 0 ? arredondar(total / rodado) : null];
  });
  const soma = (i: number, casas = 2) => arredondar(linhas.reduce((s, l) => s + ((l[i] as number | null) ?? 0), 0), casas);
  const kmTotal = soma(2, 0);
  const custoTotal = soma(6);
  return {
    titulo: "Uso e custos da frota",
    resumo: [
      tag
        ? `${soma(1, 0)} viagem(ns) e ${km(kmTotal)} rodados com a tag “${tag.nome}”.`
        : `${soma(1, 0)} viagem(ns), ${km(kmTotal)} rodados e ${reais(custoTotal)} em combustível e manutenção.`,
    ],
    colunas: [
      { rotulo: "Veículo", formato: "texto" },
      { rotulo: "Viagens", formato: "inteiro" },
      { rotulo: "Km rodados", formato: "km" },
      { rotulo: "Litros", formato: "litros" },
      { rotulo: "Combustível", formato: "reais" },
      { rotulo: "Manutenção", formato: "reais" },
      { rotulo: "Custo total", formato: "reais" },
      { rotulo: "Custo por km", formato: "reais" },
    ],
    linhas,
    total: tag
      ? ["Total", soma(1, 0), kmTotal, null, null, null, null, null]
      : ["Total", soma(1, 0), kmTotal, soma(3, 1), soma(4), soma(5), custoTotal, kmTotal > 0 ? arredondar(custoTotal / kmTotal) : null],
  };
}

export function relatorioEspacos(pedidos: PedidoEspaco[], de: string, ate: string): Relatorio {
  const doPeriodo = pedidos.filter((p) => p.status !== "cancelado" && noPeriodo(p.data, de, ate));
  const linhas = ESPACOS.map((e) => {
    const doEspaco = doPeriodo.filter((p) => p.espacoId === e.id);
    const aprovados = doEspaco.filter((p) => p.status === "aprovado");
    return [
      e.nome,
      doEspaco.length,
      aprovados.length,
      doEspaco.filter((p) => p.status === "pendente").length,
      doEspaco.filter((p) => p.status === "recusado").length,
      doEspaco.filter((p) => p.status === "devolvido").length,
      arredondar(aprovados.reduce((s, p) => s + (minutos(p.fim) - minutos(p.inicio)) / 60, 0), 1),
      aprovados.reduce((s, p) => s + p.participantes, 0),
      doEspaco.filter((p) => p.status === "pendente" && conflitosDoPedido(p, pedidos).length > 0).length,
    ];
  });
  const soma = (i: number, casas = 0) => arredondar(linhas.reduce((s, l) => s + (l[i] as number), 0), casas);
  const conflitos = soma(8);
  return {
    titulo: "Ocupação dos espaços",
    resumo: [
      `${soma(1)} pedido(s), ${soma(2)} aprovado(s), ${soma(5)} devolvido(s) para correção e ${soma(6, 1).toLocaleString("pt-BR")} hora(s) de uso aprovadas.`,
      conflitos > 0 ? `${conflitos} pedido(s) pendente(s) em conflito de horário.` : "Nenhum pedido pendente em conflito.",
    ],
    colunas: [
      { rotulo: "Espaço", formato: "texto" },
      { rotulo: "Pedidos", formato: "inteiro" },
      { rotulo: "Aprovados", formato: "inteiro" },
      { rotulo: "Pendentes", formato: "inteiro" },
      { rotulo: "Recusados", formato: "inteiro" },
      { rotulo: "Devolvidos", formato: "inteiro" },
      { rotulo: "Horas aprovadas", formato: "horas" },
      { rotulo: "Participantes", formato: "inteiro" },
      { rotulo: "Em conflito", formato: "inteiro" },
    ],
    linhas,
    total: ["Total", soma(1), soma(2), soma(3), soma(4), soma(5), soma(6, 1), soma(7), conflitos],
  };
}

/** Recebe os itens já montados por `itensDaAgenda` (próprios, FAPERON, viagens e espaços). O tipo é o da legenda única. */
export function relatorioAgenda(itens: Evento[], de: string, ate: string, tags: Tag[] = []): Relatorio {
  const doPeriodo = itens.filter((e) => noPeriodo(e.data, de, ate));
  const tipos = doPeriodo.map(tipoDoEvento);
  const porTipo = tiposPresentes(tipos).map((t) => `${tipos.filter((x) => x === t).length} ${LEGENDA[t].toLowerCase()}`);
  return {
    titulo: "Agenda no período",
    resumo: [`${doPeriodo.length} evento(s)${porTipo.length ? `: ${porTipo.join(", ")}` : ""}.`],
    colunas: [
      { rotulo: "Data", formato: "texto" },
      { rotulo: "Horário", formato: "texto" },
      { rotulo: "Evento", formato: "texto" },
      { rotulo: "Tipo", formato: "texto", selo: true },
      { rotulo: "Origem", formato: "texto" },
      { rotulo: "Local", formato: "texto" },
      { rotulo: "Tags", formato: "texto" },
    ],
    linhas: doPeriodo.map((e, i) => [
      formatarDataBR(e.data),
      `${e.inicio}–${e.fim}`,
      e.titulo,
      LEGENDA[tipos[i]!],
      ROTULO_ORIGEM[e.origem] ?? "Pessoal",
      e.local,
      nomesDasTags(e.tags, tags),
    ]),
    total: null,
    tipos,
  };
}

/** O gestor das contas vê as despesas de todos; os demais, só as próprias. */
export function relatorioContas(despesas: Despesa[], funcionario: Funcionario, de: string, ate: string, tags: Tag[] = [], equipe: Funcionario[] = []): Relatorio {
  const visiveis = despesas
    .filter((d) => (funcionario.gestorContas || d.funcionarioId === funcionario.id) && noPeriodo(d.data, de, ate))
    .sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao));
  const somaStatus = (s: StatusDespesa) => arredondar(visiveis.filter((d) => d.status === s).reduce((t, d) => t + d.valor, 0));
  const reconhecido = arredondar(somaStatus("aprovada") + somaStatus("enviada"));
  const comQuem = funcionario.gestorContas;
  return {
    titulo: comQuem ? "Prestação de contas: todas as despesas" : "Prestação de contas: minhas despesas",
    resumo: [
      (["aprovada", "enviada", "devolvida", "rascunho"] as const)
        .map((s) => `${ROTULO_STATUS_DESPESA[s]}s ${reais(somaStatus(s))}`)
        .join(" · "),
    ],
    colunas: [
      { rotulo: "Data", formato: "texto" },
      ...(comQuem ? [{ rotulo: "Funcionário", formato: "texto" as const }] : []),
      { rotulo: "Centro de custo", formato: "texto" },
      { rotulo: "Categoria", formato: "texto" },
      { rotulo: "Descrição", formato: "texto" },
      { rotulo: "Status", formato: "texto" },
      { rotulo: "Tags", formato: "texto" },
      { rotulo: "Valor", formato: "reais" },
    ],
    linhas: visiveis.map((d) => [
      formatarDataBR(d.data),
      ...(comQuem ? [nomeNaEquipe(equipe, d.funcionarioId)] : []),
      d.centro,
      ROTULO_CATEGORIA[d.categoria],
      d.descricao,
      ROTULO_STATUS_DESPESA[d.status],
      nomesDasTags(d.tags, tags),
      d.valor,
    ]),
    total: ["Aprovadas + enviadas", ...(comQuem ? [""] : []), "", "", "", "", "", reconhecido],
  };
}

/** O coordenador vê as atividades de todos; os demais, só as próprias. */
export function relatorioAtividades(atividades: Atividade[], funcionario: Funcionario, de: string, ate: string, tags: Tag[] = [], equipe: Funcionario[] = []): Relatorio {
  const lista = atividadesVisiveis(atividades, funcionario)
    .filter((a) => noPeriodo(a.data, de, ate))
    .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
  const comQuem = funcionario.coordenador;
  const totalHoras = arredondar(lista.reduce((s, a) => s + horasDaAtividade(a), 0), 1);
  const totalPublico = lista.reduce((s, a) => s + a.publico, 0);
  const porTipo = (Object.keys(ROTULO_TIPO_ATIVIDADE) as Atividade["tipo"][])
    .map((t) => [ROTULO_TIPO_ATIVIDADE[t], lista.filter((a) => a.tipo === t).length] as const)
    .filter(([, n]) => n > 0)
    .map(([rotulo, n]) => `${n} ${rotulo.toLowerCase()}`);
  return {
    titulo: comQuem ? "Atividades da equipe" : "Minhas atividades",
    resumo: [
      `${lista.length} atividade(s), ${totalHoras.toLocaleString("pt-BR")} hora(s) e ${totalPublico} pessoa(s) atendida(s).`,
      ...(porTipo.length ? [`Por tipo: ${porTipo.join(", ")}.`] : []),
    ],
    colunas: [
      { rotulo: "Data", formato: "texto" },
      { rotulo: "Horário", formato: "texto" },
      ...(comQuem ? [{ rotulo: "Funcionário", formato: "texto" as const }] : []),
      { rotulo: "Tipo", formato: "texto", selo: true },
      { rotulo: "Atividade", formato: "texto" },
      { rotulo: "Município", formato: "texto" },
      { rotulo: "Resultados", formato: "texto" },
      { rotulo: "Tags", formato: "texto" },
      { rotulo: "Público", formato: "inteiro" },
      { rotulo: "Horas", formato: "horas" },
    ],
    linhas: lista.map((a) => [
      formatarDataBR(a.data),
      `${a.inicio}–${a.fim}`,
      ...(comQuem ? [nomeNaEquipe(equipe, a.funcionarioId)] : []),
      ROTULO_TIPO_ATIVIDADE[a.tipo],
      a.titulo,
      a.municipio,
      a.resultados,
      nomesDasTags(a.tags, tags),
      a.publico,
      horasDaAtividade(a),
    ]),
    total: ["Total", "", ...(comQuem ? [""] : []), "", "", "", "", "", totalPublico, totalHoras],
    tipos: lista.map((a) => TIPO_DA_ATIVIDADE[a.tipo]),
  };
}

/** Relatório filtrado por tag: o resumo diz o filtro. Frota e espaços somam por veículo e espaço (sem coluna
 *  Tags); na frota, só as viagens têm tag, então as colunas de custo ficam vazias. */
export function comNotaDeTag(r: Relatorio, tag: Tag | null, tipo: TipoRelatorio): Relatorio {
  if (!tag) return r;
  const nota =
    tipo === "frota"
      ? `Só as viagens com a tag “${tag.nome}”. Abastecimentos e manutenções não têm tag: ficam fora deste filtro, e as colunas de custo e o custo por km ficam vazias.`
      : `Só os itens com a tag “${tag.nome}”.`;
  return { ...r, resumo: [...r.resumo, nota] };
}

const inteiroBR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatarCelula(valor: Celula, formato: FormatoColuna): string {
  if (valor == null) return "—";
  if (typeof valor === "string") return valor;
  switch (formato) {
    case "reais":
      return reais(valor);
    case "km":
      return km(valor);
    case "litros":
      return litros(valor);
    case "horas":
      return `${umaCasa.format(valor)} h`;
    default:
      return inteiroBR.format(valor);
  }
}

/** Número no padrão do Excel em português: vírgula decimal, sem separador de milhar nem unidade. */
function numeroCSV(valor: number, formato: FormatoColuna): string {
  const casas = formato === "reais" ? 2 : formato === "litros" || formato === "horas" ? 1 : 0;
  return valor.toFixed(casas).replace(".", ",");
}

function textoCSV(valor: string): string {
  // Texto que começa como fórmula vira texto puro no Excel (injeção de fórmula em CSV).
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV com `;` e BOM UTF-8, para abrir com acentos certos no Excel em português. */
export function paraCSV(r: Relatorio): string {
  const linha = (celulas: Celula[]) =>
    celulas.map((c, i) => (c == null ? "" : typeof c === "number" ? numeroCSV(c, r.colunas[i]!.formato) : textoCSV(c))).join(";");
  const linhas = [r.colunas.map((c) => textoCSV(c.rotulo)).join(";"), ...r.linhas.map(linha), ...(r.total ? [linha(r.total)] : [])];
  return `﻿${linhas.join("\r\n")}\r\n`;
}
