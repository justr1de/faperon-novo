import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { semAreaDoZetele } from "./sem-zetele";

test.beforeEach(({ page }) => semAreaDoZetele(page));

const SECOES = ["Como o crédito evoluiu", "Onde o crédito foi contratado", "O que o crédito financiou"];

// Números, as três seções com conteúdo e o mapa desenhado (svg com caminhos): só então a página está estável.
async function aguardarPaginaCompleta(page: Page) {
  await expect(page.getByTestId("manchete")).toBeVisible();
  for (const nome of SECOES) await expect(page.getByRole("region", { name: nome }).getByRole("button", { name: "Ver como tabela" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Onde o crédito foi contratado" }).locator("svg path").first()).toBeAttached();
}

async function semViolacoesSerias(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serias = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias, JSON.stringify(serias.map((v) => ({ id: v.id, nos: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
}

test("Central → Crédito rural → filtro no link → tabela dos 52 municípios", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/central-de-inteligencia");
  await page.getByRole("link", { name: /Abrir o painel de crédito rural/ }).click();
  await expect(page).toHaveURL(/\/credito-rural$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crédito rural e Pronaf em Rondônia.");
  await aguardarPaginaCompleta(page);
  await expect(page.getByText(/2026 tem dados de janeiro a setembro/)).toBeVisible();
  await expect(page.getByTestId("cartao-credito")).toHaveCount(4);

  await page.getByRole("combobox", { name: "Programa", exact: true }).selectOption("pronaf");
  await expect(page).toHaveURL(/programa=pronaf/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Programa", exact: true })).toHaveValue("pronaf");

  const municipios = page.getByRole("region", { name: "Onde o crédito foi contratado" });
  await aguardarPaginaCompleta(page);
  await municipios.getByRole("button", { name: "Ver como tabela" }).click();
  const tabela = municipios.getByRole("table", { name: "Crédito rural por município" });
  await expect(tabela.getByRole("row")).toHaveCount(53); // cabeçalho + 52
  await expect(page.getByRole("complementary", { name: "Fonte e atualização" })).toContainText("ODbL");
});

for (const tema of ["claro", "escuro"]) {
  test(`Crédito rural sem violações sérias de acessibilidade (axe), tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("faperon-tema", t), tema);
    await page.goto("/credito-rural?municipio=ji-parana");
    await expect(page.locator("html")).toHaveAttribute("data-theme", tema === "escuro" ? "dark" : "light");
    await aguardarPaginaCompleta(page);
    await expect(page.getByText(/Ji-Paraná está em \d+º lugar/)).toBeVisible();
    await semViolacoesSerias(page);
  });
}
