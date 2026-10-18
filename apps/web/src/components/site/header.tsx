"use client";

import { ExternalLink, LogIn, LogOut, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BotaoTema } from "@/components/site/botao-tema";
import { buttonVariants } from "@/components/ui/button";
import { sairDaConta } from "@/lib/sistema/conta";
import { MENU, MENU_SISTEMA, ROTAS } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Botão sólido; no escuro troca para lima, que destaca mais sobre o grafite. */
const BOTAO_ACESSO = "dark:bg-brand-lime dark:text-brand-dark dark:hover:bg-brand-lime-hover";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  // na área logada o botão do cabeçalho deixa de levar ao login e passa a sair do sistema
  const logado = pathname.startsWith("/sistema");

  // encerra a sessão no servidor (ADR 0035) antes de voltar ao login
  async function sair() {
    setAberto(false);
    await sairDaConta();
    router.push(ROTAS.login);
  }

  // "/" e "/sistema" só ficam ativos neles mesmos; as demais seções, em qualquer subpágina
  const ativo = (href: string) => (href === "/" || href === "/sistema" ? pathname === href : pathname.startsWith(href));
  const itens = logado ? MENU_SISTEMA : MENU;
  const rotuloMenu = logado ? "Seções do sistema" : "Principal";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card">
      <div
        className={cn(
          "mx-auto flex h-[72px] w-full max-w-[1920px] items-center justify-between gap-4 px-4 md:px-6 lg:gap-3 lg:px-4 min-[1400px]:gap-4 min-[1400px]:px-8",
          // na área logada, três colunas: marca, menu no centro exato da tela e as ações à direita
          logado && "lg:grid lg:grid-cols-[1fr_auto_1fr]",
        )}
      >
        <Link href="/" aria-label="FAPERON – página inicial" className="flex shrink-0 items-center gap-1 justify-self-start">
          <Image
            src="/marca-faperon.png"
            alt=""
            width={56}
            height={56}
            priority
            className="h-12 w-12 dark:rounded-xl dark:bg-white dark:p-1"
          />
          <span>
            <span className="block text-[1.35rem] font-bold leading-none tracking-tight text-brand-fg">FAPERON</span>
            <span className="mt-0.5 hidden max-w-[11rem] min-[1400px]:block text-[0.7rem] leading-tight text-ink-muted">
              Federação da Agricultura e Pecuária de Rondônia
            </span>
          </span>
        </Link>

        <div className={cn("hidden items-center gap-1 lg:flex min-[1400px]:gap-2", logado && "lg:contents")}>
          <nav aria-label={rotuloMenu} data-tour={logado ? "barra" : undefined} className={cn(logado && "justify-self-center")}>
            <ul className="flex items-center">
              {itens.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    {...(item.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-current={!item.externo && ativo(item.href) ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap border-b-[3px] border-transparent px-1.5 py-2 text-[0.8125rem] font-medium text-ink hover:text-brand-fg min-[1200px]:px-2 min-[1200px]:text-sm min-[1400px]:px-3",
                      !item.externo && ativo(item.href) && "border-brand-light text-brand-fg",
                    )}
                  >
                    {item.label}
                    {item.externo && (
                      <>
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        <span className="sr-only"> (abre o site atual em nova aba)</span>
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {logado ? (
            <div className="flex items-center justify-self-end">
              <button type="button" onClick={() => void sair()} className={cn(buttonVariants({ size: "sm" }), BOTAO_ACESSO, "shrink-0")}>
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sair
              </button>
              <BotaoTema className="ml-2 min-[1200px]:ml-3" />
            </div>
          ) : (
            <Link href={ROTAS.login} className={cn(buttonVariants({ size: "sm" }), BOTAO_ACESSO, "ml-1 shrink-0 min-[1200px]:ml-2")}>
              <LogIn aria-hidden="true" className="h-4 w-4" />
              {/* Abaixo de 1200 px o menu de 6 itens não deixa folga (no Linux o texto sai um pouco mais largo): o rótulo encurta, e o nome acessível continua inteiro. */}
              <span>
                Acessar<span className="sr-only min-[1200px]:not-sr-only"> o sistema</span>
              </span>
            </Link>
          )}
          {!logado && <BotaoTema className="ml-2 min-[1200px]:ml-3" />}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <BotaoTema />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-brand-soft"
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            onClick={() => setAberto((v) => !v)}
          >
            {aberto ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {aberto && (
        <nav id="menu-mobile" aria-label={`${rotuloMenu} (móvel)`} className="border-t border-line bg-card lg:hidden">
          <ul className="container flex flex-col py-2">
            {itens.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setAberto(false)}
                  {...(item.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  aria-current={!item.externo && ativo(item.href) ? "page" : undefined}
                  className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-fg"
                >
                  {item.label}
                  {item.externo && (
                    <>
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="sr-only"> (abre o site atual em nova aba)</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-line pt-2">
              {logado ? (
                <button type="button" onClick={() => void sair()} className={cn(buttonVariants(), BOTAO_ACESSO, "w-full justify-center")}>
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Sair do sistema
                </button>
              ) : (
                <Link
                  href={ROTAS.login}
                  onClick={() => setAberto(false)}
                  className={cn(buttonVariants(), BOTAO_ACESSO, "w-full justify-center")}
                >
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                  Acessar o sistema
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
