import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entrarComo } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import { Agenda } from "../agenda/agenda";
import { Espacos } from "../espacos/espacos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/sistema",
  useSearchParams: () => new URLSearchParams(),
}));

class ReconhecedorFalso {
  static ultimo: ReconhecedorFalso | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    ReconhecedorFalso.ultimo = this;
  }
  falar(...partes: string[]) {
    this.onresult?.({ results: partes.map((p) => [{ transcript: p }]) });
  }
}

function responder(corpo: unknown, status = 200) {
  const buscar = vi.fn(async () => new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal("fetch", buscar);
  return buscar;
}

function renderCom(componente: React.ReactNode) {
  entrarComo("carla");
  return render(<SistemaProvider>{componente}</SistemaProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  ReconhecedorFalso.ultimo = null;
});

describe("Agendar por voz", () => {
  it("ouve em pt-BR, mostra a transcrição e abre o evento preenchido para conferir", async () => {
    vi.stubGlobal("webkitSpeechRecognition", ReconhecedorFalso);
    const buscar = responder({
      tipo: "evento",
      campos: { titulo: "Reunião com o sindicato", data: "2026-10-20", inicio: "09:00", fim: "10:00", local: "Sede", tipo: "reuniao", descricao: "" },
      faltando: [],
    });
    const user = userEvent.setup();
    renderCom(<Agenda />);
    await user.click(screen.getByRole("button", { name: "Agendar por voz" }));
    await user.click(screen.getByRole("button", { name: "Falar" }));
    const rec = ReconhecedorFalso.ultimo!;
    expect(rec.lang).toBe("pt-BR");
    // a agenda também tem a região de avisos; aqui vale a do microfone
    expect(screen.getByText(/Ouvindo…/).closest('[role="status"]')).not.toBeNull();
    act(() => rec.falar("reunião com o sindicato", " terça às nove na sede"));
    expect(screen.getByLabelText("O que entendi (pode corrigir)")).toHaveValue("reunião com o sindicato terça às nove na sede");
    await user.click(screen.getByRole("button", { name: "Preencher formulário" }));

    const corpo = JSON.parse(String((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo).toMatchObject({ tipo: "evento", texto: "reunião com o sindicato terça às nove na sede" });
    const dialogo = screen.getByRole("dialog", { name: "Novo evento" });
    expect(within(dialogo).getByText(/Preenchido por voz/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Título")).toHaveValue("Reunião com o sindicato");
    expect(within(dialogo).getByLabelText("Data")).toHaveValue("2026-10-20");
  });

  it("sem reconhecimento de voz, aceita a frase digitada; erro do servidor aparece no diálogo", async () => {
    responder({ erro: "x" }, 422);
    const user = userEvent.setup();
    renderCom(<Agenda />);
    await user.click(screen.getByRole("button", { name: "Agendar por voz" }));
    expect(screen.getByText(/não reconhece voz/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Preencher formulário" }));
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("Fale ou digite"))).toBe(true);
    await user.type(screen.getByLabelText("Frase do agendamento"), "almoço amanhã");
    await user.click(screen.getByRole("button", { name: "Preencher formulário" }));
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("Não consegui entender"))).toBe(true);
    expect(screen.getByRole("dialog", { name: "Agendar por voz" })).toBeInTheDocument();
  });

  it("microfone bloqueado vira orientação", async () => {
    vi.stubGlobal("webkitSpeechRecognition", ReconhecedorFalso);
    const user = userEvent.setup();
    renderCom(<Agenda />);
    await user.click(screen.getByRole("button", { name: "Agendar por voz" }));
    await user.click(screen.getByRole("button", { name: "Falar" }));
    act(() => ReconhecedorFalso.ultimo!.onerror?.({ error: "not-allowed" }));
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("acesso ao microfone"))).toBe(true);
  });

  it("pedido de espaço: manda a lista de espaços e abre com nome, participantes e coffee break", async () => {
    const buscar = responder({
      tipo: "espaco",
      campos: { espacoId: "auditorio", data: "2026-10-20", periodo: "tarde", inicio: "", fim: "", tipo: "palestra", nome: "Palestra de crédito rural", participantes: 80, coffeeBreak: true, observacoes: "" },
      faltando: [],
    });
    const user = userEvent.setup();
    renderCom(<Espacos />);
    await user.click(screen.getByRole("button", { name: "Agendar por voz" }));
    await user.type(screen.getByLabelText("Frase do agendamento"), "auditório dia 20 à tarde, palestra para 80 com coffee");
    await user.click(screen.getByRole("button", { name: "Preencher formulário" }));
    const corpo = JSON.parse(String((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.espacos).toContainEqual({ id: "auditorio", descricao: "Auditório" });
    const dialogo = screen.getByRole("dialog", { name: "Novo pedido de espaço" });
    expect(within(dialogo).getByLabelText(/Nome do evento/)).toHaveValue("Palestra de crédito rural");
    expect(within(dialogo).getByLabelText(/participantes/i)).toHaveValue(80);
    expect(within(dialogo).getByLabelText(/Coffee break/i)).toBeChecked();
  });
});
