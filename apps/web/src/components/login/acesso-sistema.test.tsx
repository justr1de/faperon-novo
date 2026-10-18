import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ler } from "@/lib/sistema/armazenamento";
import { contaLembrada, esquecerConta } from "@/lib/sistema/conta";
import { perfilDe } from "@/lib/sistema/conta-de-teste";
import type { RegistroHistorico } from "@/lib/sistema/tipos";
import { AcessoSistema } from "./acesso-sistema";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }) }));

type Rota = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** Simula a API: sem sessão no /auth/eu, e cada rota do teste responde o que ele pedir. */
function api(rotas: Record<string, Rota> = {}) {
  const buscar = vi.fn(async (url: string, init?: RequestInit) => {
    for (const [fim, responder] of Object.entries(rotas)) if (url.endsWith(fim)) return responder(url, init);
    if (url.endsWith("/auth/eu")) return Response.json({ erro: "Sem login", campos: {} }, { status: 401 });
    if (url.endsWith("/auth/csrf")) return Response.json({ csrf: "token-de-teste" });
    return Response.json({ erro: "Não encontrado", campos: {} }, { status: 404 });
  });
  vi.stubGlobal("fetch", buscar);
  return buscar;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  esquecerConta();
  push.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function preencher(email: string, senha: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), senha);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

describe("Acessar o sistema (login de verdade, ADR 0035)", () => {
  it("manda e-mail e senha à API e mostra a mensagem genérica do servidor", async () => {
    const buscar = api({ "/auth/entrar": () => Response.json({ erro: "E-mail ou senha incorretos.", campos: {} }, { status: 400 }) });
    render(<AcessoSistema />);
    await preencher("carla@exemplo.faperon.br", "errada-errada");
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
    const [, init] = buscar.mock.calls.find(([u]) => u.endsWith("/auth/entrar"))!;
    expect(JSON.parse(String(init!.body))).toEqual({ email: "carla@exemplo.faperon.br", senha: "errada-errada" });
    expect((init!.headers as Record<string, string>)["X-CSRFToken"]).toBe("token-de-teste");
    expect(contaLembrada()).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("bloqueio depois de muitas falhas: mostra o aviso do servidor", async () => {
    api({ "/auth/entrar": () => Response.json({ erro: "Muitas tentativas sem sucesso. Tente de novo em 15 minutos.", campos: {} }, { status: 429 }) });
    render(<AcessoSistema />);
    await preencher("carla@exemplo.faperon.br", "qualquer-senha");
    expect(await screen.findByRole("alert")).toHaveTextContent("15 minutos");
  });

  it("entra, anota a entrada no histórico e abre o sistema", async () => {
    api({ "/auth/entrar": () => Response.json(perfilDe("carla")) });
    render(<AcessoSistema />);
    await preencher("carla@exemplo.faperon.br", "senha-de-demonstracao");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/sistema"));
    expect(contaLembrada()?.perfil.codigo).toBe("carla");
    const historico = ler<RegistroHistorico[]>("historico", []);
    expect(historico[0]).toMatchObject({ funcionarioId: "carla", modulo: "acesso", acao: "Entrou no sistema" });
  });

  it("com senha temporária, entra e o sistema pede a troca", async () => {
    api({ "/auth/entrar": () => Response.json(perfilDe("carla", { precisa_trocar_senha: true })) });
    render(<AcessoSistema />);
    await preencher("carla@exemplo.faperon.br", "Temp-aaaa-bbbb");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/sistema"));
    expect(contaLembrada()?.perfil.precisa_trocar_senha).toBe(true);
  });

  it("quem já tem sessão vê com quem entrou e pode ir ao sistema ou sair", async () => {
    const buscar = api({
      "/auth/eu": () => Response.json(perfilDe("marcos")),
      "/auth/sair": () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup();
    render(<AcessoSistema />);
    expect(await screen.findByText(/Você entrou como/)).toHaveTextContent("Marcos Oliveira");
    expect(screen.getByRole("link", { name: "Ir para o sistema" })).toHaveAttribute("href", "/sistema");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByLabelText("E-mail")).toBeInTheDocument();
    expect(buscar.mock.calls.some(([u]) => u.endsWith("/auth/sair"))).toBe(true);
  });

  it("mostra e oculta a senha", async () => {
    api();
    const user = userEvent.setup();
    render(<AcessoSistema />);
    const senha = await screen.findByLabelText("Senha");
    expect(senha).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar a senha" }));
    expect(senha).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar a senha" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Ocultar a senha" }));
    expect(senha).toHaveAttribute("type", "password");
  });

  it("esqueci a senha: diz com honestidade que é o administrador quem gera uma temporária", async () => {
    api();
    const user = userEvent.setup();
    render(<AcessoSistema />);
    await user.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));
    expect(screen.getByRole("status")).toHaveTextContent("Peça ao administrador uma senha temporária.");
    await user.click(screen.getByRole("button", { name: "Voltar ao login" }));
    expect(screen.getByRole("form", { name: "Acessar o sistema" })).toBeInTheDocument();
  });

  it("sem NEXT_PUBLIC_GOOGLE_CLIENT_ID, não mostra o Entrar com Google", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    api();
    render(<AcessoSistema />);
    await screen.findByLabelText("E-mail");
    expect(screen.queryByTestId("entrar-com-google")).toBeNull();
  });

  it("com NEXT_PUBLIC_GOOGLE_CLIENT_ID, mostra o Entrar com Google", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "cliente.apps.googleusercontent.com");
    api();
    render(<AcessoSistema />);
    expect(await screen.findByTestId("entrar-com-google")).toBeInTheDocument();
  });
});
