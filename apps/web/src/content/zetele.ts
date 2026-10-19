import { CENTRAL } from "./central";
import { CONTATO } from "./contato";
import { CREDITO } from "./credito";
import { INFORMATIVOS } from "./informativos";

export const PAGINAS_COM_ZETELE = [
  "/",
  "/central-de-inteligencia",
  "/central-de-inteligencia/observatorio",
  "/painel",
  "/credito-rural",
  "/sistema",
  "/sistema/agenda",
  "/sistema/frotas",
  "/sistema/espacos",
  "/sistema/contas",
  "/sistema/relatorios",
  "/sistema/atividades",
  "/sistema/indicadores",
  "/sistema/usuarios",
] as const;
export type PaginaComZetele = (typeof PAGINAS_COM_ZETELE)[number];

/** Os dois Zétele (ADR 0032): o do site público e o da área do sistema, com base, limites e registro próprios. */
export type AreaZetele = "site" | "sistema";

export function areaDaPagina(pagina: string): AreaZetele {
  return pagina.startsWith("/sistema") ? "sistema" : "site";
}

export function ehPaginaComZetele(caminho: string | null): caminho is PaginaComZetele {
  return PAGINAS_COM_ZETELE.includes(caminho as PaginaComZetele);
}

export type Pose = "acenando" | "tablet" | "apontando";
/** Arte recortada de Gemini_Generated_Image_1wmk3o1wmk3o1wmk.jpeg (Task 11), em WebP sem fundo. */
export const POSES: Record<Pose, string> = {
  acenando: "/zetele/acenando.webp",
  tablet: "/zetele/tablet.webp",
  apontando: "/zetele/apontando.webp",
};

export interface PerguntaPronta {
  id: string;
  texto: string;
  tipo: "estatica" | "dados";
  /** "sistema": perguntas da área logada; não se misturam com as do site público. */
  area?: "site" | "sistema";
  resposta?: string;
  href?: string;
  rotuloLink?: string;
}

const [painel, observatorio] = CENTRAL.portas;

// Só a inicial: o subtítulo termina em "Rondônia", que não pode virar minúscula.
const minusculaInicial = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const PERGUNTAS: PerguntaPronta[] = [
  {
    id: "central",
    texto: "O que é a Central de Inteligência?",
    tipo: "estatica",
    resposta: CENTRAL.paragrafos[0],
    href: "/central-de-inteligencia",
    rotuloLink: "Abrir a Central de Inteligência",
  },
  {
    id: "painel-observatorio",
    texto: "Qual a diferença entre o Painel e o Observatório?",
    tipo: "estatica",
    resposta: `${painel!.titulo}: ${painel!.texto} ${observatorio!.titulo}: ${observatorio!.texto}`,
    href: "/central-de-inteligencia",
    rotuloLink: "Ver as duas portas na Central",
  },
  {
    id: "pdf",
    texto: "Como gero o relatório em PDF no Painel?",
    tipo: "estatica",
    resposta:
      'No Painel Agro Analítico, escolha o produto, o indicador e o período. Depois clique em "Gerar PDF", na barra do recorte, no alto da página. O relatório sai com os dados e a análise do recorte escolhido.',
    href: "/painel",
    rotuloLink: "Abrir o Painel Agro Analítico",
  },
  {
    id: "credito-pronaf",
    texto: "O que é o Pronaf?",
    tipo: "estatica",
    resposta: CREDITO.nota.pronaf,
    href: "/credito-rural",
    rotuloLink: "Abrir o painel de crédito rural",
  },
  {
    id: "credito-fonte",
    texto: "De onde vêm os dados do crédito rural?",
    tipo: "estatica",
    resposta:
      "Da Matriz de Dados do Crédito Rural (SICOR) do Banco Central do Brasil, publicada em dados abertos com a licença ODbL. O painel mostra os totais por município e por mês, sem operações individuais nem valores por produtor.",
    href: "/credito-rural",
    rotuloLink: "Ver a nota metodológica",
  },
  {
    id: "credito-ano",
    texto: "Por que o ano atual aparece incompleto?",
    tipo: "estatica",
    resposta: `${CREDITO.nota.defasagem} No painel, o aviso de ano incompleto diz até que mês há dados.`,
    href: "/credito-rural",
    rotuloLink: "Abrir o painel de crédito rural",
  },
  { id: "soja", texto: "Qual município mais produz soja em Rondônia?", tipo: "dados" },
  { id: "gado", texto: "Quantas cabeças de gado tem Rondônia hoje?", tipo: "dados" },
  { id: "cafe", texto: "Como a produção de café evoluiu nos últimos 10 anos?", tipo: "dados" },
  { id: "preco", texto: "Quanto vale a produção de soja e qual o preço médio?", tipo: "dados" },
  {
    id: "informativos",
    texto: "Onde encontro os Informativos Técnicos?",
    tipo: "estatica",
    resposta: `Na página ${INFORMATIVOS.titulo}: ${minusculaInicial(INFORMATIVOS.subtitulo)}, em PDF, nas categorias ${INFORMATIVOS.categorias.map((c) => c.titulo).join(" e ")}.`,
    href: "/informativos-tecnicos",
    rotuloLink: "Abrir os Informativos Técnicos",
  },
  {
    id: "contato",
    texto: "Como falo com a FAPERON?",
    tipo: "estatica",
    resposta: `Pelo telefone ${CONTATO.telefone.texto}, pelo WhatsApp ${CONTATO.whatsapp.texto} ou no endereço ${CONTATO.endereco.linhas.join(", ")}. A página Fale Conosco também tem um formulário.`,
    href: "/fale-conosco",
    rotuloLink: "Abrir o Fale Conosco",
  },
  {
    id: "sis-evento",
    area: "sistema",
    texto: "Como crio um evento na minha agenda?",
    tipo: "estatica",
    resposta: 'Na Agenda, clique em "Novo evento" (ou no "+" de um dia do mês), preencha título, data, horário e tipo, e salve. Só você vê os seus eventos; os da FAPERON aparecem para todos.',
    href: "/sistema/agenda",
    rotuloLink: "Abrir a Agenda",
  },
  {
    id: "sis-agenda-outros",
    area: "sistema",
    texto: "O que mais aparece na minha agenda?",
    tipo: "estatica",
    resposta: "Além dos seus eventos, aparecem os eventos institucionais da FAPERON, as suas viagens com veículo da frota e os espaços aprovados para você. Use a visão Lista para ver os próximos 30 dias.",
    href: "/sistema/agenda",
    rotuloLink: "Abrir a Agenda",
  },
  {
    id: "sis-reserva",
    area: "sistema",
    texto: "Como reservo um veículo?",
    tipo: "estatica",
    resposta: 'Em Frotas, aba Reservas, clique em "Nova reserva", escolha o veículo, a saída e o retorno, o destino e o motivo. Se o veículo já estiver reservado ou em manutenção no período, o sistema avisa. A reserva entra na sua agenda.',
    href: "/sistema/frotas?aba=reservas",
    rotuloLink: "Abrir as Reservas",
  },
  {
    id: "sis-km",
    area: "sistema",
    texto: "Como registro a saída e o retorno do veículo?",
    tipo: "estatica",
    resposta: 'Na sua reserva, use "Registrar saída" ao pegar o veículo e "Registrar retorno" ao devolver, informando o km. O km de retorno não pode ser menor que o de saída e atualiza o km do veículo.',
    href: "/sistema/frotas?aba=reservas",
    rotuloLink: "Abrir as Reservas",
  },
  {
    id: "sis-revisao",
    area: "sistema",
    texto: "Quando o veículo precisa de revisão?",
    tipo: "estatica",
    resposta: "A cada 10.000 km ou 12 meses desde a última revisão, o que vencer primeiro. A aba Veículos mostra a próxima revisão e avisa quando está próxima ou vencida. Manutenções são registradas pelo gestor da frota.",
    href: "/sistema/frotas?aba=veiculos",
    rotuloLink: "Abrir os Veículos",
  },
  {
    id: "sis-custos",
    area: "sistema",
    texto: "Onde vejo os custos da frota?",
    tipo: "estatica",
    resposta: "Na aba Custos: combustível e manutenção dos últimos 6 meses, km rodados nas viagens concluídas e custo por km, da frota toda ou de um veículo.",
    href: "/sistema/frotas?aba=custos",
    rotuloLink: "Abrir os Custos",
  },
  {
    id: "sis-espaco",
    area: "sistema",
    texto: "Como peço um espaço, como o auditório?",
    tipo: "estatica",
    resposta: 'Em Espaços, clique em "Novo pedido" e informe o espaço, o dia, o período (dia todo, manhã, tarde, noite ou horário específico), o tipo e o nome do evento, os participantes e se haverá coffee break. O pedido vai para a fila.',
    href: "/sistema/espacos",
    rotuloLink: "Abrir os Espaços",
  },
  {
    id: "sis-fila",
    area: "sistema",
    texto: "Como funciona a fila de pedidos de espaço?",
    tipo: "estatica",
    resposta: "Todo pedido entra como pendente, em ordem de chegada. O gestor dos espaços aprova, recusa com um motivo ou devolve para correção com uma observação do que mudar (por exemplo, quando há conflito de horário). Pedido devolvido aparece em Meus pedidos com o botão \"Corrigir e reenviar\"; corrigido, volta para a fila. O que for aprovado entra na sua agenda.",
    href: "/sistema/espacos?aba=fila",
    rotuloLink: "Abrir a Fila",
  },
  {
    id: "sis-conflito",
    area: "sistema",
    texto: "O que acontece se houver conflito de horário?",
    tipo: "estatica",
    resposta: "Antes de enviar, o pedido mostra os choques com pedidos aprovados ou pendentes do mesmo espaço e horário, e avisa se passar da capacidade. Ele pode ir para a fila assim mesmo, marcado; o gestor não consegue aprovar algo que choque com um pedido já aprovado.",
    href: "/sistema/espacos?aba=painel",
    rotuloLink: "Abrir o Painel de 7 dias",
  },
  {
    id: "sis-voz",
    area: "sistema",
    texto: "Como agendo por voz?",
    tipo: "estatica",
    resposta: 'Na Agenda, em Frotas (aba Reservas) ou em Espaços, clique em "Agendar por voz", depois em "Falar", e diga o que quer, como "reunião com o sindicato terça às nove". O formulário abre preenchido para você conferir e salvar. Funciona no Chrome e no Edge; nos outros navegadores, digite a frase.',
    href: "/sistema/agenda",
    rotuloLink: "Abrir a Agenda",
  },
  {
    id: "sis-despesa",
    area: "sistema",
    texto: "Como lanço uma despesa na prestação de contas?",
    tipo: "estatica",
    resposta: 'Em Contas, clique em "Nova despesa" e informe data, valor, centro de custo, categoria, descrição, fornecedor e o comprovante (imagem ou PDF). Salve como rascunho ou envie para aprovação. Despesa devolvida pelo gestor mostra o motivo e pode ser corrigida e reenviada.',
    href: "/sistema/contas",
    rotuloLink: "Abrir as Contas",
  },
  {
    id: "sis-aprovacao-contas",
    area: "sistema",
    texto: "Quem aprova as despesas?",
    tipo: "estatica",
    resposta: "O gestor das contas, na aba Aprovação: ele aprova ou devolve cada despesa enviada, com o motivo da devolução. A aba Por centro de custo soma as despesas enviadas e aprovadas no período, por centro e categoria.",
    href: "/sistema/contas?aba=centros",
    rotuloLink: "Ver por centro de custo",
  },
  {
    id: "sis-relatorio",
    area: "sistema",
    texto: "Como gero um relatório?",
    tipo: "estatica",
    resposta: 'Em Relatórios, escolha o tipo (Frota, Espaços, Agenda ou Prestação de contas) e o período. A prévia mostra a tabela com os totais; "Imprimir / salvar PDF" imprime só o relatório e "Baixar CSV" gera a planilha para o Excel.',
    href: "/sistema/relatorios",
    rotuloLink: "Abrir os Relatórios",
  },
  {
    id: "sis-indicadores",
    area: "sistema",
    texto: "O que mostram os Indicadores?",
    tipo: "estatica",
    resposta: 'Os números de cada área em gráficos: agenda, frota, espaços, contas e atividades, no período escolhido (este mês ou os últimos 3, 6 ou 12 meses) e, se quiser, só com uma tag. Gestores e o coordenador veem a equipe toda e podem escolher um funcionário; os demais veem os próprios números e o uso geral da frota e dos espaços. Cada gráfico tem a tabela em "Ver tabela".',
    href: "/sistema/indicadores",
    rotuloLink: "Abrir os Indicadores",
  },
  {
    id: "sis-atividade",
    area: "sistema",
    texto: "Como registro uma atividade que fiz?",
    tipo: "estatica",
    resposta: 'Em Atividades, clique em "Registrar atividade" e informe o que fez, a data, o horário, o tipo (visita técnica, atendimento, reunião, capacitação...), o município, o público atendido e os resultados. Também dá para usar "Registrar por voz" e contar o que fez.',
    href: "/sistema/atividades",
    rotuloLink: "Abrir as Atividades",
  },
  {
    id: "sis-historico",
    area: "sistema",
    texto: "O que é o histórico?",
    tipo: "estatica",
    resposta: "É o registro automático do que foi feito no sistema: entradas, eventos, reservas, pedidos de espaço, despesas e atividades, com data, hora e quem fez. Você vê o seu; o coordenador vê o de toda a equipe, além do resumo de atividades por funcionário.",
    href: "/sistema/atividades?aba=historico",
    rotuloLink: "Abrir o Histórico",
  },
  // o Zétele interno também responde números do agro, pelas ferramentas (pedido de 18/10/2026)
  { id: "sis-cafe", area: "sistema", texto: "Qual município mais produz café em Rondônia?", tipo: "dados" },
  {
    id: "sis-usuarios",
    area: "sistema",
    texto: "Como cadastro uma pessoa da equipe?",
    tipo: "estatica",
    resposta: "Quem é administrador abre Usuários, na barra do sistema, e clica em Novo usuário. O sistema gera uma senha temporária, que aparece uma única vez; a pessoa troca a senha no primeiro acesso. Quem esqueceu a senha também recebe uma temporária do administrador.",
    href: "/sistema/usuarios",
    rotuloLink: "Abrir Usuários",
  },
];

/**
 * No Início o Zétele só orienta (sem dados); perguntas de dados e preços ficam na Central.
 * No sistema ele explica o uso e também responde números do agro (pedido de 18/10/2026).
 */
export const PAGINAS_SO_ORIENTACAO: readonly PaginaComZetele[] = ["/"];

export const ORDEM_POR_PAGINA: Record<PaginaComZetele, string[]> = {
  "/": ["central", "painel-observatorio", "informativos", "contato"],
  "/central-de-inteligencia": ["painel-observatorio", "soja", "preco", "pdf"],
  "/painel": ["pdf", "soja", "preco", "gado"],
  "/central-de-inteligencia/observatorio": ["painel-observatorio", "cafe", "preco", "soja"],
  "/credito-rural": ["credito-pronaf", "credito-fonte", "credito-ano", "painel-observatorio"],
  "/sistema": ["sis-evento", "sis-atividade", "sis-voz", "sis-relatorio"],
  "/sistema/agenda": ["sis-evento", "sis-voz", "sis-agenda-outros", "sis-reserva"],
  "/sistema/frotas": ["sis-reserva", "sis-voz", "sis-km", "sis-custos"],
  "/sistema/espacos": ["sis-espaco", "sis-voz", "sis-fila", "sis-conflito"],
  "/sistema/contas": ["sis-despesa", "sis-aprovacao-contas", "sis-relatorio", "sis-evento"],
  "/sistema/relatorios": ["sis-relatorio", "sis-custos", "sis-despesa", "sis-voz"],
  "/sistema/atividades": ["sis-atividade", "sis-historico", "sis-voz", "sis-relatorio"],
  "/sistema/indicadores": ["sis-indicadores", "sis-relatorio", "sis-custos", "sis-atividade"],
  "/sistema/usuarios": ["sis-usuarios", "sis-historico", "sis-evento", "sis-relatorio"],
};

export function perguntasDaPagina(pagina: PaginaComZetele): { visiveis: PerguntaPronta[]; demais: PerguntaPronta[] } {
  const ids = ORDEM_POR_PAGINA[pagina];
  const porId = new Map(PERGUNTAS.map((p) => [p.id, p]));
  const area = areaDaPagina(pagina);
  return {
    visiveis: ids.map((id) => porId.get(id)).filter((p): p is PerguntaPronta => Boolean(p)),
    demais: PERGUNTAS.filter((p) => !ids.includes(p.id) && (p.area ?? "site") === area),
  };
}

export const ZETELE = {
  nome: "Zétele",
  rotuloBotao: "Falar com o Zétele, assistente do site",
  saudacao: "Oi! Posso ajudar?",
  rotuloFecharSaudacao: "Fechar saudação",
  rotuloCampo: "Sua pergunta",
  enviar: "Enviar pergunta",
  fechar: "Fechar o Zétele",
  rotuloSugestoes: "Perguntas sugeridas",
  rotuloConversa: "Conversa com o Zétele",
  sugestoes: "Sugestões",
  maisSugestoes: "Mais sugestões",
  ocultarSugestoes: "Ocultar sugestões",
  consultando: "Zétele está consultando os dados…",
  indisponivel: "Hoje só respondo às perguntas prontas.",
  falha: "Não consegui responder agora.",
  tentarDeNovo: "Tentar de novo",
  espera: (segundos: number) => `Muitas perguntas de uma vez; espere ${segundos} segundos.`,
  fonte: "Fonte",
  abrirConsulta: "Ver no site",
  avisoPrivacidade: "Não digite dados pessoais. As perguntas ficam guardadas por 90 dias, sem identificação.",
  politica: "Política de Privacidade",
  tamanhoMaximo: 500,
} as const;

/** O que muda entre o Zétele do site e o do sistema. */
export const TEXTOS_DA_AREA: Record<AreaZetele, { boasVindas: string; placeholder: string; descansando: string }> = {
  site: {
    boasVindas:
      "Oi, eu sou o Zétele! Tiro dúvidas sobre o site da FAPERON: onde achar cada coisa, como usar o Painel e o Observatório e os números do IBGE que o site mostra.",
    placeholder: "Escreva sua pergunta sobre o site",
    descansando: "O Zétele está descansando. Tente de novo em instantes ou abra o Painel.",
  },
  sistema: {
    boasVindas:
      "Oi, eu sou o Zétele do sistema! Explico como usar a agenda, a frota, os espaços, as contas, as atividades e os relatórios, e como agendar ou registrar por voz.",
    placeholder: "Escreva sua dúvida sobre o sistema",
    descansando: "O Zétele está descansando. Tente de novo em instantes.",
  },
};

/** Voz do Zétele do sistema (ADR 0034): microfone, "Ouvir" e "Responder em voz". */
export const ZETELE_VOZ = {
  gravar: "Gravar pergunta",
  pararGravacao: "Parar gravação",
  gravando: "Gravando… Toque de novo para parar ou aperte Esc para cancelar.",
  transcrevendo: "Transcrevendo…",
  confira: "Confira o texto e envie a pergunta.",
  ouvir: "Ouvir",
  ouvirRotulo: "Ouvir resposta",
  parar: "Parar",
  pararRotulo: "Parar áudio",
  responderEmVoz: "Responder em voz",
  avisoPrototipo: "Protótipo: o áudio é processado pela Groq e pelo Google (plano gratuito).",
  limiteSegundos: 60,
  erros: {
    bloqueado: "O microfone está bloqueado. Libere o acesso no navegador para gravar.",
    semMicrofone: "Não encontrei um microfone neste aparelho.",
    microfone: "Não consegui usar o microfone. Digite a pergunta.",
    naoEntendi: "Não entendi o áudio. Tente de novo ou digite a pergunta.",
    recusado: "Não consegui enviar o áudio. Tente uma gravação mais curta.",
    indisponivel: "A voz está indisponível agora. Digite a pergunta ou tente mais tarde.",
    limiteDoDia: "O Zétele atingiu o limite de hoje.",
    tocar: "Não consegui tocar o áudio. Toque em Ouvir para tentar de novo.",
  },
} as const;
