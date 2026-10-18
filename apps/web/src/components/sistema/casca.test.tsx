import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FUNCIONARIOS } from "@/content/sistema/funcionarios";
import { contaLembrada, esquecerConta } from "@/lib/sistema/conta";
import { entrarComo, perfilDe, semConta } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import { BarraSistema } from "./barra-sistema";
import { ExigeLogin } from "./exige-login";
import { InicioSistema } from "./inicio-sistema";
import { TourProvider } from "./tour/tour";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/sistema" }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  esquecerConta();
  push.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

function Sistema({ children }: { children: React.ReactNode }) {
  return (
    <SistemaProvider>
      <TourProvider>
      <BarraSistema />
      <ExigeLogin>{children}</ExigeLogin>
      </TourProvider>
    </SistemaProvider>
  );
}

describe("entrada no sistema (ADR 0035)", () => {
  it("sem sessão no servidor, o sistema pede para fazer login", async () => {
    semConta();
    render(<Sistema><p>conteúdo</p></Sistema>);
    expect(await screen.findByRole("heading", { name: "Faça login para entrar no sistema" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Acessar o sistema" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("conteúdo")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Protótipo:");
  });

  it("servidor fora do ar: avisa e tenta de novo", async () => {
    const buscar = vi.fn(async () => Promise.reject(new TypeError("rede")));
    vi.stubGlobal("fetch", buscar);
    const user = userEvent.setup();
    render(<Sistema><p>conteúdo</p></Sistema>);
    expect(await screen.findByRole("heading", { name: "Sem conexão com o servidor" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("logado, mostra o nome e os atalhos; Sair encerra a sessão no servidor", async () => {
    entrarComo("marcos");
    document.cookie = "csrftoken=t";
    const buscar = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", buscar);
    const user = userEvent.setup();
    render(<Sistema><InicioSistema /></Sistema>);
    expect(screen.getByRole("heading", { name: "Olá, Marcos" })).toBeInTheDocument();
    expect(screen.getByText("Marcos Oliveira")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Agenda.*próximos 7 dias/ })).toHaveAttribute("href", "/sistema/agenda");
    expect(screen.getByText(/pedido\(s\) na fila para avaliar/)).toBeInTheDocument();
    // a troca de funcionário saiu: agora cada pessoa tem a própria conta
    expect(screen.queryByRole("button", { name: "Trocar de funcionário" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Sair" }));
    const [url, init] = buscar.mock.calls.at(-1)! as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/sair");
    expect(init.method).toBe("POST");
    expect(contaLembrada()).toBeNull();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("o acesso à tela Usuários fica na barra, só para administrador", () => {
    entrarComo("marcos");
    const { unmount } = render(<Sistema><p>conteúdo</p></Sistema>);
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/sistema/usuarios");
    unmount();

    entrarComo("carla");
    render(<Sistema><p>conteúdo</p></Sistema>);
    expect(screen.queryByRole("link", { name: "Usuários" })).toBeNull();
  });

  it("com senha temporária, pede a troca antes de tudo", async () => {
    entrarComo("carla", { precisa_trocar_senha: true });
    const novo = perfilDe("carla");
    const equipe = FUNCIONARIOS.map((f) => ({ ...perfilDe(f.id), email: undefined }));
    const buscar = vi.fn(async (url: string) => Response.json(String(url).endsWith("/trocar-senha") ? novo : equipe));
    vi.stubGlobal("fetch", buscar);
    document.cookie = "csrftoken=t";
    const user = userEvent.setup();
    render(<Sistema><p>conteúdo</p></Sistema>);

    const formulario = screen.getByRole("form", { name: "Trocar a senha" });
    expect(screen.getByRole("heading", { name: "Troque a senha temporária" })).toBeInTheDocument();
    expect(screen.queryByText("conteúdo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tour guiado" })).toBeNull();

    await user.type(within(formulario).getByLabelText("Senha atual"), "Temp-1234-abcd");
    await user.type(within(formulario).getByLabelText("Nova senha"), "curta");
    await user.type(within(formulario).getByLabelText("Repita a nova senha"), "curta");
    await user.click(within(formulario).getByRole("button", { name: "Trocar a senha" }));
    expect(await within(formulario).findByRole("alert")).toHaveTextContent("pelo menos 10 caracteres");
    expect(buscar).not.toHaveBeenCalled();

    await user.clear(within(formulario).getByLabelText("Nova senha"));
    await user.clear(within(formulario).getByLabelText("Repita a nova senha"));
    await user.type(within(formulario).getByLabelText("Nova senha"), "minha-senha-nova");
    await user.type(within(formulario).getByLabelText("Repita a nova senha"), "minha-senha-nova");
    await user.click(within(formulario).getByRole("button", { name: "Trocar a senha" }));
    expect(await screen.findByText("conteúdo")).toBeInTheDocument();
    const [url, init] = buscar.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/trocar-senha");
    expect(JSON.parse(String(init.body))).toEqual({ senha_atual: "Temp-1234-abcd", senha_nova: "minha-senha-nova" });
  });
});
