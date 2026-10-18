import { afterEach, describe, expect, it, vi } from "vitest";
import { cookiesDaApi, ipDoCliente, proxyParaApi } from "./proxy";

afterEach(() => vi.unstubAllGlobals());

describe("proxyParaApi", () => {
  it("repassa ao Django só o IP que o Funnel acrescentou, nunca a cadeia forjada", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    await proxyParaApi(
      new Request("http://site.test/api/v1/relatorio.pdf", {
        headers: { "x-forwarded-for": "6.6.6.6, 7.7.7.7, 203.0.113.9" },
      }),
    );
    const enviados = fetchFalso.mock.calls[0]![1].headers as Headers;
    expect(enviados.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("sem x-forwarded-for na entrada, não inventa o header na saída", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    await proxyParaApi(new Request("http://site.test/api/v1/relatorio.pdf"));
    const enviados = fetchFalso.mock.calls[0]![1].headers as Headers;
    expect(enviados.has("x-forwarded-for")).toBe(false);
  });

  it("sem x-forwarded-for, usa o x-real-ip para o limite por IP não cair no IP do container", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    await proxyParaApi(new Request("http://site.test/api/v1/ranking", { headers: { "x-real-ip": "203.0.113.7" } }));
    const enviados = fetchFalso.mock.calls[0]![1].headers as Headers;
    expect(enviados.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("ipDoCliente pega o último valor não vazio", () => {
    expect(ipDoCliente("1.1.1.1, 2.2.2.2")).toBe("2.2.2.2");
    expect(ipDoCliente(" 2.2.2.2 ,")).toBe("2.2.2.2");
    expect(ipDoCliente("")).toBeNull();
    expect(ipDoCliente(null)).toBeNull();
  });

  it("só encaminha /api/v1/ e nunca expõe schema, docs ou admin do Django", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    for (const caminho of ["/api/schema/", "/api/docs/", "/api/", "/api/v1x/saude", "/api/../admin/", "/media/qualquer.png"]) {
      const res = await proxyParaApi(new Request(`http://site.test${caminho}`));
      expect(res.status, caminho).toBe(404);
    }
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("encaminha /api/v1/ ao Django com a query string", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchFalso);
    const res = await proxyParaApi(new Request("http://site.test/api/v1/ranking?produto=soja"));
    expect(res.status).toBe(200);
    expect(String(fetchFalso.mock.calls[0]![0])).toMatch(/\/api\/v1\/ranking\?produto=soja$/);
  });

  it("POST repassa corpo e content-type ao Django", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const corpo = JSON.stringify({ pergunta: "onde fica o ranking?", historico: [], pagina: "/" });
    await proxyParaApi(
      new Request("http://site.test/api/v1/zetele/perguntar", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: corpo,
      }),
    );
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/zetele\/perguntar$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(corpo);
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
    expect((init.headers as Headers).get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("GET continua sem corpo", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    await proxyParaApi(new Request("http://site.test/api/v1/ranking"));
    expect(fetchFalso.mock.calls[0]![1].body).toBeUndefined();
  });

  it("recusa corpo acima de 16 KB sem chamar o Django", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const res = await proxyParaApi(
      new Request("http://site.test/api/v1/zetele/perguntar", { method: "POST", body: "x".repeat(16_385) }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ erro: "Corpo grande demais" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("aceita corpo de exatamente 16 KB", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const corpo = "x".repeat(16_384);
    const res = await proxyParaApi(new Request("http://site.test/api/v1/zetele/perguntar", { method: "POST", body: corpo }));
    expect(res.status).toBe(200);
    expect(fetchFalso.mock.calls[0]![1].body).toBe(corpo);
  });

  it("conta bytes, não caracteres", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    // 9 000 caracteres, 18 000 bytes em UTF-8.
    const res = await proxyParaApi(
      new Request("http://site.test/api/v1/zetele/perguntar", { method: "POST", body: "é".repeat(9_000) }),
    );
    expect(res.status).toBe(413);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("corta um stream sem content-length assim que passa de 16 KB, sem ler o resto", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    let pedacos = 0;
    // 1 MB em pedaços de 4 KB: ler tudo antes de checar puxaria os 256 pedaços. Finito de propósito, para um
    // proxy que bufferiza falhar no assert em vez de travar o teste enchendo a memória.
    const fluxo = new ReadableStream<Uint8Array>({
      pull(controle) {
        pedacos++;
        controle.enqueue(new Uint8Array(4_096));
        if (pedacos === 256) controle.close();
      },
    });
    const res = await proxyParaApi(
      new Request("http://site.test/api/v1/zetele/perguntar", { method: "POST", body: fluxo, duplex: "half" } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ erro: "Corpo grande demais" });
    expect(pedacos).toBeLessThan(10);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("content-length declarado acima do limite: 413 sem ler o corpo", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const req = new Request("http://site.test/api/v1/zetele/perguntar", {
      method: "POST",
      headers: { "content-length": "500000000" },
      body: "x",
    });
    const res = await proxyParaApi(req);
    expect(res.status).toBe(413);
    expect(req.bodyUsed).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("corpo que falha no meio da leitura vira 400", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const fluxo = new ReadableStream<Uint8Array>({
      pull(controle) {
        controle.error(new Error("cliente desconectou"));
      },
    });
    const res = await proxyParaApi(
      new Request("http://site.test/api/v1/zetele/perguntar", { method: "POST", body: fluxo, duplex: "half" } as RequestInit),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ erro: "Corpo inválido" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  describe("áudio do Zétele do sistema (ADR 0034)", () => {
    const ROTA = "http://site.test/api/v1/sistema/zetele/ouvir";
    // o FormData do jsdom não vira corpo de Request no Node: o multipart é montado à mão
    const FRONTEIRA = "----zetele";
    const TIPO = { "content-type": `multipart/form-data; boundary=${FRONTEIRA}` };
    function multipart(audio: Uint8Array): Uint8Array<ArrayBuffer> {
      const cabeca = new TextEncoder().encode(
        `--${FRONTEIRA}\r\nContent-Disposition: form-data; name="audio"; filename="pergunta.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
      );
      const pe = new TextEncoder().encode(`\r\n--${FRONTEIRA}--\r\n`);
      const tudo = new Uint8Array(cabeca.length + audio.length + pe.length);
      tudo.set(cabeca);
      tudo.set(audio, cabeca.length);
      tudo.set(pe, cabeca.length + audio.length);
      return tudo;
    }

    it("repassa o multipart byte a byte, sem decodificar como texto", async () => {
      const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);
      // bytes que não são UTF-8 válido: decodificar como texto os trocaria por U+FFFD
      const corpo = multipart(new Uint8Array(200_000).map((_, i) => (i * 37) % 256));
      const res = await proxyParaApi(new Request(ROTA, { method: "POST", headers: TIPO, body: corpo }));
      expect(res.status).toBe(200);
      const [, init] = fetchFalso.mock.calls[0]!;
      expect(init.body).toBeInstanceOf(Uint8Array);
      expect(init.body).toEqual(corpo);
      expect((init.headers as Headers).get("content-type")).toBe(TIPO["content-type"]);
    });

    it("recusa áudio acima de 3 MB mais os cabeçalhos", async () => {
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      const corpo = multipart(new Uint8Array(3 * 1024 * 1024 + 70 * 1024));
      const res = await proxyParaApi(new Request(ROTA, { method: "POST", headers: TIPO, body: corpo }));
      expect(res.status).toBe(413);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("o limite maior vale só para multipart na rota do áudio", async () => {
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);
      const json = { "content-type": "application/json" };
      const naRota = await proxyParaApi(new Request(ROTA, { method: "POST", headers: json, body: "x".repeat(16_385) }));
      const foraDaRota = await proxyParaApi(
        new Request("http://site.test/api/v1/sistema/zetele/perguntar", { method: "POST", headers: TIPO, body: multipart(new Uint8Array(20_000)) }),
      );
      expect([naRota.status, foraDaRota.status]).toEqual([413, 413]);
      expect(fetchFalso).not.toHaveBeenCalled();
    });

    it("devolve o WAV do /falar sem mexer nos bytes", async () => {
      const wav = new Uint8Array([82, 73, 70, 70, 0, 255, 1, 2]);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(wav, { status: 200, headers: { "content-type": "audio/wav", "cache-control": "no-store" } })));
      const res = await proxyParaApi(
        new Request("http://site.test/api/v1/sistema/zetele/falar", { method: "POST", headers: { "content-type": "application/json" }, body: '{"texto":"oi"}' }),
      );
      expect(res.headers.get("content-type")).toBe("audio/wav");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(wav);
    });
  });

  describe("sessão do sistema (ADR 0035)", () => {
    it("repassa o Cookie e o X-CSRFToken da pessoa à API", async () => {
      const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);
      await proxyParaApi(
        new Request("http://site.test/api/v1/auth/sair", {
          method: "POST",
          headers: { cookie: "sessionid=abc; csrftoken=xyz", "x-csrftoken": "xyz" },
        }),
      );
      const enviados = fetchFalso.mock.calls[0]![1].headers as Headers;
      expect(enviados.get("cookie")).toBe("sessionid=abc; csrftoken=xyz");
      expect(enviados.get("x-csrftoken")).toBe("xyz");
    });

    it("só os cookies do Django vão para a API", () => {
      expect(cookiesDaApi("tema=escuro; sessionid=abc; _ga=1; csrftoken=xyz")).toBe("sessionid=abc; csrftoken=xyz");
      expect(cookiesDaApi("tema=escuro")).toBeNull();
      expect(cookiesDaApi(null)).toBeNull();
    });

    it("não repassa Origin nem Authorization (a API não precisa e o CSRF fica no token)", async () => {
      const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);
      await proxyParaApi(
        new Request("http://site.test/api/v1/auth/eu", { headers: { origin: "http://outro.test", authorization: "Basic x" } }),
      );
      const enviados = fetchFalso.mock.calls[0]![1].headers as Headers;
      expect(enviados.has("origin")).toBe(false);
      expect(enviados.has("authorization")).toBe(false);
    });

    it("devolve cada Set-Cookie da API com HttpOnly, SameSite e Secure intactos", async () => {
      const sessao = "sessionid=abc; expires=Sun, 19 Oct 2026 05:00:00 GMT; HttpOnly; Max-Age=43200; Path=/; SameSite=Lax; Secure";
      const csrf = "csrftoken=xyz; expires=Sun, 17 Oct 2027 17:00:00 GMT; Max-Age=31449600; Path=/; SameSite=Lax; Secure";
      const resposta = new Response("{}", {
        status: 200,
        headers: [
          ["content-type", "application/json"],
          ["set-cookie", sessao],
          ["set-cookie", csrf],
        ],
      });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta));
      const res = await proxyParaApi(new Request("http://site.test/api/v1/auth/entrar", { method: "POST", body: "{}" }));
      expect(res.headers.getSetCookie()).toEqual([sessao, csrf]);
    });

    it("sem Set-Cookie na resposta, não inventa nenhum", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
      const res = await proxyParaApi(new Request("http://site.test/api/v1/ranking"));
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it("PATCH (editar usuário) repassa o corpo com o limite de texto", async () => {
      const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);
      const corpo = JSON.stringify({ nome: "Carla" });
      await proxyParaApi(
        new Request("http://site.test/api/v1/usuarios/carla", { method: "PATCH", headers: { "content-type": "application/json" }, body: corpo }),
      );
      const [, init] = fetchFalso.mock.calls[0]!;
      expect(init.method).toBe("PATCH");
      expect(init.body).toBe(corpo);
    });

    it("a rota do Next exporta PATCH para a edição de usuários", async () => {
      const rota = await import("@/app/api/[...caminho]/route");
      expect(rota.PATCH).toBe(proxyParaApi);
    });
  });
});
