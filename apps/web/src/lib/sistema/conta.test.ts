import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { administracao, cabecalhoCsrf, conta, contaLembrada, esquecerConta, lembrarConta, paraFuncionario, type PerfilDaConta } from "./conta";

const PERFIL: PerfilDaConta = {
  codigo: "marcos",
  nome: "Marcos Oliveira",
  email: "marcos@exemplo.faperon.br",
  area: "Administrativo",
  telefone: "",
  administrador: true,
  coordenador: true,
  gestor_frota: true,
  gestor_espacos: false,
  gestor_contas: true,
  demonstracao: true,
  precisa_trocar_senha: false,
};

function apagarCookies() {
  for (const item of document.cookie.split(";")) {
    const nome = item.split("=")[0]!.trim();
    if (nome) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  apagarCookies();
  esquecerConta();
});
afterEach(() => vi.unstubAllGlobals());

describe("paraFuncionario", () => {
  it("o eu e a equipe da API viram o Funcionario do front (id = código)", () => {
    expect(paraFuncionario(PERFIL)).toEqual({
      id: "marcos",
      nome: "Marcos Oliveira",
      area: "Administrativo",
      administrador: true,
      coordenador: true,
      gestorFrota: true,
      gestorEspacos: false,
      gestorContas: true,
    });
  });
});

describe("CSRF", () => {
  it("lê o csrftoken do cookie para o cabeçalho X-CSRFToken", () => {
    expect(cabecalhoCsrf()).toEqual({});
    document.cookie = "tema=escuro";
    document.cookie = "csrftoken=abc123";
    expect(cabecalhoCsrf()).toEqual({ "X-CSRFToken": "abc123" });
  });

  it("sem cookie, pede o token ao /auth/csrf antes de entrar", async () => {
    const buscar = vi.fn(async (url: string) =>
      String(url).endsWith("/auth/csrf") ? Response.json({ csrf: "do-servidor" }) : Response.json(PERFIL),
    );
    vi.stubGlobal("fetch", buscar);
    const r = await conta.entrar("marcos@exemplo.faperon.br", "senha-longa-123");
    expect(r).toEqual({ ok: true, dados: PERFIL });
    const [url, init] = buscar.mock.calls[1]! as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/entrar");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["X-CSRFToken"]).toBe("do-servidor");
    expect(JSON.parse(String(init.body))).toEqual({ email: "marcos@exemplo.faperon.br", senha: "senha-longa-123" });
  });

  it("com cookie, não pede o token de novo", async () => {
    document.cookie = "csrftoken=do-cookie";
    const buscar = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", buscar);
    expect(await conta.sair()).toEqual({ ok: true, dados: undefined });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [, init] = buscar.mock.calls[0]! as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-CSRFToken"]).toBe("do-cookie");
  });
});

describe("respostas de erro", () => {
  it("devolve a mensagem e os campos do servidor", async () => {
    document.cookie = "csrftoken=t";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ erro: "Parâmetros inválidos", campos: { email: "Já existe uma conta com este e-mail." } }, { status: 400 })));
    expect(await administracao.criar({ nome: "Ana", email: "ana@x.br", area: "Técnica" })).toEqual({
      ok: false,
      status: 400,
      erro: "Parâmetros inválidos",
      campos: { email: "Já existe uma conta com este e-mail." },
    });
  });

  it("sem conexão, avisa sem quebrar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("falhou"))));
    const r = await conta.eu();
    expect(r).toMatchObject({ ok: false, status: 0 });
  });

  it("editar usa PATCH no código da pessoa", async () => {
    document.cookie = "csrftoken=t";
    const buscar = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", buscar);
    await administracao.editar("carla", { nome: "Carla M." });
    const [url, init] = buscar.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/usuarios/carla");
    expect(init.method).toBe("PATCH");
  });
});

describe("conta lembrada na página", () => {
  it("guarda só em memória o perfil e a equipe de quem entrou", () => {
    expect(contaLembrada()).toBeNull();
    lembrarConta(PERFIL);
    expect(contaLembrada()).toEqual({ perfil: PERFIL, equipe: null });
    esquecerConta();
    expect(contaLembrada()).toBeNull();
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
  });
});
