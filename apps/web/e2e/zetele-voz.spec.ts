import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { entrar as entrarComSenha } from "./entrar";

// Microfone falso do Chromium (tom de teste) e áudio sem exigir gesto: nada de dispositivo real.
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
});

/** WAV de 0,2 s de silêncio (24 kHz, mono, 16 bits), como o /falar devolve. */
function wavDeSilencio(): Buffer {
  const pcm = Buffer.alloc(24000 * 0.2 * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function simularApiDaVoz(page: Page) {
  const pedidos = { ouvir: 0, falar: 0, perguntar: 0 };
  await page.route("**/api/v1/sistema/zetele/estado", (r) => r.fulfill({ json: { disponivel: true, motivo: null, voz: { ouvir: true, falar: true } } }));
  await page.route("**/api/v1/sistema/zetele/ouvir", (r) => {
    pedidos.ouvir++;
    expect(r.request().headers()["content-type"]).toMatch(/^multipart\/form-data/);
    return r.fulfill({ json: { texto: "Como reservo a Hilux?" } });
  });
  await page.route("**/api/v1/sistema/zetele/perguntar", (r) => {
    pedidos.perguntar++;
    return r.fulfill({ json: { status: "respondida", texto: "Na aba Reservas de Frotas, clique em Nova reserva.", fontes: [], sugestoes: [] } });
  });
  await page.route("**/api/v1/sistema/zetele/falar", (r) => {
    pedidos.falar++;
    return r.fulfill({ status: 200, contentType: "audio/wav", body: wavDeSilencio() });
  });
  return pedidos;
}

async function entrar(page: Page) {
  await page.addInitScript(() => window.sessionStorage.setItem("zetele-saudou", "1"));
  await entrarComSenha(page, "carla@exemplo.faperon.br");
}

test("Zétele do sistema: pergunta gravada vira texto para conferir e a resposta é lida em voz alta", async ({ page }) => {
  const pedidos = await simularApiDaVoz(page);
  await entrar(page);
  await page.getByRole("button", { name: "Falar com o Zétele, assistente do site" }).click();
  const dialogo = page.getByRole("dialog", { name: "Zétele" });
  await expect(dialogo.getByText("Protótipo: o áudio é processado pela Groq e pelo Google (plano gratuito).")).toBeVisible();

  await dialogo.getByRole("button", { name: "Gravar pergunta" }).click();
  await expect(dialogo.getByText(/Gravando…/)).toBeVisible();
  await expect(dialogo.getByText(/0:01 \/ 1:00/)).toBeVisible();
  await dialogo.getByRole("button", { name: "Parar gravação" }).click();
  await expect(dialogo.getByLabel("Sua pergunta")).toHaveValue("Como reservo a Hilux?");
  expect(pedidos).toMatchObject({ ouvir: 1, perguntar: 0 });

  const r = await new AxeBuilder({ page }).include("#zetele-painel").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await dialogo.getByLabel("Sua pergunta").press("Enter");
  await expect(dialogo.getByText(/clique em Nova reserva/)).toBeVisible();
  await expect.poll(() => pedidos.falar).toBe(1);
  await expect(dialogo.getByRole("button", { name: /Parar áudio|Ouvir resposta/ })).toBeVisible();
});
