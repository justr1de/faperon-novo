"use client";

import { MapPin, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { historicoVisivel, horasDaAtividade, LIMITE_HISTORICO, resumoPorFuncionario, ROTULO_MODULO, ROTULO_TIPO_ATIVIDADE } from "@/lib/sistema/atividades";
import { agoraISO, formatarDataBR, formatarHora, somarDias } from "@/lib/sistema/datas";
import { novoId, useSistema } from "@/lib/sistema/estado";
import { TIPO_DA_ATIVIDADE } from "@/lib/sistema/legenda";
import { comTag } from "@/lib/sistema/tags";
import type { Atividade, ModuloHistorico } from "@/lib/sistema/tipos";
import { aplicarAtividade } from "@/lib/sistema/voz";
import { Abas } from "../abas";
import { Dialogo } from "../dialogo";
import { SeloDeTipo } from "../legenda-de-tipos";
import { ChipsDeTags, FiltroDeTag, useFiltroDeTag } from "../tags";
import { AgendarPorVoz, AvisoVoz } from "../voz/agendar-por-voz";
import { FormularioAtividade } from "./formulario-atividade";

const horas = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;

function LinhaAtividade({ a, mostrarQuem, acoes }: { a: Atividade; mostrarQuem: boolean; acoes?: React.ReactNode }) {
  const { nomeDe } = useSistema();
  return (
    <li className="rounded-xl border border-line bg-card p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {a.titulo} <SeloDeTipo tipo={TIPO_DA_ATIVIDADE[a.tipo]} className="ml-1">{ROTULO_TIPO_ATIVIDADE[a.tipo]}</SeloDeTipo>
          </p>
          <p className="text-ink-muted">
            {formatarDataBR(a.data)} · {a.inicio}–{a.fim} ({horas(horasDaAtividade(a))})
            {mostrarQuem && ` · ${nomeDe(a.funcionarioId)}`}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-ink-muted">
            {a.municipio && (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                {a.municipio}
              </span>
            )}
            {a.publico > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                {a.publico} pessoa(s)
              </span>
            )}
          </p>
          {a.descricao && <p className="mt-1 text-ink">{a.descricao}</p>}
          {a.resultados && <p className="mt-1 text-ink-muted">Resultados: {a.resultados}</p>}
          <ChipsDeTags ids={a.tags} className="mt-2" />
        </div>
        {acoes && <div className="flex gap-2">{acoes}</div>}
      </div>
    </li>
  );
}

/** Período e filtro de tag das abas de atividades (a tag escolhida vale para as duas abas). */
function Periodo({ de, ate, aoMudar, tag, aoMudarTag }: { de: string; ate: string; aoMudar: (de: string, ate: string) => void; tag: string; aoMudarTag: (id: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="atividades-de">De</Label>
        <Input id="atividades-de" type="date" value={de} onChange={(e) => aoMudar(e.target.value, ate)} />
      </div>
      <div>
        <Label htmlFor="atividades-ate">Até</Label>
        <Input id="atividades-ate" type="date" value={ate} onChange={(e) => aoMudar(de, e.target.value)} />
      </div>
      <FiltroDeTag id="atividades-tag" valor={tag} aoMudar={aoMudarTag} />
    </div>
  );
}

interface FiltroTag {
  tag: string;
  aoMudarTag: (id: string) => void;
}

function MinhasAtividades({ aoEditar, tag, aoMudarTag }: { aoEditar: (a: Atividade) => void } & FiltroTag) {
  const { funcionario, hoje, atividades, atualizarAtividades } = useSistema();
  const [de, setDe] = useState(somarDias(hoje, -29));
  const [ate, setAte] = useState(hoje);
  if (!funcionario) return null;
  const minhas = comTag(atividades, tag)
    .filter((a) => a.funcionarioId === funcionario.id && a.data >= de && a.data <= ate)
    .sort((a, b) => b.data.localeCompare(a.data) || b.inicio.localeCompare(a.inicio));
  const total = minhas.reduce((s, a) => s + horasDaAtividade(a), 0);
  const publico = minhas.reduce((s, a) => s + a.publico, 0);
  return (
    <div>
      <Periodo
        de={de}
        ate={ate}
        aoMudar={(d, a) => {
          setDe(d);
          setAte(a);
        }}
        tag={tag}
        aoMudarTag={aoMudarTag}
      />
      <p className="mb-3 text-sm text-ink-muted">
        {minhas.length} atividade(s) · {horas(Math.round(total * 100) / 100)} · {publico} pessoa(s) atendida(s)
      </p>
      {minhas.length === 0 && <p className="text-sm text-ink-muted">Nenhuma atividade registrada no período.</p>}
      <ul className="grid gap-2">
        {minhas.map((a) => (
          <LinhaAtividade
            key={a.id}
            a={a}
            mostrarQuem={false}
            acoes={
              <>
                <Button size="sm" variant="ghost" onClick={() => aoEditar(a)} aria-label={`Editar ${a.titulo}`}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => atualizarAtividades((l) => l.filter((x) => x.id !== a.id), `Excluiu a atividade "${a.titulo}"`)}
                  aria-label={`Excluir ${a.titulo}`}
                >
                  Excluir
                </Button>
              </>
            }
          />
        ))}
      </ul>
    </div>
  );
}

function Equipe({ tag, aoMudarTag }: FiltroTag) {
  const { hoje, atividades: todas, equipe } = useSistema();
  const atividades = comTag(todas, tag);
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);
  const [quem, setQuem] = useState("");
  const resumo = resumoPorFuncionario(atividades, de, ate);
  const lista = atividades
    .filter((a) => a.data >= de && a.data <= ate && (!quem || a.funcionarioId === quem))
    .sort((a, b) => b.data.localeCompare(a.data) || b.inicio.localeCompare(a.inicio));
  return (
    <div>
      <Periodo
        de={de}
        ate={ate}
        aoMudar={(d, a) => {
          setDe(d);
          setAte(a);
        }}
        tag={tag}
        aoMudarTag={aoMudarTag}
      />
      <div className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">Atividades da equipe por funcionário</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
              <th scope="col" className="py-2">Funcionário</th>
              <th scope="col" className="text-right">Atividades</th>
              <th scope="col" className="text-right">Horas</th>
              <th scope="col" className="text-right">Público</th>
            </tr>
          </thead>
          <tbody>
            {equipe.map((f) => {
              const r = resumo.find((x) => x.funcionarioId === f.id);
              return (
                <tr key={f.id} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-medium text-ink">{f.nome}</th>
                  <td className="text-right tabular-nums">{r?.atividades ?? 0}</td>
                  <td className="text-right tabular-nums">{horas(r?.horas ?? 0)}</td>
                  <td className="text-right tabular-nums">{r?.publico ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mb-3 max-w-xs">
        <Label htmlFor="atividades-quem">Mostrar atividades de</Label>
        <Select id="atividades-quem" value={quem} onChange={(e) => setQuem(e.target.value)}>
          <option value="">Toda a equipe</option>
          {equipe.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
      </div>
      {lista.length === 0 && <p className="text-sm text-ink-muted">Nenhuma atividade no período.</p>}
      <ul className="grid gap-2">
        {lista.map((a) => (
          <LinhaAtividade key={a.id} a={a} mostrarQuem />
        ))}
      </ul>
    </div>
  );
}

function Historico() {
  const { funcionario, historico, nomeDe } = useSistema();
  const [modulo, setModulo] = useState<ModuloHistorico | "">("");
  if (!funcionario) return null;
  const lista = historicoVisivel(historico, funcionario).filter((r) => !modulo || r.modulo === modulo);
  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">
        {funcionario.coordenador
          ? "O que cada pessoa fez no sistema, registrado automaticamente."
          : "O que você fez no sistema, registrado automaticamente."}{" "}
        Ficam as {LIMITE_HISTORICO} ações mais recentes.
      </p>
      <div className="mb-3 max-w-xs">
        <Label htmlFor="historico-modulo">Módulo</Label>
        <Select id="historico-modulo" value={modulo} onChange={(e) => setModulo(e.target.value as ModuloHistorico | "")}>
          <option value="">Todos</option>
          {Object.entries(ROTULO_MODULO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>
      </div>
      {lista.length === 0 && <p className="text-sm text-ink-muted">Nada registrado.</p>}
      <ol className="grid gap-1.5" aria-label="Histórico de ações">
        {lista.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line py-1.5 text-sm">
            <time dateTime={r.quando} className="w-36 shrink-0 tabular-nums text-ink-muted">
              {formatarDataBR(r.quando.slice(0, 10))} {formatarHora(r.quando)}
            </time>
            <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-brand-fg">{ROTULO_MODULO[r.modulo]}</span>
            <span className="min-w-0 flex-1 text-ink">
              {funcionario.coordenador && <strong className="font-medium">{nomeDe(r.funcionarioId)}: </strong>}
              {r.acao}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Atividades() {
  const { funcionario, hoje, atualizarAtividades } = useSistema();
  const [editando, setEditando] = useState<{ atividade: Atividade; nova: boolean; faltandoVoz?: string[] } | null>(null);
  const [tag, setTag] = useFiltroDeTag();
  if (!funcionario) return null;

  const atividadeNova = (): Atividade => ({
    id: novoId("atividade"),
    funcionarioId: funcionario.id,
    data: hoje,
    inicio: "08:00",
    fim: "12:00",
    tipo: "visita_tecnica",
    titulo: "",
    municipio: "",
    publico: 0,
    descricao: "",
    resultados: "",
    criadaEm: agoraISO(),
  });

  const abas = [
    { id: "minhas", rotulo: "Minhas atividades", conteudo: <MinhasAtividades aoEditar={(a) => setEditando({ atividade: a, nova: false })} tag={tag} aoMudarTag={setTag} /> },
    ...(funcionario.coordenador ? [{ id: "equipe", rotulo: "Equipe", conteudo: <Equipe tag={tag} aoMudarTag={setTag} /> }] : []),
    { id: "historico", rotulo: "Histórico", conteudo: <Historico /> },
  ];

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Registro de atividades</h1>
        <div className="flex flex-wrap gap-2" data-tour="atividades-acoes">
          <AgendarPorVoz
            tipo="atividade"
            rotulo="Registrar por voz"
            aoInterpretar={(campos, faltando) => setEditando({ atividade: aplicarAtividade(atividadeNova(), campos), nova: true, faltandoVoz: faltando })}
          />
          <Button variant="vidro" onClick={() => setEditando({ atividade: atividadeNova(), nova: true })}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Registrar atividade
          </Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        Lance as atividades que você realizou: visitas, atendimentos, reuniões, capacitações. O histórico guarda sozinho o que foi feito no sistema.
      </p>
      <Abas rotulo="Registro de atividades" base="/sistema/atividades" abas={abas} tour="atividades-abas" />
      {editando && (
        <Dialogo titulo={editando.nova ? "Registrar atividade" : "Editar atividade"} aoFechar={() => setEditando(null)}>
          {editando.faltandoVoz && <AvisoVoz faltando={editando.faltandoVoz} />}
          <FormularioAtividade
            inicial={editando.atividade}
            aoCancelar={() => setEditando(null)}
            aoSalvar={(a) => {
              atualizarAtividades((l) => [...l.filter((x) => x.id !== a.id), a], `${editando.nova ? "Registrou" : "Editou"} a atividade "${a.titulo}"`);
              setEditando(null);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
