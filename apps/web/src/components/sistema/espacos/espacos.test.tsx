import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Agenda } from "@/components/sistema/agenda/agenda";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { hojeISO, somarDias } from "@/lib/sistema/datas";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { PedidoEspaco, RegistroHistorico } from "@/lib/sistema/tipos";
import { Espacos } from "./espacos";

let aba = "painel";
const replace = vi.fn((url: string) => {
  aba = new URL(url, "http://x").searchParams.get("aba") ?? "painel";
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/sistema/espacos",
  useSearchParams: () => new URLSearchParams(`aba=${aba}`),
}));

const amanha = somarDias(hojeISO(), 1);
function pedido(parcial: Partial<PedidoEspaco> & Pick<PedidoEspaco, "id" | "nome">): PedidoEspaco {
  return {
    espacoId: "sala-reunioes",
    funcionarioId: "ana",
    data: amanha,
    periodo: "manha",
    inicio: "08:00",
    fim: "12:00",
    tipo: "reuniao",
    participantes: 6,
    coffeeBreak: false,
    observacoes: "",
    status: "pendente",
    motivoRecusa: "",
    criadoEm: `${hojeISO()}T08:00`,
    ...parcial,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  gravar("espacos", [
    pedido({ id: "aprovado", nome: "Reunião aprovada", status: "aprovado", funcionarioId: "luiza" }),
    pedido({ id: "pendente", nome: "Pedido da Ana", periodo: "dia_todo", inicio: "08:00", fim: "18:00" }),
    pedido({ id: "livre", nome: "Pedido sem conflito", periodo: "tarde", inicio: "13:00", fim: "18:00", espacoId: "hub" }),
  ]);
});

function renderEspacos(quem: string, abaInicial = "painel") {
  aba = abaInicial;
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Espacos />
    </SistemaProvider>,
  );
}

describe("Agendamento de espaços", () => {
  it("o pedido informa conflitos e lotação antes de enviar, e entra na fila marcado", async () => {
    const user = userEvent.setup();
    renderEspacos("carla");
    await user.click(screen.getByRole("button", { name: "Novo pedido" }));
    const dialogo = screen.getByRole("dialog", { name: "Novo pedido de espaço" });
    await user.clear(within(dialogo).getByLabelText("Dia"));
    await user.type(within(dialogo).getByLabelText("Dia"), amanha);
    await user.type(within(dialogo).getByLabelText("Nome do evento"), "Reunião de pauta");
    await user.type(within(dialogo).getByLabelText("Participantes (aproximado)"), "15");
    await user.click(within(dialogo).getByLabelText("Haverá coffee break"));
    const aviso = within(dialogo).getByText("Possíveis conflitos").parentElement!;
    expect(aviso).toHaveTextContent("Reunião aprovada");
    expect(aviso).toHaveTextContent("Pedido da Ana");
    expect(aviso).toHaveTextContent("passam da capacidade");
    await user.click(within(dialogo).getByRole("button", { name: "Enviar para a fila" }));
    expect(screen.getByText(/enviado para a fila, marcado com conflito/)).toBeInTheDocument();
    const salvo = ler<PedidoEspaco[]>("espacos", []).find((p) => p.nome === "Reunião de pauta")!;
    expect(salvo).toMatchObject({ status: "pendente", coffeeBreak: true, participantes: 15, funcionarioId: "carla", inicio: "08:00", fim: "12:00" });
  });

  it("horário específico precisa de fim depois do início", async () => {
    const user = userEvent.setup();
    renderEspacos("carla");
    await user.click(screen.getByRole("button", { name: "Novo pedido" }));
    const dialogo = screen.getByRole("dialog");
    await user.selectOptions(within(dialogo).getByLabelText("Período"), "horario");
    await user.type(within(dialogo).getByLabelText("Início"), "10:00");
    await user.type(within(dialogo).getByLabelText("Fim"), "09:00");
    await user.type(within(dialogo).getByLabelText("Nome do evento"), "X");
    await user.type(within(dialogo).getByLabelText("Participantes (aproximado)"), "3");
    await user.click(within(dialogo).getByRole("button", { name: "Enviar para a fila" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("o fim precisa ser depois do início");
  });

  it("o painel da semana mostra os pedidos e destaca conflitos", () => {
    const hoje = hojeISO();
    gravar("espacos", [
      pedido({ id: "a", nome: "Reunião aprovada", status: "aprovado", data: hoje }),
      pedido({ id: "b", nome: "Pedido em choque", data: hoje }),
    ]);
    renderEspacos("carla");
    const tabela = screen.getByRole("table", { name: "Agendamentos dos espaços em 7 dias" });
    expect(within(tabela).getByText(/Reunião aprovada/)).toBeInTheDocument();
    expect(within(tabela).getAllByText(/conflito/)).toHaveLength(2);
  });

  it("não gestor não vê aprovar e recusar na fila", () => {
    renderEspacos("carla", "fila");
    expect(screen.getByText(/avaliada pelo gestor dos espaços/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aprovar/ })).toBeNull();
  });

  it("o gestor não aprova pedido que choca com aprovado; aprova o livre, que vai para a agenda de quem pediu", async () => {
    const user = userEvent.setup();
    const { unmount } = renderEspacos("marcos", "fila");
    await user.click(screen.getByRole("button", { name: "Aprovar Pedido da Ana" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Já há um agendamento aprovado nesse espaço e horário: Reunião aprovada");
    await user.click(screen.getByRole("button", { name: "Aprovar Pedido sem conflito" }));
    expect(ler<PedidoEspaco[]>("espacos", []).find((p) => p.id === "livre")!.status).toBe("aprovado");
    await user.click(screen.getByRole("button", { name: "Recusar Pedido da Ana" }));
    await user.click(screen.getByRole("button", { name: "Recusar pedido" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o motivo da recusa.");
    await user.type(screen.getByLabelText("Motivo da recusa"), "Sala ocupada pela diretoria.");
    await user.click(screen.getByRole("button", { name: "Recusar pedido" }));
    expect(ler<PedidoEspaco[]>("espacos", []).find((p) => p.id === "pendente")).toMatchObject({ status: "recusado", motivoRecusa: "Sala ocupada pela diretoria." });
    unmount();

    entrarComo("ana");
    render(
      <SistemaProvider>
        <Agenda />
      </SistemaProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getByText(/Pedido sem conflito/)).toBeInTheDocument();
  });

  it("em Meus pedidos aparecem o status, o motivo da recusa e o cancelamento", async () => {
    const user = userEvent.setup();
    renderEspacos("ana", "meus");
    expect(screen.getByText("Pedido da Ana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar Pedido da Ana" }));
    expect(ler<PedidoEspaco[]>("espacos", []).find((p) => p.id === "pendente")!.status).toBe("cancelado");
  });

  it("o gestor devolve com observação; o solicitante corrige e reenvia para a fila", async () => {
    const user = userEvent.setup();
    const { unmount } = renderEspacos("marcos", "fila");
    await user.click(screen.getByRole("button", { name: "Devolver Pedido da Ana para correção" }));
    const dialogo = screen.getByRole("dialog", { name: "Devolver para correção: Pedido da Ana" });
    const campo = within(dialogo).getByLabelText("Observação: o que precisa ser corrigido");
    expect((campo as HTMLTextAreaElement).value).toContain('Conflita com "Reunião aprovada"');
    await user.clear(campo);
    await user.click(within(dialogo).getByRole("button", { name: "Devolver ao solicitante" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Diga o que o solicitante precisa corrigir.");
    await user.type(campo, "Troque para a tarde: de manhã o auditório já está ocupado.");
    await user.click(within(dialogo).getByRole("button", { name: "Devolver ao solicitante" }));
    expect(ler<PedidoEspaco[]>("espacos", []).find((p) => p.id === "pendente")).toMatchObject({ status: "devolvido", correcao: "Troque para a tarde: de manhã o auditório já está ocupado." });
    expect(ler<RegistroHistorico[]>("historico", [])[0]).toMatchObject({ funcionarioId: "marcos", acao: 'Devolveu para correção o pedido de espaço "Pedido da Ana"' });
    unmount();

    renderEspacos("ana", "meus");
    expect(screen.getByRole("tab", { name: "Meus pedidos (1 para corrigir)" })).toBeInTheDocument();
    expect(screen.getByText("O que corrigir: Troque para a tarde: de manhã o auditório já está ocupado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Corrigir e reenviar Pedido da Ana" }));
    const correcao = screen.getByRole("dialog", { name: "Corrigir pedido: Pedido da Ana" });
    await user.selectOptions(within(correcao).getByLabelText("Período"), "tarde");
    await user.click(within(correcao).getByRole("button", { name: "Reenviar para a fila" }));
    expect(ler<PedidoEspaco[]>("espacos", []).find((p) => p.id === "pendente")).toMatchObject({ status: "pendente", periodo: "tarde", inicio: "13:00", correcao: "" });
  });
});
