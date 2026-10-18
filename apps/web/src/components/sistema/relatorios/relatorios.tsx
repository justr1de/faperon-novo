"use client";

import { Download, FileCog, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/field";
import { PROTOTIPO } from "@/content/sistema/funcionarios";
import { itensDaAgenda } from "@/lib/sistema/agenda";
import { gravar, ler } from "@/lib/sistema/armazenamento";
import { completar, preencher, type ModeloDocumento } from "@/lib/sistema/documento";
import { formatarDataBR, somarDias, somarMeses } from "@/lib/sistema/datas";
import { useSistema } from "@/lib/sistema/estado";
import { comTag } from "@/lib/sistema/tags";
import {
  comNotaDeTag,
  formatarCelula,
  paraCSV,
  parametrosDoRelatorio,
  relatorioAgenda,
  relatorioAtividades,
  relatorioContas,
  relatorioEspacos,
  relatorioFrota,
  ROTULO_RELATORIO,
  type Relatorio,
  type TipoRelatorio,
} from "@/lib/sistema/relatorios";
import { cn } from "@/lib/utils";
import { Dialogo } from "../dialogo";
import { SeloDeTipo } from "../legenda-de-tipos";
import { Segmentado } from "../segmentado";
import { FiltroDeTag, useFiltroDeTag } from "../tags";
import { FormularioDocumento } from "./formulario-documento";
import { Capa, Contracapa, Faixa } from "./paginas-documento";

const TIPOS = (Object.keys(ROTULO_RELATORIO) as TipoRelatorio[]).map((valor) => ({ valor, rotulo: ROTULO_RELATORIO[valor] }));

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Tabela({ r }: { r: Relatorio }) {
  const numerica = r.colunas.map((c) => c.formato !== "texto");
  if (r.linhas.length === 0) return <p className="py-6 text-sm text-ink-muted">Nada registrado no período.</p>;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[640px] text-sm print:min-w-0 print:text-[9.5px]">
        <caption className="sr-only">{r.titulo}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            {r.colunas.map((c, i) => (
              <th key={c.rotulo} scope="col" className={cn("px-2 py-2 font-medium first:pl-0 print:px-1 print:py-1", numerica[i] && "text-right")}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.linhas.map((l, li) => (
            <tr key={li} className="border-b border-line print:break-inside-avoid">
              {l.map((c, i) => (
                <td key={i} className={cn("px-2 py-2 first:pl-0 print:px-1 print:py-1", numerica[i] ? "text-right tabular-nums" : "text-ink")}>
                  {r.colunas[i]!.selo && r.tipos?.[li] ? <SeloDeTipo tipo={r.tipos[li]}>{formatarCelula(c, "texto")}</SeloDeTipo> : formatarCelula(c, r.colunas[i]!.formato)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {r.total && (
          <tfoot>
            <tr className="font-semibold text-ink">
              {r.total.map((c, i) => (
                <td key={i} className={cn("px-2 py-2 first:pl-0 print:px-1 print:py-1", numerica[i] && "text-right tabular-nums")}>
                  {formatarCelula(c, r.colunas[i]!.formato)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Relatorios() {
  const { hoje, funcionario, eventos, institucionais, frota, pedidos, despesas, atividades, tags, equipe } = useSistema();
  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const fimDoMes = somarDias(somarMeses(inicioDoMes, 1), -1);
  const [tipo, setTipo] = useState<TipoRelatorio>("frota");
  const [de, setDe] = useState(inicioDoMes);
  const [ate, setAte] = useState(fimDoMes);
  const [personalizando, setPersonalizando] = useState(false);
  const [versaoModelo, setVersaoModelo] = useState(0);
  const [tagId, setTagId] = useFiltroDeTag();
  // link dos Indicadores (?tipo=&de=&ate=): lido depois da hidratação, sem useSearchParams (a página fica estática)
  useEffect(() => {
    const p = parametrosDoRelatorio(window.location.search);
    if (p.tipo) setTipo(p.tipo);
    if (p.de) setDe(p.de);
    if (p.ate) setAte(p.ate);
  }, []);
  if (!funcionario) return null;

  // lido a cada render: muda ao trocar de tipo e depois de salvar (versaoModelo força o render)
  void versaoModelo;
  const modelo = completar(ler<Partial<ModeloDocumento> | null>(`documento:${tipo}`, null), tipo);
  const documento = preencher(modelo, { de, ate, hoje, funcionario });
  const periodoValido = /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate) && de <= ate;
  const tag = tags.find((t) => t.id === tagId) ?? null;
  const gerar = (): Relatorio => {
    switch (tipo) {
      case "frota":
        return relatorioFrota(frota, de, ate, tag);
      case "espacos":
        return relatorioEspacos(comTag(pedidos, tagId), de, ate);
      case "agenda":
        return relatorioAgenda(comTag(itensDaAgenda(funcionario.id, eventos, institucionais, frota.reservas, frota.veiculos, pedidos), tagId), de, ate, tags);
      case "contas":
        return relatorioContas(comTag(despesas, tagId), funcionario, de, ate, tags, equipe);
      case "atividades":
        return relatorioAtividades(comTag(atividades, tagId), funcionario, de, ate, tags, equipe);
    }
  };
  const relatorio = periodoValido ? comNotaDeTag(gerar(), tag, tipo) : null;
  const atalhos = [
    { rotulo: "Este mês", de: inicioDoMes, ate: fimDoMes },
    { rotulo: "Últimos 30 dias", de: somarDias(hoje, -29), ate: hoje },
    { rotulo: "Últimos 3 meses", de: somarMeses(hoje, -3), ate: hoje },
  ];

  return (
    <div className="relatorio-impressao">
      <h1 className="mb-4 text-2xl font-semibold text-ink print:hidden">Relatórios</h1>
      <div className="mb-6 grid gap-4 print:hidden" data-tour="relatorios-tipos">
        <Segmentado rotulo="Tipo de relatório" opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="relatorio-de">De</Label>
            <Input id="relatorio-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="relatorio-ate">Até</Label>
            <Input id="relatorio-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <FiltroDeTag id="relatorio-tag" valor={tagId} aoMudar={setTagId} className="w-48" />
          {atalhos.map((a) => (
            <Button
              key={a.rotulo}
              size="sm"
              variant={de === a.de && ate === a.ate ? "vidro" : "vidro-claro"}
              onClick={() => {
                setDe(a.de);
                setAte(a.ate);
              }}
            >
              {a.rotulo}
            </Button>
          ))}
        </div>
      </div>

      {!relatorio ? (
        <Alert tone="erro">Escolha um período válido: a data inicial não pode vir depois da final.</Alert>
      ) : (
        // Na tela: capa e contracapa em miniatura, lado a lado, e o relatório embaixo.
        // No papel (display: block, a ordem do DOM vale): capa, relatório, contracapa.
        <div className="doc-paginas flex flex-wrap items-start gap-4">
          <div className="order-1 flex w-full flex-wrap items-center justify-between gap-2 print:hidden" data-tour="relatorios-documento">
            <p className="text-sm font-medium text-ink">Capa e contracapa (padrão do boletim da FAPERON)</p>
            <Button size="sm" variant="vidro-claro" onClick={() => setPersonalizando(true)}>
              <FileCog aria-hidden="true" className="h-4 w-4" />
              Personalizar capa e contracapa
            </Button>
          </div>
          {documento.incluirCapa && <Capa m={documento} className="order-2 w-40 sm:w-48" />}
          {!documento.incluirCapa && !documento.incluirContracapa && (
            <p className="order-2 text-sm text-ink-muted print:hidden">Sem capa nem contracapa neste tipo de relatório.</p>
          )}
          <section aria-labelledby="titulo-relatorio" className="vidro-cartao order-4 w-full rounded-2xl p-5 print:rounded-none print:border-0 print:bg-white print:px-[14mm] print:py-0 print:shadow-none">
            <Faixa m={documento} className="doc-faixa-interna" />
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-fg">FAPERON · Relatório de {ROTULO_RELATORIO[tipo].toLowerCase()}</p>
                <h2 id="titulo-relatorio" className="text-lg font-semibold text-ink">
                  {relatorio.titulo}
                </h2>
                <p className="text-sm text-ink-muted">
                  {formatarDataBR(de)} a {formatarDataBR(ate)} · gerado em {formatarDataBR(hoje)} por {funcionario.nome}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button size="sm" variant="vidro-claro" onClick={() => window.print()}>
                  <Printer aria-hidden="true" className="h-4 w-4" />
                  Imprimir / salvar PDF
                </Button>
                <Button size="sm" variant="vidro" onClick={() => baixar(`relatorio-${tipo}-${de}-a-${ate}.csv`, paraCSV(relatorio))}>
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Baixar CSV
                </Button>
              </div>
            </div>
            {relatorio.resumo.map((linha) => (
              <p key={linha} className="mb-1 text-sm text-ink">
                {linha}
              </p>
            ))}
            <div className="mt-3">
              <Tabela r={relatorio} />
            </div>
            <p className="mt-4 hidden text-[10px] text-ink-muted print:block">{PROTOTIPO.faixa}</p>
          </section>
          {documento.incluirContracapa && <Contracapa m={documento} className="order-3 w-40 sm:w-48" />}
        </div>
      )}
      {personalizando && (
        <Dialogo titulo={`Capa e contracapa: relatório de ${ROTULO_RELATORIO[tipo].toLowerCase()}`} aoFechar={() => setPersonalizando(false)}>
          <FormularioDocumento
            key={tipo}
            tipo={tipo}
            inicial={modelo}
            aoCancelar={() => setPersonalizando(false)}
            aoSalvar={(m) => {
              gravar(`documento:${tipo}`, m);
              setVersaoModelo((v) => v + 1);
              setPersonalizando(false);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
