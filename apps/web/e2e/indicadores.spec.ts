import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { emailDe, entrar } from "./entrar";
import { semAreaDoZetele } from "./sem-zetele";

test.beforeEach(({ page }) => semAreaDoZetele(page));

const BLOCOS = ["Agenda", "Frota", "Espaços", "Contas", "Atividades"];

async function semViolacoesSerias(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serias = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias, JSON.stringify(serias.map((v) => ({ id: v.id, nos: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
}

/** Entra com o usuário de demonstração do funcionário (login real, ADR 0035). */
async function entrarComo(page: Page, nome: string) {
  await entrar(page, emailDe(nome));
}

async function abrirIndicadores(page: Page) {
  await page.getByRole("link", { name: "Indicadores", exact: true }).click();
  await expect(page).toHaveURL(/\/sistema\/indicadores$/);
  for (const nome of BLOCOS) await expect(page.getByRole("region", { name: nome })).toBeVisible();
}

test("Marcos vê a equipe toda, filtra por funcionário e chega ao relatório do bloco", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarComo(page, "Marcos Oliveira");
  await abrirIndicadores(page);
  await expect(page.getByText("Toda a equipe", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Frota" }).locator('[data-testid="grafico"] svg').first()).toBeAttached();
  await expect(page.getByRole("region", { name: "Atividades" }).getByRole("heading", { name: "Horas por funcionário" })).toBeVisible();
  await semViolacoesSerias(page);

  await page.getByLabel("Funcionário").selectOption({ label: "Ana Ribeiro" });
  await expect(page.getByText("Números de Ana Ribeiro")).toBeVisible();
  await page.getByRole("region", { name: "Atividades" }).getByText("Ver tabela").first().click();
  await expect(page.getByRole("region", { name: "Atividades" }).getByRole("table", { name: "Horas por tipo" })).toBeVisible();

  await page.getByRole("region", { name: "Atividades" }).getByRole("link", { name: "Relatório de atividades" }).click();
  await expect(page.getByRole("heading", { name: "Atividades da equipe" })).toBeVisible();
});

test("Carla vê os próprios números, sem a equipe, em claro e escuro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarComo(page, "Carla Mendes");
  await abrirIndicadores(page);
  await expect(page.getByText("Seus números", { exact: true })).toBeVisible();
  await expect(page.getByText("Toda a equipe")).toHaveCount(0);
  await expect(page.getByLabel("Funcionário")).toHaveCount(0);
  await semViolacoesSerias(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await semViolacoesSerias(page);
});

test("com 8 itens, o cabeçalho logado cabe numa linha e deixa folga entre marca, menu e ações (1024 a 1440 px)", async ({ page }) => {
  await entrarComo(page, "Carla Mendes");
  await page.goto("/sistema/indicadores");
  await expect(page.getByRole("navigation", { name: "Seções do sistema" }).getByRole("link")).toHaveCount(8);
  // com a fonte de reserva (antes da Poppins carregar) o menu sai mais largo: mede com a fonte do site
  await page.evaluate(() => document.fonts.ready);
  for (const largura of [1024, 1040, 1072, 1100, 1120, 1152, 1200, 1280, 1366, 1400, 1440]) {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.waitForTimeout(50);
    const m = await page.evaluate(() => {
      const caixa = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const marca = caixa('header a[aria-label^="FAPERON"]');
      const menu = caixa('header nav[aria-label="Seções do sistema"] ul');
      const acoes = [...document.querySelectorAll("header button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
      const linhas = new Set([...document.querySelectorAll('header nav[aria-label="Seções do sistema"] a')].map((a) => Math.round(a.getBoundingClientRect().top)));
      return {
        excesso: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        linhas: linhas.size,
        antes: menu.left - marca.right,
        depois: Math.min(...acoes.map((r) => r.left)) - menu.right,
        direita: Math.max(...acoes.map((r) => r.right)),
      };
    });
    expect(m.linhas, `${largura}px: menu numa linha`).toBe(1);
    expect(m.excesso, `${largura}px: sem rolagem horizontal`).toBeLessThanOrEqual(1);
    expect(m.antes, `${largura}px: folga entre a marca e o menu`).toBeGreaterThanOrEqual(30);
    expect(m.depois, `${largura}px: folga entre o menu e as ações`).toBeGreaterThanOrEqual(30);
    expect(m.direita, `${largura}px: o último controle longe da borda`).toBeLessThanOrEqual(largura - 8);
  }
});
