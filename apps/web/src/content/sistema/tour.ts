/** Tour guiado da área logada: cada passo abre a tela, destaca o elemento real e diz como fazer a tarefa. */
export interface PassoDoTour {
  id: string;
  /** Seção do menu, para a pessoa saber onde está. */
  secao: string;
  rota: string;
  /** Valor do atributo data-tour do elemento destacado; sem ele, o cartão fica no centro. */
  alvo: string | null;
  titulo: string;
  texto: string;
  /** Como fazer, em ordem. */
  passos?: string[];
}

export const TOUR: PassoDoTour[] = [
  {
    id: "barra",
    secao: "Início",
    rota: "/sistema",
    alvo: "barra",
    titulo: "O menu do sistema",
    texto: "Daqui você chega a todas as áreas. O nome e a área de quem está usando aparecem logo abaixo, com a opção de sair. Cada pessoa entra com a própria conta.",
  },
  {
    id: "inicio",
    secao: "Início",
    rota: "/sistema",
    alvo: "inicio-atalhos",
    titulo: "Atalhos do dia",
    texto: "Ao entrar, você vê o que vem pela frente na semana e um atalho para cada área, já com o que precisa da sua atenção.",
  },
  {
    id: "agenda-marcar",
    secao: "Agenda",
    rota: "/sistema/agenda",
    alvo: "agenda-acoes",
    titulo: "Marcar um compromisso",
    texto: "A agenda é sua: ninguém mais vê os seus eventos.",
    passos: [
      "Clique em Novo evento.",
      "Preencha título, data, início e fim; tipo e local ajudam a achar depois.",
      "Clique em Salvar. Prefere falar? Use Agendar por voz, diga o compromisso e confira antes de salvar.",
    ],
  },
  {
    id: "agenda-mes",
    secao: "Agenda",
    rota: "/sistema/agenda",
    alvo: "agenda-mes",
    titulo: "Ler o mês",
    texto: "A cor diz o tipo, igual em todo o sistema: reunião em verde, viagem em aço, compromisso em ameixa, e assim por diante; a legenda abaixo do mês mostra só os tipos que estão na tela. A forma diz a origem: o ponto cheio é evento seu (o único com fundo cheio, porque só ele se edita aqui); o prédio, os da FAPERON; a chave, os espaços aprovados; o caminhão, as viagens da frota, em faixa com o destino em todos os dias da viagem (a sua cheia; a dos colegas contornada, para saber quem estará fora).",
    passos: ["Clique no número de um dia para ver tudo dele no painel do dia.", "Passe o mouse sobre o dia e use o + para marcar algo nele.", "Mês e Lista trocam o jeito de ver."],
  },
  {
    id: "agenda-dia",
    secao: "Agenda",
    rota: "/sistema/agenda",
    alvo: "agenda-dia",
    titulo: "O dia em foco",
    texto: "O painel verde mostra o dia escolhido, com horário e local de cada compromisso.",
    passos: ["Marcar neste dia abre um evento já com a data.", "Para editar ou excluir um evento seu, clique nele. Excluiu sem querer? Use Desfazer no aviso que aparece embaixo."],
  },
  {
    id: "tags",
    secao: "Agenda",
    rota: "/sistema/agenda",
    alvo: "agenda-acoes",
    titulo: "Tags para achar por assunto",
    texto: "Tags como Dia de campo, Sindicatos ou SENAR juntam o que é do mesmo assunto em eventos, reservas, pedidos, despesas e atividades.",
    passos: [
      "No formulário de qualquer item, marque as tags em Tags (são opcionais).",
      "Use o filtro Tag de cada tela, e dos relatórios, para ver só o que tem aquela tag.",
      "Os gestores criam, renomeiam e apagam tags em Gerenciar tags, na barra do sistema.",
    ],
  },
  {
    id: "frotas-reservar",
    secao: "Frotas",
    rota: "/sistema/frotas?aba=reservas",
    alvo: "frotas-reservas",
    titulo: "Reservar um veículo",
    texto: "Toda viagem com carro da FAPERON começa por uma reserva, que entra na sua agenda.",
    passos: [
      "Clique em Nova reserva e escolha o veículo.",
      "Informe saída, retorno, destino e motivo e clique em Reservar. Se o carro estiver ocupado ou em manutenção, o sistema avisa.",
      "No dia, use Registrar saída e, na volta, Registrar retorno com o km do painel.",
    ],
  },
  {
    id: "frotas-abas",
    secao: "Frotas",
    rota: "/sistema/frotas?aba=reservas",
    alvo: "frotas-abas",
    titulo: "Abastecimento, manutenção e custos",
    texto: "Nas outras abas ficam o cadastro dos veículos (feito pelo gestor), o registro de abastecimentos e manutenções e os custos do mês, por veículo ou da frota toda.",
    passos: ["Abasteceu? Abra Abastecimento e manutenção e lance litros, valor e km.", "Em Veículos, o aviso de revisão mostra quando cada carro precisa ir à oficina."],
  },
  {
    id: "espacos-pedir",
    secao: "Espaços",
    rota: "/sistema/espacos",
    alvo: "espacos-acoes",
    titulo: "Pedir um espaço",
    texto: "Auditório, hub e salas são pedidos aqui e passam pela aprovação do gestor.",
    passos: [
      "Clique em Novo pedido.",
      "Escolha o espaço, o dia, o período, o tipo, o nome do evento, os participantes e se terá coffee break.",
      "Se houver conflito de horário ou lotação, o pedido avisa. Clique em Enviar para a fila.",
    ],
  },
  {
    id: "espacos-fila",
    secao: "Espaços",
    rota: "/sistema/espacos",
    alvo: "espacos-abas",
    titulo: "Fila, aprovação e correção",
    texto: "O painel de 7 dias mostra a ocupação. Na Fila, o gestor aprova, recusa ou devolve o pedido com uma observação do que corrigir.",
    passos: ["Pedido devolvido aparece em Meus pedidos: clique em Corrigir e reenviar, ajuste e mande de novo para a fila.", "Aprovado, ele entra na sua agenda."],
  },
  {
    id: "contas",
    secao: "Contas",
    rota: "/sistema/contas",
    alvo: "contas-acoes",
    titulo: "Lançar uma despesa",
    texto: "A prestação de contas reúne as despesas por centro de custo, com aprovação do gestor.",
    passos: [
      "Clique em Nova despesa.",
      "Informe data, valor, centro de custo, categoria, descrição e fornecedor, e anexe o comprovante.",
      "Clique em Enviar para aprovação, ou Salvar rascunho para terminar depois. Se voltar devolvida, corrija e envie de novo.",
    ],
  },
  {
    id: "contas-aprovacao",
    secao: "Contas",
    rota: "/sistema/contas",
    alvo: "contas-abas",
    titulo: "Aprovação e totais",
    texto: "O gestor das contas avalia cada despesa enviada; todos acompanham os totais por centro de custo.",
    passos: [
      "Gestor: abra Aprovação e clique em Aprovar, ou em Devolver dizendo o que corrigir.",
      "Quem lançou vê o motivo em Minhas despesas, edita e envia de novo.",
      "Por centro de custo soma as despesas enviadas e aprovadas no período escolhido.",
    ],
  },
  {
    id: "atividades",
    secao: "Atividades",
    rota: "/sistema/atividades",
    alvo: "atividades-acoes",
    titulo: "Registrar o que você fez",
    texto: "Visitas, atendimentos, reuniões e capacitações ficam registrados com horário, município e público atendido.",
    passos: [
      "Clique em Registrar atividade e preencha o que foi feito, quando, onde e os resultados.",
      "No campo, use Registrar por voz e conte o que fez.",
      "A aba Histórico guarda sozinha tudo o que foi feito no sistema.",
    ],
  },
  {
    id: "atividades-historico",
    secao: "Atividades",
    rota: "/sistema/atividades",
    alvo: "atividades-abas",
    titulo: "Equipe e histórico",
    texto: "O coordenador vê, na aba Equipe, as atividades, as horas e o público atendido de cada pessoa. O Histórico mostra, com data e hora, tudo o que foi feito no sistema.",
    passos: ["Em Equipe, escolha o período e o funcionário para ver o detalhe.", "Em Histórico, filtre por módulo (agenda, frota, espaços, contas, atividades) para achar uma ação."],
  },
  {
    id: "indicadores",
    secao: "Indicadores",
    rota: "/sistema/indicadores",
    alvo: "indicadores-filtros",
    titulo: "Indicadores: os números de cada área em gráficos",
    texto: "Agenda, frota, espaços, contas e atividades num painel só, com os totais do período e um gráfico por assunto. Embaixo de cada gráfico, Ver tabela mostra os números.",
    passos: ["Escolha o período e, se quiser, uma tag.", "Gestores e o coordenador veem a equipe toda e podem escolher um funcionário; os demais veem os próprios números."],
  },
  {
    id: "relatorios",
    secao: "Relatórios",
    rota: "/sistema/relatorios",
    alvo: "relatorios-tipos",
    titulo: "Gerar um relatório",
    texto: "Frota, espaços, agenda, contas e atividades viram relatório em segundos.",
    passos: ["Escolha o tipo e o período (ou um dos atalhos).", "Confira a prévia com os totais.", "Use Imprimir / salvar PDF ou Baixar CSV para o Excel."],
  },
  {
    id: "relatorios-capa",
    secao: "Relatórios",
    rota: "/sistema/relatorios",
    alvo: "relatorios-documento",
    titulo: "Capa e contracapa",
    texto: "O PDF sai no padrão do boletim da FAPERON, com capa e créditos.",
    passos: ["Clique em Personalizar capa e contracapa para mudar título, campos da capa, créditos e nota.", "O modelo fica salvo para o tipo de relatório escolhido."],
  },
  {
    id: "zetele",
    secao: "Ajuda",
    rota: "/sistema",
    alvo: "zetele",
    titulo: "Ficou com dúvida?",
    texto: "O Zétele está em todas as telas do sistema. Pergunte como fazer qualquer tarefa; ele responde e indica onde clicar. Este tour pode ser refeito quando quiser pelo botão Tour guiado, na barra do sistema.",
  },
];
