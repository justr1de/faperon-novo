"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { RotaCredito } from "@/lib/api-types";

/** Filtros da página, todos no link: ano, município (código ou slug), programa e finalidade. */
export const CHAVES = ["ano", "municipio", "programa", "finalidade"] as const;
export type ChaveFiltro = (typeof CHAVES)[number];

export function useFiltrosCredito() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const atual = new URLSearchParams();
  for (const k of CHAVES) {
    const v = sp.get(k);
    if (v) atual.set(k, v);
  }
  const ir = (novo: URLSearchParams) => {
    const s = novo.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return {
    qs: atual.toString(),
    /** O valor na URL; vazio quando o filtro usa o padrão do servidor. */
    valor: (k: ChaveFiltro) => atual.get(k) ?? "",
    definir: (k: ChaveFiltro, v: string) => {
      const novo = new URLSearchParams(atual);
      if (v) novo.set(k, v);
      else novo.delete(k);
      ir(novo);
    },
    padrao: () => ir(new URLSearchParams()),
  };
}

export function useCredito<R extends RotaCredito>(rota: R, qs: string) {
  return useQuery({ queryKey: ["credito", rota, qs], queryFn: () => api.credito(rota, qs), placeholderData: keepPreviousData });
}
