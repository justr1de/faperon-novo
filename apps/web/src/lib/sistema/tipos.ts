/** Tipos do protótipo do sistema interno (agenda e frotas). Datas são strings locais, sem fuso:
 *  `YYYY-MM-DD` para dias e `YYYY-MM-DDTHH:mm` para momentos; comparam bem como texto. */

export interface Funcionario {
  id: string;
  nome: string;
  area: string;
  gestorFrota: boolean;
  gestorEspacos: boolean;
  gestorContas: boolean;
  /** Coordena a equipe: vê as atividades e o histórico de todos. */
  coordenador: boolean;
  /** Gere as contas da equipe (tela Usuários, ADR 0035). */
  administrador?: boolean;
}

export type TipoEvento = "reuniao" | "viagem" | "compromisso";
export type OrigemEvento = "pessoal" | "faperon" | "frota" | "espaco";

export interface Evento {
  id: string;
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  local: string;
  descricao: string;
  tipo: TipoEvento;
  origem: OrigemEvento;
  /** Só nas viagens da frota: o município de destino, que a agenda mostra em faixa no dia. */
  destino?: string;
  /** Viagem de vários dias: ida, meio (o dia todo) ou volta; "unico" quando sai e volta no mesmo dia. */
  trecho?: "unico" | "ida" | "meio" | "volta";
  /** Viagem de um colega: o primeiro nome de quem viaja (só leitura, sem link para a reserva). */
  quem?: string;
  /** Tipo na legenda única quando o item vem de outro lugar (espaço, FAPERON); sem ele, vale o `tipo`. */
  tipoNaLegenda?: TipoLegenda;
  /** Ids das tags; só o evento próprio as edita, os demais herdam da reserva ou do pedido. */
  tags?: string[];
}

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  ano: number;
  km: number;
}

export type SituacaoReserva = "agendada" | "em_uso" | "concluida" | "cancelada";

export interface Reserva {
  id: string;
  veiculoId: string;
  funcionarioId: string;
  saida: string;
  retorno: string;
  destino: string;
  motivo: string;
  kmInicial: number | null;
  kmFinal: number | null;
  situacao: SituacaoReserva;
  tags?: string[];
}

export interface Abastecimento {
  id: string;
  veiculoId: string;
  funcionarioId: string;
  data: string;
  litros: number;
  valor: number;
  km: number;
}

export type TipoManutencao = "revisao" | "pneus" | "freios" | "outros";

export interface Manutencao {
  id: string;
  veiculoId: string;
  data: string;
  tipo: TipoManutencao;
  valor: number;
  km: number;
  concluida: boolean;
}

export interface EstadoFrota {
  veiculos: Veiculo[];
  reservas: Reserva[];
  abastecimentos: Abastecimento[];
  manutencoes: Manutencao[];
}

export type SituacaoVeiculo = "disponivel" | "reservado" | "em_manutencao";

export type IdEspaco = "auditorio" | "hub" | "sala-reunioes" | "nucleo-tecnico" | "sala-presidencia";

export interface Espaco {
  id: IdEspaco;
  nome: string;
  capacidade: number;
}

export type PeriodoEspaco = "dia_todo" | "manha" | "tarde" | "noite" | "horario";
export type TipoEventoEspaco = "reuniao" | "curso" | "palestra" | "institucional" | "outro";
export type StatusPedido = "pendente" | "aprovado" | "recusado" | "cancelado" | "devolvido";

export interface PedidoEspaco {
  id: string;
  espacoId: IdEspaco;
  funcionarioId: string;
  data: string;
  periodo: PeriodoEspaco;
  /** Horário já resolvido a partir do período (HH:mm). */
  inicio: string;
  fim: string;
  tipo: TipoEventoEspaco;
  nome: string;
  participantes: number;
  coffeeBreak: boolean;
  observacoes: string;
  status: StatusPedido;
  motivoRecusa: string;
  /** O que o gestor pediu para corrigir ao devolver o pedido (status "devolvido"). */
  correcao?: string;
  criadoEm: string;
  tags?: string[];
}

export const CENTROS_DE_CUSTO = ["Presidência", "Administrativo", "Técnica", "Comunicação", "Sindical"] as const;
export type CentroDeCusto = (typeof CENTROS_DE_CUSTO)[number];
export type CategoriaDespesa = "material" | "combustivel" | "alimentacao" | "hospedagem" | "transporte" | "servicos" | "eventos" | "outros";
export type StatusDespesa = "rascunho" | "enviada" | "aprovada" | "devolvida";

export interface Comprovante {
  nome: string;
  tipo: string;
  /** data: URL do arquivo; null quando passou do limite e só o nome ficou guardado. */
  dados: string | null;
}

export interface Despesa {
  id: string;
  funcionarioId: string;
  data: string;
  centro: CentroDeCusto;
  categoria: CategoriaDespesa;
  descricao: string;
  fornecedor: string;
  valor: number;
  comprovante: Comprovante | null;
  status: StatusDespesa;
  observacaoGestor: string;
  criadaEm: string;
  tags?: string[];
}

export type TipoAtividade =
  | "visita_tecnica"
  | "atendimento"
  | "reuniao"
  | "capacitacao"
  | "evento"
  | "viagem"
  | "administrativo"
  | "outro";

/** Atividade realizada, lançada pelo próprio funcionário. */
export interface Atividade {
  id: string;
  funcionarioId: string;
  data: string;
  inicio: string;
  fim: string;
  tipo: TipoAtividade;
  titulo: string;
  municipio: string;
  /** Pessoas atendidas ou participantes; 0 quando não se aplica. */
  publico: number;
  descricao: string;
  resultados: string;
  criadaEm: string;
  tags?: string[];
}

/** Catálogo único de tipos: a cor diz o tipo em todo o sistema (ver `legenda.ts`). */
export type TipoLegenda =
  | "reuniao"
  | "viagem"
  | "compromisso"
  | "capacitacao"
  | "palestra"
  | "institucional"
  | "visita_tecnica"
  | "atendimento"
  | "administrativo"
  | "outro";

/** Paleta própria das tags, distinta da dos tipos: aparece só como ponto ao lado do nome. */
// 24 cores, para os gestores criarem tags sem repetir cor (cada uma com par claro e escuro, ≥ 4,5:1 sobre o cartão)
export type CorTag =
  | "azul" | "violeta" | "rosa" | "laranja" | "amarelo" | "ciano" | "magenta" | "indigo"
  | "vermelho" | "coral" | "terracota" | "marrom" | "dourado" | "oliva" | "verde" | "esmeralda"
  | "turquesa" | "petroleo" | "celeste" | "marinho" | "lavanda" | "ameixa" | "vinho" | "grafite";

/** Etiqueta livre, criada pelos gestores e aplicada por todos. */
export interface Tag {
  id: string;
  nome: string;
  cor: CorTag;
}

export type ModuloHistorico = "acesso" | "agenda" | "frota" | "espacos" | "contas" | "atividades" | "tags";

/** Trilha automática do que foi feito no sistema: quem, quando, onde e o quê. */
export interface RegistroHistorico {
  id: string;
  quando: string;
  funcionarioId: string;
  modulo: ModuloHistorico;
  acao: string;
}
