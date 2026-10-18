import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { hojeISO } from "@/lib/sistema/datas";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { Atividade, RegistroHistorico } from "@/lib/sistema/tipos";
import { Atividades } from "./atividades";

let aba = "minhas";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: (url: string) => (aba = new URL(url, "http://x").searchParams.get("aba") ?? "minhas") }),
  usePathname: () => "/sistema/atividades",
  useSearchParams: () => new URLSearchParams(`aba=${aba}`),
}));

const hoje = hojeISO();
const daAna: Atividade = {
  id: "x",
  funcionarioId: "ana",
  data: hoje,
  inicio: "08:00",
  fim: "12:00",
  tipo: "capacitacao",
  titulo: "Curso de pastagem",
  municipio: "Ji-Paraná",
  publico: 20,
  descricao: "",
  resultados: "",
  criadaEm: `${hoje}T13:00`,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  gravar("atividades", [daAna]);
  gravar("historico", []);
});

function renderAtividades(quem: string, abaInicial = "minhas") {
  aba = abaInicial;
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Atividades />
    </SistemaProvider>,
  );
}

describe("Registro de atividades", () => {
  it("registra uma atividade, valida o horário e anota no histórico", async () => {
    const user = userEvent.setup();
    renderAtividades("carla");
    expect(screen.queryByText("Curso de pastagem")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar atividade" }));
    const dialogo = screen.getByRole("dialog", { name: "Registrar atividade" });
    await user.type(within(dialogo).getByLabelText("Atividade"), "Atendimento a produtores de leite");
    await user.clear(within(dialogo).getByLabelText("Fim"));
    await user.type(within(dialogo).getByLabelText("Fim"), "07:00");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar atividade" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("O fim precisa ser depois do início.");
    await user.clear(within(dialogo).getByLabelText("Fim"));
    await user.type(within(dialogo).getByLabelText("Fim"), "11:30");
    await user.type(within(dialogo).getByLabelText("Município"), "Jaru");
    await user.type(within(dialogo).getByLabelText("Público atendido (pessoas)"), "14");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar atividade" }));

    expect(screen.getByText("Atendimento a produtores de leite")).toBeInTheDocument();
    expect(ler<Atividade[]>("atividades", []).find((a) => a.funcionarioId === "carla")).toMatchObject({ municipio: "Jaru", publico: 14, fim: "11:30" });
    const historico = ler<RegistroHistorico[]>("historico", []);
    expect(historico[0]).toMatchObject({ funcionarioId: "carla", modulo: "atividades", acao: 'Registrou a atividade "Atendimento a produtores de leite"' });
  });

  it("só o coordenador vê a equipe; o histórico mostra o que cada um fez", async () => {
    gravar("historico", [
      { id: "h1", quando: `${hoje}T09:00`, funcionarioId: "ana", modulo: "contas", acao: "Enviou para aprovação a despesa X" },
      { id: "h2", quando: `${hoje}T10:00`, funcionarioId: "carla", modulo: "agenda", acao: 'Criou o evento "Y"' },
    ]);
    const { unmount } = renderAtividades("carla", "historico");
    expect(screen.queryByRole("tab", { name: "Equipe" })).toBeNull();
    const meu = screen.getByRole("list", { name: "Histórico de ações" });
    expect(within(meu).getAllByRole("listitem")).toHaveLength(1);
    unmount();

    renderAtividades("marcos", "equipe");
    expect(screen.getByRole("rowheader", { name: "Ana Ribeiro" }).closest("tr")).toHaveTextContent("20");
    expect(screen.getByText("Curso de pastagem")).toBeInTheDocument();
  });

  it("aplica tag numa atividade, mostra o chip e filtra por ela", async () => {
    const user = userEvent.setup();
    renderAtividades("ana");
    // o selo de tipo usa a cor da legenda única
    expect(screen.getByText("Capacitação ou curso")).toHaveClass("bg-tipo-capacitacao-suave", "text-tipo-capacitacao");
    await user.click(screen.getByRole("button", { name: "Registrar atividade" }));
    const dialogo = screen.getByRole("dialog", { name: "Registrar atividade" });
    await user.type(within(dialogo).getByLabelText("Atividade"), "Dia de campo do café");
    await user.click(within(dialogo).getByRole("checkbox", { name: "Dia de campo" }));
    await user.click(within(dialogo).getByRole("button", { name: "Salvar atividade" }));
    expect(ler<Atividade[]>("atividades", []).find((a) => a.titulo === "Dia de campo do café")?.tags).toEqual(["tag-dia-de-campo"]);

    await user.selectOptions(screen.getByLabelText("Tag"), "Dia de campo");
    const item = screen.getByText("Dia de campo do café").closest("li")!;
    expect(within(within(item).getByRole("list", { name: "Tags" })).getByText("Dia de campo")).toBeInTheDocument();
    expect(screen.queryByText("Curso de pastagem")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Tag"), "Todas");
    expect(screen.getByText("Curso de pastagem")).toBeInTheDocument();
  });
});
