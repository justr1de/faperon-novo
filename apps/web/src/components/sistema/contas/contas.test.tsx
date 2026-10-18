import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { Despesa } from "@/lib/sistema/tipos";
import { Contas } from "./contas";

let aba = "minhas";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: (url: string) => (aba = new URL(url, "http://x").searchParams.get("aba") ?? "minhas") }),
  usePathname: () => "/sistema/contas",
  useSearchParams: () => new URLSearchParams(`aba=${aba}`),
}));

function despesa(parcial: Partial<Despesa> & Pick<Despesa, "id" | "descricao">): Despesa {
  return {
    funcionarioId: "carla",
    data: "2026-10-10",
    centro: "Comunicação",
    categoria: "material",
    fornecedor: "",
    valor: 100,
    comprovante: null,
    status: "enviada",
    observacaoGestor: "",
    criadaEm: "2026-10-10T10:00",
    ...parcial,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  gravar("contas", [
    despesa({ id: "a", descricao: "Papel A4" }),
    despesa({ id: "b", descricao: "Lanche da reunião", status: "devolvida", observacaoGestor: "Falta nota fiscal." }),
    despesa({ id: "c", descricao: "Despesa do João", funcionarioId: "joao", centro: "Sindical" }),
  ]);
});

function renderContas(quem: string, abaInicial = "minhas") {
  aba = abaInicial;
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <Contas />
    </SistemaProvider>,
  );
}

const salvas = () => ler<Despesa[]>("contas", []);

describe("Prestação de contas", () => {
  it("lança despesa, valida e envia para aprovação com o centro da área", async () => {
    const user = userEvent.setup();
    renderContas("ana");
    await user.click(screen.getByRole("button", { name: "Nova despesa" }));
    const dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Enviar para aprovação" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Descreva a despesa.");
    await user.type(within(dialogo).getByLabelText("Descrição"), "Combustível do gerador");
    await user.type(within(dialogo).getByLabelText("Valor (R$)"), "1.250,40");
    await user.click(within(dialogo).getByRole("button", { name: "Enviar para aprovação" }));
    const nova = salvas().find((d) => d.descricao === "Combustível do gerador")!;
    expect(nova).toMatchObject({ valor: 1250.4, centro: "Técnica", status: "enviada", funcionarioId: "ana" });
  });

  it("a devolvida mostra a observação e pode ser corrigida e reenviada; a enviada não se edita", async () => {
    const user = userEvent.setup();
    renderContas("carla");
    expect(screen.getByText("Devolvida: Falta nota fiscal.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Papel A4" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enviar Lanche da reunião" }));
    expect(salvas().find((d) => d.id === "b")).toMatchObject({ status: "enviada", observacaoGestor: "" });
  });

  it("só o gestor vê a aprovação; aprova e devolve com observação obrigatória", async () => {
    const user = userEvent.setup();
    const { unmount } = renderContas("carla");
    expect(screen.queryByRole("tab", { name: "Aprovação" })).toBeNull();
    unmount();

    renderContas("marcos", "aprovacao");
    await user.click(screen.getByRole("button", { name: "Aprovar Papel A4" }));
    expect(salvas().find((d) => d.id === "a")!.status).toBe("aprovada");
    await user.click(screen.getByRole("button", { name: "Devolver Despesa do João" }));
    await user.click(screen.getByRole("button", { name: "Devolver despesa" }));
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("Diga o que precisa ser corrigido."))).toBe(true);
    await user.type(screen.getByLabelText("O que precisa ser corrigido"), "Anexe o recibo.");
    await user.click(screen.getByRole("button", { name: "Devolver despesa" }));
    expect(salvas().find((d) => d.id === "c")).toMatchObject({ status: "devolvida", observacaoGestor: "Anexe o recibo." });
  });

  it("por centro de custo soma enviadas e aprovadas do período", async () => {
    const user = userEvent.setup();
    renderContas("marcos", "centros");
    await user.clear(screen.getByLabelText("De"));
    await user.type(screen.getByLabelText("De"), "2026-10-01");
    await user.clear(screen.getByLabelText("Até"));
    await user.type(screen.getByLabelText("Até"), "2026-10-31");
    const linha = screen.getByRole("rowheader", { name: "Comunicação" }).closest("tr")!;
    expect(linha).toHaveTextContent("R$ 100,00");
    expect(screen.getByRole("rowheader", { name: "Sindical" }).closest("tr")).toHaveTextContent("R$ 100,00");
  });

  it("comprovante: recusa HTML (não vira link para abrir) e aceita imagem pequena", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderContas("ana");
    await user.click(screen.getByRole("button", { name: "Nova despesa" }));
    const dialogo = screen.getByRole("dialog");
    const campo = within(dialogo).getByLabelText("Comprovante (imagem ou PDF)");
    await user.upload(campo, new File(["<script>alert(1)</script>"], "nota.html", { type: "text/html" }));
    expect(await within(dialogo).findByText("Envie uma imagem (PNG, JPEG ou WebP) ou um PDF.")).toBeInTheDocument();
    expect(within(dialogo).queryByText("nota.html")).toBeNull();
    await user.upload(campo, new File([new Uint8Array([137, 80, 78, 71])], "recibo.png", { type: "image/png" }));
    expect(await within(dialogo).findByText("recibo.png")).toBeInTheDocument();
  });

  it("aplica tag numa despesa e filtra por ela em todas as abas", async () => {
    const user = userEvent.setup();
    renderContas("carla");
    await user.click(screen.getByRole("button", { name: "Nova despesa" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Descrição"), "Faixa da assembleia");
    await user.type(within(dialogo).getByLabelText("Valor (R$)"), "90");
    await user.click(within(dialogo).getByRole("checkbox", { name: "Assembleia" }));
    await user.click(within(dialogo).getByRole("button", { name: "Salvar rascunho" }));
    expect(salvas().find((d) => d.descricao === "Faixa da assembleia")?.tags).toEqual(["tag-assembleia"]);

    await user.selectOptions(screen.getByLabelText("Tag"), "Assembleia");
    expect(screen.getByText("Faixa da assembleia")).toBeInTheDocument();
    expect(screen.queryByText("Papel A4")).toBeNull();
    const item = screen.getByText("Faixa da assembleia").closest("li")!;
    expect(within(item).getByRole("list", { name: "Tags" })).toHaveTextContent("Assembleia");
  });
});
