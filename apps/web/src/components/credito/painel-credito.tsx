"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useFiltrosLembrados } from "@/components/observatorio/consultas";
import { GraficoObservatorio } from "@/components/observatorio/grafico-observatorio";
import { MapaMunicipios } from "@/components/observatorio/mapa-municipios";
import { Seletor } from "@/components/observatorio/seletor";
import { GrupoTabela, TabelaDados } from "@/components/observatorio/tabela-dados";
import { Carregando, ErroConsulta } from "@/components/painel/comuns";
import { Alert } from "@/components/ui/feedback";
import { CREDITO } from "@/content/credito";
import type { AnoCredito, CreditoProdutos, CreditoRanking, CreditoResumo, CreditoSerie, DivisaoCredito, MetaCredito } from "@/lib/api-types";
import {
  MESES,
  UNIDADE,
  detalhesRanking,
  municipiosNoMapa,
  optionAnualCredito,
  optionMensalCredito,
  periodoDoAno,
  reaisCompletos,
  reaisPorExtenso,
  rotuloAno,
} from "@/lib/credito";
import { formatDataHora, formatNumero, formatPercentual, formatoPorUnidade } from "@/lib/format";
import { optionBarrasHorizontais } from "@/lib/observatorio-graficos";
import { useCredito, useFiltrosCredito } from "./consultas";
import { SecaoCredito } from "./secao-credito";

/** Quantos municípios o gráfico de barras mostra; a tabela e o mapa têm os 52. */
const BARRAS_RANKING = 15;
const ATIVIDADES: Record<string, string> = { agricola: "Agrícola", pecuaria: "Pecuária" };

const pct = (v: number | null | undefined) => (v == null ? "–" : formatPercentual(v));
const reais = (v: number | null | undefined) => (v == null ? "–" : reaisCompletos(v));

function Filtros({ d, anual, f }: { d: CreditoResumo["filtros"]; anual: AnoCredito[]; f: ReturnType<typeof useFiltrosCredito> }) {
  const porAno = new Map(anual.map((a) => [a.ano, a]));
  const anos = [...d.opcoes.anos].reverse().map((a) => {
    const info = porAno.get(a);
    return { valor: String(a), rotulo: info ? rotuloAno(info) : String(a) };
  });
  return (
    <div role="group" aria-label="Filtros do painel" className="flex flex-wrap gap-4">
      <Seletor rotulo="Ano" valor={f.valor("ano") || String(d.valores.ano ?? "")} opcoes={anos} onChange={(v) => f.definir("ano", v)} />
      <Seletor rotulo="Município" valor={f.valor("municipio") ? d.valores.municipio?.slug ?? f.valor("municipio") : ""} onChange={(v) => f.definir("municipio", v)}
        opcoes={[{ valor: "", rotulo: "Rondônia (todos)" }, ...d.opcoes.municipios.map((m) => ({ valor: m.slug, rotulo: m.nome }))]} />
      <Seletor rotulo="Programa" valor={f.valor("programa")} onChange={(v) => f.definir("programa", v)}
        opcoes={[{ valor: "", rotulo: "Todos os programas" }, ...d.opcoes.programas.map((p) => ({ valor: p.slug, rotulo: p.nome }))]} />
      <Seletor rotulo="Finalidade" valor={f.valor("finalidade")} onChange={(v) => f.definir("finalidade", v)}
        opcoes={[{ valor: "", rotulo: "Todas as finalidades" }, ...d.opcoes.finalidades.map((p) => ({ valor: p.slug, rotulo: p.nome }))]} />
    </div>
  );
}

function Cartao({ rotulo, numero, apoio, tendencia }: { rotulo: string; numero: string; apoio?: string; tendencia?: "alta" | "queda" }) {
  const Seta = tendencia === "queda" ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="flex flex-col rounded-2xl bg-brand-dark p-5 text-white" data-testid="cartao-credito">
      <dt className="text-sm font-semibold uppercase tracking-wide text-brand-lime">{rotulo}</dt>
      <dd className="mt-3 flex items-center gap-2 text-[1.7rem] font-bold leading-tight tabular-nums">
        {tendencia && <Seta aria-hidden="true" className={tendencia === "queda" ? "h-7 w-7 shrink-0 text-amber-300" : "h-7 w-7 shrink-0 text-brand-lime"} />}
        <span className="min-w-0">{numero}</span>
      </dd>
      {apoio && <dd className="mt-auto pt-3 text-sm leading-snug text-white/85">{apoio}</dd>}
    </div>
  );
}

function Numeros({ d }: { d: CreditoResumo }) {
  const m = d.metricas;
  const v = m.variacao_pct;
  const ano = d.filtros.valores.ano;
  const comparado = ano != null && d.qualidade.ano_completo === false ? `do mesmo período de ${ano - 1}` : ano != null ? `de ${ano - 1}` : "";
  return (
    <div className="space-y-6">
      <p data-testid="manchete" className="max-w-[70ch] text-lg font-medium leading-relaxed">{d.texto.manchete}</p>
      <dl className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Cartao rotulo="Total contratado" numero={m.valor_total != null ? reaisPorExtenso(m.valor_total) : "–"}
          tendencia={v == null ? undefined : v >= 0 ? "alta" : "queda"}
          apoio={v == null ? "Sem o ano anterior para comparar" : `${v >= 0 ? "+" : "−"}${formatPercentual(Math.abs(v))} em relação ao valor ${comparado}`} />
        <Cartao rotulo="Contratos" numero={m.contratos != null ? formatNumero(m.contratos) : "–"} apoio="Operações de crédito rural registradas no período" />
        <Cartao rotulo="Valor médio por contrato" numero={m.valor_medio != null ? reaisPorExtenso(m.valor_medio) : "–"} apoio="Total contratado dividido pelo número de contratos" />
        <Cartao rotulo="Participação do Pronaf" numero={pct(m.participacao_pronaf_pct)}
          apoio={m.valor_pronaf != null ? `${reaisPorExtenso(m.valor_pronaf)} da agricultura familiar, sem o filtro de programa` : undefined} />
      </dl>
      {d.texto.como_ler.length > 0 && (
        <ul aria-label="Como ler" className="max-w-[70ch] space-y-1.5 leading-relaxed text-ink-muted">
          {d.texto.como_ler.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}

function TabelaDivisao({ titulo, itens }: { titulo: string; itens: DivisaoCredito[] }) {
  return (
    <GrupoTabela titulo={titulo}>
      <TabelaDados legenda={titulo} colunas={[
        { chave: "nome", rotulo: "Item" }, { chave: "valor", rotulo: "Valor (R$)", numerico: true },
        { chave: "contratos", rotulo: "Contratos", numerico: true }, { chave: "participacao", rotulo: "Participação", numerico: true },
      ]} linhas={itens.map((i) => ({ nome: i.nome, valor: reais(i.valor), contratos: i.contratos, participacao: pct(i.participacao) }))} />
    </GrupoTabela>
  );
}

function Evolucao({ d }: { d: CreditoSerie }) {
  const ano = d.filtros.valores.ano ?? 0;
  const mensal = useMemo(() => d.series.mensal ?? [], [d]);
  const anual = useMemo(() => d.series.anual ?? [], [d]);
  const optMensal = useCallback((e: boolean) => optionMensalCredito(mensal, ano, e), [mensal, ano]);
  const optAnual = useCallback((e: boolean) => optionAnualCredito(anual, e), [anual]);
  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <section aria-labelledby="evolucao-mensal-titulo">
        <h3 id="evolucao-mensal-titulo" className="text-sm font-semibold">Mês a mês em {ano}, com o mesmo mês de {ano - 1}</h3>
        <GraficoObservatorio option={optMensal} descricao={`Crédito rural contratado mês a mês em ${ano} (barras) e em ${ano - 1} (linha tracejada)`} altura={340} />
      </section>
      <section aria-labelledby="evolucao-anual-titulo">
        <h3 id="evolucao-anual-titulo" className="text-sm font-semibold">Ano a ano: Pronaf e demais programas</h3>
        <GraficoObservatorio option={optAnual} descricao="Crédito rural contratado por ano, com o Pronaf e os demais programas empilhados" altura={340} />
      </section>
    </div>
  );
}

function TabelasEvolucao({ d }: { d: CreditoSerie }) {
  const ano = d.filtros.valores.ano ?? 0;
  return (
    <div className="space-y-8">
      <GrupoTabela titulo={`Mês a mês em ${ano}`}>
        <TabelaDados legenda={`Crédito rural mês a mês em ${ano}`} colunas={[
          { chave: "mes", rotulo: "Mês" }, { chave: "valor", rotulo: `${ano} (R$)`, numerico: true }, { chave: "contratos", rotulo: "Contratos", numerico: true },
          { chave: "pronaf", rotulo: "Pronaf (R$)", numerico: true }, { chave: "anterior", rotulo: `${ano - 1} (R$)`, numerico: true },
        ]} linhas={(d.series.mensal ?? []).map((m) => ({
          mes: MESES[m.mes - 1] ?? String(m.mes), valor: m.valor == null ? "sem dado" : reais(m.valor), contratos: m.contratos,
          pronaf: m.valor_pronaf == null ? "sem dado" : reais(m.valor_pronaf), anterior: m.valor_ano_anterior == null ? "sem dado" : reais(m.valor_ano_anterior),
        }))} />
      </GrupoTabela>
      <GrupoTabela titulo="Ano a ano">
        <TabelaDados legenda="Crédito rural ano a ano" colunas={[
          { chave: "ano", rotulo: "Ano" }, { chave: "valor", rotulo: "Total (R$)", numerico: true }, { chave: "contratos", rotulo: "Contratos", numerico: true },
          { chave: "pronaf", rotulo: "Pronaf (R$)", numerico: true },
        ]} linhas={(d.series.anual ?? []).map((a) => ({ ano: rotuloAno(a), valor: reais(a.valor), contratos: a.contratos, pronaf: reais(a.valor_pronaf) }))} />
      </GrupoTabela>
    </div>
  );
}

function Municipios({ d, municipio }: { d: CreditoRanking; municipio: string | null }) {
  const itens = useMemo(() => d.series.municipios ?? [], [d]);
  const top = useMemo(() => itens.slice(0, BARRAS_RANKING), [itens]);
  const formato = useMemo(() => formatoPorUnidade(UNIDADE, Math.max(0, ...top.map((i) => i.valor / 1000))), [top]);
  const detalhes = useMemo(() => detalhesRanking(top), [top]);
  const opt = useCallback((e: boolean) => optionBarrasHorizontais(top.map((i) => ({ nome: i.nome, valor: i.valor / 1000 })), UNIDADE, e, formato, detalhes), [top, formato, detalhes]);
  const escolhido = municipio ? itens.find((i) => i.slug === municipio || i.codigo_ibge === municipio) : undefined;
  return (
    <div className="space-y-4">
      {escolhido && (
        <p className="font-medium">
          {escolhido.nome} está em {escolhido.posicao}º lugar entre os 52 municípios, com {reaisPorExtenso(escolhido.valor)} ({pct(escolhido.participacao_pct)} do estado).
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <MapaMunicipios municipios={municipiosNoMapa(itens)} unidade={UNIDADE} categorias={[]} descricao="Mapa dos municípios de Rondônia pelo crédito rural contratado" />
        <section aria-labelledby="ranking-credito-titulo">
          <h3 id="ranking-credito-titulo" className="text-sm font-semibold">Os {BARRAS_RANKING} municípios que mais contrataram</h3>
          <GraficoObservatorio option={opt} descricao={`Os ${BARRAS_RANKING} municípios com mais crédito rural contratado`} altura={520} />
        </section>
      </div>
    </div>
  );
}

function TabelaMunicipios({ d }: { d: CreditoRanking }) {
  return (
    <GrupoTabela titulo="Ranking dos municípios (mapa e barras)">
      <TabelaDados legenda="Crédito rural por município" colunas={[
        { chave: "posicao", rotulo: "Posição", numerico: true }, { chave: "nome", rotulo: "Município" }, { chave: "valor", rotulo: "Valor (R$)", numerico: true },
        { chave: "contratos", rotulo: "Contratos", numerico: true }, { chave: "medio", rotulo: "Valor por contrato (R$)", numerico: true }, { chave: "participacao", rotulo: "Participação", numerico: true },
      ]} linhas={(d.series.municipios ?? []).map((m) => ({
        posicao: m.posicao, nome: m.nome, valor: reais(m.valor), contratos: m.contratos, medio: reais(m.valor_por_contrato), participacao: pct(m.participacao_pct),
      }))} />
    </GrupoTabela>
  );
}

function Produtos({ d }: { d: CreditoProdutos }) {
  const produtos = useMemo(() => d.series.produtos ?? [], [d]);
  const formato = useMemo(() => formatoPorUnidade(UNIDADE, Math.max(0, ...produtos.map((p) => p.valor / 1000))), [produtos]);
  const detalhes = useMemo(() => Object.fromEntries(produtos.map((p) => [p.nome, `${pct(p.participacao_pct)} do valor${p.atividade ? ` · ${ATIVIDADES[p.atividade] ?? p.atividade}` : ""}`])), [produtos]);
  const opt = useCallback((e: boolean) => optionBarrasHorizontais(produtos.map((p) => ({ nome: p.nome, valor: p.valor / 1000 })), UNIDADE, e, formato, detalhes), [produtos, formato, detalhes]);
  return <GraficoObservatorio option={opt} descricao="Principais produtos e itens financiados por valor contratado" altura={Math.max(320, produtos.length * 36)} />;
}

function TabelaProdutos({ d, resumo }: { d: CreditoProdutos; resumo: CreditoResumo | undefined }) {
  return (
    <div className="space-y-8">
      <GrupoTabela titulo="Principais produtos">
        <TabelaDados legenda="Crédito rural por produto" colunas={[
          { chave: "nome", rotulo: "Produto ou item" }, { chave: "atividade", rotulo: "Atividade" }, { chave: "valor", rotulo: "Valor (R$)", numerico: true },
          { chave: "participacao", rotulo: "Participação", numerico: true },
        ]} linhas={(d.series.produtos ?? []).map((p) => ({ nome: p.nome, atividade: p.atividade ? ATIVIDADES[p.atividade] ?? p.atividade : "–", valor: reais(p.valor), participacao: pct(p.participacao_pct) }))} />
      </GrupoTabela>
      {resumo?.series.atividades && <TabelaDivisao titulo="Por atividade" itens={resumo.series.atividades} />}
    </div>
  );
}

function Divisoes({ d }: { d: CreditoResumo }) {
  const grupos: [string, DivisaoCredito[] | undefined][] = [["Por programa", d.series.programas], ["Por finalidade", d.series.finalidades], ["Por atividade", d.series.atividades]];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {grupos.map(([titulo, itens]) => itens && (
        <section key={titulo} aria-label={titulo} className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{titulo}</h3>
          <ul className="mt-3 space-y-3">
            {itens.map((i) => (
              <li key={i.slug}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{i.nome}</span>
                  <span className="tabular-nums text-ink-muted">{pct(i.participacao)}</span>
                </div>
                <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-surface-alt">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, i.participacao ?? 0))}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{reaisPorExtenso(i.valor)} · {formatNumero(i.contratos)} {i.contratos === 1 ? "contrato" : "contratos"}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Metodologia({ meta, mesRecente }: { meta: MetaCredito | undefined; mesRecente: string | null | undefined }) {
  const fonte = meta?.fontes[0];
  const [ano, mes] = (mesRecente ?? "").split("-").map(Number);
  return (
    <section id="metodologia" aria-labelledby="metodologia-titulo" className="scroll-mt-32 border-t border-line pt-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">05 · Metodologia</p>
      <h2 id="metodologia-titulo" className="mt-1 text-[1.75rem] font-semibold tracking-tight">De onde vêm os números</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="max-w-[70ch] space-y-3 leading-relaxed text-ink-muted">
          <p>{CREDITO.nota.pronaf}</p>
          <p>{CREDITO.nota.finalidades}</p>
          <p>{CREDITO.nota.defasagem}</p>
          <p>{CREDITO.nota.limites}</p>
        </div>
        <aside aria-label="Fonte e atualização" className="self-start rounded-md bg-surface-alt p-4 text-sm leading-relaxed">
          <p>
            Fonte:{" "}
            <a href={fonte?.url_fonte ?? "https://www.bcb.gov.br/estabilidadefinanceira/micrrural"} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-fg underline">
              {fonte?.fonte ?? "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)"}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
            . Dados abertos sob a licença{" "}
            <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-fg underline">
              ODbL<span className="sr-only"> (abre em nova aba)</span>
            </a>
            .
          </p>
          {ano && mes ? <p className="mt-2">Dados até {MESES[mes - 1]} de {ano}.</p> : null}
          <p className="mt-2">Atualizado em {formatDataHora(meta?.atualizado_em ?? null)}.</p>
        </aside>
      </div>
    </section>
  );
}

export function PainelCredito() {
  const f = useFiltrosCredito();
  const resumo = useCredito("resumo", f.qs);
  const serie = useCredito("serie", f.qs);
  const ranking = useCredito("ranking", f.qs);
  const produtos = useCredito("por-produto", f.qs);
  const filtros = useFiltrosLembrados(resumo.data?.filtros);
  const r = resumo.data;
  const ano = r?.filtros.valores.ano;
  const periodo = ano != null && r ? periodoDoAno(ano, r.qualidade.meses_com_dado) : null;

  return (
    <div className="min-w-0 space-y-16 pb-8">
      <section id="numeros" aria-labelledby="numeros-titulo" className="scroll-mt-32 pt-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-fg">01 · Números</p>
        <h2 id="numeros-titulo" className="mt-1 text-[1.75rem] font-semibold tracking-tight">
          {periodo ? `Crédito rural contratado, ${periodo}` : "Crédito rural contratado"}
        </h2>
        {filtros && <div className="mt-5"><Filtros d={filtros} anual={serie.data?.series.anual ?? []} f={f} /></div>}
        {r && r.qualidade.avisos.length > 0 && (
          <Alert className="mt-5" title={r.qualidade.ano_completo === false ? "Ano incompleto" : undefined}>
            {r.qualidade.avisos.map((a) => <p key={a}>{a}</p>)}
          </Alert>
        )}
        <div className="mt-6">
          {resumo.isPending && <Carregando rotulo="números" />}
          {resumo.isError && <ErroConsulta erro={resumo.error} onRetry={() => void resumo.refetch()} />}
          {r && Object.keys(r.metricas).length > 0 && (
            <div aria-busy={resumo.isPlaceholderData ? "true" : undefined} className={resumo.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
              <Numeros d={r} />
              <div className="mt-8"><Divisoes d={r} /></div>
            </div>
          )}
        </div>
      </section>

      <SecaoCredito id="evolucao" etiqueta="02 · Evolução" titulo="Como o crédito evoluiu" consulta={serie} onPadrao={f.padrao}
        apoio="Mês a mês no ano escolhido e ano a ano desde 2018. Os valores estão em reais da época, sem correção pela inflação."
        tabela={(d) => <TabelasEvolucao d={d} />}>
        {(d) => <Evolucao d={d} />}
      </SecaoCredito>

      <SecaoCredito id="municipios" etiqueta="03 · Municípios" titulo="Onde o crédito foi contratado" consulta={ranking} onPadrao={f.padrao}
        apoio="O mapa e o ranking mostram os 52 municípios no ano, programa e finalidade escolhidos (o filtro de município não se aplica aqui). Município sem contrato no período aparece com zero."
        tabela={(d) => <TabelaMunicipios d={d} />}>
        {(d) => <Municipios d={d} municipio={f.valor("municipio") || null} />}
      </SecaoCredito>

      <SecaoCredito id="produtos" etiqueta="04 · Produtos" titulo="O que o crédito financiou" consulta={produtos} onPadrao={f.padrao}
        apoio="Os principais produtos e itens do custeio e do investimento. O Banco Central não detalha por produto a comercialização e a industrialização."
        tabela={(d) => <TabelaProdutos d={d} resumo={r} />}>
        {(d) => <Produtos d={d} />}
      </SecaoCredito>

      <Metodologia meta={r?.meta} mesRecente={r?.qualidade.mes_mais_recente} />
    </div>
  );
}
