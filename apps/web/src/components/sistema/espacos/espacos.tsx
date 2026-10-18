"use client";

import { ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ESPACOS } from "@/content/sistema/exemplo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Label, Textarea } from "@/components/ui/field";
import { agoraISO, formatarDataBR, somarDias } from "@/lib/sistema/datas";
import { conflitosDoPedido, excedeCapacidade, podeAprovar, ROTULO_PERIODO, ROTULO_STATUS, ROTULO_TIPO_ESPACO, sugestaoDeCorrecao } from "@/lib/sistema/espacos";
import { novoId, useSistema } from "@/lib/sistema/estado";
import { TIPO_DO_ESPACO } from "@/lib/sistema/legenda";
import { comTag } from "@/lib/sistema/tags";
import type { PedidoEspaco, StatusPedido } from "@/lib/sistema/tipos";
import { aplicarEspaco } from "@/lib/sistema/voz";
import { cn } from "@/lib/utils";
import { Abas } from "../abas";
import { Dialogo } from "../dialogo";
import { SeloDeTipo } from "../legenda-de-tipos";
import { ChipsDeTags, FiltroDeTag, useFiltroDeTag } from "../tags";
import { AgendarPorVoz, AvisoVoz } from "../voz/agendar-por-voz";
import { FormularioPedido } from "./formulario-pedido";

const corStatus: Record<StatusPedido, string> = {
  pendente: "bg-warm text-ink",
  aprovado: "bg-brand-soft text-brand-strong",
  recusado: "bg-danger-soft text-danger-ink",
  cancelado: "bg-surface-alt text-ink-muted",
  devolvido: "bg-danger-soft text-danger-ink",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function StatusPedidoSelo({ status }: { status: StatusPedido }) {
  return <Badge className={cn("px-2 py-0", corStatus[status])}>{ROTULO_STATUS[status]}</Badge>;
}

function PainelSemana({ tag }: { tag: string }) {
  const { hoje, pedidos } = useSistema();
  // começa hoje: os pedidos que importam são os que vêm pela frente
  const [inicio, setInicio] = useState(hoje);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const visiveis = comTag(pedidos, tag).filter((p) => p.status === "pendente" || p.status === "aprovado");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setInicio(somarDias(inicio, -7))} aria-label="7 dias antes">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button variant="vidro-claro" size="sm" onClick={() => setInicio(hoje)}>
          Hoje
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setInicio(somarDias(inicio, 7))} aria-label="7 dias depois">
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
        <span className="text-sm text-ink-muted">
          {formatarDataBR(dias[0]!)} a {formatarDataBR(dias[6]!)} · pendentes e aprovados; conflitos em vermelho
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
          <caption className="sr-only">Agendamentos dos espaços em 7 dias</caption>
          <thead>
            <tr>
              <th scope="col" className="w-36 pb-2 text-left text-ink-muted">Espaço</th>
              {dias.map((d) => (
                <th key={d} scope="col" className={cn("pb-2 text-left font-semibold text-ink-muted", d === hoje && "text-brand-strong")}>
                  {DIAS_SEMANA[new Date(`${d}T12:00`).getDay()]} {d.slice(8)}/{d.slice(5, 7)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ESPACOS.map((esp) => (
              <tr key={esp.id}>
                <th scope="row" className="border border-line p-2 text-left align-top font-medium text-ink">
                  {esp.nome}
                  <span className="block font-normal text-ink-muted">até {esp.capacidade}</span>
                </th>
                {dias.map((d) => (
                  <td key={d} className="h-20 border border-line p-1 align-top">
                    <ul className="grid gap-1">
                      {visiveis
                        .filter((p) => p.espacoId === esp.id && p.data === d)
                        .sort((a, b) => a.inicio.localeCompare(b.inicio))
                        .map((p) => {
                          const conflito = conflitosDoPedido(p, pedidos).length > 0 || excedeCapacidade(p, esp);
                          return (
                            <li
                              key={p.id}
                              className={cn("rounded-lg px-1.5 py-1", p.status === "aprovado" ? "bg-brand-soft" : "bg-warm", conflito && "ring-1 ring-inset ring-danger")}
                            >
                              <span aria-hidden="true" className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle", p.status === "aprovado" ? "bg-brand" : "bg-brand-lime")} />
                              <span className="font-medium tabular-nums">
                                {p.inicio}–{p.fim}
                              </span>{" "}
                              {p.nome}
                              <span className="block text-ink-muted">
                                {ROTULO_STATUS[p.status]}
                                {conflito && <strong className="text-danger-ink"> · conflito</strong>}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalhesPedido({ p, mostrarQuem }: { p: PedidoEspaco; mostrarQuem: boolean }) {
  const { pedidos, nomeDe: nomeFuncionario } = useSistema();
  const espaco = ESPACOS.find((e) => e.id === p.espacoId)!;
  const conflitos = p.status === "pendente" || p.status === "aprovado" ? conflitosDoPedido(p, pedidos) : [];
  const lotado = excedeCapacidade(p, espaco);
  return (
    <div className="text-sm">
      <p className="font-medium text-ink">
        {p.nome} <StatusPedidoSelo status={p.status} />{" "}
        <SeloDeTipo tipo={TIPO_DO_ESPACO[p.tipo]}>{ROTULO_TIPO_ESPACO[p.tipo]}</SeloDeTipo>
      </p>
      <p className="text-ink-muted">
        {espaco.nome} · {formatarDataBR(p.data)} · {p.periodo === "horario" ? `${p.inicio}–${p.fim}` : `${ROTULO_PERIODO[p.periodo]}`} · {p.participantes} participantes
        {p.coffeeBreak && (
          <>
            {" · "}
            <Coffee aria-hidden="true" className="inline h-3.5 w-3.5" /> coffee break
          </>
        )}
        {mostrarQuem && ` · pedido por ${nomeFuncionario(p.funcionarioId)}`}
      </p>
      {p.observacoes && <p className="text-ink-muted">Obs.: {p.observacoes}</p>}
      {p.status === "recusado" && p.motivoRecusa && <p className="text-danger-ink">Motivo da recusa: {p.motivoRecusa}</p>}
      {p.status === "devolvido" && p.correcao && <p className="text-danger-ink">O que corrigir: {p.correcao}</p>}
      {(conflitos.length > 0 || lotado) && (
        <ul className="mt-1 list-disc pl-5 text-danger-ink">
          {conflitos.map((c) => (
            <li key={c.id}>
              Conflito com {c.nome} ({c.inicio}–{c.fim}, {ROTULO_STATUS[c.status].toLowerCase()})
            </li>
          ))}
          {lotado && <li>Passa da capacidade ({espaco.capacidade} pessoas)</li>}
        </ul>
      )}
      <ChipsDeTags ids={p.tags} className="mt-2" />
    </div>
  );
}

function Fila({ tag }: { tag: string }) {
  const { funcionario, pedidos, atualizarPedidos, nomeDe: nomeFuncionario } = useSistema();
  const [aviso, setAviso] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<PedidoEspaco | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const [devolvendo, setDevolvendo] = useState<PedidoEspaco | null>(null);
  const [correcao, setCorrecao] = useState("");
  const [erroCorrecao, setErroCorrecao] = useState<string | null>(null);
  const gestor = funcionario?.gestorEspacos ?? false;
  const fila = comTag(pedidos, tag).filter((p) => p.status === "pendente").sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  function aprovar(p: PedidoEspaco) {
    const bloqueio = podeAprovar(p, pedidos);
    if (bloqueio) return setAviso(`${bloqueio} Use "Devolver" para pedir a correção ao solicitante.`);
    setAviso(null);
    atualizarPedidos((lista) => lista.map((o) => (o.id === p.id ? { ...o, status: "aprovado" } : o)), `Aprovou o pedido de espaço "${p.nome}"`);
  }

  function recusar(e: FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) return setErroMotivo("Informe o motivo da recusa.");
    atualizarPedidos(
      (lista) => lista.map((o) => (o.id === recusando!.id ? { ...o, status: "recusado", motivoRecusa: motivo.trim() } : o)),
      `Recusou o pedido de espaço "${recusando!.nome}"`,
    );
    setRecusando(null);
    setMotivo("");
    setErroMotivo(null);
  }

  function abrirDevolucao(p: PedidoEspaco) {
    const espaco = ESPACOS.find((e) => e.id === p.espacoId)!;
    setCorrecao(sugestaoDeCorrecao(p, pedidos, espaco));
    setErroCorrecao(null);
    setDevolvendo(p);
  }

  function devolver(e: FormEvent) {
    e.preventDefault();
    if (!correcao.trim()) return setErroCorrecao("Diga o que o solicitante precisa corrigir.");
    atualizarPedidos(
      (lista) => lista.map((o) => (o.id === devolvendo!.id ? { ...o, status: "devolvido", correcao: correcao.trim() } : o)),
      `Devolveu para correção o pedido de espaço "${devolvendo!.nome}"`,
    );
    setDevolvendo(null);
    setAviso(null);
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">
        {fila.length} pedido(s) aguardando, em ordem de chegada.
        {!gestor && " A fila é avaliada pelo gestor dos espaços."}
      </p>
      {aviso && (
        <Alert tone="erro" className="mb-3">
          {aviso}
        </Alert>
      )}
      <ol className="grid gap-2">
        {fila.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-card p-3">
            <DetalhesPedido p={p} mostrarQuem />
            {gestor && (
              <div className="flex gap-2">
                <Button variant="vidro" size="sm" onClick={() => aprovar(p)} aria-label={`Aprovar ${p.nome}`}>
                  Aprovar
                </Button>
                <Button size="sm" variant="vidro-claro" onClick={() => abrirDevolucao(p)} aria-label={`Devolver ${p.nome} para correção`}>
                  Devolver
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRecusando(p)} aria-label={`Recusar ${p.nome}`}>
                  Recusar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {recusando && (
        <Dialogo titulo={`Recusar: ${recusando.nome}`} aoFechar={() => setRecusando(null)}>
          <form onSubmit={recusar} className="grid gap-4" noValidate>
            <div>
              <Label htmlFor="motivo-recusa">Motivo da recusa</Label>
              <Textarea id="motivo-recusa" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-20" />
            </div>
            {erroMotivo && <Alert tone="erro">{erroMotivo}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRecusando(null)}>
                Cancelar
              </Button>
              <Button variant="vidro" type="submit">Recusar pedido</Button>
            </div>
          </form>
        </Dialogo>
      )}
      {devolvendo && (
        <Dialogo titulo={`Devolver para correção: ${devolvendo.nome}`} aoFechar={() => setDevolvendo(null)}>
          <form onSubmit={devolver} className="grid gap-4" noValidate>
            <p className="text-sm text-ink-muted">O pedido volta para {nomeFuncionario(devolvendo.funcionarioId)}, que corrige e reenvia para a fila.</p>
            <div>
              <Label htmlFor="observacao-correcao">Observação: o que precisa ser corrigido</Label>
              <Textarea id="observacao-correcao" value={correcao} onChange={(e) => setCorrecao(e.target.value)} className="min-h-24" />
            </div>
            {erroCorrecao && <Alert tone="erro">{erroCorrecao}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDevolvendo(null)}>
                Cancelar
              </Button>
              <Button variant="vidro" type="submit">
                Devolver ao solicitante
              </Button>
            </div>
          </form>
        </Dialogo>
      )}
    </div>
  );
}

function MeusPedidos({ tag }: { tag: string }) {
  const { funcionario, pedidos, atualizarPedidos } = useSistema();
  const [corrigindo, setCorrigindo] = useState<PedidoEspaco | null>(null);
  if (!funcionario) return null;
  const meus = comTag(pedidos, tag).filter((p) => p.funcionarioId === funcionario.id).sort((a, b) => b.data.localeCompare(a.data));
  return (
    <div>
      {meus.length === 0 && <p className="text-sm text-ink-muted">{tag ? "Nenhum pedido seu com essa tag." : "Você ainda não pediu nenhum espaço."}</p>}
      <ul className="grid gap-2">
        {meus.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-card p-3">
            <DetalhesPedido p={p} mostrarQuem={false} />
            {p.status === "devolvido" && (
              <Button size="sm" variant="vidro" onClick={() => setCorrigindo(p)} aria-label={`Corrigir e reenviar ${p.nome}`}>
                Corrigir e reenviar
              </Button>
            )}
            {(p.status === "pendente" || p.status === "aprovado" || p.status === "devolvido") && (
              <Button size="sm" variant="ghost" onClick={() => atualizarPedidos((lista) => lista.map((o) => (o.id === p.id ? { ...o, status: "cancelado" } : o)), `Cancelou o pedido de espaço "${p.nome}"`)} aria-label={`Cancelar ${p.nome}`}>
                Cancelar pedido
              </Button>
            )}
          </li>
        ))}
      </ul>
      {corrigindo && (
        <Dialogo titulo={`Corrigir pedido: ${corrigindo.nome}`} aoFechar={() => setCorrigindo(null)}>
          {corrigindo.correcao && (
            <Alert tone="erro" className="mb-4">
              O que corrigir: {corrigindo.correcao}
            </Alert>
          )}
          <FormularioPedido
            base={corrigindo}
            pedidos={pedidos}
            rotuloEnviar="Reenviar para a fila"
            aoCancelar={() => setCorrigindo(null)}
            aoEnviar={(p) => {
              atualizarPedidos(
                (lista) => lista.map((o) => (o.id === p.id ? { ...p, status: "pendente", correcao: "" } : o)),
                `Corrigiu e reenviou o pedido de espaço "${p.nome}"`,
              );
              setCorrigindo(null);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}

export function Espacos() {
  const { funcionario, hoje, pedidos, atualizarPedidos } = useSistema();
  const [novo, setNovo] = useState<PedidoEspaco | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [faltandoVoz, setFaltandoVoz] = useState<string[] | null>(null);
  const [tag, setTag] = useFiltroDeTag();
  if (!funcionario) return null;

  function abrirNovo(pedido = pedidoNovo()) {
    setEnviado(null);
    setNovo(pedido);
  }

  function pedidoNovo(): PedidoEspaco {
    return {
      id: novoId("pedido"),
      espacoId: "sala-reunioes",
      funcionarioId: funcionario!.id,
      data: somarDias(hoje, 1),
      periodo: "manha",
      inicio: "08:00",
      fim: "12:00",
      tipo: "reuniao",
      nome: "",
      participantes: 0,
      coffeeBreak: false,
      observacoes: "",
      status: "pendente",
      motivoRecusa: "",
      criadoEm: agoraISO(),
    };
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Agendamento de espaços</h1>
        <div className="flex flex-wrap gap-2" data-tour="espacos-acoes">
          <AgendarPorVoz
            tipo="espaco"
            espacos={ESPACOS.map((e) => ({ id: e.id, descricao: e.nome }))}
            aoInterpretar={(campos, faltando) => {
              setFaltandoVoz(faltando);
              abrirNovo(aplicarEspaco(pedidoNovo(), campos));
            }}
          />
          <Button
            variant="vidro"
            onClick={() => {
              setFaltandoVoz(null);
              abrirNovo();
            }}
          >
            Novo pedido
          </Button>
        </div>
      </div>
      {enviado && (
        <Alert tone="info" className="mb-4">
          {enviado}
        </Alert>
      )}
      {/* a tag escolhida vale para o painel, a fila e os seus pedidos */}
      <FiltroDeTag id="espacos-tag" valor={tag} aoMudar={setTag} className="mb-4" />
      <Abas
        rotulo="Agendamento de espaços"
        tour="espacos-abas"
        base="/sistema/espacos"
        abas={[
          { id: "painel", rotulo: "Painel de 7 dias", conteudo: <PainelSemana tag={tag} /> },
          { id: "fila", rotulo: `Fila (${pedidos.filter((p) => p.status === "pendente").length})`, conteudo: <Fila tag={tag} /> },
          {
            id: "meus",
            rotulo: (() => {
              const n = pedidos.filter((p) => p.status === "devolvido" && p.funcionarioId === funcionario.id).length;
              return n ? `Meus pedidos (${n} para corrigir)` : "Meus pedidos";
            })(),
            conteudo: <MeusPedidos tag={tag} />,
          },
        ]}
      />
      {novo && (
        <Dialogo titulo="Novo pedido de espaço" aoFechar={() => setNovo(null)}>
          {faltandoVoz && <AvisoVoz faltando={faltandoVoz} />}
          <FormularioPedido
            base={novo}
            pedidos={pedidos}
            aoCancelar={() => setNovo(null)}
            aoEnviar={(p) => {
              const comConflito = conflitosDoPedido(p, pedidos).length > 0;
              atualizarPedidos((lista) => [...lista, p], `Pediu o espaço ${ESPACOS.find((e) => e.id === p.espacoId)?.nome ?? ""} para "${p.nome}"`);
              setNovo(null);
              setEnviado(`Pedido "${p.nome}" enviado para a fila${comConflito ? ", marcado com conflito" : ""}. Acompanhe em Meus pedidos.`);
            }}
          />
        </Dialogo>
      )}
    </div>
  );
}
