import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import { Indicadores } from "./indicadores";

// o ECharts não roda no jsdom: o gráfico vira uma imagem com a descrição, como nos testes do Painel
vi.mock("next/dynamic", () => ({
  default: () =>
    function GraficoFalso({ descricao }: { descricao: string }) {
      return <div role="img" aria-label={descricao} />;
    },
}));

function renderIndicadores(quem: string) {
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Indicadores />
    </SistemaProvider>,
  );
}

const bloco = (nome: string) => screen.getByRole("region", { name: nome });

/** O número de um rótulo (dt) dentro do bloco. */
function valor(nomeDoBloco: string, rotulo: string): string {
  const dt = within(bloco(nomeDoBloco)).getByText(rotulo, { selector: "dt" });
  return dt.parentElement!.querySelector("dd")!.textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Indicadores", () => {
  it("mostra um bloco por área, com números, gráficos com tabela e links", async () => {
    renderIndicadores("marcos");
    for (const nome of ["Agenda", "Frota", "Espaços", "Contas", "Atividades"]) expect(await screen.findByRole("region", { name: nome })).toBeInTheDocument();
    expect(screen.getByText("Toda a equipe")).toBeInTheDocument();
    expect(within(bloco("Frota")).getByRole("img", { name: /Km rodados por mês/ })).toBeInTheDocument();
    expect(within(bloco("Frota")).getByRole("link", { name: /Abrir Frotas/ })).toHaveAttribute("href", "/sistema/frotas");
    expect(within(bloco("Frota")).getByRole("link", { name: "Relatório da frota" }).getAttribute("href")).toMatch(/^\/sistema\/relatorios\?tipo=frota&de=\d{4}-\d{2}-01&ate=/);
    expect(within(bloco("Atividades")).getByRole("table", { name: "Horas por tipo" })).toBeInTheDocument();
    expect(within(bloco("Atividades")).getByRole("heading", { name: "Horas por funcionário" })).toBeInTheDocument();
    expect(valor("Atividades", "Atividades")).toBe("7");
  });

  it("os filtros de funcionário e de tag mudam os números", async () => {
    const user = userEvent.setup();
    renderIndicadores("marcos");
    await screen.findByRole("region", { name: "Atividades" });
    await user.selectOptions(screen.getByLabelText("Funcionário"), "Ana Ribeiro");
    expect(screen.getByText("Números de Ana Ribeiro")).toBeInTheDocument();
    expect(valor("Atividades", "Atividades")).toBe("2");
    expect(within(bloco("Atividades")).queryByRole("heading", { name: "Horas por funcionário" })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Funcionário"), "Todos");
    await user.selectOptions(screen.getByLabelText("Tag"), "SENAR");
    expect(valor("Atividades", "Atividades")).toBe("1");
    expect(within(bloco("Frota")).getByText(/Custos da frota toda/)).toBeInTheDocument();
  });

  it("o funcionário comum vê os próprios números, sem a equipe nem o filtro de funcionário", async () => {
    renderIndicadores("carla");
    await screen.findByRole("region", { name: "Atividades" });
    expect(screen.getByText("Seus números")).toBeInTheDocument();
    expect(screen.queryByText("Toda a equipe")).toBeNull();
    expect(screen.queryByLabelText("Funcionário")).toBeNull();
    expect(valor("Atividades", "Atividades")).toBe("2");
    expect(within(bloco("Atividades")).queryByRole("heading", { name: "Horas por funcionário" })).toBeNull();
    expect(within(bloco("Espaços")).getByText("Seus pedidos")).toBeInTheDocument();
  });

  it("bloco sem dados diz o que fazer para aparecer", async () => {
    gravar("atividades", []);
    renderIndicadores("carla");
    const atividades = await screen.findByRole("region", { name: "Atividades" });
    expect(within(atividades).getByText("Sem dados no período")).toBeInTheDocument();
    expect(within(atividades).getByText("Registre uma atividade para ver aqui.")).toBeInTheDocument();
    expect(within(atividades).queryByRole("img")).toBeNull();
  });
});
