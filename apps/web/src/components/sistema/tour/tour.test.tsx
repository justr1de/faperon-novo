import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR } from "@/content/sistema/tour";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import { InicioSistema } from "../inicio-sistema";
import { TourProvider, tourJaVisto } from "./tour";

const push = vi.fn((url: string) => window.history.pushState({}, "", url));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/sistema");
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  push.mockClear();
  entrarComo("carla");
});

function renderInicio() {
  return render(
    <SistemaProvider>
      <TourProvider>
        <nav data-tour="barra">menu</nav>
        <InicioSistema />
      </TourProvider>
    </SistemaProvider>,
  );
}

const cartao = () => screen.getByRole("dialog", { name: /./ });

describe("tour guiado", () => {
  it("cobre todas as áreas do sistema, com instruções", () => {
    const secoes = new Set(TOUR.map((p) => p.secao));
    for (const s of ["Início", "Agenda", "Frotas", "Espaços", "Contas", "Atividades", "Relatórios"]) expect(secoes).toContain(s);
    expect(TOUR.filter((p) => p.passos?.length).length).toBeGreaterThanOrEqual(8);
  });

  it("convida na primeira visita, anda pelos passos e pelas telas, e some depois de concluído ou dispensado", async () => {
    const user = userEvent.setup();
    renderInicio();
    await user.click(screen.getByRole("button", { name: "Começar o tour" }));
    expect(await screen.findByRole("heading", { name: "O menu do sistema" })).toHaveFocus();
    expect(cartao()).toHaveTextContent(`passo 1 de ${TOUR.length}`);
    expect(within(cartao()).getByRole("button", { name: "Voltar" })).toBeDisabled();

    await user.click(within(cartao()).getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("heading", { name: "Atalhos do dia" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("heading", { name: "Marcar um compromisso" })).toBeInTheDocument();
    expect(push).toHaveBeenLastCalledWith("/sistema/agenda", { scroll: false });
    expect(within(cartao()).getByText(/Clique em Novo evento/)).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("heading", { name: "Atalhos do dia" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tourJaVisto()).toBe(true);
    expect(screen.queryByText("Primeira vez por aqui?")).toBeNull();
  });

  it("o último passo conclui; 'Agora não' também dispensa o convite", async () => {
    const user = userEvent.setup();
    const { unmount } = renderInicio();
    await user.click(screen.getByRole("button", { name: "Começar o tour" }));
    for (let i = 1; i < TOUR.length; i++) await user.click(within(cartao()).getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("heading", { name: "Ficou com dúvida?" })).toBeInTheDocument();
    await user.click(within(cartao()).getByRole("button", { name: "Concluir o tour" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    window.localStorage.clear();
    entrarComo("carla");
    renderInicio();
    await user.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByText("Primeira vez por aqui?")).toBeNull();
    expect(tourJaVisto()).toBe(true);
  });
});
