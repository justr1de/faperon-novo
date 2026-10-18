"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Carregando, ErroConsulta, Vazio } from "@/components/painel/comuns";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

interface Resposta {
  series: object;
  qualidade: { avisos: string[] };
}

interface SecaoCreditoProps<R extends Resposta> {
  id: string;
  etiqueta: string;
  titulo: string;
  consulta: UseQueryResult<R>;
  onPadrao: () => void;
  /** Uma tabela rotulada para cada gráfico ou mapa da seção. */
  tabela: (d: R) => ReactNode;
  children: (d: R) => ReactNode;
  /** Texto curto abaixo do título. */
  apoio?: ReactNode;
}

/** Uma seção da página de crédito: título, estados de carga e erro, e a troca entre gráfico e tabela. */
export function SecaoCredito<R extends Resposta>({ id, etiqueta, titulo, consulta, onPadrao, tabela, children, apoio }: SecaoCreditoProps<R>) {
  const [comoTabela, setComoTabela] = useState(false);
  const d = consulta.data;
  const vazio = d !== undefined && Object.keys(d.series).length === 0;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-32 border-t border-line pt-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">{etiqueta}</p>
      <h2 id={`${id}-titulo`} className="mt-1 text-[1.75rem] font-semibold tracking-tight">{titulo}</h2>
      {apoio && <div className="mt-2 max-w-[70ch] leading-relaxed text-ink-muted">{apoio}</div>}

      {consulta.isPending && <div className="mt-6"><Carregando rotulo={titulo.toLowerCase()} /></div>}
      {consulta.isError && (
        <div className="mt-6">
          {consulta.error instanceof ApiError && consulta.error.status === 400 ? (
            <div role="alert" className="rounded-md border border-line bg-surface-alt p-5">
              <p className="font-medium">{consulta.error.message}</p>
              <Button className="mt-3" onClick={onPadrao}>Voltar ao padrão</Button>
            </div>
          ) : (
            <ErroConsulta erro={consulta.error} onRetry={() => void consulta.refetch()} />
          )}
        </div>
      )}

      {d && vazio && (
        <div className="mt-6">
          <Vazio>{d.qualidade.avisos.at(-1) ?? "Não há dados para este recorte."}</Vazio>
        </div>
      )}
      {d && !vazio && (
        <div data-testid={`conteudo-${id}`} aria-busy={consulta.isPlaceholderData ? "true" : undefined} className={consulta.isPlaceholderData ? "mt-6 opacity-60 transition-opacity" : "mt-6"}>
          <div className="mb-2 flex justify-end">
            <Button variant="outline" size="sm" aria-pressed={comoTabela} onClick={() => setComoTabela((v) => !v)}>
              {comoTabela ? "Ver como gráfico" : "Ver como tabela"}
            </Button>
          </div>
          {comoTabela ? tabela(d) : children(d)}
        </div>
      )}
    </section>
  );
}
