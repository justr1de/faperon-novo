"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";
import { conta } from "@/lib/sistema/conta";
import { useSistema } from "@/lib/sistema/estado";

const MINIMO = 10;

/** Primeiro acesso com senha temporária (ADR 0035): a pessoa escolhe a própria senha antes de usar o sistema. */
export function TrocarSenha() {
  const { funcionario, senhaTrocada } = useSistema();
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function trocar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const atual = String(dados.get("atual") ?? "");
    const nova = String(dados.get("nova") ?? "");
    if (!atual) return setErro("Informe a senha temporária que você recebeu.");
    if (nova.length < MINIMO) return setErro(`A nova senha precisa ter pelo menos ${MINIMO} caracteres.`);
    if (nova !== String(dados.get("repetida") ?? "")) return setErro("As duas senhas novas não são iguais.");
    setEnviando(true);
    const r = await conta.trocarSenha(atual, nova);
    setEnviando(false);
    if (!r.ok) return setErro(Object.values(r.campos)[0] ?? r.erro);
    setErro(null);
    senhaTrocada(r.dados);
  }

  const tipo = ver ? "text" : "password";
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-ink">Troque a senha temporária</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {funcionario ? `${funcionario.nome.split(" ")[0]}, a` : "A"} senha que o administrador gerou vale só para este primeiro acesso. Escolha uma senha
            sua, com pelo menos {MINIMO} caracteres.
          </p>
        </div>
      </div>
      <form aria-label="Trocar a senha" onSubmit={trocar} className="grid gap-4" noValidate>
        <div>
          <Label htmlFor="senha-atual">Senha atual</Label>
          <Input id="senha-atual" name="atual" type={tipo} autoComplete="current-password" required />
        </div>
        <div>
          <Label htmlFor="senha-nova">Nova senha</Label>
          <Input id="senha-nova" name="nova" type={tipo} autoComplete="new-password" minLength={MINIMO} required />
        </div>
        <div>
          <Label htmlFor="senha-repetida">Repita a nova senha</Label>
          <Input id="senha-repetida" name="repetida" type={tipo} autoComplete="new-password" minLength={MINIMO} required />
        </div>
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-pressed={ver}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm font-medium text-brand-fg underline-offset-2 hover:underline"
        >
          {ver ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          {ver ? "Ocultar as senhas" : "Mostrar as senhas"}
        </button>
        {erro && <Alert tone="erro">{erro}</Alert>}
        <Button variant="vidro" type="submit" size="lg" className="w-full" disabled={enviando}>
          Trocar a senha
        </Button>
      </form>
    </div>
  );
}
