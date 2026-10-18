"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { useSistema } from "@/lib/sistema/estado";
import { TrocarSenha } from "./trocar-senha";

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
      <p className="mt-2 text-sm text-ink-muted">{texto}</p>
      {children}
    </div>
  );
}

/** Conteúdo do sistema só com sessão no servidor (ADR 0035); com senha temporária, antes a troca. */
export function ExigeLogin({ children }: { children: ReactNode }) {
  const { pronto, situacao, funcionario, precisaTrocarSenha, conferirDeNovo } = useSistema();
  if (!pronto || situacao === "conferindo") return <Skeleton className="h-64 w-full" />;
  if (situacao === "erro") {
    return (
      <Aviso titulo="Sem conexão com o servidor" texto="Não foi possível conferir o seu acesso agora. Verifique a internet e tente de novo.">
        <Button variant="vidro" className="mt-5" onClick={conferirDeNovo}>
          Tentar de novo
        </Button>
      </Aviso>
    );
  }
  if (!funcionario) {
    return (
      <Aviso titulo="Faça login para entrar no sistema" texto="Entre com o seu e-mail e a sua senha da equipe.">
        <Link href="/login" className={buttonVariants({ variant: "vidro", className: "mt-5" })}>
          Ir para Acessar o sistema
        </Link>
      </Aviso>
    );
  }
  if (precisaTrocarSenha) return <TrocarSenha />;
  return <>{children}</>;
}
