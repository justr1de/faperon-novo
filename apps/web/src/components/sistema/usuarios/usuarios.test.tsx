import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esquecerConta, type UsuarioDaAdministracao } from "@/lib/sistema/conta";
import { entrarComo, perfilDe } from "@/lib/sistema/conta-de-teste";
import { SistemaProvider } from "@/lib/sistema/estado";
import { Usuarios } from "./usuarios";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/sistema/usuarios" }));

function usuario(codigo: string, extra: Partial<UsuarioDaAdministracao> = {}): UsuarioDaAdministracao {
  return { ...perfilDe(codigo), ativo: true, ultimo_acesso: null, criado_em: "2026-10-18T12:00:00Z", ...extra };
}

type Rota = (init: RequestInit) => Response;

function api(rotas: Record<string, Rota>) {
  const buscar = vi.fn(async (url: string, init: RequestInit = {}) => {
    const chave = `${init.method ?? "GET"} ${url}`;
    const rota = rotas[chave];
    return rota ? rota(init) : Response.json({ erro: `sem rota ${chave}`, campos: {} }, { status: 404 });
  });
  vi.stubGlobal("fetch", buscar);
  return buscar;
}

const LISTA = [
  usuario("carla", { ultimo_acesso: "2026-10-18T13:30:00Z" }),
  usuario("joao", { ativo: false }),
  usuario("marcos", { ultimo_acesso: "2026-10-18T14:00:00Z" }),
];

function renderizar() {
  return render(
    <SistemaProvider>
      <Usuarios />
    </SistemaProvider>,
  );
}

beforeEach(() => {
  esquecerConta();
  document.cookie = "csrftoken=t";
});
afterEach(() => vi.unstubAllGlobals());

describe("tela Usuários (ADR 0035)", () => {
  it("só administrador entra; os demais veem o aviso e a lista nem é pedida", () => {
    entrarComo("carla");
    const buscar = api({});
    renderizar();
    expect(screen.getByRole("heading", { name: "Usuários" })).toBeInTheDocument();
    expect(screen.getByText("Só administradores gerenciam usuários.")).toBeInTheDocument();
    expect(buscar).not.toHaveBeenCalled();
  });

  it("lista nome, e-mail, área, papéis, situação e último acesso", async () => {
    entrarComo("marcos");
    api({ "GET /api/v1/usuarios": () => Response.json(LISTA) });
    renderizar();
    const tabela = await screen.findByRole("table", { name: "Usuários do sistema" });
    const cabecalho = within(tabela).getAllByRole("columnheader").map((c) => c.textContent);
    expect(cabecalho.slice(0, 6)).toEqual(["Nome", "E-mail", "Área", "Papéis", "Situação", "Último acesso"]);
    const marcos = within(tabela).getByRole("row", { name: /Marcos Oliveira/ });
    expect(marcos).toHaveTextContent("marcos@exemplo.faperon.br");
    expect(marcos).toHaveTextContent("Administrador");
    expect(marcos).toHaveTextContent("Gestor da frota");
    expect(within(tabela).getByRole("row", { name: /João Pereira/ })).toHaveTextContent("Desativado");
    expect(within(tabela).getByRole("row", { name: /João Pereira/ })).toHaveTextContent("Nunca");
    // ninguém desativa a própria conta pela tela
    expect(within(marcos).queryByRole("button", { name: /Desativar/ })).toBeNull();
  });

  it("cria uma conta e mostra a senha temporária uma vez, com Copiar", async () => {
    entrarComo("marcos");
    const nova = usuario("ana", { precisa_trocar_senha: true, gestor_frota: true });
    const buscar = api({
      "GET /api/v1/usuarios": () => Response.json(LISTA),
      "POST /api/v1/usuarios": () => Response.json({ usuario: nova, senha_temporaria: "k7Pm-x2Qa-9Ztd-RfW3" }, { status: 201 }),
    });
    // o user-event troca a área de transferência no setup: o espião vem depois dele
    const user = userEvent.setup();
    const copiar = vi.spyOn(navigator.clipboard, "writeText");
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Novo usuário" }));
    const dialogo = screen.getByRole("dialog", { name: "Novo usuário" });
    await user.type(within(dialogo).getByLabelText("Nome"), "Ana Ribeiro");
    await user.type(within(dialogo).getByLabelText("E-mail"), "ana@exemplo.faperon.br");
    await user.selectOptions(within(dialogo).getByLabelText("Área"), "Técnica");
    await user.click(within(dialogo).getByLabelText("Gestor da frota"));
    await user.click(within(dialogo).getByRole("button", { name: "Criar usuário" }));

    const senha = await screen.findByRole("dialog", { name: "Senha temporária de Ana Ribeiro" });
    expect(senha).toHaveTextContent("k7Pm-x2Qa-9Ztd-RfW3");
    expect(senha).toHaveTextContent("aparece só agora");
    await user.click(within(senha).getByRole("button", { name: "Copiar" }));
    expect(copiar).toHaveBeenCalledWith("k7Pm-x2Qa-9Ztd-RfW3");
    expect(await within(senha).findByText("Copiada.")).toBeInTheDocument();
    const corpo = JSON.parse(String(buscar.mock.calls.find(([, i]) => i?.method === "POST")![1]!.body));
    expect(corpo).toMatchObject({ nome: "Ana Ribeiro", email: "ana@exemplo.faperon.br", area: "Técnica", gestor_frota: true, administrador: false });
    await user.click(within(senha).getByRole("button", { name: "Pronto" }));
    expect(screen.getByRole("row", { name: /Ana Ribeiro/ })).toHaveTextContent("Senha temporária");
  });

  it("mostra o erro do servidor no campo (e-mail repetido)", async () => {
    entrarComo("marcos");
    api({
      "GET /api/v1/usuarios": () => Response.json(LISTA),
      "POST /api/v1/usuarios": () => Response.json({ erro: "Parâmetros inválidos", campos: { email: "Já existe uma conta com este e-mail." } }, { status: 400 }),
    });
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Novo usuário" }));
    const dialogo = screen.getByRole("dialog", { name: "Novo usuário" });
    await user.type(within(dialogo).getByLabelText("Nome"), "Carla Dois");
    await user.type(within(dialogo).getByLabelText("E-mail"), "carla@exemplo.faperon.br");
    await user.click(within(dialogo).getByRole("button", { name: "Criar usuário" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Já existe uma conta com este e-mail.");
  });

  it("edita uma conta pelo diálogo", async () => {
    entrarComo("marcos");
    const buscar = api({
      "GET /api/v1/usuarios": () => Response.json(LISTA),
      "PATCH /api/v1/usuarios/carla": () => Response.json(usuario("carla", { nome: "Carla M. Mendes", coordenador: true })),
    });
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Editar Carla Mendes" }));
    const dialogo = screen.getByRole("dialog", { name: "Editar usuário" });
    expect(within(dialogo).getByLabelText("E-mail")).toHaveValue("carla@exemplo.faperon.br");
    await user.clear(within(dialogo).getByLabelText("Nome"));
    await user.type(within(dialogo).getByLabelText("Nome"), "Carla M. Mendes");
    await user.click(within(dialogo).getByLabelText("Coordenador"));
    await user.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("row", { name: /Carla M\. Mendes/ })).toHaveTextContent("Coordenador");
    const patch = buscar.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toMatchObject({ nome: "Carla M. Mendes", coordenador: true });
  });

  it("desativa e reativa com confirmação", async () => {
    entrarComo("marcos");
    api({
      "GET /api/v1/usuarios": () => Response.json(LISTA),
      "POST /api/v1/usuarios/carla/desativar": () => Response.json(usuario("carla", { ativo: false })),
      "POST /api/v1/usuarios/joao/reativar": () => Response.json(usuario("joao")),
    });
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Desativar Carla Mendes" }));
    const confirmar = screen.getByRole("dialog", { name: "Desativar Carla Mendes?" });
    expect(confirmar).toHaveTextContent("continua registrado");
    await user.click(within(confirmar).getByRole("button", { name: "Desativar" }));
    expect(await screen.findByRole("row", { name: /Carla Mendes/ })).toHaveTextContent("Desativado");

    await user.click(screen.getByRole("button", { name: "Reativar João Pereira" }));
    await user.click(within(screen.getByRole("dialog", { name: "Reativar João Pereira?" })).getByRole("button", { name: "Reativar" }));
    expect(await screen.findByRole("row", { name: /João Pereira/ })).toHaveTextContent("Ativo");
  });

  it("gera senha temporária depois de confirmar", async () => {
    entrarComo("marcos");
    api({
      "GET /api/v1/usuarios": () => Response.json(LISTA),
      "POST /api/v1/usuarios/carla/senha-temporaria": () => Response.json({ senha_temporaria: "Abcd-Efgh-Jkmn-Pqrs" }),
    });
    const user = userEvent.setup();
    renderizar();
    await user.click(await screen.findByRole("button", { name: "Gerar senha temporária para Carla Mendes" }));
    const confirmar = screen.getByRole("dialog", { name: "Gerar senha temporária para Carla Mendes?" });
    expect(confirmar).toHaveTextContent("A senha atual deixa de valer");
    await user.click(within(confirmar).getByRole("button", { name: "Gerar senha" }));
    expect(await screen.findByRole("dialog", { name: "Senha temporária de Carla Mendes" })).toHaveTextContent("Abcd-Efgh-Jkmn-Pqrs");
  });
});
