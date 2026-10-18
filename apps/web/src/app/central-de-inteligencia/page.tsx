import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/site/icone";
import { buttonVariants } from "@/components/ui/button";
import { CENTRAL as c } from "@/content/central";
import { cn } from "@/lib/utils";
import { Revelar } from "@/components/site/revelar";

export const metadata: Metadata = {
  title: c.seo.titulo,
  description: c.seo.descricao,
  alternates: { canonical: "/central-de-inteligencia" },
};

export default function CentralPage() {
  return (
    <>
      <section aria-labelledby="central-titulo" className="bg-gradient-to-br from-brand-dark to-brand text-white">
        <div className="container grid gap-4 py-14 md:py-20">
          <h1 id="central-titulo" className="text-3xl font-bold md:text-5xl">
            {c.titulo}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/90">{c.subtitulo}</p>
        </div>
      </section>

      <Revelar as="section" aria-label="Escolha por onde começar" className="container mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {c.portas.map((p) => (
          <article key={p.href} className="flex flex-col rounded-2xl border border-line bg-card p-8 shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-white">
              <Icone nome={p.icone} className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-2xl font-semibold">{p.titulo}</h2>
            <p className="mt-2 flex-1 leading-relaxed text-justify hyphens-auto text-ink-muted">{p.texto}</p>
            <Link href={p.href} className={cn(buttonVariants({ size: "lg" }), "mt-6 self-start")}>
              {p.rotulo}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </article>
        ))}
      </Revelar>

      <Revelar as="section" className="container mt-12">
        <div className="prose-faperon max-w-3xl text-ink">
          {c.paragrafos.map((p) => (
            <p key={p} className="text-justify hyphens-auto">{p}</p>
          ))}
        </div>
      </Revelar>
    </>
  );
}
