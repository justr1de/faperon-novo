import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import type { Atividade, Evento, RegistroHistorico, Tag } from "@/lib/sistema/tipos";
import { BarraSistema } from "./barra-sistema";
import { TourProvider } from "./tour/tour";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sistema" }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function renderBarra(quem: string) {
  entrarComo(quem);
  return render(
    <SistemaProvider>
      <TourProvider>
        <BarraSistema />
      </TourProvider>
    </SistemaProvider>,
  );
}

const nomes = () => ler<Tag[]>("tags", []).map((t) => t.nome);
const acoes = () => ler<RegistroHistorico[]>("historico", []).map((r) => r.acao);

describe("Gerenciar tags", () => {
  it("só aparece para quem gere (coordenador ou gestor)", () => {
    const { unmount } = renderBarra("carla");
    expect(screen.queryByRole("button", { name: "Gerenciar tags" })).toBeNull();
    unmount();
    renderBarra("marcos");
    expect(screen.getByRole("button", { name: "Gerenciar tags" })).toBeInTheDocument();
  });

  it("cria tag, recusa nome vazio ou repetido (sem caixa nem acento) e anota no histórico", async () => {
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    const campo = within(dialogo).getByLabelText("Nova tag");
    expect(campo).toHaveFocus();

    await user.click(within(dialogo).getByRole("button", { name: "Criar tag" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Informe o nome da tag.");
    await user.type(campo, "dia de câmpo");
    await user.click(within(dialogo).getByRole("button", { name: "Criar tag" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Já existe a tag “Dia de campo”.");

    await user.clear(campo);
    await user.type(campo, "Feira regional");
    await user.selectOptions(within(dialogo).getByLabelText("Cor da nova tag"), "magenta");
    await user.click(within(dialogo).getByRole("button", { name: "Criar tag" }));
    expect(within(dialogo).getByLabelText("Nome da tag Feira regional")).toHaveValue("Feira regional");
    expect(ler<Tag[]>("tags", []).find((t) => t.nome === "Feira regional")?.cor).toBe("magenta");
    expect(acoes()).toContain('Criou a tag "Feira regional"');
  });

  it("renomeia e troca a cor", async () => {
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    const nome = within(dialogo).getByLabelText("Nome da tag SENAR");
    await user.clear(nome);
    await user.type(nome, "Sindicatos");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar a tag SENAR" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Já existe a tag “Sindicatos”.");

    await user.clear(nome);
    await user.type(nome, "Cursos SENAR");
    await user.selectOptions(within(dialogo).getByLabelText("Cor da tag SENAR"), "indigo");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar a tag SENAR" }));
    expect(nomes()).toContain("Cursos SENAR");
    expect(nomes()).not.toContain("SENAR");
    expect(acoes()).toContain('Renomeou a tag "SENAR" para "Cursos SENAR" e trocou a cor para índigo');
  });

  it("apagar pede confirmação e tira a tag dos itens", async () => {
    const user = userEvent.setup();
    renderBarra("marcos");
    // os dados de exemplo já trazem a tag Urgente num evento do Marcos e SENAR numa atividade
    expect(ler<Evento[]>("agenda:marcos", []).length).toBe(0);
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag Urgente" }));
    const confirmar = within(dialogo).getByRole("group", { name: "Confirmar: apagar a tag Urgente" });
    await user.click(within(confirmar).getByRole("button", { name: "Manter" }));
    expect(within(dialogo).getByLabelText("Nome da tag Urgente")).toBeInTheDocument();

    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag Urgente" }));
    await user.click(within(dialogo).getByRole("button", { name: "Apagar tag" }));
    expect(nomes()).not.toContain("Urgente");
    expect(within(dialogo).queryByLabelText("Nome da tag Urgente")).toBeNull();
    const agenda = ler<Evento[]>("agenda:marcos", []);
    expect(agenda.find((e) => e.titulo === "Conferir notas de abastecimento")?.tags).toEqual([]);
    expect(acoes()).toContain('Apagou a tag "Urgente"');

    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag SENAR" }));
    await user.click(within(dialogo).getByRole("button", { name: "Apagar tag" }));
    expect(ler<Atividade[]>("atividades", []).some((a) => a.tags?.includes("tag-senar"))).toBe(false);
  });

  it("o foco não sai do diálogo: depois de apagar vai para Nova tag, e Esc continua fechando", async () => {
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag Urgente" }));
    expect(within(dialogo).getByRole("button", { name: "Manter" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(within(dialogo).getByRole("button", { name: "Apagar a tag Urgente" })).toHaveFocus();

    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag Urgente" }));
    await user.click(within(dialogo).getByRole("button", { name: "Apagar tag" }));
    expect(within(dialogo).getByLabelText("Nova tag")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("salvar pelo teclado mantém o foco no botão (aria-disabled), e Esc fecha", async () => {
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    const salvar = within(dialogo).getByRole("button", { name: "Salvar a tag SENAR" });
    expect(salvar).toHaveAttribute("aria-disabled", "true");
    await user.type(within(dialogo).getByLabelText("Nome da tag SENAR"), " RO");
    expect(salvar).toHaveAttribute("aria-disabled", "false");
    salvar.focus();
    await user.keyboard("{Enter}");
    expect(nomes()).toContain("SENAR RO");
    const depois = within(dialogo).getByRole("button", { name: "Salvar a tag SENAR RO" });
    expect(depois).toHaveFocus();
    expect(depois).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("apagar tira a tag da agenda gravada de um colega", async () => {
    gravar("agenda:joao", [
      { id: "j1", titulo: "Reunião no sindicato", data: "2026-10-20", inicio: "09:00", fim: "10:00", local: "", descricao: "", tipo: "reuniao", origem: "pessoal", tags: ["tag-sindicatos", "tag-urgente"] },
    ]);
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    await user.click(within(dialogo).getByRole("button", { name: "Apagar a tag Sindicatos" }));
    await user.click(within(dialogo).getByRole("button", { name: "Apagar tag" }));
    expect(ler<Evento[]>("agenda:joao", [])[0]!.tags).toEqual(["tag-urgente"]);
    // a da Carla nunca foi gravada: continua sem existir (os exemplos não se congelam)
    expect(ler<Evento[] | null>("agenda:carla", null)).toBeNull();
  });

  it("lista de tags corrompida no navegador não quebra a tela", async () => {
    gravar("tags", [{ id: "t1", nome: "Boa", cor: "azul" }, { id: "t2", nome: "Cor estranha", cor: "verde-limao" }, { nome: "Sem id" }, 42]);
    const user = userEvent.setup();
    renderBarra("marcos");
    await user.click(screen.getByRole("button", { name: "Gerenciar tags" }));
    const dialogo = screen.getByRole("dialog", { name: "Gerenciar tags" });
    expect(within(dialogo).getAllByRole("textbox", { name: /^Nome da tag/ })).toHaveLength(2);
    expect(within(dialogo).getByLabelText("Cor da tag Cor estranha")).toHaveValue("azul");
  });
});
