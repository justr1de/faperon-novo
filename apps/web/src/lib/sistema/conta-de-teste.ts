/** Só para os testes (Vitest): simula quem está logado sem servidor (ADR 0035).
 *  `entrarComo` deixa a conta lembrada na página, como logo depois do login; o SistemaProvider abre
 *  sem chamar a API. `semConta` simula a sessão ausente (`/auth/eu` responde 401). */
import { vi } from "vitest";
import { FUNCIONARIOS } from "@/content/sistema/funcionarios";
import { esquecerConta, lembrarConta, type PerfilDaConta } from "./conta";

export function perfilDe(codigo: string, extra: Partial<PerfilDaConta> = {}): PerfilDaConta {
  const f = FUNCIONARIOS.find((p) => p.id === codigo);
  if (!f) throw new Error(`funcionário de demonstração desconhecido: ${codigo}`);
  return {
    codigo: f.id,
    nome: f.nome,
    email: `${f.id}@exemplo.faperon.br`,
    area: f.area,
    telefone: "",
    administrador: f.administrador ?? false,
    coordenador: f.coordenador,
    gestor_frota: f.gestorFrota,
    gestor_espacos: f.gestorEspacos,
    gestor_contas: f.gestorContas,
    demonstracao: true,
    precisa_trocar_senha: false,
    ...extra,
  };
}

export function entrarComo(codigo: string, extra: Partial<PerfilDaConta> = {}): PerfilDaConta {
  const perfil = perfilDe(codigo, extra);
  lembrarConta(perfil, extra.precisa_trocar_senha ? null : FUNCIONARIOS);
  return perfil;
}

export function semConta(): void {
  esquecerConta();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ erro: "As credenciais de autenticação não foram fornecidas.", campos: {} }, { status: 401 })),
  );
}
