import { BarChart3, FileText, GitCompareArrows, HandCoins, Lightbulb, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";
import type { NomeIcone } from "@/content/central";

const ICONES: Record<NomeIcone, LucideIcon> = {
  trophy: Trophy,
  chart: BarChart3,
  compare: GitCompareArrows,
  insight: Lightbulb,
  pdf: FileText,
  shield: ShieldCheck,
  credito: HandCoins,
};

export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  const Componente = ICONES[nome];
  return <Componente aria-hidden="true" className={className} />;
}
