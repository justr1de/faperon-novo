"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/field";
import { formatarDataBR, formatarHora, somarDias } from "@/lib/sistema/datas";
import { novoId, useSistema } from "@/lib/sistema/estado";
import { km } from "@/lib/sistema/formato";
import { formatarPlaca } from "@/lib/sistema/placa";
import { conflitoDeReserva, MENSAGEM_CONFLITO, validarRetorno } from "@/lib/sistema/reservas";
import { comTag } from "@/lib/sistema/tags";
import type { Reserva, SituacaoReserva } from "@/lib/sistema/tipos";
import { aplicarReserva } from "@/lib/sistema/voz";
import { Dialogo } from "../dialogo";
import { Segmentado } from "../segmentado";
import { ChipsDeTags, FiltroDeTag, SeletorDeTags, useFiltroDeTag } from "../tags";
import { AgendarPorVoz, AvisoVoz } from "../voz/agendar-por-voz";

const ROTULO_RESERVA: Record<SituacaoReserva, string> = {
  agendada: "Agendada",
  em_uso: "Em uso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function quando(r: Reserva): string {
  const dia = formatarDataBR(r.saida);
  const ate = r.saida.slice(0, 10) === r.retorno.slice(0, 10) ? formatarHora(r.retorno) : `${formatarDataBR(r.retorno)} ${formatarHora(r.retorno)}`;
  return `${dia} ${formatarHora(r.saida)} – ${ate}`;
}

function FormularioReserva({ inicial, aoSalvar, aoCancelar }: { inicial: Reserva; aoSalvar: (r: Reserva) => string | null; aoCancelar: () => void }) {
  const { frota } = useSistema();
  const [r, setR] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  function salvar(e: FormEvent) {
    e.preventDefault();
    if (!r.veiculoId) return setErro("Escolha o veículo.");
    if (!r.saida || !r.retorno || r.retorno <= r.saida) return setErro("O retorno precisa ser depois da saída.");
    if (!r.destino.trim()) return setErro("Informe o destino.");
    setErro(aoSalvar({ ...r, destino: r.destino.trim(), motivo: r.motivo.trim() }));
  }

  return (
    <form onSubmit={salvar} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor="reserva-veiculo">Veículo</Label>
        <Select id="reserva-veiculo" value={r.veiculoId} onChange={(e) => setR({ ...r, veiculoId: e.target.value })}>
          <option value="">Escolha</option>
          {frota.veiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.modelo} ({formatarPlaca(v.placa)})
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reserva-saida">Saída</Label>
          <Input id="reserva-saida" type="datetime-local" value={r.saida} onChange={(e) => setR({ ...r, saida: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="reserva-retorno">Retorno previsto</Label>
          <Input id="reserva-retorno" type="datetime-local" value={r.retorno} onChange={(e) => setR({ ...r, retorno: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="reserva-destino">Destino</Label>
        <Input id="reserva-destino" value={r.destino} onChange={(e) => setR({ ...r, destino: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="reserva-motivo">Motivo</Label>
        <Input id="reserva-motivo" value={r.motivo} onChange={(e) => setR({ ...r, motivo: e.target.value })} />
      </div>
      <SeletorDeTags valor={r.tags} aoMudar={(tags) => setR((a) => ({ ...a, tags }))} />
      {erro && <Alert tone="erro">{erro}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button variant="vidro" type="submit">Reservar</Button>
      </div>
    </form>
  );
}

function PedidoDeKm({ titulo, rotulo, minimo, aoConfirmar, aoCancelar }: { titulo: string; rotulo: string; minimo: number; aoConfirmar: (valor: number) => string | null; aoCancelar: () => void }) {
  const [valor, setValor] = useState(String(minimo));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Dialogo titulo={titulo} aoFechar={aoCancelar}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(valor);
          setErro(Number.isFinite(n) && valor !== "" ? aoConfirmar(n) : "Informe o km.");
        }}
      >
        <div>
          <Label htmlFor="km-valor">{rotulo}</Label>
          <Input id="km-valor" type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        {erro && <Alert tone="erro">{erro}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button variant="vidro" type="submit">Confirmar</Button>
        </div>
      </form>
    </Dialogo>
  );
}

export function Reservas() {
  const { funcionario, hoje, frota, atualizarFrota, nomeDe } = useSistema();
  const [nova, setNova] = useState<Reserva | null>(null);
  const [faltandoVoz, setFaltandoVoz] = useState<string[] | null>(null);
  const [km_, setKm] = useState<{ reserva: Reserva; etapa: "saida" | "retorno" } | null>(null);
  const [filtro, setFiltro] = useState<"minhas" | "todas">("minhas");
  const [tag, setTag] = useFiltroDeTag();
  if (!funcionario) return null;

  const veiculo = (id: string) => frota.veiculos.find((v) => v.id === id);
  const lista = comTag(frota.reservas, tag)
    .filter((r) => filtro === "todas" || r.funcionarioId === funcionario.id)
    .sort((a, b) => b.saida.localeCompare(a.saida));

  function reservar(r: Reserva): string | null {
    const conflito = conflitoDeReserva(r, frota.reservas, frota.manutencoes);
    if (conflito) return MENSAGEM_CONFLITO[conflito];
    atualizarFrota((f) => ({ ...f, reservas: [...f.reservas, r] }), `Reservou ${nomeVeiculo(r.veiculoId)} para ${r.destino || "viagem"}`);
    setNova(null);
    return null;
  }

  function mudar(id: string, muda: Partial<Reserva>, acao: string) {
    atualizarFrota((f) => ({ ...f, reservas: f.reservas.map((r) => (r.id === id ? { ...r, ...muda } : r)) }), acao);
  }

  function nomeVeiculo(id: string) {
    const v = veiculo(id);
    return v ? `${v.modelo} (${formatarPlaca(v.placa)})` : "veículo";
  }

  const amanha = somarDias(hoje, 1);
  const reservaNova = (): Reserva => ({
    id: novoId("reserva"),
    veiculoId: "",
    funcionarioId: funcionario.id,
    saida: `${amanha}T08:00`,
    retorno: `${amanha}T18:00`,
    destino: "",
    motivo: "",
    kmInicial: null,
    kmFinal: null,
    situacao: "agendada",
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            rotulo="Quais reservas mostrar"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: "minhas", rotulo: "Minhas reservas" },
              { valor: "todas", rotulo: "Todas" },
            ]}
          />
          <FiltroDeTag id="reservas-tag" valor={tag} aoMudar={setTag} compacto />
        </div>
        <div className="flex flex-wrap gap-2" data-tour="frotas-reservas">
          <AgendarPorVoz
            tipo="reserva"
            veiculos={frota.veiculos.map((v) => ({ id: v.id, descricao: `${v.modelo} (${formatarPlaca(v.placa)})` }))}
            aoInterpretar={(campos, faltando) => {
              setFaltandoVoz(faltando);
              setNova(aplicarReserva(reservaNova(), campos));
            }}
          />
          <Button
            variant="vidro"
            onClick={() => {
              setFaltandoVoz(null);
              setNova(reservaNova());
            }}
          >
            Nova reserva
          </Button>
        </div>
      </div>
      {lista.length === 0 && <p className="text-sm text-ink-muted">{tag ? "Nenhuma reserva com essa tag." : "Nenhuma reserva."}</p>}
      <ul className="grid gap-2">
        {lista.map((r) => {
          const v = veiculo(r.veiculoId);
          const minha = r.funcionarioId === funcionario.id;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-3 text-sm">
              <div>
                <p className="font-medium text-ink">
                  {r.destino} <Badge className="ml-1 px-2 py-0">{ROTULO_RESERVA[r.situacao]}</Badge>
                </p>
                <p className="text-ink-muted">
                  {quando(r)} · {v ? `${v.modelo} (${formatarPlaca(v.placa)})` : "veículo removido"}
                  {filtro === "todas" && ` · ${nomeDe(r.funcionarioId)}`}
                  {r.kmInicial != null && r.kmFinal != null && ` · ${km(r.kmFinal - r.kmInicial)} rodados`}
                </p>
                <ChipsDeTags ids={r.tags} className="mt-1.5" />
              </div>
              {minha && (r.situacao === "agendada" || r.situacao === "em_uso") && (
                <div className="flex gap-2">
                  {r.situacao === "agendada" && (
                    <>
                      <Button size="sm" variant="vidro-claro" onClick={() => setKm({ reserva: r, etapa: "saida" })}>
                        Registrar saída
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => mudar(r.id, { situacao: "cancelada" }, `Cancelou a reserva de ${nomeVeiculo(r.veiculoId)} para ${r.destino}`)}>
                        Cancelar
                      </Button>
                    </>
                  )}
                  {r.situacao === "em_uso" && (
                    <Button variant="vidro" size="sm" onClick={() => setKm({ reserva: r, etapa: "retorno" })}>
                      Registrar retorno
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {nova && (
        <Dialogo titulo="Nova reserva" aoFechar={() => setNova(null)}>
          {faltandoVoz && <AvisoVoz faltando={faltandoVoz} />}
          <FormularioReserva inicial={nova} aoSalvar={reservar} aoCancelar={() => setNova(null)} />
        </Dialogo>
      )}
      {km_ && (
        <PedidoDeKm
          titulo={km_.etapa === "saida" ? "Registrar saída" : "Registrar retorno"}
          rotulo={km_.etapa === "saida" ? "Km na saída" : "Km no retorno"}
          minimo={km_.etapa === "saida" ? veiculo(km_.reserva.veiculoId)?.km ?? 0 : km_.reserva.kmInicial ?? 0}
          aoCancelar={() => setKm(null)}
          aoConfirmar={(valor) => {
            const r = km_.reserva;
            if (km_.etapa === "saida") {
              mudar(r.id, { situacao: "em_uso", kmInicial: valor }, `Registrou a saída de ${nomeVeiculo(r.veiculoId)} com ${valor} km`);
            } else {
              const problema = validarRetorno(r.kmInicial ?? 0, valor);
              if (problema) return problema;
              // o retorno atualiza o km do veículo e fecha a viagem agora
              atualizarFrota((f) => ({
                ...f,
                reservas: f.reservas.map((o) => (o.id === r.id ? { ...o, situacao: "concluida", kmFinal: valor } : o)),
                veiculos: f.veiculos.map((v) => (v.id === r.veiculoId ? { ...v, km: Math.max(v.km, valor) } : v)),
              }), `Registrou o retorno de ${nomeVeiculo(r.veiculoId)} com ${valor} km`);
            }
            setKm(null);
            return null;
          }}
        />
      )}
    </div>
  );
}
