"use client";

import { Paperclip, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input, Label, Textarea } from "@/components/ui/field";
import { comprovanteSeguro, podeEditar, ROTULO_CATEGORIA, ROTULO_STATUS_DESPESA, totaisPorCentro } from "@/lib/sistema/contas";
import { agoraISO, formatarDataBR, somarDias } from "@/lib/sistema/datas";
import { novoId, useSistema } from "@/lib/sistema/estado";
import { comTag } from "@/lib/sistema/tags";
import { reais } from "@/lib/sistema/formato";
import { CENTROS_DE_CUSTO, type CentroDeCusto, type Despesa, type StatusDespesa } from "@/lib/sistema/tipos";
import { cn } from "@/lib/utils";
import { Abas } from "../abas";
import { Dialogo } from "../dialogo";
import { ChipsDeTags, FiltroDeTag, useFiltroDeTag } from "../tags";
import { FormularioDespesa } from "./formulario-despesa";

const corStatus: Record<StatusDespesa, string> = {
  rascunho: "bg-surface-alt text-ink-muted",
  enviada: "bg-warm text-ink",
  aprovada: "bg-brand-soft text-brand-strong",
  devolvida: "bg-danger-soft text-danger-ink",
};

function LinhaDespesa({ d, mostrarQuem, acoes }: { d: Despesa; mostrarQuem: boolean; acoes?: React.ReactNode }) {
  const { nomeDe } = useSistema();
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-card p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {d.descricao} <Badge className={cn("ml-1 px-2 py-0", corStatus[d.status])}>{ROTULO_STATUS_DESPESA[d.status]}</Badge>
        </p>
        <p className="text-ink-muted">
          {formatarDataBR(d.data)} · {d.centro} · {ROTULO_CATEGORIA[d.categoria]}
          {d.fornecedor && ` · ${d.fornecedor}`}
          {mostrarQuem && ` · ${nomeDe(d.funcionarioId)}`}
        </p>
        {d.comprovante &&
          (comprovanteSeguro(d.comprovante.dados) ? (
            <a href={d.comprovante.dados!} download={d.comprovante.nome} className="mt-1 inline-flex items-center gap-1 text-brand-fg underline-offset-2 hover:underline">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
              {d.comprovante.nome}
            </a>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1 text-ink-muted">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
              {d.comprovante.nome} (só o nome)
            </p>
          ))}
        {d.status === "devolvida" && d.observacaoGestor && <p className="mt-1 text-danger-ink">Devolvida: {d.observacaoGestor}</p>}
        <ChipsDeTags ids={d.tags} className="mt-2" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums text-ink">{reais(d.valor)}</span>
        {acoes}
      </div>
    </li>
  );
}

function MinhasDespesas({ aoEditar, tag }: { aoEditar: (d: Despesa) => void; tag: string }) {
  const { funcionario, despesas, atualizarDespesas } = useSistema();
  if (!funcionario) return null;
  const minhas = comTag(despesas, tag).filter((d) => d.funcionarioId === funcionario.id).sort((a, b) => b.data.localeCompare(a.data));
  const mudar = (id: string, muda: Partial<Despesa>, acao: string) => atualizarDespesas((l) => l.map((d) => (d.id === id ? { ...d, ...muda } : d)), acao);
  return (
    <div>
      {minhas.length === 0 && <p className="text-sm text-ink-muted">{tag ? "Nenhuma despesa sua com essa tag." : "Nenhuma despesa lançada."}</p>}
      <ul className="grid gap-2">
        {minhas.map((d) => (
          <LinhaDespesa
            key={d.id}
            d={d}
            mostrarQuem={false}
            acoes={
              podeEditar(d, funcionario.id) && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => aoEditar(d)} aria-label={`Editar ${d.descricao}`}>
                    Editar
                  </Button>
                  <Button size="sm" variant="vidro" onClick={() => mudar(d.id, { status: "enviada", observacaoGestor: "" }, `Enviou para aprovação a despesa "${d.descricao}"`)} aria-label={`Enviar ${d.descricao}`}>
                    Enviar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => atualizarDespesas((l) => l.filter((x) => x.id !== d.id), `Excluiu a despesa "${d.descricao}"`)} aria-label={`Excluir ${d.descricao}`}>
                    Excluir
                  </Button>
                </>
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}

function Aprovacao({ tag }: { tag: string }) {
  const { despesas: todas, atualizarDespesas } = useSistema();
  const despesas = comTag(todas, tag);
  const [devolvendo, setDevolvendo] = useState<Despesa | null>(null);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const fila = despesas.filter((d) => d.status === "enviada").sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
  const mudar = (id: string, muda: Partial<Despesa>, acao: string) => atualizarDespesas((l) => l.map((d) => (d.id === id ? { ...d, ...muda } : d)), acao);

  function devolver(e: FormEvent) {
    e.preventDefault();
    if (!obs.trim()) return setErro("Diga o que precisa ser corrigido.");
    mudar(devolvendo!.id, { status: "devolvida", observacaoGestor: obs.trim() }, `Devolveu a despesa "${devolvendo!.descricao}"`);
    setDevolvendo(null);
    setObs("");
    setErro(null);
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">
        {fila.length} despesa(s) aguardando aprovação · {reais(fila.reduce((s, d) => s + d.valor, 0))}
      </p>
      <ul className="grid gap-2">
        {fila.map((d) => (
          <LinhaDespesa
            key={d.id}
            d={d}
            mostrarQuem
            acoes={
              <>
                <Button size="sm" variant="vidro" onClick={() => mudar(d.id, { status: "aprovada" }, `Aprovou a despesa "${d.descricao}"`)} aria-label={`Aprovar ${d.descricao}`}>
                  Aprovar
                </Button>
                <Button size="sm" variant="vidro-claro" onClick={() => setDevolvendo(d)} aria-label={`Devolver ${d.descricao}`}>
                  Devolver
                </Button>
              </>
            }
          />
        ))}
      </ul>
      {devolvendo && (
        <Dialogo titulo={`Devolver: ${devolvendo.descricao}`} aoFechar={() => setDevolvendo(null)}>
          <form onSubmit={devolver} className="grid gap-4" noValidate>
            <div>
              <Label htmlFor="obs-gestor">O que precisa ser corrigido</Label>
              <Textarea id="obs-gestor" value={obs} onChange={(e) => setObs(e.target.value)} className="min-h-20" />
            </div>
            {erro && <Alert tone="erro">{erro}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDevolvendo(null)}>
                Cancelar
              </Button>
              <Button variant="vidro" type="submit">
                Devolver despesa
              </Button>
            </div>
          </form>
        </Dialogo>
      )}
    </div>
  );
}

function PorCentro({ tag }: { tag: string }) {
  const { hoje, despesas: todas } = useSistema();
  const despesas = comTag(todas, tag);
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);
  const inicioPadrao = somarDias(hoje, -90);
  const totais = totaisPorCentro(despesas, de || inicioPadrao, ate || hoje);
  const geral = totais.reduce((s, t) => s + t.total, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="centro-de">De</Label>
          <Input id="centro-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="centro-ate">Até</Label>
          <Input id="centro-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button variant="vidro-claro" size="sm" onClick={() => setDe(inicioPadrao)}>
          Últimos 3 meses
        </Button>
      </div>
      <p className="mb-3 text-sm text-ink-muted">Despesas enviadas e aprovadas no período: <strong className="text-ink">{reais(geral)}</strong></p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Despesas por centro de custo</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
              <th scope="col" className="py-2">Centro de custo</th>
              <th scope="col">Principais categorias</th>
              <th scope="col" className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {CENTROS_DE_CUSTO.map((c: CentroDeCusto) => {
              const t = totais.find((x) => x.centro === c);
              const categorias = t ? Object.entries(t.porCategoria).sort((a, b) => b[1]! - a[1]!).map(([k, v]) => `${ROTULO_CATEGORIA[k as keyof typeof ROTULO_CATEGORIA]} ${reais(v!)}`) : [];
              return (
                <tr key={c} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-medium text-ink">{c}</th>
                  <td className="text-ink-muted">{categorias.join(" · ") || "—"}</td>
                  <td className="text-right font-semibold">{reais(t?.total ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Contas() {
  const { funcionario, atualizarDespesas } = useSistema();
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [tag, setTag] = useFiltroDeTag();
  if (!funcionario) return null;
  const centroPadrao = (CENTROS_DE_CUSTO as readonly string[]).includes(funcionario.area) ? (funcionario.area as CentroDeCusto) : "Administrativo";

  function nova() {
    setEditando({
      id: novoId("despesa"),
      funcionarioId: funcionario!.id,
      data: agoraISO().slice(0, 10),
      centro: centroPadrao,
      categoria: "material",
      descricao: "",
      fornecedor: "",
      valor: 0,
      comprovante: null,
      status: "rascunho",
      observacaoGestor: "",
      criadaEm: agoraISO(),
    });
  }

  const abas = [
    { id: "minhas", rotulo: "Minhas despesas", conteudo: <MinhasDespesas aoEditar={setEditando} tag={tag} /> },
    ...(funcionario.gestorContas ? [{ id: "aprovacao", rotulo: "Aprovação", conteudo: <Aprovacao tag={tag} /> }] : []),
    { id: "centros", rotulo: "Por centro de custo", conteudo: <PorCentro tag={tag} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Prestação de contas</h1>
        <Button variant="vidro" onClick={nova} data-tour="contas-acoes">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nova despesa
        </Button>
      </div>
      {/* a tag escolhida vale para as três abas */}
      <FiltroDeTag id="contas-tag" valor={tag} aoMudar={setTag} className="mb-4" />
      <Abas rotulo="Prestação de contas" base="/sistema/contas" abas={abas} tour="contas-abas" />
      {editando && (
        <Dialogo titulo={editando.descricao ? "Editar despesa" : "Nova despesa"} aoFechar={() => setEditando(null)}>
          <FormularioDespesa
            inicial={editando}
            aoCancelar={() => setEditando(null)}
            aoSalvar={(d, enviar) => {
              const final: Despesa = { ...d, status: enviar ? "enviada" : "rascunho", observacaoGestor: enviar ? "" : d.observacaoGestor };
              atualizarDespesas((l) => [...l.filter((x) => x.id !== final.id), final], `${enviar ? "Enviou para aprovação" : "Salvou como rascunho"} a despesa "${final.descricao}"`);
              setEditando(null);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
