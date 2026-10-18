// Mock do login e das contas (ADR 0035, docs/api-contract.md) para o e2e sem Django.
// Sessão em memória por cookie `sessionid`, CSRF por cookie `csrftoken` + cabeçalho `X-CSRFToken`.
// Usuários: os 5 de demonstração, com a senha DEMO_SENHA (padrão "demonstracao-local", só no mock).
import { randomBytes } from "node:crypto";

const DEMO_SENHA = process.env.DEMO_SENHA || "demonstracao-local";
const PAPEIS = ["administrador", "coordenador", "gestor_frota", "gestor_espacos", "gestor_contas"];
const ERRO_LOGIN = "E-mail ou senha incorretos.";

function pessoa(codigo, nome, area, papeis = {}) {
  return {
    codigo,
    nome,
    email: `${codigo}@exemplo.faperon.br`,
    area,
    telefone: "",
    ...Object.fromEntries(PAPEIS.map((p) => [p, Boolean(papeis[p])])),
    demonstracao: true,
    precisa_trocar_senha: false,
    ativo: true,
    ultimo_acesso: null,
    criado_em: "2026-10-18T12:00:00Z",
    senha: DEMO_SENHA,
  };
}

export function criarEstado() {
  const todos = Object.fromEntries(PAPEIS.map((p) => [p, true]));
  const usuarios = new Map(
    [
      pessoa("carla", "Carla Mendes", "Comunicação"),
      pessoa("marcos", "Marcos Oliveira", "Administrativo", todos),
      pessoa("ana", "Ana Ribeiro", "Técnica"),
      pessoa("joao", "João Pereira", "Sindical"),
      pessoa("luiza", "Luíza Santos", "Presidência"),
    ].map((u) => [u.codigo, u]),
  );
  return { usuarios, sessoes: new Map() };
}

const sem = (u, ...campos) => Object.fromEntries(Object.entries(u).filter(([k]) => !campos.includes(k)));
const perfil = (u) => sem(u, "senha", "ativo", "ultimo_acesso", "criado_em");
const daAdministracao = (u) => sem(u, "senha");
const membro = (u) => ({ codigo: u.codigo, nome: u.nome, area: u.area, ...Object.fromEntries(PAPEIS.map((p) => [p, u[p]])) });

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter(([k]) => k),
  );
}

const token = () => randomBytes(16).toString("hex");
const cookieCsrf = (valor) => `csrftoken=${valor}; Path=/; SameSite=Lax`;
const erro = (status, mensagem, campos = {}) => ({ status, json: { erro: mensagem, campos } });

/** Responde às rotas de /auth e /usuarios; devolve null para as demais. */
export function rotaDeContas(estado, req, url, corpo) {
  const caminho = url.pathname.replace(/\/$/, "");
  if (!caminho.startsWith("/api/v1/auth/") && !caminho.startsWith("/api/v1/usuarios")) return null;
  const metodo = req.method ?? "GET";
  const c = cookies(req);
  const quem = estado.usuarios.get(estado.sessoes.get(c.sessionid));
  const logado = quem && quem.ativo ? quem : null;
  const csrfOk = Boolean(c.csrftoken) && req.headers["x-csrftoken"] === c.csrftoken;
  if (metodo !== "GET" && !csrfOk) return erro(403, "CSRF Failed: CSRF token missing.");

  if (caminho === "/api/v1/auth/csrf") {
    const t = c.csrftoken ?? token();
    return { status: 200, json: { csrf: t }, cookies: [cookieCsrf(t)] };
  }
  if (caminho === "/api/v1/auth/entrar" && metodo === "POST") {
    const email = String(corpo?.email ?? "").trim().toLowerCase();
    const u = [...estado.usuarios.values()].find((x) => x.email === email);
    if (!u || !u.ativo || u.senha !== corpo?.senha) return erro(400, ERRO_LOGIN);
    const sid = token();
    estado.sessoes.set(sid, u.codigo);
    u.ultimo_acesso = new Date().toISOString();
    return { status: 200, json: perfil(u), cookies: [`sessionid=${sid}; HttpOnly; Path=/; SameSite=Lax`, cookieCsrf(token())] };
  }
  if (caminho === "/api/v1/auth/google") return erro(503, "O login com o Google está desligado.");
  if (!logado) return erro(401, "As credenciais de autenticação não foram fornecidas.");

  if (caminho === "/api/v1/auth/sair" && metodo === "POST") {
    estado.sessoes.delete(c.sessionid);
    return { status: 204, cookies: ["sessionid=; Max-Age=0; Path=/"] };
  }
  if (caminho === "/api/v1/auth/eu") return { status: 200, json: perfil(logado) };
  if (caminho === "/api/v1/auth/trocar-senha" && metodo === "POST") {
    if (corpo?.senha_atual !== logado.senha) return erro(400, "A senha atual não confere.", { senha_atual: "A senha atual não confere." });
    if (String(corpo?.senha_nova ?? "").length < 10) return erro(400, "Senha curta.", { senha_nova: "Esta senha é muito curta. Ela precisa conter pelo menos 10 caracteres." });
    logado.senha = corpo.senha_nova;
    logado.precisa_trocar_senha = false;
    return { status: 200, json: perfil(logado) };
  }
  if (logado.precisa_trocar_senha) return erro(403, "Troque a senha temporária antes de continuar.");
  if (caminho === "/api/v1/usuarios/equipe") {
    const ativos = [...estado.usuarios.values()].filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { status: 200, json: ativos.map(membro) };
  }
  if (!logado.administrador) return erro(403, "Só administradores gerenciam usuários.");

  if (caminho === "/api/v1/usuarios") {
    if (metodo === "GET") return { status: 200, json: [...estado.usuarios.values()].map(daAdministracao) };
    const email = String(corpo?.email ?? "").trim().toLowerCase();
    if ([...estado.usuarios.values()].some((u) => u.email === email)) {
      return erro(400, "Parâmetros inválidos", { email: "Já existe uma conta com este e-mail." });
    }
    const senha = `Temp-${token().slice(0, 4)}-${token().slice(0, 4)}`;
    const codigo = String(corpo?.nome ?? "pessoa").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const novo = { ...pessoa(codigo, corpo.nome, corpo.area, corpo), email, telefone: corpo.telefone ?? "", demonstracao: false, precisa_trocar_senha: true, senha };
    estado.usuarios.set(codigo, novo);
    return { status: 201, json: { usuario: daAdministracao(novo), senha_temporaria: senha } };
  }
  const [, , , , codigo, acao] = caminho.split("/");
  const alvo = estado.usuarios.get(codigo);
  if (!alvo) return erro(404, "Não encontrado.");
  if (!acao && metodo === "PATCH") {
    for (const campo of ["nome", "email", "area", "telefone", ...PAPEIS]) if (corpo && campo in corpo) alvo[campo] = corpo[campo];
    return { status: 200, json: daAdministracao(alvo) };
  }
  if (acao === "desativar" && metodo === "POST") {
    if (alvo === logado) return erro(400, "Você não pode desativar a própria conta.");
    alvo.ativo = false;
    return { status: 200, json: daAdministracao(alvo) };
  }
  if (acao === "reativar" && metodo === "POST") {
    alvo.ativo = true;
    return { status: 200, json: daAdministracao(alvo) };
  }
  if (acao === "senha-temporaria" && metodo === "POST") {
    alvo.senha = `Temp-${token().slice(0, 4)}-${token().slice(0, 4)}`;
    alvo.precisa_trocar_senha = true;
    return { status: 200, json: { senha_temporaria: alvo.senha } };
  }
  return erro(405, "Método não permitido.");
}
