import { API_BASE } from "../api";
import { cabecalhoCsrf } from "./conta";
import { horarioDoPeriodo } from "./espacos";
import type { Atividade, Evento, IdEspaco, PedidoEspaco, PeriodoEspaco, Reserva, TipoAtividade, TipoEvento, TipoEventoEspaco } from "./tipos";

export type TipoVoz = "evento" | "reserva" | "espaco" | "atividade";

/** Campos como o servidor devolve, já conferidos: "" (ou 0) é o que não foi entendido. */
export interface CamposEvento {
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  local: string;
  tipo: TipoEvento;
  descricao: string;
}

export interface CamposReserva {
  veiculoId: string;
  dataSaida: string;
  horaSaida: string;
  dataRetorno: string;
  horaRetorno: string;
  destino: string;
  motivo: string;
}

export interface CamposEspaco {
  espacoId: IdEspaco | "";
  data: string;
  periodo: PeriodoEspaco;
  inicio: string;
  fim: string;
  tipo: TipoEventoEspaco;
  nome: string;
  participantes: number;
  coffeeBreak: boolean;
  observacoes: string;
}

export interface CamposAtividade {
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  tipo: TipoAtividade;
  municipio: string;
  publico: number;
  descricao: string;
  resultados: string;
}

export interface CamposPorTipo {
  evento: CamposEvento;
  reserva: CamposReserva;
  espaco: CamposEspaco;
  atividade: CamposAtividade;
}

export interface Opcao {
  id: string;
  descricao: string;
}

export type ResultadoVoz<T extends TipoVoz> =
  | { tipo: "ok"; campos: CamposPorTipo[T]; faltando: string[] }
  | { tipo: "erro"; mensagem: string };

const MENSAGEM_503: Record<string, string> = {
  sem_chave: "A interpretação por voz está desligada neste ambiente. Preencha o formulário.",
  orcamento_diario: "A interpretação por voz atingiu o limite de hoje. Preencha o formulário.",
};

export async function interpretar<T extends TipoVoz>(
  tipo: T,
  texto: string,
  hoje: string,
  opcoes: { veiculos?: Opcao[]; espacos?: Opcao[] } = {},
): Promise<ResultadoVoz<T>> {
  try {
    const r = await fetch(`${API_BASE}/sistema/interpretar`, {
      method: "POST",
      // a rota exige a sessão do sistema (ADR 0035)
      headers: { "content-type": "application/json", ...cabecalhoCsrf() },
      body: JSON.stringify({ tipo, texto, hoje, ...opcoes }),
    });
    if (r.ok) {
      const corpo = (await r.json()) as { campos: CamposPorTipo[T]; faltando: string[] };
      return { tipo: "ok", campos: corpo.campos, faltando: corpo.faltando };
    }
    if (r.status === 429) return { tipo: "erro", mensagem: "Muitos pedidos seguidos. Espere um pouco e tente de novo." };
    if (r.status === 422) return { tipo: "erro", mensagem: "Não consegui entender o pedido. Tente dizer de outro jeito ou preencha o formulário." };
    if (r.status === 503) {
      const corpo = (await r.json().catch(() => ({}))) as { motivo?: string };
      return { tipo: "erro", mensagem: MENSAGEM_503[corpo.motivo ?? ""] ?? "A interpretação por voz está indisponível agora. Tente de novo em instantes." };
    }
    return { tipo: "erro", mensagem: "Não foi possível interpretar agora. Tente de novo." };
  } catch {
    return { tipo: "erro", mensagem: "Sem conexão com o servidor. Tente de novo." };
  }
}

/** O que a voz trouxe sobrescreve o padrão do formulário; o que veio vazio fica como estava. */
export function aplicarEvento(base: Evento, c: CamposEvento): Evento {
  return {
    ...base,
    titulo: c.titulo || base.titulo,
    data: c.data || base.data,
    inicio: c.inicio || base.inicio,
    fim: c.fim || base.fim,
    local: c.local || base.local,
    tipo: c.tipo,
    descricao: c.descricao || base.descricao,
  };
}

export function aplicarReserva(base: Reserva, c: CamposReserva): Reserva {
  const [dataSaida, horaSaida] = base.saida.split("T") as [string, string];
  const [, horaRetorno] = base.retorno.split("T") as [string, string];
  const saida = c.dataSaida || dataSaida;
  return {
    ...base,
    veiculoId: c.veiculoId || base.veiculoId,
    saida: `${saida}T${c.horaSaida || horaSaida}`,
    // sem data de retorno, volta no mesmo dia da saída
    retorno: `${c.dataRetorno || saida}T${c.horaRetorno || horaRetorno}`,
    destino: c.destino || base.destino,
    motivo: c.motivo || base.motivo,
  };
}

export function aplicarEspaco(base: PedidoEspaco, c: CamposEspaco): PedidoEspaco {
  const horario = c.periodo === "horario" ? { inicio: c.inicio, fim: c.fim } : horarioDoPeriodo(c.periodo)!;
  return {
    ...base,
    espacoId: c.espacoId || base.espacoId,
    data: c.data || base.data,
    periodo: c.periodo,
    ...horario,
    tipo: c.tipo,
    nome: c.nome || base.nome,
    participantes: c.participantes || base.participantes,
    coffeeBreak: c.coffeeBreak,
    observacoes: c.observacoes || base.observacoes,
  };
}

export function aplicarAtividade(base: Atividade, c: CamposAtividade): Atividade {
  return {
    ...base,
    titulo: c.titulo || base.titulo,
    data: c.data || base.data,
    inicio: c.inicio || base.inicio,
    fim: c.fim || base.fim,
    tipo: c.tipo,
    municipio: c.municipio || base.municipio,
    publico: c.publico || base.publico,
    descricao: c.descricao || base.descricao,
    resultados: c.resultados || base.resultados,
  };
}
