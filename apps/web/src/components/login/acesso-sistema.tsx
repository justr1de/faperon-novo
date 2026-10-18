"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { historicoDeExemplo } from "@/content/sistema/exemplo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { anotar } from "@/lib/sistema/atividades";
import { conta, contaLembrada, esquecerConta, lembrarConta, sairDaConta, type PerfilDaConta, type Resultado } from "@/lib/sistema/conta";
import { agoraISO, hojeISO } from "@/lib/sistema/datas";
import { novoId } from "@/lib/sistema/estado";
import type { RegistroHistorico } from "@/lib/sistema/tipos";
import { EntrarComGoogle } from "./entrar-com-google";

/** Ainda não há servidor de e-mail (ADR 0035): quem esqueceu a senha recebe uma temporária do administrador. */
function EsqueciSenha({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <div className="grid gap-4">
      <Alert tone="info" title="Esqueceu a senha?">
        Peça ao administrador uma senha temporária. Ela vale para um acesso, e o sistema pede uma senha nova logo em seguida. O envio de link por e-mail
        ainda não existe.
      </Alert>
      <Button variant="ghost" className="w-full" onClick={aoVoltar}>
        Voltar ao login
      </Button>
    </div>
  );
}

/** A entrada fica no histórico do navegador, como as demais ações do protótipo (ADR 0031). */
function anotarEntrada(codigo: string, detalhe = "") {
  const historico = ler<RegistroHistorico[]>("historico", historicoDeExemplo(hojeISO()));
  const acao = `Entrou no sistema${detalhe}`;
  gravar("historico", anotar(historico, { id: novoId("historico"), quando: agoraISO(), funcionarioId: codigo, modulo: "acesso", acao }));
}

/** /login: e-mail e senha conferidos no servidor (ADR 0035), com o botão do Google quando configurado. */
export function AcessoSistema() {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "login" | "esqueci" | "logado">("carregando");
  const [logado, setLogado] = useState<PerfilDaConta | null>(null);
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const clienteGoogle = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let vivo = true;
    const lembrada = contaLembrada();
    if (lembrada) {
      setLogado(lembrada.perfil);
      setEstado("logado");
      return;
    }
    void conta.eu().then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setLogado(r.dados);
        setEstado("logado");
      } else setEstado("login");
    });
    return () => {
      vivo = false;
    };
  }, []);

  function concluir(r: Resultado<PerfilDaConta>, detalhe = "") {
    setConferindo(false);
    if (!r.ok) return setErro(r.erro);
    setErro(null);
    lembrarConta(r.dados);
    anotarEntrada(r.dados.codigo, detalhe);
    router.push("/sistema");
  }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const email = String(dados.get("email") ?? "").trim();
    const senha = String(dados.get("senha") ?? "");
    if (!email || !senha) return setErro("Informe o e-mail e a senha.");
    setConferindo(true);
    const r = await conta.entrar(email, senha);
    // no login por senha, 403 só vem do CSRF: a página ficou velha (no Google, 403 é conta sem acesso)
    concluir(r.ok || r.status !== 403 ? r : { ...r, erro: "Não foi possível entrar agora. Recarregue a página e tente de novo." });
  }

  async function entrarComGoogle(credencial: string) {
    setConferindo(true);
    concluir(await conta.entrarComGoogle(credencial), " com o Google");
  }

  async function sair() {
    await sairDaConta();
    esquecerConta();
    setLogado(null);
    setEstado("login");
  }

  if (estado === "carregando") return <Skeleton className="h-48 w-full" />;
  if (estado === "esqueci") return <EsqueciSenha aoVoltar={() => setEstado("login")} />;

  if (estado === "logado" && logado) {
    return (
      <div className="grid gap-3 text-center">
        <p className="text-sm text-ink">
          Você entrou como <strong className="font-semibold">{logado.nome}</strong>
          <span className="block text-ink-muted">{logado.email}</span>
        </p>
        <Link href="/sistema" className={buttonVariants({ variant: "vidro", size: "lg", className: "w-full" })}>
          Ir para o sistema
        </Link>
        <Button variant="ghost" className="w-full" onClick={() => void sair()}>
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {clienteGoogle && (
        <>
          <EntrarComGoogle clienteId={clienteGoogle} aoReceber={(c) => void entrarComGoogle(c)} />
          <p className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            ou
          </p>
        </>
      )}
      <form aria-label="Acessar o sistema" onSubmit={entrar} className="grid gap-4" noValidate>
        <div>
          <Label htmlFor="login-email">E-mail</Label>
          <Input id="login-email" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="login-senha">Senha</Label>
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setEstado("esqueci");
              }}
              className="rounded text-sm font-medium text-brand-fg underline-offset-2 hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="relative">
            <Input id="login-senha" name="senha" type={verSenha ? "text" : "password"} autoComplete="current-password" required className="pr-11" />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar a senha" : "Mostrar a senha"}
              aria-pressed={verSenha}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:text-ink"
            >
              {verSenha ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {erro && <Alert tone="erro">{erro}</Alert>}
        <Button variant="vidro" type="submit" size="lg" className="mt-1 w-full" disabled={conferindo}>
          Entrar
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-muted">
          Área restrita à equipe do sistema FAPERON/SENAR e demais instituições. Solicite seu acesso à Administração.
        </p>
      </form>
    </div>
  );
}
