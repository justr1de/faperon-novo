import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpretar } from "./sistema/voz";
import { falarTexto, ouvirAudio, perguntar } from "./zetele";

/** A área do sistema exige sessão (ADR 0035): os POST do Zétele do sistema e da voz levam o X-CSRFToken. */
function cabecalhos(buscar: ReturnType<typeof vi.fn>, i = 0): Headers {
  return new Headers((buscar.mock.calls[i]![1] as RequestInit).headers);
}

beforeEach(() => {
  document.cookie = "csrftoken=token-da-sessao";
});
afterEach(() => vi.unstubAllGlobals());

describe("CSRF nas chamadas do sistema", () => {
  it("perguntar, ouvir e falar levam o X-CSRFToken", async () => {
    const buscar = vi.fn(async () => Response.json({ status: "respondida", texto: "ok", fontes: [], sugestoes: [], tipo: "evento", campos: {}, faltando: [] }));
    vi.stubGlobal("fetch", buscar);
    await perguntar("como reservo?", [], "/sistema/frotas");
    await ouvirAudio(new Blob(["x"], { type: "audio/webm" }), "/sistema");
    await falarTexto("Olá", "/sistema");
    await interpretar("evento", "reunião amanhã", "2026-10-18");
    for (const i of [0, 1, 2, 3]) expect(cabecalhos(buscar, i).get("x-csrftoken"), String(i)).toBe("token-da-sessao");
  });
});
