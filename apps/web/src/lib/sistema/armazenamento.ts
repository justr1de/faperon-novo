/** Storage do protótipo: os dados dos módulos ficam no navegador, com prefixo `sistema:` (ADR 0031).
 *  Quem está logado não fica aqui: vem da sessão no servidor (ADR 0035).
 *  Navegador que bloqueia storage (aba privada, política) não quebra: cai para memória da página. */

const PREFIXO = "sistema:";
const memoria = new Map<string, string>();
// chaves cuja última gravação não coube no storage (cota cheia): a versão certa está na memória
const soNaMemoria = new Set<string>();

/** Evento disparado quando o navegador fica sem espaço para o protótipo (a barra avisa a pessoa). */
export const ARMAZENAMENTO_CHEIO = "sistema:armazenamento-cheio";

function local(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A memória só vale quando o storage não existe ou lança erro; com storage funcionando, ele manda. */
function lerBruto(storage: Storage | null, chave: string): string | null {
  if (soNaMemoria.has(chave)) return memoria.get(chave) ?? null;
  if (storage) {
    try {
      return storage.getItem(chave);
    } catch {
      // storage bloqueado: cai para a memória
    }
  }
  return memoria.get(chave) ?? null;
}

function gravarBruto(storage: Storage | null, chave: string, valor: string | null): void {
  if (storage) {
    try {
      if (valor == null) storage.removeItem(chave);
      else storage.setItem(chave, valor);
      soNaMemoria.delete(chave);
      return;
    } catch {
      // storage bloqueado ou cheio: guarda em memória e passa a ler dela (senão voltaria a versão velha)
      soNaMemoria.add(chave);
      if (typeof window !== "undefined") window.dispatchEvent(new Event(ARMAZENAMENTO_CHEIO));
    }
  }
  if (valor == null) memoria.delete(chave);
  else memoria.set(chave, valor);
}

/** O dado lido tem o formato do padrão? (lista é lista; objeto tem as listas que o padrão tem) */
function formatoCompativel(valor: unknown, padrao: unknown): boolean {
  if (padrao == null) return true;
  if (Array.isArray(padrao)) return Array.isArray(valor);
  if (typeof padrao === "object") {
    if (valor == null || typeof valor !== "object" || Array.isArray(valor)) return false;
    return Object.entries(padrao).every(([k, v]) => !Array.isArray(v) || Array.isArray((valor as Record<string, unknown>)[k]));
  }
  return typeof valor === typeof padrao;
}

/** JSON inválido ou de formato errado (editado à mão, versão antiga) cai no padrão em vez de quebrar a tela. */
export function ler<T>(chave: string, padrao: T): T {
  const bruto = lerBruto(local(), PREFIXO + chave);
  if (bruto == null) return padrao;
  try {
    const valor: unknown = JSON.parse(bruto);
    return formatoCompativel(valor, padrao) ? (valor as T) : padrao;
  } catch {
    return padrao;
  }
}

export function gravar(chave: string, valor: unknown): void {
  gravarBruto(local(), PREFIXO + chave, JSON.stringify(valor));
}

/** "Restaurar dados de exemplo": apaga agenda, frota e o resto dos módulos (a sessão fica no servidor). */
export function apagarTudo(): void {
  memoria.clear();
  soNaMemoria.clear();
  const storage = local();
  try {
    if (!storage) return;
    const chaves: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const chave = storage.key(i);
      if (chave?.startsWith(PREFIXO)) chaves.push(chave);
    }
    for (const chave of chaves) storage.removeItem(chave);
  } catch {
    // nada a apagar fora da memória
  }
}
