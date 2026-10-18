import { expect, type Page } from "@playwright/test";

/** Senha dos usuários de demonstração (ADR 0035). Contra o mock do e2e é "demonstracao-local"; contra o
 *  compose, use a mesma DEMO_SENHA do `manage.py carregar_usuarios_demo` em E2E_DEMO_SENHA. */
export const DEMO_SENHA = process.env.E2E_DEMO_SENHA ?? "demonstracao-local";

/** E-mail de demonstração a partir do primeiro nome: "Carla Mendes" -> carla@exemplo.faperon.br. */
export function emailDe(nome: string): string {
  const primeiro = nome.split(" ")[0]!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return `${primeiro}@exemplo.faperon.br`;
}

/** Entra pelo /login com um usuário de demonstração e espera o Início do sistema. */
export async function entrar(page: Page, email: string, senha = DEMO_SENHA) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/sistema$/);
}
