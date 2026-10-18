/** Conta de quem usa o sistema (ADR 0035): login, sessão e equipe vêm da API, não do navegador.
 *  A sessão é o cookie HttpOnly `sessionid` do Django; o front só lê o `csrftoken` para mandar no
 *  cabeçalho `X-CSRFToken` dos POST e PATCH. */
import { API_BASE } from "@/lib/api";
import type { Funcionario } from "./tipos";

export interface PapeisDaConta {
  administrador: boolean;
  coordenador: boolean;
  gestor_frota: boolean;
  gestor_espacos: boolean;
  gestor_contas: boolean;
}

/** Colega na equipe (`GET /usuarios/equipe`): sem e-mail nem telefone. */
export interface MembroDaEquipe extends PapeisDaConta {
  codigo: string;
  nome: string;
  area: string;
}

/** Quem está logado (`GET /auth/eu` e resposta do login). */
export interface PerfilDaConta extends MembroDaEquipe {
  email: string;
  telefone: string;
  demonstracao: boolean;
  precisa_trocar_senha: boolean;
}

/** Linha da tela Usuários (só administrador). */
export interface UsuarioDaAdministracao extends PerfilDaConta {
  ativo: boolean;
  ultimo_acesso: string | null;
  criado_em: string;
}

export type DadosDoUsuario = Partial<PapeisDaConta> & { nome: string; email: string; area: string; telefone?: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; status: number; erro: string; campos: Record<string, string> };

export const AREAS = ["Administrativo", "Comunicação", "Presidência", "Sindical", "Técnica"] as const;

export const ROTULO_PAPEL: Record<keyof PapeisDaConta, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  gestor_frota: "Gestor da frota",
  gestor_espacos: "Gestor dos espaços",
  gestor_contas: "Gestor das contas",
};

export function paraFuncionario(p: MembroDaEquipe): Funcionario {
  return {
    id: p.codigo,
    nome: p.nome,
    area: p.area,
    administrador: p.administrador,
    coordenador: p.coordenador,
    gestorFrota: p.gestor_frota,
    gestorEspacos: p.gestor_espacos,
    gestorContas: p.gestor_contas,
  };
}

// ---------- CSRF ----------

export function lerCookieCsrf(): string | null {
  if (typeof document === "undefined") return null;
  for (const item of document.cookie.split(";")) {
    const [nome, ...resto] = item.trim().split("=");
    if (nome === "csrftoken") return decodeURIComponent(resto.join("="));
  }
  return null;
}

/** Para quem chama a API por conta própria (Zétele e agendamento por voz). */
export function cabecalhoCsrf(): Record<string, string> {
  const token = lerCookieCsrf();
  return token ? { "X-CSRFToken": token } : {};
}

async function tokenCsrf(): Promise<string> {
  const doCookie = lerCookieCsrf();
  if (doCookie) return doCookie;
  // primeiro acesso: o Django grava o cookie e devolve o mesmo token no corpo
  const r = await fetch(`${API_BASE}/auth/csrf`, { credentials: "same-origin", cache: "no-store" });
  const { csrf } = ((await r.json().catch(() => ({}))) ?? {}) as { csrf?: string };
  // sem token, o Django recusa com 403 e a tela mostra o erro
  return lerCookieCsrf() ?? csrf ?? "";
}

// ---------- chamadas ----------

const SEM_CONEXAO = "Sem conexão com o servidor. Tente de novo.";

async function chamar<T>(caminho: string, metodo: "GET" | "POST" | "PATCH" = "GET", corpo?: unknown): Promise<Resultado<T>> {
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (corpo !== undefined) headers["content-type"] = "application/json";
    if (metodo !== "GET") headers["X-CSRFToken"] = await tokenCsrf();
    const r = await fetch(`${API_BASE}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: "same-origin",
      cache: "no-store",
    });
    if (r.status === 204) return { ok: true, dados: undefined as T };
    const dados = (await r.json().catch(() => null)) as (T & { erro?: string; campos?: Record<string, string> }) | null;
    if (r.ok && dados !== null) return { ok: true, dados };
    return { ok: false, status: r.status, erro: dados?.erro ?? "Não foi possível concluir agora. Tente de novo.", campos: dados?.campos ?? {} };
  } catch {
    return { ok: false, status: 0, erro: SEM_CONEXAO, campos: {} };
  }
}

export const conta = {
  entrar: (email: string, senha: string) => chamar<PerfilDaConta>("/auth/entrar", "POST", { email, senha }),
  entrarComGoogle: (credential: string) => chamar<PerfilDaConta>("/auth/google", "POST", { credential }),
  sair: () => chamar<undefined>("/auth/sair", "POST"),
  eu: () => chamar<PerfilDaConta>("/auth/eu"),
  trocarSenha: (senhaAtual: string, senhaNova: string) =>
    chamar<PerfilDaConta>("/auth/trocar-senha", "POST", { senha_atual: senhaAtual, senha_nova: senhaNova }),
  equipe: () => chamar<MembroDaEquipe[]>("/usuarios/equipe"),
};

export const administracao = {
  listar: () => chamar<UsuarioDaAdministracao[]>("/usuarios"),
  criar: (dados: DadosDoUsuario) => chamar<{ usuario: UsuarioDaAdministracao; senha_temporaria: string }>("/usuarios", "POST", dados),
  editar: (codigo: string, dados: Partial<DadosDoUsuario>) =>
    chamar<UsuarioDaAdministracao>(`/usuarios/${encodeURIComponent(codigo)}`, "PATCH", dados),
  desativar: (codigo: string) => chamar<UsuarioDaAdministracao>(`/usuarios/${encodeURIComponent(codigo)}/desativar`, "POST"),
  reativar: (codigo: string) => chamar<UsuarioDaAdministracao>(`/usuarios/${encodeURIComponent(codigo)}/reativar`, "POST"),
  senhaTemporaria: (codigo: string) =>
    chamar<{ senha_temporaria: string }>(`/usuarios/${encodeURIComponent(codigo)}/senha-temporaria`, "POST"),
};

// ---------- conta lembrada (só em memória) ----------

/** Quem acabou de entrar, para o sistema abrir sem esperar outro `/auth/eu`. Fica só na memória da
 *  página: ao recarregar, a identidade volta a vir do servidor. */
interface ContaLembrada {
  perfil: PerfilDaConta;
  equipe: Funcionario[] | null;
}
let lembrada: ContaLembrada | null = null;

export function lembrarConta(perfil: PerfilDaConta, equipe: Funcionario[] | null = null): void {
  lembrada = { perfil, equipe };
}

export function contaLembrada(): ContaLembrada | null {
  return lembrada;
}

export function esquecerConta(): void {
  lembrada = null;
}

/** "Sair" do cabeçalho e da barra: encerra a sessão no servidor e esquece a conta na página. */
export async function sairDaConta(): Promise<void> {
  esquecerConta();
  await conta.sair();
}
