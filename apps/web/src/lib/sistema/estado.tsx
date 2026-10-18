"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  agendaDeExemplo,
  atividadesDeExemplo,
  despesasDeExemplo,
  eventosInstitucionais,
  frotaDeExemplo,
  historicoDeExemplo,
  pedidosDeExemplo,
} from "@/content/sistema/exemplo";
import { apagarTudo, gravar, ler } from "./armazenamento";
import { anotar } from "./atividades";
import { conta, contaLembrada, lembrarConta, paraFuncionario, sairDaConta, type PerfilDaConta } from "./conta";
import { agoraISO, hojeISO } from "./datas";
import { limparTags, removerTag, sanearTags, tagsDeExemplo } from "./tags";
import type { Atividade, Despesa, EstadoFrota, Evento, Funcionario, ModuloHistorico, PedidoEspaco, RegistroHistorico, Tag } from "./tipos";

/** Mudança com a descrição do que foi feito: entra no histórico (registro automático de atividades). */
type Atualizar<T> = (muda: (atual: T) => T, acao?: string) => void;

/** Situação da conta: conferindo no servidor, logada, fora (401) ou sem resposta do servidor. */
export type SituacaoDaConta = "conferindo" | "dentro" | "fora" | "erro";

interface ContextoSistema {
  /** Falso até ler o storage e conferir a conta (no servidor e no primeiro render): evita descompasso de hidratação. */
  pronto: boolean;
  hoje: string;
  /** Há sessão no servidor (ADR 0035). */
  acesso: boolean;
  situacao: SituacaoDaConta;
  /** Quem está logado, vindo do `/auth/eu` (id = código do perfil). */
  funcionario: Funcionario | null;
  /** E-mail, telefone e demais dados da conta de quem está logado. */
  perfil: PerfilDaConta | null;
  /** Colegas ativos (`/usuarios/equipe`), no lugar da lista fixa do protótipo. */
  equipe: Funcionario[];
  nomeDe: (id: string) => string;
  /** Com senha temporária, o sistema pede a troca antes de tudo. */
  precisaTrocarSenha: boolean;
  /** Depois da troca de senha: atualiza o perfil e carrega a equipe. */
  senhaTrocada: (perfil: PerfilDaConta) => void;
  /** Encerra a sessão no servidor (cabeçalho e barra). */
  sair: () => Promise<void>;
  /** Confere a conta de novo (depois de uma falha de conexão). */
  conferirDeNovo: () => void;
  /** Eventos pessoais do funcionário logado. */
  eventos: Evento[];
  institucionais: Evento[];
  salvarEvento: (evento: Evento) => void;
  excluirEvento: (id: string) => void;
  frota: EstadoFrota;
  atualizarFrota: Atualizar<EstadoFrota>;
  pedidos: PedidoEspaco[];
  atualizarPedidos: Atualizar<PedidoEspaco[]>;
  despesas: Despesa[];
  atualizarDespesas: Atualizar<Despesa[]>;
  atividades: Atividade[];
  atualizarAtividades: Atualizar<Atividade[]>;
  /** Tags compartilhadas por todos; só quem gere (`podeGerirTags`) cria, renomeia e apaga. */
  tags: Tag[];
  atualizarTags: Atualizar<Tag[]>;
  /** Apaga a tag e a tira de todos os itens, inclusive das agendas dos colegas guardadas neste navegador. */
  apagarTag: (id: string) => void;
  historico: RegistroHistorico[];
  registrar: (modulo: ModuloHistorico, acao: string) => void;
  restaurar: () => void;
}

const Contexto = createContext<ContextoSistema | null>(null);

const FROTA_VAZIA: EstadoFrota = { veiculos: [], reservas: [], abastecimentos: [], manutencoes: [] };

export function SistemaProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [hoje] = useState(hojeISO);
  const [situacao, setSituacao] = useState<SituacaoDaConta>("conferindo");
  const [perfil, setPerfil] = useState<PerfilDaConta | null>(null);
  const [equipe, setEquipe] = useState<Funcionario[]>([]);
  const [tentativa, setTentativa] = useState(0);
  const funcionario = useMemo(() => (perfil ? paraFuncionario(perfil) : null), [perfil]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [frota, setFrota] = useState<EstadoFrota>(FROTA_VAZIA);
  const [pedidos, setPedidos] = useState<PedidoEspaco[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [historico, setHistorico] = useState<RegistroHistorico[]>([]);

  /** Lê do navegador os dados dos módulos (ADR 0031); a agenda é a de quem está logado. */
  const carregar = useCallback((atual: Funcionario | null) => {
    // as tags vêm primeiro: os itens perdem, já na leitura, os ids de tags que não existem mais
    const lidas = sanearTags(ler<unknown[]>("tags", tagsDeExemplo()));
    setTags(lidas);
    setEventos(atual ? limparTags(ler(`agenda:${atual.id}`, agendaDeExemplo(atual.id, hoje)), lidas) : []);
    const frotaLida = ler("frota", frotaDeExemplo(hoje));
    setFrota({ ...frotaLida, reservas: limparTags(frotaLida.reservas, lidas) });
    setPedidos(limparTags(ler("espacos", pedidosDeExemplo(hoje)), lidas));
    setDespesas(limparTags(ler("contas", despesasDeExemplo(hoje)), lidas));
    setAtividades(limparTags(ler("atividades", atividadesDeExemplo(hoje)), lidas));
    setHistorico(ler("historico", historicoDeExemplo(hoje)));
    setPronto(true);
  }, [hoje]);

  const buscarEquipe = useCallback(async (dono: PerfilDaConta) => {
    const r = await conta.equipe();
    if (!r.ok) return;
    const lista = r.dados.map(paraFuncionario);
    lembrarConta(dono, lista);
    setEquipe(lista);
  }, []);

  // quem está logado vem do servidor; logo depois do login, a página já sabe e não pergunta de novo
  useEffect(() => {
    let vivo = true;
    const entrar = (dono: PerfilDaConta, lista: Funcionario[] | null) => {
      setPerfil(dono);
      setSituacao("dentro");
      setEquipe(lista ?? [paraFuncionario(dono)]);
      carregar(paraFuncionario(dono));
      if (!lista && !dono.precisa_trocar_senha) void buscarEquipe(dono);
    };
    const lembrada = contaLembrada();
    if (lembrada) {
      entrar(lembrada.perfil, lembrada.equipe);
      return;
    }
    void conta.eu().then((r) => {
      if (!vivo) return;
      if (r.ok) {
        lembrarConta(r.dados);
        return entrar(r.dados, null);
      }
      setPerfil(null);
      setSituacao(r.status === 0 || r.status >= 500 ? "erro" : "fora");
      carregar(null);
    });
    return () => {
      vivo = false;
    };
  }, [carregar, buscarEquipe, tentativa]);

  const valor = useMemo<ContextoSistema>(() => {
    const registrar = (modulo: ModuloHistorico, acao: string) => {
      if (!funcionario) return;
      setHistorico((atual) => {
        const novo = anotar(atual, { id: novoId("historico"), quando: agoraISO(), funcionarioId: funcionario.id, modulo, acao });
        gravar("historico", novo);
        return novo;
      });
    };
    /** Grava a coleção (só com ids de tags que existem) e, se houver descrição, anota no histórico. */
    function persistente<T>(chave: string, modulo: ModuloHistorico, set: (f: (atual: T) => T) => void, limpar: (v: T) => T = (v) => v): Atualizar<T> {
      return (muda, acao) => {
        set((atual) => {
          const nova = limpar(muda(atual));
          gravar(chave, nova);
          return nova;
        });
        if (acao) registrar(modulo, acao);
      };
    }
    const salvarEventos = (lista: Evento[]) => {
      const limpa = limparTags(lista, tags);
      setEventos(limpa);
      if (funcionario) gravar(`agenda:${funcionario.id}`, limpa);
    };
    const semTagsApagadas = <I extends { tags?: string[] }>(l: I[]) => limparTags(l, tags);
    const atualizarFrota = persistente("frota", "frota", setFrota, (f: EstadoFrota) => ({ ...f, reservas: semTagsApagadas(f.reservas) }));
    const atualizarPedidos = persistente("espacos", "espacos", setPedidos, semTagsApagadas<PedidoEspaco>);
    const atualizarDespesas = persistente("contas", "contas", setDespesas, semTagsApagadas<Despesa>);
    const atualizarAtividades = persistente("atividades", "atividades", setAtividades, semTagsApagadas<Atividade>);
    const atualizarTags = persistente("tags", "tags", setTags);
    const nomes = new Map(equipe.map((f) => [f.id, f.nome]));
    return {
      pronto,
      hoje,
      acesso: situacao === "dentro",
      situacao,
      funcionario,
      perfil,
      equipe,
      nomeDe: (id) => nomes.get(id) ?? id,
      precisaTrocarSenha: perfil?.precisa_trocar_senha ?? false,
      senhaTrocada: (novo) => {
        lembrarConta(novo);
        setPerfil(novo);
        void buscarEquipe(novo);
      },
      sair: async () => {
        await sairDaConta();
        setPerfil(null);
        setEquipe([]);
        setSituacao("fora");
      },
      conferirDeNovo: () => {
        setSituacao("conferindo");
        setTentativa((n) => n + 1);
      },
      eventos,
      institucionais: eventosInstitucionais(hoje),
      salvarEvento: (evento) => {
        const existia = eventos.some((e) => e.id === evento.id);
        salvarEventos([...eventos.filter((e) => e.id !== evento.id), evento]);
        registrar("agenda", `${existia ? "Editou" : "Criou"} o evento "${evento.titulo}"`);
      },
      excluirEvento: (id) => {
        const evento = eventos.find((e) => e.id === id);
        salvarEventos(eventos.filter((e) => e.id !== id));
        if (evento) registrar("agenda", `Excluiu o evento "${evento.titulo}"`);
      },
      frota,
      atualizarFrota,
      pedidos,
      atualizarPedidos,
      despesas,
      atualizarDespesas,
      atividades,
      atualizarAtividades,
      tags,
      atualizarTags,
      apagarTag: (id) => {
        const tag = tags.find((t) => t.id === id);
        if (!tag) return;
        salvarEventos(removerTag(eventos, id));
        // agendas dos colegas: só as que já foram gravadas (as de exemplo não têm a tag apagada salva)
        for (const f of equipe) {
          if (f.id === funcionario?.id) continue;
          const salva = ler<Evento[] | null>(`agenda:${f.id}`, null);
          if (Array.isArray(salva)) gravar(`agenda:${f.id}`, removerTag(salva, id));
        }
        atualizarFrota((fr) => ({ ...fr, reservas: removerTag(fr.reservas, id) }));
        atualizarPedidos((l) => removerTag(l, id));
        atualizarDespesas((l) => removerTag(l, id));
        atualizarAtividades((l) => removerTag(l, id));
        atualizarTags((l) => l.filter((t) => t.id !== id), `Apagou a tag "${tag.nome}"`);
      },
      historico,
      registrar,
      restaurar: () => {
        apagarTudo();
        carregar(funcionario);
      },
    };
  }, [pronto, hoje, situacao, perfil, equipe, funcionario, eventos, frota, pedidos, despesas, atividades, tags, historico, carregar, buscarEquipe]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSistema(): ContextoSistema {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSistema fora do SistemaProvider");
  return ctx;
}

export function novoId(prefixo: string): string {
  const aleatorio = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
  return `${prefixo}-${aleatorio}`;
}
