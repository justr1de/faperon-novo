import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { hojeISO, somarDias } from "@/lib/sistema/datas";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { EstadoFrota } from "@/lib/sistema/tipos";
import { Frotas } from "./frotas";

let aba = "veiculos";
const replace = vi.fn((url: string) => {
  aba = new URL(url, "http://x").searchParams.get("aba") ?? "veiculos";
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/sistema/frotas",
  useSearchParams: () => new URLSearchParams(`aba=${aba}`),
}));
vi.mock("@/components/painel/grafico", () => ({ Grafico: ({ descricao }: { descricao: string }) => <div role="img" aria-label={descricao} /> }));

const amanha = somarDias(hojeISO(), 1);
const FROTA: EstadoFrota = {
  veiculos: [
    { id: "v1", placa: "ABC1D23", modelo: "Hilux", ano: 2022, km: 10_000 },
    { id: "v2", placa: "XYZ9876", modelo: "Strada", ano: 2023, km: 5_000 },
  ],
  reservas: [{ id: "r1", veiculoId: "v1", funcionarioId: "ana", saida: `${amanha}T08:00`, retorno: `${amanha}T18:00`, destino: "Cacoal", motivo: "", kmInicial: null, kmFinal: null, situacao: "agendada" }],
  abastecimentos: [],
  manutencoes: [{ id: "m1", veiculoId: "v1", data: "2026-01-01", tipo: "revisao", valor: 500, km: 9_000, concluida: true }],
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  aba = "veiculos";
  gravar("frota", FROTA);
});

function renderFrotas(quem: string, abaInicial = "veiculos") {
  aba = abaInicial;
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Frotas />
    </SistemaProvider>,
  );
}

describe("Gestão de frotas", () => {
  it("lista veículos; só o gestor cadastra, com placa validada e sem repetir", async () => {
    const user = userEvent.setup();
    const { unmount } = renderFrotas("carla");
    expect(screen.getByRole("rowheader", { name: "ABC1D23" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "XYZ-9876" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cadastrar veículo" })).toBeNull();
    unmount();

    renderFrotas("marcos");
    await user.click(screen.getByRole("button", { name: "Cadastrar veículo" }));
    const dialogo = screen.getByRole("dialog", { name: "Cadastrar veículo" });
    await user.type(within(dialogo).getByLabelText("Placa"), "12345");
    await user.type(within(dialogo).getByLabelText("Modelo"), "Gol");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar veículo" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Placa inválida");
    await user.clear(within(dialogo).getByLabelText("Placa"));
    await user.type(within(dialogo).getByLabelText("Placa"), "xyz-9876");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar veículo" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Já existe um veículo com essa placa.");
    await user.clear(within(dialogo).getByLabelText("Placa"));
    await user.type(within(dialogo).getByLabelText("Placa"), "qwe2r45");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar veículo" }));
    expect(screen.getByRole("rowheader", { name: "QWE2R45" })).toBeInTheDocument();
    expect(ler<EstadoFrota | null>("frota", null)!.veiculos).toHaveLength(3);
  });

  it("reserva com choque de horário mostra o erro; sem choque, entra na lista", async () => {
    const user = userEvent.setup();
    renderFrotas("carla", "reservas");
    await user.click(screen.getByRole("button", { name: "Nova reserva" }));
    const dialogo = screen.getByRole("dialog", { name: "Nova reserva" });
    await user.selectOptions(within(dialogo).getByLabelText("Veículo"), "v1");
    await user.type(within(dialogo).getByLabelText("Destino"), "Vilhena");
    await user.click(within(dialogo).getByRole("button", { name: "Reservar" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("já está reservado");
    await user.selectOptions(within(dialogo).getByLabelText("Veículo"), "v2");
    await user.click(within(dialogo).getByRole("button", { name: "Reservar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Vilhena")).toBeInTheDocument();
  });

  it("saída e retorno registram o km e atualizam o veículo", async () => {
    const user = userEvent.setup();
    renderFrotas("ana", "reservas");
    await user.click(screen.getByRole("button", { name: "Registrar saída" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    await user.click(screen.getByRole("button", { name: "Registrar retorno" }));
    const campo = within(screen.getByRole("dialog")).getByLabelText("Km no retorno");
    await user.clear(campo);
    await user.type(campo, "9999");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("não pode ser menor");
    await user.clear(campo);
    await user.type(campo, "10350");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(screen.getByText(/350 km rodados/)).toBeInTheDocument();
    expect(ler<EstadoFrota | null>("frota", null)!.veiculos.find((v) => v.id === "v1")!.km).toBe(10_350);
  });

  it("só o gestor registra manutenção; qualquer um registra abastecimento", async () => {
    const user = userEvent.setup();
    renderFrotas("joao", "abastecimento");
    expect(screen.getByText("Só o gestor da frota registra manutenções.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Veículo"), "v2");
    await user.type(screen.getByLabelText("Km no hodômetro"), "5200");
    await user.type(screen.getByLabelText("Litros"), "40");
    await user.type(screen.getByLabelText("Valor total (R$)"), "251,60");
    await user.click(screen.getByRole("button", { name: "Registrar abastecimento" }));
    expect(screen.getByText("Abastecimento registrado.")).toBeInTheDocument();
    expect(ler<EstadoFrota | null>("frota", null)!.abastecimentos[0]!.valor).toBe(251.6);
  });

  it("custos mostram tabela e gráfico", () => {
    renderFrotas("marcos", "custos");
    expect(screen.getByRole("img", { name: /Custos mensais/ })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });
});
