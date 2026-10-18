import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frotaDeExemplo, pedidosDeExemplo } from "@/content/sistema/exemplo";
import { esquecerConta } from "./conta";
import { entrarComo, perfilDe, semConta } from "./conta-de-teste";
import { SistemaProvider, useSistema } from "./estado";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  esquecerConta();
});
afterEach(() => vi.unstubAllGlobals());

function Sonda() {
  const s = useSistema();
  if (!s.pronto) return <p>carregando</p>;
  return (
    <div>
      <p data-testid="quem">{s.funcionario?.nome ?? "ninguém"}</p>
      <p data-testid="situacao">{s.situacao}</p>
      <p data-testid="equipe">{s.equipe.map((f) => f.id).join("|")}</p>
      <p data-testid="admin">{String(s.funcionario?.administrador ?? false)}</p>
      <p data-testid="eventos">{s.eventos.map((e) => e.titulo).join("|")}</p>
      <p data-testid="veiculos">{s.frota.veiculos.length}</p>
      <button
        onClick={() =>
          s.salvarEvento({ id: "novo", titulo: "Meu evento", data: s.hoje, inicio: "10:00", fim: "11:00", local: "", descricao: "", tipo: "reuniao", origem: "pessoal" })
        }
      >
        criar
      </button>
      <button onClick={s.restaurar}>restaurar</button>
    </div>
  );
}

describe("estado do protótipo", () => {
  it("sem sessão no servidor, ninguém está logado mas a frota de exemplo carrega", async () => {
    semConta();
    render(<SistemaProvider><Sonda /></SistemaProvider>);
    expect(await screen.findByTestId("quem")).toHaveTextContent("ninguém");
    expect(screen.getByTestId("situacao")).toHaveTextContent("fora");
    expect(screen.getByTestId("veiculos")).toHaveTextContent("6");
  });

  it("quem está logado vem do /auth/eu e a equipe do /usuarios/equipe", async () => {
    const equipe = [
      { codigo: "marcos", nome: "Marcos Oliveira", area: "Administrativo", administrador: true, coordenador: true, gestor_frota: true, gestor_espacos: true, gestor_contas: true },
      { codigo: "rita", nome: "Rita Nova", area: "Técnica", administrador: false, coordenador: false, gestor_frota: false, gestor_espacos: false, gestor_contas: false },
    ];
    const buscar = vi.fn(async (url: string) =>
      String(url).endsWith("/auth/eu") ? Response.json(perfilDe("marcos")) : Response.json(equipe),
    );
    vi.stubGlobal("fetch", buscar);
    render(<SistemaProvider><Sonda /></SistemaProvider>);
    expect(await screen.findByText("Marcos Oliveira")).toBeInTheDocument();
    expect(await screen.findByText("marcos|rita")).toBeInTheDocument();
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
    expect(buscar.mock.calls.map(([u]) => u)).toEqual(["/api/v1/auth/eu", "/api/v1/usuarios/equipe"]);
  });

  it("servidor fora do ar não vira \"faça login\"", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("rede"))));
    render(<SistemaProvider><Sonda /></SistemaProvider>);
    expect(await screen.findByText("erro")).toBeInTheDocument();
  });

  it("a agenda é por funcionário e persiste no navegador", () => {
    entrarComo("carla");
    const { unmount } = render(<SistemaProvider><Sonda /></SistemaProvider>);
    act(() => screen.getByText("criar").click());
    expect(screen.getByTestId("eventos")).toHaveTextContent("Meu evento");
    unmount();

    entrarComo("marcos");
    const outro = render(<SistemaProvider><Sonda /></SistemaProvider>);
    expect(screen.getByTestId("quem")).toHaveTextContent("Marcos Oliveira");
    expect(screen.getByTestId("eventos")).not.toHaveTextContent("Meu evento");
    outro.unmount();

    entrarComo("carla");
    render(<SistemaProvider><Sonda /></SistemaProvider>);
    expect(screen.getByTestId("eventos")).toHaveTextContent("Meu evento");
  });

  it("restaurar volta aos dados de exemplo", () => {
    entrarComo("carla");
    render(<SistemaProvider><Sonda /></SistemaProvider>);
    act(() => screen.getByText("criar").click());
    act(() => screen.getByText("restaurar").click());
    expect(screen.getByTestId("eventos")).not.toHaveTextContent("Meu evento");
    expect(screen.getByTestId("quem")).toHaveTextContent("Carla Mendes");
  });
});

describe("dados de exemplo", () => {
  it("são deterministas para o mesmo dia", () => {
    expect(frotaDeExemplo("2026-10-17")).toEqual(frotaDeExemplo("2026-10-17"));
    expect(pedidosDeExemplo("2026-10-17")).toEqual(pedidosDeExemplo("2026-10-17"));
  });

  it("km das viagens concluídas é coerente (final maior que inicial)", () => {
    for (const r of frotaDeExemplo("2026-10-17").reservas.filter((r) => r.situacao === "concluida")) {
      expect(r.kmFinal!).toBeGreaterThan(r.kmInicial!);
    }
  });
});
