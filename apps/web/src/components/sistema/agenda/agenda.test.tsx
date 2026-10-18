import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { hojeISO } from "@/lib/sistema/datas";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { Evento } from "@/lib/sistema/tipos";
import { Agenda } from "./agenda";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sistema/agenda" }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function renderAgenda(quem: string) {
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Agenda />
    </SistemaProvider>,
  );
}

async function criarEvento(user: ReturnType<typeof userEvent.setup>, titulo: string) {
  await user.click(screen.getByRole("button", { name: "Novo evento" }));
  const dialogo = screen.getByRole("dialog", { name: "Novo evento" });
  expect(within(dialogo).getByLabelText("Título")).toHaveFocus();
  await user.type(within(dialogo).getByLabelText("Título"), titulo);
  await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
}

describe("Agenda individual", () => {
  it("cria um evento que aparece no mês e na lista", async () => {
    const user = userEvent.setup();
    renderAgenda("carla");
    await criarEvento(user, "Entrevista com a rádio");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Editar Entrevista com a rádio/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getByText(/Entrevista com a rádio/)).toBeInTheDocument();
  });

  it("valida título e horário", async () => {
    const user = userEvent.setup();
    renderAgenda("carla");
    await user.click(screen.getByRole("button", { name: "Novo evento" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o título do evento.");
    await user.type(screen.getByLabelText("Título"), "X");
    await user.clear(screen.getByLabelText("Fim"));
    await user.type(screen.getByLabelText("Fim"), "08:00");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("O fim precisa ser depois do início.");
  });

  it("outro funcionário não vê o evento", async () => {
    const user = userEvent.setup();
    const { unmount } = renderAgenda("carla");
    await criarEvento(user, "Só da Carla");
    unmount();
    renderAgenda("joao");
    expect(screen.queryByText(/Só da Carla/)).toBeNull();
  });

  it("edita e exclui o próprio evento", async () => {
    const user = userEvent.setup();
    renderAgenda("ana");
    await criarEvento(user, "Rascunho");
    await user.click(screen.getByRole("button", { name: /Editar Rascunho/ }));
    await user.click(screen.getByRole("button", { name: "Excluir evento" }));
    expect(screen.queryByRole("button", { name: /Editar Rascunho/ })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Evento “Rascunho” excluído.");
  });

  it("Desfazer devolve o evento excluído", async () => {
    const user = userEvent.setup();
    renderAgenda("ana");
    await criarEvento(user, "Visita ao sindicato");
    await user.click(screen.getByRole("button", { name: /Editar Visita ao sindicato/ }));
    await user.click(screen.getByRole("button", { name: "Excluir evento" }));
    await user.click(within(screen.getByRole("status")).getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("button", { name: /Editar Visita ao sindicato/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("restaurado");
  });

  it("ao salvar, avisa a data e leva ao mês do evento", async () => {
    const user = userEvent.setup();
    renderAgenda("carla");
    await user.click(screen.getByRole("button", { name: "Novo evento" }));
    const dialogo = screen.getByRole("dialog", { name: "Novo evento" });
    await user.type(within(dialogo).getByLabelText("Título"), "Feira de Ji-Paraná");
    const data = within(dialogo).getByLabelText("Data");
    await user.clear(data);
    await user.type(data, "2031-03-14");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Marcado para .*14 de março.*às 09:00/);
    expect(screen.getByRole("heading", { level: 2, name: /Março 2031/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar Feira de Ji-Paraná/ })).toBeInTheDocument();
  });

  it("viagem de vários dias aparece em todos os dias, para quem viaja e para os colegas", async () => {
    const hoje = hojeISO();
    const depois = (n: number) => {
      const d = new Date(`${hoje}T12:00`);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    gravar("frota", {
      veiculos: [{ id: "v1", placa: "ABC1D23", modelo: "Hilux", ano: 2022, km: 1000 }],
      reservas: [{ id: "r9", veiculoId: "v1", funcionarioId: "joao", saida: `${hoje}T07:00`, retorno: `${depois(2)}T18:00`, destino: "Vilhena", motivo: "x", kmInicial: null, kmFinal: null, situacao: "agendada" }],
      abastecimentos: [],
      manutencoes: [],
    });
    const user = userEvent.setup();
    const { unmount } = renderAgenda("joao");
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getAllByRole("link", { name: /Viagem a Vilhena/ })).toHaveLength(3);
    expect(screen.getByText("dia todo")).toBeInTheDocument();
    expect(screen.getByText("volta 18:00")).toBeInTheDocument();
    unmount();
    renderAgenda("carla");
    await user.click(screen.getByRole("button", { name: "Lista" }));
    // a colega vê os três dias, sem link para a reserva do João
    expect(screen.getAllByText(/João Pereira em viagem a Vilhena/)).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /Vilhena/ })).toBeNull();
  });

  it("eventos da FAPERON aparecem para todos, sem edição; a reserva de veículo aparece como viagem", async () => {
    const hoje = hojeISO();
    gravar("frota", {
      veiculos: [{ id: "v1", placa: "ABC1D23", modelo: "Hilux", ano: 2022, km: 1000 }],
      reservas: [{ id: "r1", veiculoId: "v1", funcionarioId: "luiza", saida: `${hoje}T08:00`, retorno: `${hoje}T12:00`, destino: "Cacoal", motivo: "x", kmInicial: null, kmFinal: null, situacao: "agendada" }],
      abastecimentos: [],
      manutencoes: [],
    });
    const user = userEvent.setup();
    renderAgenda("luiza");
    // no mês, a viagem vira faixa com o destino
    expect(screen.getByRole("link", { name: /Viagem da frota, Cacoal/ })).toHaveAttribute("href", "/sistema/frotas?aba=reservas");
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(screen.getByRole("link", { name: /Viagem a Cacoal/ })).toHaveAttribute("href", "/sistema/frotas?aba=reservas");
    const institucional = screen.getAllByText("FAPERON")[0]!;
    expect(institucional.closest("button")).toBeNull();
  });

  it("aplica tag ao evento próprio, mostra o chip na lista e filtra o mês e a lista pela tag", async () => {
    const user = userEvent.setup();
    renderAgenda("carla");
    await user.click(screen.getByRole("button", { name: "Novo evento" }));
    const dialogo = screen.getByRole("dialog", { name: "Novo evento" });
    // só quem gere tem o atalho
    expect(within(dialogo).queryByRole("button", { name: "Gerenciar tags" })).toBeNull();
    await user.type(within(dialogo).getByLabelText("Título"), "Conversa com o sindicato");
    const sindicatos = within(dialogo).getByRole("checkbox", { name: "Sindicatos" });
    await user.click(sindicatos);
    expect(sindicatos).toBeChecked();
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));

    await user.selectOptions(screen.getByLabelText("Tag"), "Sindicatos");
    expect(screen.getByRole("button", { name: /Editar Conversa com o sindicato/ })).toBeInTheDocument();
    // o evento próprio sem a tag some do mês
    expect(screen.queryByRole("button", { name: /Editar Pauta do informativo mensal/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Lista" }));
    const item = screen.getByRole("button", { name: /Editar Conversa com o sindicato/ }).closest("li")!;
    expect(within(within(item).getByRole("list", { name: "Tags" })).getByText("Sindicatos")).toBeInTheDocument();
    expect(screen.queryByText(/Pauta do informativo mensal/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Tag"), "Todas");
    expect(screen.getByText(/Pauta do informativo mensal/)).toBeInTheDocument();
  });

  it("legenda mostra os tipos presentes (cor) e as origens (forma)", () => {
    renderAgenda("carla");
    const tipos = screen.getByRole("list", { name: "Cores por tipo" });
    expect(within(tipos).getByText("Reunião")).toBeInTheDocument();
    expect(within(tipos).queryByText("Atendimento ao produtor")).toBeNull();
    const origens = screen.getByRole("list", { name: "Origem dos eventos" });
    for (const o of ["Meus eventos", "FAPERON", "Viagens da frota", "Espaços aprovados"]) expect(within(origens).getByText(o)).toBeInTheDocument();
  });

  it("o gestor abre Gerenciar tags de dentro do formulário sem perder o evento", async () => {
    const user = userEvent.setup();
    renderAgenda("marcos");
    await user.click(screen.getByRole("button", { name: "Novo evento" }));
    const formulario = screen.getByRole("dialog", { name: "Novo evento" });
    await user.type(within(formulario).getByLabelText("Título"), "Visita à feira");
    await user.click(within(formulario).getByRole("button", { name: "Gerenciar tags" }));
    const gerir = screen.getByRole("dialog", { name: "Gerenciar tags" });
    await user.type(within(gerir).getByLabelText("Nova tag"), "Feira regional{Enter}");
    // o Enter enviou só o formulário de dentro: o evento não foi salvo e os dois diálogos seguem abertos
    expect(within(gerir).getByLabelText("Nome da tag Feira regional")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Novo evento" })).toBeInTheDocument();
    expect(ler<Evento[]>("agenda:marcos", []).some((e) => e.titulo === "Visita à feira")).toBe(false);
    // Esc fecha só o de cima
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Gerenciar tags" })).toBeNull();
    // o formulário continua aberto, com o título digitado e a tag nova para marcar
    expect(within(formulario).getByLabelText("Título")).toHaveValue("Visita à feira");
    await user.click(within(formulario).getByRole("checkbox", { name: "Feira regional" }));
    await user.click(within(formulario).getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("button", { name: /Editar Visita à feira/ })).toBeInTheDocument();
  });

  it("id de tag que não existe mais não volta a ser gravado", async () => {
    const hoje = hojeISO();
    gravar("agenda:carla", [
      { id: "c1", titulo: "Pauta antiga", data: hoje, inicio: "09:00", fim: "10:00", local: "", descricao: "", tipo: "reuniao", origem: "pessoal", tags: ["tag-apagada", "tag-sindicatos"] },
    ]);
    const user = userEvent.setup();
    renderAgenda("carla");
    await user.click(screen.getByRole("button", { name: /Editar Pauta antiga/ }));
    const dialogo = screen.getByRole("dialog", { name: "Editar evento" });
    expect(within(dialogo).getByRole("checkbox", { name: "Sindicatos" })).toBeChecked();
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(ler<Evento[]>("agenda:carla", []).find((e) => e.id === "c1")?.tags).toEqual(["tag-sindicatos"]);
  });
});
