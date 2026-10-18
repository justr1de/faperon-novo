"use client";

import { Compass, LogOut, RotateCcw, Tags, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROTOTIPO } from "@/content/sistema/funcionarios";
import { ARMAZENAMENTO_CHEIO } from "@/lib/sistema/armazenamento";
import { useSistema } from "@/lib/sistema/estado";
import { podeGerirTags } from "@/lib/sistema/tags";
import { GerenciarTags } from "./tags";
import { useTour } from "./tour/tour";

const acao =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium sm:min-h-0 text-ink-muted transition duration-150 ease-out hover:bg-white/60 hover:text-ink dark:hover:bg-white/5";

/** Barra do sistema em vidro, fixa sob o cabeçalho: quem está logado e as ações. As seções ficam no cabeçalho. */
export function BarraSistema() {
  const { funcionario, precisaTrocarSenha, sair, restaurar } = useSistema();
  const { iniciar } = useTour();
  const [semEspaco, setSemEspaco] = useState(false);
  const [gerindoTags, setGerindoTags] = useState(false);
  useEffect(() => {
    const avisar = () => setSemEspaco(true);
    window.addEventListener(ARMAZENAMENTO_CHEIO, avisar);
    return () => window.removeEventListener(ARMAZENAMENTO_CHEIO, avisar);
  }, []);
  const router = useRouter();

  // cada pessoa tem a própria conta (ADR 0035): "Trocar de funcionário" virou "Sair"
  async function sairDoSistema() {
    await sair();
    router.push("/login");
  }
  // com senha temporária, só Sair: o resto espera a troca
  const liberado = funcionario && !precisaTrocarSenha;

  return (
    <div className="vidro-barra z-30 md:sticky md:top-[72px] print:hidden">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
        <div className="flex flex-wrap items-center gap-1 text-sm">
          {funcionario && (
            <span className="mr-2 text-ink">
              <span className="sr-only">Logado como </span>
              <strong className="font-semibold">{funcionario.nome}</strong> <span className="text-ink-muted">· {funcionario.area}</span>
            </span>
          )}
          <button type="button" onClick={restaurar} className={acao} title="Volta agenda, frota e espaços aos dados de exemplo">
            <RotateCcw aria-hidden="true" className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="sr-only sm:not-sr-only">{PROTOTIPO.restaurar}</span>
          </button>
          {liberado && (
            <button type="button" onClick={iniciar} className={acao}>
              <Compass aria-hidden="true" className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only sm:not-sr-only">Tour guiado</span>
            </button>
          )}
          {liberado && podeGerirTags(funcionario) && (
            <button type="button" onClick={() => setGerindoTags(true)} className={acao}>
              <Tags aria-hidden="true" className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only sm:not-sr-only">Gerenciar tags</span>
            </button>
          )}
          {liberado && funcionario.administrador && (
            <Link href="/sistema/usuarios" className={acao}>
              <UsersRound aria-hidden="true" className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only sm:not-sr-only">Usuários</span>
            </Link>
          )}
          {funcionario && (
            <button type="button" onClick={() => void sairDoSistema()} className={acao}>
              <LogOut aria-hidden="true" className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only sm:not-sr-only">Sair</span>
            </button>
          )}
        </div>
      </div>
      <p role="note" className="border-t border-line py-1 text-center text-[11px] font-medium tracking-wide text-ink-muted">
        {PROTOTIPO.faixa}
      </p>
      {gerindoTags && <GerenciarTags aoFechar={() => setGerindoTags(false)} />}
      {semEspaco && (
        <p role="alert" className="border-t border-line bg-danger-soft px-4 py-1.5 text-center text-xs font-medium text-danger-ink">
          O espaço do navegador para o protótipo acabou: as últimas mudanças valem só até fechar esta aba. Exclua comprovantes ou use “Restaurar dados de exemplo”.
        </p>
      )}
    </div>
  );
}
