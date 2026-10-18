"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useEscuro } from "@/components/observatorio/use-escuro";
import { Label, Select } from "@/components/ui/field";
import { agendaDeExemplo } from "@/content/sistema/exemplo";
import { ler } from "@/lib/sistema/armazenamento";
import { ROTULO_TIPO_ATIVIDADE } from "@/lib/sistema/atividades";
import { ROTULO_CATEGORIA } from "@/lib/sistema/contas";
import { rotuloMesCurto } from "@/lib/sistema/datas";
import { ROTULO_STATUS } from "@/lib/sistema/espacos";
import { useSistema } from "@/lib/sistema/estado";
import { km, reais } from "@/lib/sistema/formato";
import {
  agendaDaEquipe,
  descreverIntervalo,
  escopoDe,
  indicadoresAgenda,
  indicadoresAtividades,
  indicadoresContas,
  indicadoresEspacos,
  indicadoresFrota,
  intervaloDoPeriodo,
  PERIODOS_INDICADORES,
  podeVerEquipe,
  type Filtro,
  type PeriodoIndicadores,
} from "@/lib/sistema/indicadores";
import { LEGENDA } from "@/lib/sistema/legenda";
import type { TipoRelatorio } from "@/lib/sistema/relatorios";
import { limparTags } from "@/lib/sistema/tags";
import type { CategoriaDespesa, Evento } from "@/lib/sistema/tipos";
import { cn } from "@/lib/utils";
import { Segmentado } from "../segmentado";
import { FiltroDeTag, useFiltroDeTag } from "../tags";
import { alturaDeitadas, lerCores, opcaoBarras, type CoresDoTema } from "./graficos";

// o ECharts só vai para o navegador quando a página abre (e não pesa nas outras telas do sistema)
const Grafico = dynamic(() => import("@/components/painel/grafico").then((m) => m.Grafico), { ssr: false });

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n = (v: number) => inteiro.format(v);
const horas = (v: number) => `${umaCasa.format(v)} h`;
const CATEGORIAS = Object.keys(ROTULO_CATEGORIA) as CategoriaDespesa[];

/** Linha de tabela já formatada: a tabela é a versão em texto do gráfico. */
type Tabela = { colunas: string[]; linhas: string[][] };

function Figura({ id, titulo, resumo, option, altura, tabela, nota }: { id: string; titulo: string; resumo: string; option: ReturnType<typeof opcaoBarras>; altura: number; tabela: Tabela; nota?: string }) {
  return (
    <figure aria-labelledby={`${id}-titulo`} className="min-w-0">
      <h3 id={`${id}-titulo`} className="text-sm font-semibold text-ink">
        {titulo}
      </h3>
      <div className="mt-2" style={{ minHeight: Math.min(altura, 320) }}>
        <Grafico option={option} descricao={`${titulo}. ${resumo}`} altura={altura} alturaMovel={Math.min(altura, 320)} temaProprio />
      </div>
      <figcaption className="mt-2 text-sm text-ink-muted">
        {resumo}
        {nota && <span className="mt-1 block text-xs">{nota}</span>}
      </figcaption>
      <details className="group mt-2 text-sm">
        <summary className="inline-flex cursor-pointer items-center rounded-md py-1 font-medium text-brand-fg underline-offset-4 hover:underline">
          Ver tabela<span className="sr-only">: {titulo}</span>
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                {tabela.colunas.map((c, i) => (
                  <th key={c} scope="col" className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((l, li) => (
                <tr key={li} className="border-b border-line last:border-b-0">
                  {l.map((c, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="py-1.5 pr-3 text-left font-normal text-ink">
                        {c}
                      </th>
                    ) : (
                      <td key={i} className="py-1.5 pr-3 text-right tabular-nums text-ink">
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Números do bloco: o primeiro é a informação principal e é o único grande. */
function Numeros({ itens }: { itens: { rotulo: string; valor: string; detalhe?: string }[] }) {
  return (
    <dl className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
      {itens.map((item, i) => (
        <div key={item.rotulo} className={cn("flex max-w-[11rem] flex-col", i === 0 && "w-full sm:w-auto sm:max-w-none")}>
          <dt className="order-2 text-xs text-ink-muted">{item.rotulo}</dt>
          <dd className={cn("order-1 whitespace-nowrap font-semibold tabular-nums tracking-[-0.02em] text-ink", i === 0 ? "text-[2rem] leading-tight" : "text-lg leading-snug")}>{item.valor}</dd>
          {item.detalhe && <dd className="order-3 text-xs text-ink-muted">{item.detalhe}</dd>}
        </div>
      ))}
    </dl>
  );
}

const ROTULO_ABRIR: Record<TipoRelatorio, string> = {
  agenda: "Abrir a Agenda",
  frota: "Abrir Frotas",
  espacos: "Abrir Espaços",
  contas: "Abrir Contas",
  atividades: "Abrir Atividades",
};
const ROTA: Record<TipoRelatorio, string> = {
  agenda: "/sistema/agenda",
  frota: "/sistema/frotas",
  espacos: "/sistema/espacos",
  contas: "/sistema/contas",
  atividades: "/sistema/atividades",
};
const ROTULO_RELATORIO_DO_BLOCO: Record<TipoRelatorio, string> = {
  agenda: "Relatório da agenda",
  frota: "Relatório da frota",
  espacos: "Relatório dos espaços",
  contas: "Relatório de contas",
  atividades: "Relatório de atividades",
};

const link = "inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-medium text-brand-fg underline-offset-4 hover:underline sm:min-h-0";

function Bloco({
  area,
  titulo,
  contexto,
  vazio,
  orientacao,
  filtro,
  children,
}: {
  area: TipoRelatorio;
  titulo: string;
  contexto?: string;
  vazio: boolean;
  orientacao: string;
  filtro: Filtro;
  children: ReactNode;
}) {
  const relatorio = `/sistema/relatorios?tipo=${area}&de=${filtro.intervalo.de}&ate=${filtro.intervalo.ate}`;
  return (
    <section aria-labelledby={`bloco-${area}`} className="min-w-0 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`bloco-${area}`} className="text-xl font-semibold tracking-[-0.02em] text-ink">
          {titulo}
        </h2>
        <p className="flex flex-wrap gap-x-4">
          <Link href={ROTA[area]} className={link}>
            {ROTULO_ABRIR[area]}
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
          <Link href={relatorio} className={link}>
            {ROTULO_RELATORIO_DO_BLOCO[area]}
          </Link>
        </p>
      </div>
      {contexto && <p className="mt-1 text-sm text-ink-muted">{contexto}</p>}
      {vazio ? (
        <div className="mt-4 rounded-xl bg-surface-alt px-4 py-5">
          <p className="font-medium text-ink">Sem dados no período</p>
          <p className="mt-1 text-sm text-ink-muted">{orientacao}</p>
        </div>
      ) : (
        <div className="grid gap-8">{children}</div>
      )}
    </section>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: { nome: string; valor: string; detalhe?: string }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      <ol className="mt-2 divide-y divide-line text-sm">
        {itens.map((item, i) => (
          <li key={item.nome} className="flex items-baseline gap-3 py-1.5">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 text-ink">
              <span className="block truncate" title={item.nome}>
                {item.nome}
              </span>
              {item.detalhe && <span className="block text-xs text-ink-muted">{item.detalhe}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted">{item.valor}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Indicadores() {
  const { hoje, funcionario, eventos, institucionais, frota, pedidos, despesas, atividades, tags, equipe: colegas } = useSistema();
  const [periodo, setPeriodo] = useState<PeriodoIndicadores>("3m");
  const [tagId, setTagId] = useFiltroDeTag();
  const [escolhido, setEscolhido] = useState("");
  const escuro = useEscuro();
  const cores = useMemo(() => lerCores(escuro), [escuro]);

  const filtro = useMemo<Filtro | null>(
    () => (funcionario ? { intervalo: intervaloDoPeriodo(periodo, hoje), hoje, tagId, escopo: escopoDe(funcionario, escolhido) } : null),
    [funcionario, periodo, hoje, tagId, escolhido],
  );

  const itensDaAgenda = useMemo(() => {
    if (!funcionario || !filtro) return [];
    const ids = filtro.escopo.pessoa ? [filtro.escopo.pessoa] : colegas.map((f) => f.id);
    // a agenda de cada colega fica guardada neste navegador (ou é a de exemplo, se nunca foi aberta)
    const pessoaisDe = (id: string): Evento[] => (id === funcionario.id ? eventos : limparTags(ler<Evento[]>(`agenda:${id}`, agendaDeExemplo(id, hoje)), tags));
    return agendaDaEquipe(ids, pessoaisDe, institucionais, frota.reservas, frota.veiculos, pedidos);
  }, [funcionario, filtro, eventos, institucionais, frota, pedidos, tags, hoje, colegas]);

  if (!funcionario || !filtro) return null;
  const equipe = podeVerEquipe(funcionario);
  const escolhidoNome = colegas.find((f) => f.id === filtro.escopo.pessoa)?.nome;
  const quem = !equipe ? "Seus números" : filtro.escopo.pessoa ? `Números de ${escolhidoNome}` : "Toda a equipe";

  const agenda = indicadoresAgenda(itensDaAgenda, filtro);
  const fr = indicadoresFrota(frota, filtro);
  const esp = indicadoresEspacos(pedidos, filtro);
  const contas = indicadoresContas(despesas, filtro);
  const ativ = indicadoresAtividades(atividades, filtro, new Map(colegas.map((f) => [f.id, f.nome])));
  const meses = filtro.intervalo.meses.map(rotuloMesCurto);
  const custosSemFiltro = Boolean(filtro.tagId || (filtro.escopo.equipe && filtro.escopo.pessoa));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Indicadores</h1>
      <p className="mt-1 text-sm text-ink-muted">
        <strong className="font-semibold text-ink">{quem}</strong> · {descreverIntervalo(filtro.intervalo)}
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-3" data-tour="indicadores-filtros">
        <div>
          <span aria-hidden="true" className="mb-1.5 block text-sm font-medium text-ink">
            Período
          </span>
          <Segmentado rotulo="Período" opcoes={PERIODOS_INDICADORES} valor={periodo} aoMudar={setPeriodo} />
        </div>
        <FiltroDeTag id="indicadores-tag" valor={tagId} aoMudar={setTagId} className="w-48" />
        {equipe && (
          <div className="w-full max-w-[14rem]">
            <Label htmlFor="indicadores-funcionario">Funcionário</Label>
            <Select id="indicadores-funcionario" value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              <option value="">Todos</option>
              {colegas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <Bloco area="agenda" titulo="Agenda" filtro={filtro} vazio={agenda.eventos === 0 && agenda.proximos7 === 0} orientacao="Marque um compromisso na Agenda para ver aqui.">
          <Numeros
            itens={[
              { rotulo: "Eventos no período", valor: n(agenda.eventos) },
              { rotulo: "Nos próximos 7 dias", valor: n(agenda.proximos7) },
              { rotulo: "Dias com viagem", valor: n(agenda.diasComViagem) },
            ]}
          />
          {agenda.porTipo.length > 0 && (
            <Figura
              id="agenda-tipos"
              titulo="Eventos por tipo"
              resumo={`${agenda.porTipo.map((t) => `${n(t.total)} ${LEGENDA[t.tipo].toLowerCase()}`).join(", ")}.`}
              altura={alturaDeitadas(agenda.porTipo.length)}
              option={opcaoBarras({
                eixo: agenda.porTipo.map((t) => LEGENDA[t.tipo]),
                series: [{ nome: "Eventos", valores: agenda.porTipo.map((t) => t.total), cor: agenda.porTipo.map((t) => cores.tipo[t.tipo]) }],
                deitadas: true,
                formatar: n,
                cores,
              })}
              tabela={{ colunas: ["Tipo", "Eventos"], linhas: agenda.porTipo.map((t) => [LEGENDA[t.tipo], n(t.total)]) }}
            />
          )}
        </Bloco>

        <Bloco
          area="frota"
          titulo="Frota"
          filtro={filtro}
          contexto={equipe ? undefined : "Uso e custos de toda a frota; em Viagens, quantas são suas."}
          vazio={fr.viagens === 0 && fr.custoTotal === 0}
          orientacao="Reserve um veículo ou registre um abastecimento para ver aqui."
        >
          <Numeros
            itens={[
              { rotulo: "Km rodados", valor: km(fr.km) },
              { rotulo: "Viagens", valor: n(fr.viagens), detalhe: fr.minhasViagens == null ? undefined : `${n(fr.minhasViagens)} sua(s)` },
              { rotulo: "Consumo médio", valor: fr.consumoMedio == null ? "—" : `${umaCasa.format(fr.consumoMedio)} km/l` },
              {
                rotulo: "Revisão próxima ou vencida",
                valor: `${n(fr.revisao.proxima + fr.revisao.vencida)} veículo(s)`,
                detalhe: fr.revisao.vencida ? `${n(fr.revisao.vencida)} vencida(s)` : undefined,
              },
            ]}
          />
          <Figura
            id="frota-meses"
            titulo="Km rodados por mês"
            resumo={`${km(fr.km)} em ${n(fr.viagens)} viagem(ns) no período.`}
            altura={240}
            option={opcaoBarras({
              eixo: meses,
              series: [{ nome: "Km rodados", valores: fr.porMes.map((m) => m.km), cor: cores.marca }],
              formatar: (v) => km(v),
              cores,
              extra: (i) => `${n(fr.porMes[i]!.viagens)} viagem(ns)`,
            })}
            tabela={{ colunas: ["Mês", "Viagens", "Km rodados"], linhas: fr.porMes.map((m, i) => [meses[i]!, n(m.viagens), km(m.km)]) }}
          />
          {fr.custoPorVeiculo.length > 0 && (
            <Figura
              id="frota-custos"
              titulo="Custo por veículo"
              resumo={`${reais(fr.custoTotal)} em combustível e manutenção; o maior é ${fr.custoPorVeiculo[0]!.nome}, com ${reais(fr.custoPorVeiculo[0]!.total)}.`}
              nota={custosSemFiltro ? "Custos da frota toda: abastecimentos e manutenções não têm tag nem são de uma pessoa." : undefined}
              altura={alturaDeitadas(fr.custoPorVeiculo.length, true)}
              option={opcaoBarras({
                eixo: fr.custoPorVeiculo.map((c) => c.nome),
                series: [
                  { nome: "Combustível", valores: fr.custoPorVeiculo.map((c) => c.combustivel), cor: cores.categorias[0]! },
                  { nome: "Manutenção", valores: fr.custoPorVeiculo.map((c) => c.manutencao), cor: cores.categorias[1]! },
                ],
                deitadas: true,
                formatar: (v) => reais(v).replace(",00", ""),
                cores,
              })}
              tabela={{
                colunas: ["Veículo", "Combustível", "Manutenção", "Total"],
                linhas: fr.custoPorVeiculo.map((c) => [c.nome, reais(c.combustivel), reais(c.manutencao), reais(c.total)]),
              }}
            />
          )}
        </Bloco>

        <Bloco
          area="espacos"
          titulo="Espaços"
          filtro={filtro}
          contexto={equipe ? undefined : "Ocupação de todos os espaços; pedidos e coffee breaks são os seus."}
          vazio={esp.pedidos === 0 && esp.horasAprovadas === 0}
          orientacao="Peça um espaço para ver aqui."
        >
          <Numeros
            itens={[
              { rotulo: "Horas de uso aprovadas", valor: horas(esp.horasAprovadas) },
              { rotulo: equipe ? "Pedidos" : "Seus pedidos", valor: n(esp.pedidos) },
              { rotulo: "Com coffee break", valor: n(esp.coffeeBreaks) },
            ]}
          />
          <Figura
            id="espacos-ocupacao"
            titulo="Ocupação por espaço"
            resumo={`${horas(esp.horasAprovadas)} aprovadas no período.`}
            altura={alturaDeitadas(esp.horasPorEspaco.length)}
            option={opcaoBarras({
              eixo: esp.horasPorEspaco.map((e) => e.nome),
              series: [{ nome: "Horas aprovadas", valores: esp.horasPorEspaco.map((e) => e.horas), cor: cores.marca }],
              deitadas: true,
              formatar: horas,
              cores,
            })}
            tabela={{ colunas: ["Espaço", "Horas aprovadas"], linhas: esp.horasPorEspaco.map((e) => [e.nome, horas(e.horas)]) }}
          />
          {esp.pedidos > 0 && (
            <Figura
              id="espacos-situacao"
              titulo={equipe ? "Pedidos por situação" : "Seus pedidos por situação"}
              resumo={`${esp.porSituacao.map((s) => `${n(s.total)} ${ROTULO_STATUS[s.status].toLowerCase()}`).join(", ")}.`}
              altura={alturaDeitadas(esp.porSituacao.length)}
              option={opcaoBarras({
                eixo: esp.porSituacao.map((s) => ROTULO_STATUS[s.status]),
                series: [{ nome: "Pedidos", valores: esp.porSituacao.map((s) => s.total), cor: cores.marca }],
                deitadas: true,
                formatar: n,
                cores,
              })}
              tabela={{ colunas: ["Situação", "Pedidos"], linhas: esp.porSituacao.map((s) => [ROTULO_STATUS[s.status], n(s.total)]) }}
            />
          )}
        </Bloco>

        <Bloco
          area="contas"
          titulo="Contas"
          filtro={filtro}
          vazio={contas.aprovado === 0 && contas.pendente === 0 && contas.devolvidas === 0}
          orientacao="Lance uma despesa em Contas para ver aqui."
        >
          <Numeros
            itens={[
              { rotulo: "Aprovado", valor: reais(contas.aprovado) },
              { rotulo: "Aguardando aprovação", valor: reais(contas.pendente) },
              { rotulo: "Devolvidas para correção", valor: n(contas.devolvidas) },
            ]}
          />
          {contas.porCentro.length > 0 && (
            <>
              <Figura
                id="contas-centros"
                titulo="Por centro de custo e categoria"
                resumo={`${contas.porCentro.map((c) => `${c.centro}: ${reais(c.total)}`).join("; ")}. Somam as despesas enviadas e aprovadas.`}
                altura={alturaDeitadas(contas.porCentro.length, true) + (contas.categorias.length > 3 ? 24 : 0)}
                option={opcaoBarras({
                  eixo: contas.porCentro.map((c) => c.centro),
                  series: contas.categorias.map((cat) => ({
                    nome: ROTULO_CATEGORIA[cat],
                    valores: contas.porCentro.map((c) => c.porCategoria[cat] ?? 0),
                    cor: corDaCategoria(cores, cat),
                  })),
                  deitadas: true,
                  formatar: (v) => reais(v).replace(",00", ""),
                  cores,
                })}
                tabela={{
                  colunas: ["Centro de custo", ...contas.categorias.map((c) => ROTULO_CATEGORIA[c]), "Total"],
                  linhas: contas.porCentro.map((c) => [c.centro, ...contas.categorias.map((cat) => reais(c.porCategoria[cat] ?? 0)), reais(c.total)]),
                }}
              />
              <Figura
                id="contas-meses"
                titulo="Evolução mensal"
                resumo={`${reais(contas.aprovado)} aprovados e ${reais(contas.pendente)} aguardando aprovação no período.`}
                altura={260}
                option={opcaoBarras({
                  eixo: meses,
                  series: [
                    { nome: "Aprovado", valores: contas.porMes.map((m) => m.aprovado), cor: cores.categorias[0]! },
                    { nome: "Aguardando aprovação", valores: contas.porMes.map((m) => m.enviado), cor: cores.categorias[1]! },
                  ],
                  formatar: (v) => reais(v).replace(",00", ""),
                  cores,
                })}
                tabela={{ colunas: ["Mês", "Aprovado", "Aguardando aprovação"], linhas: contas.porMes.map((m, i) => [meses[i]!, reais(m.aprovado), reais(m.enviado)]) }}
              />
            </>
          )}
        </Bloco>

        <Bloco area="atividades" titulo="Atividades" filtro={filtro} vazio={ativ.atividades === 0} orientacao="Registre uma atividade para ver aqui.">
          <Numeros
            itens={[
              { rotulo: "Horas registradas", valor: horas(ativ.horas) },
              { rotulo: "Atividades", valor: n(ativ.atividades) },
              { rotulo: "Pessoas atendidas", valor: n(ativ.publico) },
            ]}
          />
          <Figura
            id="atividades-tipos"
            titulo="Horas por tipo"
            resumo={`${ativ.horasPorTipo.map((t) => `${horas(t.horas)} de ${ROTULO_TIPO_ATIVIDADE[t.tipo].toLowerCase()}`).join(", ")}.`}
            altura={alturaDeitadas(ativ.horasPorTipo.length)}
            option={opcaoBarras({
              eixo: ativ.horasPorTipo.map((t) => ROTULO_TIPO_ATIVIDADE[t.tipo]),
              series: [{ nome: "Horas", valores: ativ.horasPorTipo.map((t) => t.horas), cor: ativ.horasPorTipo.map((t) => cores.tipo[t.legenda]) }],
              deitadas: true,
              formatar: horas,
              cores,
            })}
            tabela={{ colunas: ["Tipo", "Horas"], linhas: ativ.horasPorTipo.map((t) => [ROTULO_TIPO_ATIVIDADE[t.tipo], horas(t.horas)]) }}
          />
          <Figura
            id="atividades-publico"
            titulo="Público atendido por mês"
            resumo={`${n(ativ.publico)} pessoa(s) atendida(s) no período.`}
            altura={220}
            option={opcaoBarras({ eixo: meses, series: [{ nome: "Público", valores: ativ.publicoPorMes.map((m) => m.publico), cor: cores.marca }], formatar: n, cores })}
            tabela={{ colunas: ["Mês", "Pessoas atendidas"], linhas: ativ.publicoPorMes.map((m, i) => [meses[i]!, n(m.publico)]) }}
          />
          <div className="grid gap-8 sm:grid-cols-2">
            <Lista
              titulo={`Municípios com mais atividades${ativ.municipios.length === 10 ? " (10 primeiros)" : ""}`}
              itens={ativ.municipios.map((m) => ({ nome: m.municipio, valor: `${n(m.atividades)} atividade(s)`, detalhe: `${n(m.publico)} pessoa(s) atendida(s)` }))}
            />
            {ativ.porFuncionario && ativ.porFuncionario.length > 0 && (
              <Lista titulo="Horas por funcionário" itens={ativ.porFuncionario.map((f) => ({ nome: f.nome, valor: horas(f.horas) }))} />
            )}
          </div>
        </Bloco>
      </div>
    </div>
  );
}

/** A cor de cada categoria é fixa (pela ordem do catálogo), para um filtro não repintar as que ficam. */
function corDaCategoria(cores: CoresDoTema, categoria: CategoriaDespesa): string {
  return cores.categorias[CATEGORIAS.indexOf(categoria)]!;
}
