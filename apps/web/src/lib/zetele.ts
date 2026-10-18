import { areaDaPagina, type PaginaComZetele } from "@/content/zetele";
import { API_BASE } from "./api";
import { cabecalhoCsrf } from "./sistema/conta";

export interface FonteZetele {
  rotulo: string;
  url_fonte: string;
  url_interna: string | null;
  atualizado_em: string | null;
}

export interface RespostaZetele {
  status: "respondida" | "recusada" | "erro";
  texto: string;
  fontes: FonteZetele[];
  sugestoes: string[];
}

/** Só no Zétele do sistema (ADR 0034): o que a voz pode fazer agora. */
export interface EstadoVoz {
  ouvir: boolean;
  falar: boolean;
}

export interface EstadoZetele {
  disponivel: boolean;
  motivo: string | null;
  voz?: EstadoVoz;
}

export interface MensagemHistorico {
  papel: "visitante" | "zetele";
  texto: string;
}

export type ResultadoPergunta =
  | { tipo: "ok"; resposta: RespostaZetele }
  | { tipo: "espera"; segundos: number }
  | { tipo: "indisponivel"; motivo: string }
  | { tipo: "falha" };

/** Cada área fala com o próprio Zétele no servidor (ADR 0032). */
export function baseDoZetele(pagina: string): string {
  return areaDaPagina(pagina) === "sistema" ? `${API_BASE}/sistema/zetele` : `${API_BASE}/zetele`;
}
const MAX_HISTORICO = 6;

export async function obterEstado(pagina: string = "/"): Promise<EstadoZetele> {
  try {
    const r = await fetch(`${baseDoZetele(pagina)}/estado`, { cache: "no-store" });
    if (!r.ok) return { disponivel: false, motivo: "indisponivel" };
    return (await r.json()) as EstadoZetele;
  } catch {
    return { disponivel: false, motivo: "indisponivel" };
  }
}

export async function perguntar(
  pergunta: string,
  historico: MensagemHistorico[],
  pagina: PaginaComZetele,
): Promise<ResultadoPergunta> {
  try {
    const r = await fetch(`${baseDoZetele(pagina)}/perguntar`, {
      method: "POST",
      // o Zétele do sistema exige a sessão (ADR 0035), e o Django confere o CSRF de quem está logado
      headers: { "content-type": "application/json", ...cabecalhoCsrf() },
      body: JSON.stringify({ pergunta, historico: historico.slice(-MAX_HISTORICO), pagina }),
    });
    if (r.ok) return { tipo: "ok", resposta: (await r.json()) as RespostaZetele };
    if (r.status === 429) return { tipo: "espera", segundos: Number.parseInt(r.headers.get("retry-after") ?? "", 10) || 30 };
    if (r.status === 503) {
      const corpo = (await r.json().catch(() => ({}))) as { motivo?: string };
      return { tipo: "indisponivel", motivo: corpo.motivo ?? "indisponivel" };
    }
    return { tipo: "falha" };
  } catch {
    return { tipo: "falha" };
  }
}

// ---------- voz do Zétele do sistema (ADR 0034) ----------

export type ErroDaVoz = { tipo: "espera"; segundos: number } | { tipo: "indisponivel"; motivo: string } | { tipo: "falha" };
export type ResultadoOuvir = { tipo: "ok"; texto: string } | { tipo: "nao_entendi" } | { tipo: "recusado" } | ErroDaVoz;
export type ResultadoFalar = { tipo: "ok"; audio: Blob } | ErroDaVoz;

const EXTENSOES: Record<string, string> = {
  "audio/mp4": "mp4",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};

/** Nome do arquivo enviado ao /ouvir: o servidor confere a extensão e o tipo. */
export function nomeDoAudio(tipo: string): string {
  return `pergunta.${EXTENSOES[tipo.split(";")[0]!.trim().toLowerCase()] ?? "webm"}`;
}

async function erroDaVoz(r: Response): Promise<ErroDaVoz> {
  if (r.status === 429) return { tipo: "espera", segundos: Number.parseInt(r.headers.get("retry-after") ?? "", 10) || 30 };
  if (r.status === 503) {
    const corpo = (await r.json().catch(() => ({}))) as { motivo?: string };
    return { tipo: "indisponivel", motivo: corpo.motivo ?? "indisponivel" };
  }
  return { tipo: "falha" };
}

/** Manda a gravação para virar texto. Não gasta o limite do dia: a pergunta conta no /perguntar. */
export async function ouvirAudio(audio: Blob, pagina: string): Promise<ResultadoOuvir> {
  try {
    const corpo = new FormData();
    corpo.append("audio", audio, nomeDoAudio(audio.type));
    const r = await fetch(`${baseDoZetele(pagina)}/ouvir`, { method: "POST", body: corpo, headers: cabecalhoCsrf() });
    if (r.ok) {
      const { texto } = (await r.json()) as { texto?: string };
      return texto ? { tipo: "ok", texto } : { tipo: "nao_entendi" };
    }
    if (r.status === 422) return { tipo: "nao_entendi" };
    if (r.status === 400 || r.status === 413) return { tipo: "recusado" };
    return await erroDaVoz(r);
  } catch {
    return { tipo: "falha" };
  }
}

/** Pede a resposta em áudio (WAV). Cada pedido conta no limite do dia do sistema. */
export async function falarTexto(texto: string, pagina: string): Promise<ResultadoFalar> {
  try {
    const r = await fetch(`${baseDoZetele(pagina)}/falar`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cabecalhoCsrf() },
      body: JSON.stringify({ texto }),
    });
    if (r.ok) return { tipo: "ok", audio: await r.blob() };
    return await erroDaVoz(r);
  } catch {
    return { tipo: "falha" };
  }
}

export type ParteTexto = { tipo: "texto"; texto: string } | { tipo: "link"; texto: string; href: string };

const RE_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Rota do próprio site. "//host" e "/\\host" são outro domínio para o navegador; barra invertida,
 *  espaço e caractere de controle nunca entram. */
export function ehRotaInterna(href: string): boolean {
  return /^\/(?![/\\])[^\\\s\x00-\x1f]*$/.test(href);
}

/** O servidor já conferiu os links; aqui só se transforma Markdown em partes, aceitando rota interna ou https. */
export function partesDoTexto(texto: string): ParteTexto[] {
  const partes: ParteTexto[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(RE_LINK)) {
    const href = m[2]!;
    if (!ehRotaInterna(href) && !href.startsWith("https://")) continue;
    if (m.index! > ultimo) partes.push({ tipo: "texto", texto: texto.slice(ultimo, m.index) });
    partes.push({ tipo: "link", texto: m[1]!, href });
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return partes;
}
