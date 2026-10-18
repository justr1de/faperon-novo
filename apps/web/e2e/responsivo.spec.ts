import { expect, test } from "@playwright/test";

test("celular: menu abre, sem rolagem horizontal, painel usável", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("navigation", { name: "Principal (móvel)" })).toBeVisible();
  await page.getByRole("navigation", { name: "Principal (móvel)" }).getByRole("link", { name: "Central de Inteligência" }).click();
  await expect(page).toHaveURL(/central-de-inteligencia/);

  await page.goto("/painel?produto=soja-em-grao&indicador=quantidade-produzida&inicio=2015&fim=2024&aba=serie");
  await expect(page.getByTestId("grafico").locator("svg")).toBeVisible();
  const larguraPagina = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(larguraPagina).toBeLessThanOrEqual(1);
});

for (const rota of ["/sobre", "/informativos-tecnicos", "/noticias", "/fale-conosco", "/central-de-inteligencia/observatorio", "/credito-rural"]) {
  test(`celular: ${rota} não tem rolagem horizontal`, async ({ page }) => {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (rota.endsWith("/observatorio")) {
      // espera os quatro blocos e o mapa desenhados antes de medir a largura
      for (const nome of ["O tamanho e a composição do agro", "Por que a produção cresceu", "Onde a produção acontece", "Rebanhos e leite"]) {
        await expect(page.getByRole("region", { name: nome }).getByTestId("manchete")).toBeVisible();
      }
      await expect(page.getByRole("region", { name: "Onde a produção acontece" }).locator("svg path").first()).toBeAttached();
    }
    if (rota === "/credito-rural") {
      await expect(page.getByTestId("manchete")).toBeVisible();
      await expect(page.getByRole("region", { name: "Onde o crédito foi contratado" }).locator("svg path").first()).toBeAttached();
    }
    const excesso = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(excesso).toBeLessThanOrEqual(1);
  });
}

test("no celular, o balão do Zétele mostra o campo e o botão de fechar", async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("zetele-saudou", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Falar com o Zétele, assistente do site" }).click();
  await expect(page.getByRole("button", { name: "Fechar o Zétele" })).toBeInViewport();
  await expect(page.getByLabel("Sua pergunta")).toBeInViewport();
});

test("celular: o protótipo do sistema não tem rolagem horizontal", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("user@faperon.br");
  await page.getByLabel("Senha", { exact: true }).fill("Senha@123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Entrar como Ana Ribeiro" }).click();
  for (const rota of ["/sistema", "/sistema/agenda", "/sistema/frotas", "/sistema/espacos"]) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const excesso = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(excesso, rota).toBeLessThanOrEqual(1);
  }
});
