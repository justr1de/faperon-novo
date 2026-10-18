import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { emailDe, entrar } from "./entrar";
import { semAreaDoZetele } from "./sem-zetele";

test.beforeEach(({ page }) => semAreaDoZetele(page));

async function semViolacoesSerias(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serias = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias, JSON.stringify(serias.map((v) => ({ id: v.id, nos: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
}

/** Entra com o usuário de demonstração (ADR 0035): e-mail e senha conferidos pela API. */
async function entrarComo(page: Page, nome: string) {
  await entrar(page, emailDe(nome));
  await expect(page.getByRole("heading", { name: `Olá, ${nome.split(" ")[0]}` })).toBeVisible();
}

/** "Sair" da barra do sistema (o cabeçalho tem outro). */
async function sair(page: Page) {
  await page.getByRole("button", { name: "Sair", exact: true }).last().click();
  await expect(page).toHaveURL(/\/login$/);
}

test("protótipo do sistema: agenda individual, reserva de veículo, frota e espaços", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acessar o sistema" })).toBeVisible();
  await semViolacoesSerias(page);
  await page.getByLabel("E-mail").fill("carla@exemplo.faperon.br");
  await page.getByLabel("Senha", { exact: true }).fill("errada-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();

  // Carla cria um evento e reserva um veículo; a reserva aparece na agenda dela
  await entrarComo(page, "Carla Mendes");
  await page.getByRole("link", { name: "Agenda", exact: true }).click();
  await page.getByRole("button", { name: "Novo evento", exact: true }).click();
  await page.getByLabel("Título").fill("Gravação com a TV");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("button", { name: /Editar Gravação com a TV/ })).toBeVisible();
  await semViolacoesSerias(page);

  await page.goto("/sistema/frotas?aba=reservas");
  await page.getByRole("button", { name: "Nova reserva" }).click();
  await page.getByLabel("Veículo").selectOption({ label: "Mitsubishi L200 (NDE-4821)" });
  await page.getByLabel("Destino").fill("Pimenta Bueno");
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page.getByText("Pimenta Bueno")).toBeVisible();
  await semViolacoesSerias(page);

  await page.goto("/sistema/agenda");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByRole("link", { name: /Viagem a Pimenta Bueno/ })).toBeVisible();

  // Marcos (gestor) vê outra agenda, registra manutenção e vê os custos
  // cada pessoa tem a própria conta: sai e entra o Marcos
  await sair(page);
  await entrarComo(page, "Marcos Oliveira");
  await page.goto("/sistema/agenda");
  await expect(page.getByText("Gravação com a TV")).toHaveCount(0);

  await page.goto("/sistema/frotas?aba=abastecimento");
  await page.getByLabel("Veículo").nth(1).selectOption({ label: "Toyota Hilux CD (QRB2F41)" });
  await page.getByLabel("Km", { exact: true }).fill("61300");
  await page.getByLabel("Valor (R$)").fill("320");
  await page.getByRole("button", { name: "Registrar manutenção" }).click();
  await expect(page.getByText("Manutenção registrada.")).toBeVisible();
  await page.getByRole("tab", { name: "Custos" }).click();
  await expect(page.getByRole("img", { name: /Custos mensais/ })).toBeVisible();

  // Espaços: a fila mostra conflito e o gestor não aprova o pedido que choca com um aprovado
  await page.goto("/sistema/espacos?aba=fila");
  await expect(page.getByText(/Conflito com Oficina de redes sociais/)).toBeVisible();
  await page.getByRole("button", { name: "Aprovar Treinamento de técnicos de campo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Já há um agendamento aprovado" })).toBeVisible();
  await page.getByRole("button", { name: "Aprovar Alinhamento com a oficina parceira" }).click();
  await expect(page.getByRole("button", { name: "Aprovar Alinhamento com a oficina parceira" })).toHaveCount(0);
  await semViolacoesSerias(page);
});

test("sem login, o sistema pede para entrar", async ({ page }) => {
  await page.goto("/sistema/frotas");
  await expect(page.getByRole("heading", { name: "Faça login para entrar no sistema" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para Acessar o sistema" })).toHaveAttribute("href", "/login");
});

test("contas, relatórios e agendamento por voz digitado; o Zétele está em todas as telas logadas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/sistema/interpretar", (rota) =>
    rota.fulfill({
      json: {
        tipo: "evento",
        campos: { titulo: "Reunião com o sindicato", data: "2026-10-20", inicio: "09:00", fim: "10:00", local: "", tipo: "reuniao", descricao: "" },
        faltando: [],
      },
    }),
  );
  await entrarComo(page, "Carla Mendes");
  for (const secao of ["Agenda", "Frotas", "Espaços", "Contas", "Atividades", "Relatórios"]) {
    await page.getByRole("link", { name: secao, exact: true }).click();
    await expect(page.getByRole("button", { name: "Falar com o Zétele, assistente do site" })).toBeAttached();
  }

  await page.getByRole("link", { name: "Contas", exact: true }).click();
  await page.getByRole("button", { name: "Nova despesa" }).click();
  await page.getByLabel("Descrição").fill("Pen drives para o evento");
  await page.getByLabel("Valor (R$)").fill("89,90");
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await expect(page.getByText("Pen drives para o evento")).toBeVisible();
  await semViolacoesSerias(page);

  await page.getByRole("link", { name: "Relatórios", exact: true }).click();
  await page.getByRole("button", { name: "Prestação de contas" }).click();
  await expect(page.getByRole("cell", { name: "Pen drives para o evento" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Baixar CSV/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^relatorio-contas-.*\.csv$/);
  await semViolacoesSerias(page);

  await page.getByRole("link", { name: "Agenda", exact: true }).click();
  await page.getByRole("button", { name: "Agendar por voz" }).click();
  const voz = page.getByRole("dialog", { name: "Agendar por voz" });
  await voz.getByRole("textbox").fill("reunião com o sindicato terça às nove");
  await voz.getByRole("button", { name: "Preencher formulário" }).click();
  const evento = page.getByRole("dialog", { name: "Novo evento" });
  await expect(evento.getByLabel("Título")).toHaveValue("Reunião com o sindicato");
  await expect(evento.getByText(/Preenchido por voz/)).toBeVisible();
});

test("tour guiado percorre todas as áreas com o elemento de cada passo destacado", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarComo(page, "Marcos Oliveira");
  await page.getByRole("button", { name: "Começar o tour" }).click();
  const { TOUR } = await import("../src/content/sistema/tour");
  for (const [i, passo] of TOUR.entries()) {
    const cartao = page.getByRole("dialog", { name: passo.titulo });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText(`passo ${i + 1} de ${TOUR.length}`);
    await expect(page).toHaveURL(new RegExp(passo.rota.replace("?", "\\?") + "$"));
    if (passo.alvo) await expect(page.locator(`[data-tour="${passo.alvo}"]`).first()).toBeAttached();
    if (i === 3) await semViolacoesSerias(page);
    await cartao.getByRole("button", { name: i === TOUR.length - 1 ? "Concluir o tour" : "Próximo", exact: true }).click();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Primeira vez por aqui?")).toHaveCount(0);
});

test("tela Usuários: só o administrador vê o acesso; gera senha temporária mostrada uma vez", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await entrarComo(page, "Ana Ribeiro");
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await sair(page);

  await entrarComo(page, "Marcos Oliveira");
  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/sistema\/usuarios$/);
  const tabela = page.getByRole("table", { name: "Usuários do sistema" });
  await expect(tabela.getByRole("row", { name: /Carla Mendes/ })).toContainText("carla@exemplo.faperon.br");
  await semViolacoesSerias(page);

  // o João não é usado nos outros testes: a senha dele pode mudar sem atrapalhar ninguém
  await page.getByRole("button", { name: "Gerar senha temporária para João Pereira" }).click();
  await page.getByRole("dialog", { name: "Gerar senha temporária para João Pereira?" }).getByRole("button", { name: "Gerar senha" }).click();
  const senha = page.getByRole("dialog", { name: "Senha temporária de João Pereira" });
  await expect(senha).toContainText("aparece só agora");
  await semViolacoesSerias(page);
  await senha.getByRole("button", { name: "Pronto" }).click();
  await expect(tabela.getByRole("row", { name: /João Pereira/ })).toContainText("Senha temporária");
});
