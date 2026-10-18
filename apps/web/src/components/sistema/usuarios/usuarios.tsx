"use client";

import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/field";
import {
  administracao,
  AREAS,
  ROTULO_PAPEL,
  type DadosDoUsuario,
  type PapeisDaConta,
  type UsuarioDaAdministracao,
} from "@/lib/sistema/conta";
import { useSistema } from "@/lib/sistema/estado";
import { cn } from "@/lib/utils";
import { Dialogo } from "../dialogo";

const PAPEIS = Object.keys(ROTULO_PAPEL) as (keyof PapeisDaConta)[];

const ultimoAcesso = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Porto_Velho" }) : "Nunca";

function porNome(lista: UsuarioDaAdministracao[]) {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function FormularioUsuario({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial: UsuarioDaAdministracao | null;
  aoSalvar: (dados: DadosDoUsuario) => Promise<string | null>;
  aoCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosDoUsuario & PapeisDaConta>({
    nome: inicial?.nome ?? "",
    email: inicial?.email ?? "",
    area: inicial?.area ?? AREAS[0],
    telefone: inicial?.telefone ?? "",
    administrador: inicial?.administrador ?? false,
    coordenador: inicial?.coordenador ?? false,
    gestor_frota: inicial?.gestor_frota ?? false,
    gestor_espacos: inicial?.gestor_espacos ?? false,
    gestor_contas: inicial?.gestor_contas ?? false,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!dados.nome.trim()) return setErro("Informe o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) return setErro("Informe um e-mail válido.");
    const telefone = (dados.telefone ?? "").replace(/[\s()-]/g, "");
    if (telefone && !/^\+[1-9]\d{7,14}$/.test(telefone)) return setErro("Telefone no formato internacional, com + e DDI (ex.: +5569999990000).");
    setSalvando(true);
    const falha = await aoSalvar({ ...dados, nome: dados.nome.trim(), email: dados.email.trim(), telefone });
    setSalvando(false);
    setErro(falha);
  }

  return (
    <form onSubmit={salvar} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="usuario-nome">Nome</Label>
          <Input id="usuario-nome" value={dados.nome} autoComplete="off" onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="usuario-email">E-mail</Label>
          <Input id="usuario-email" type="email" autoComplete="off" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="usuario-area">Área</Label>
          <Select id="usuario-area" value={dados.area} onChange={(e) => setDados({ ...dados, area: e.target.value })}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="usuario-telefone">Telefone (opcional)</Label>
          <Input
            id="usuario-telefone"
            type="tel"
            inputMode="tel"
            placeholder="+5569999990000"
            value={dados.telefone}
            onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
          />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Papéis no sistema</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAPEIS.map((p) => (
            <label key={p} className="flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm text-ink">
              <input
                type="checkbox"
                checked={dados[p]}
                onChange={(e) => setDados({ ...dados, [p]: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              {ROTULO_PAPEL[p]}
            </label>
          ))}
        </div>
      </fieldset>
      {erro && <Alert tone="erro">{erro}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button variant="vidro" type="submit" disabled={salvando}>
          {inicial ? "Salvar" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}

/** A senha temporária aparece uma única vez: a API não a devolve de novo. */
function SenhaGerada({ nome, senha, aoFechar }: { nome: string; senha: string; aoFechar: () => void }) {
  const [copiada, setCopiada] = useState<boolean | null>(null);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }
  return (
    <Dialogo titulo={`Senha temporária de ${nome}`} aoFechar={aoFechar}>
      <p className="text-sm text-ink-muted">
        Ela aparece só agora: copie e passe à pessoa por um canal seguro. No primeiro acesso, o sistema pede uma senha nova.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-alt p-3">
        <code className="flex-1 select-all break-all font-mono text-base font-semibold tracking-wide text-ink">{senha}</code>
        <Button variant="vidro-claro" size="sm" onClick={() => void copiar()}>
          {copiada ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
          Copiar
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-muted">
        {copiada === true && "Copiada."}
        {copiada === false && "Não deu para copiar; selecione a senha e copie à mão."}
      </p>
      <div className="mt-2 flex justify-end">
        <Button variant="vidro" onClick={aoFechar}>
          Pronto
        </Button>
      </div>
    </Dialogo>
  );
}

type Confirmacao = { acao: "desativar" | "reativar" | "senha"; usuario: UsuarioDaAdministracao };

const TEXTO_CONFIRMACAO: Record<Confirmacao["acao"], { titulo: (n: string) => string; texto: string; botao: string }> = {
  desativar: {
    titulo: (n) => `Desativar ${n}?`,
    texto: "A pessoa deixa de entrar no sistema na hora. A conta não é apagada: o que ela fez continua registrado, e dá para reativar depois.",
    botao: "Desativar",
  },
  reativar: { titulo: (n) => `Reativar ${n}?`, texto: "A pessoa volta a entrar com a senha que já tinha.", botao: "Reativar" },
  senha: {
    titulo: (n) => `Gerar senha temporária para ${n}?`,
    texto: "A senha atual deixa de valer, e a pessoa troca a temporária no primeiro acesso.",
    botao: "Gerar senha",
  },
};

function GestaoDeUsuarios() {
  const { funcionario } = useSistema();
  const [lista, setLista] = useState<UsuarioDaAdministracao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ usuario: UsuarioDaAdministracao | null } | null>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [senha, setSenha] = useState<{ nome: string; senha: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    void administracao.listar().then((r) => {
      if (!vivo) return;
      if (r.ok) setLista(porNome(r.dados));
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const trocar = (novo: UsuarioDaAdministracao) => setLista((l) => porNome([...(l ?? []).filter((u) => u.codigo !== novo.codigo), novo]));

  async function salvar(dados: DadosDoUsuario): Promise<string | null> {
    const atual = editando?.usuario;
    if (atual) {
      const r = await administracao.editar(atual.codigo, dados);
      if (!r.ok) return Object.values(r.campos)[0] ?? r.erro;
      trocar(r.dados);
    } else {
      const r = await administracao.criar(dados);
      if (!r.ok) return Object.values(r.campos)[0] ?? r.erro;
      trocar(r.dados.usuario);
      setSenha({ nome: r.dados.usuario.nome, senha: r.dados.senha_temporaria });
    }
    setEditando(null);
    return null;
  }

  async function confirmar() {
    if (!confirmando) return;
    const { acao, usuario } = confirmando;
    if (acao === "senha") {
      const r = await administracao.senhaTemporaria(usuario.codigo);
      if (!r.ok) return setErroDaAcao(r.erro);
      trocar({ ...usuario, precisa_trocar_senha: true });
      setSenha({ nome: usuario.nome, senha: r.dados.senha_temporaria });
    } else {
      const r = await (acao === "desativar" ? administracao.desativar(usuario.codigo) : administracao.reativar(usuario.codigo));
      if (!r.ok) return setErroDaAcao(r.erro);
      trocar(r.dados);
    }
    setConfirmando(null);
    setErroDaAcao(null);
  }

  if (erro) return <Alert tone="erro">{erro}</Alert>;
  if (!lista) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {lista.filter((u) => u.ativo).length} conta(s) ativa(s) de {lista.length}. Quem sai é desativado, não apagado.
        </p>
        <Button variant="vidro" onClick={() => setEditando({ usuario: null })}>
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <caption className="sr-only">Usuários do sistema</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
              <th scope="col" className="py-2">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Área</th>
              <th scope="col">Papéis</th>
              <th scope="col">Situação</th>
              <th scope="col">Último acesso</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const papeis = PAPEIS.filter((p) => u[p]);
              const eu = u.codigo === funcionario?.id;
              return (
                <tr key={u.codigo} className={cn("border-b border-line align-top", !u.ativo && "text-ink-muted")}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                    {u.nome}
                    {eu && <span className="ml-1 text-xs font-normal text-ink-muted">(você)</span>}
                  </th>
                  <td className="py-2.5 pr-3 break-all">{u.email}</td>
                  <td className="py-2.5 pr-3">{u.area}</td>
                  <td className="py-2.5 pr-3">
                    {papeis.length ? (
                      <span className="flex flex-wrap gap-1">
                        {papeis.map((p) => (
                          <Badge key={p} className="px-2 py-0.5">
                            {ROTULO_PAPEL[p]}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Uso dos módulos</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex flex-wrap gap-1">
                      <Badge className={cn("px-2 py-0.5", u.ativo ? "bg-brand-soft text-brand-strong" : "bg-surface-alt text-ink-muted")}>
                        {u.ativo ? "Ativo" : "Desativado"}
                      </Badge>
                      {u.precisa_trocar_senha && <Badge className="bg-warm px-2 py-0.5 text-ink">Senha temporária</Badge>}
                      {u.demonstracao && <Badge className="bg-steel-soft px-2 py-0.5 text-ink">Demonstração</Badge>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{ultimoAcesso(u.ultimo_acesso)}</td>
                  <td className="py-1.5 text-right">
                    <span className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditando({ usuario: u })} aria-label={`Editar ${u.nome}`}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmando({ acao: "senha", usuario: u })}
                        aria-label={`Gerar senha temporária para ${u.nome}`}
                      >
                        <KeyRound aria-hidden="true" className="h-4 w-4" />
                        Senha
                      </Button>
                      {!eu && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmando({ acao: u.ativo ? "desativar" : "reativar", usuario: u })}
                          aria-label={`${u.ativo ? "Desativar" : "Reativar"} ${u.nome}`}
                          className={u.ativo ? "text-danger-ink hover:bg-danger-soft" : undefined}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <Dialogo titulo={editando.usuario ? "Editar usuário" : "Novo usuário"} aoFechar={() => setEditando(null)}>
          {!editando.usuario && (
            <p className="mb-4 text-sm text-ink-muted">O sistema gera uma senha temporária, que você passa à pessoa. Ela troca no primeiro acesso.</p>
          )}
          <FormularioUsuario inicial={editando.usuario} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />
        </Dialogo>
      )}

      {confirmando && (
        <Dialogo
          titulo={TEXTO_CONFIRMACAO[confirmando.acao].titulo(confirmando.usuario.nome)}
          aoFechar={() => {
            setConfirmando(null);
            setErroDaAcao(null);
          }}
        >
          <p className="text-sm text-ink-muted">{TEXTO_CONFIRMACAO[confirmando.acao].texto}</p>
          {erroDaAcao && (
            <Alert tone="erro" className="mt-4">
              {erroDaAcao}
            </Alert>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmando(null)}>
              Cancelar
            </Button>
            <Button variant="vidro" onClick={() => void confirmar()}>
              {TEXTO_CONFIRMACAO[confirmando.acao].botao}
            </Button>
          </div>
        </Dialogo>
      )}

      {senha && <SenhaGerada nome={senha.nome} senha={senha.senha} aoFechar={() => setSenha(null)} />}
    </div>
  );
}

/** Tela Usuários (ADR 0035): só administrador; o acesso fica na barra do sistema. */
export function Usuarios() {
  const { funcionario } = useSistema();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Usuários</h1>
      <p className="mb-6 text-sm text-ink-muted">Contas da equipe: quem entra no sistema e com quais papéis.</p>
      {funcionario?.administrador ? (
        <GestaoDeUsuarios />
      ) : (
        <Alert tone="info">Só administradores gerenciam usuários.</Alert>
      )}
    </div>
  );
}
