import type { Funcionario } from "@/lib/sistema/tipos";

/** Os 5 usuários de DEMONSTRAÇÃO (nomes inventados, sem relação com pessoas reais), os mesmos que o
 *  `manage.py carregar_usuarios_demo` cria no banco. A equipe de verdade vem de `/api/v1/usuarios/equipe`
 *  (ADR 0035); esta lista serve aos testes e aos dados de exemplo, semeados por código. */
export const FUNCIONARIOS: Funcionario[] = [
  { id: "carla", nome: "Carla Mendes", area: "Comunicação", gestorFrota: false, gestorEspacos: false, gestorContas: false, coordenador: false },
  { id: "marcos", nome: "Marcos Oliveira", area: "Administrativo", gestorFrota: true, gestorEspacos: true, gestorContas: true, coordenador: true, administrador: true },
  { id: "ana", nome: "Ana Ribeiro", area: "Técnica", gestorFrota: false, gestorEspacos: false, gestorContas: false, coordenador: false },
  { id: "joao", nome: "João Pereira", area: "Sindical", gestorFrota: false, gestorEspacos: false, gestorContas: false, coordenador: false },
  { id: "luiza", nome: "Luíza Santos", area: "Presidência", gestorFrota: false, gestorEspacos: false, gestorContas: false, coordenador: false },
];

export const PROTOTIPO = {
  faixa: "Protótipo: agenda, frota, espaços, contas e atividades ficam salvos só neste navegador.",
  restaurar: "Restaurar dados de exemplo",
} as const;
