import type { Metadata } from "next";
import { Suspense } from "react";
import { PainelCredito } from "@/components/credito/painel-credito";
import { Destaque, HeroPagina } from "@/components/site/hero-pagina";
import { IndiceSecoes } from "@/components/sobre/indice-secoes";
import { Skeleton } from "@/components/ui/feedback";
import { CREDITO as c } from "@/content/credito";

export const metadata: Metadata = {
  title: c.seo.titulo,
  description: c.seo.descricao,
  alternates: { canonical: "/credito-rural" },
};

export default function CreditoRuralPage() {
  return (
    <>
      <HeroPagina id="credito-titulo" atual={c.titulo} titulo={<>Crédito rural e <Destaque>Pronaf</Destaque> em Rondônia.</>}>
        <p>{c.intro}</p>
      </HeroPagina>
      <div className="border-t-2 border-ink">
        <div className="container grid gap-10 lg:grid-cols-[12rem_1fr]">
          <IndiceSecoes secoes={c.secoes} />
          <Suspense fallback={<div role="status" className="py-12"><span className="sr-only">Carregando o painel de crédito rural…</span><Skeleton className="h-64 w-full" /></div>}>
            <PainelCredito />
          </Suspense>
        </div>
      </div>
    </>
  );
}
