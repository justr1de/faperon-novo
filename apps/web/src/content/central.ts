export type NomeIcone = "trophy" | "chart" | "compare" | "insight" | "pdf" | "shield" | "credito";

export const CENTRAL = {
  titulo: "Central de Inteligência",
  subtitulo: "Os números do agro de Rondônia, explicados e para consultar",
  paragrafos: [
    "A Central de Inteligência Agropecuária reúne, em um só lugar, os dados oficiais do IBGE sobre as lavouras e a pecuária dos 52 municípios de Rondônia. Escolha um produto e um indicador, defina o período e veja o ranking dos municípios, a evolução ao longo dos anos e uma análise estratégica pronta para apoiar decisões de produtores, sindicatos, gestores públicos e empresas.",
    "Os números da produção vêm da Pesquisa Agrícola Municipal (PAM) e da Pesquisa da Pecuária Municipal (PPM) do IBGE; os do crédito rural, da Matriz de Dados do Crédito Rural (SICOR) do Banco Central. A fonte e a data de atualização aparecem em cada tela.",
  ],
  portas: [
    {
      titulo: "Painel Agro Analítico",
      texto: "Consulta objetiva por produto, indicador, município e período, com ranking, série, comparação, análise e relatório em PDF.",
      rotulo: "Abrir o Painel Agro Analítico",
      href: "/painel",
      icone: "chart",
    },
    {
      titulo: "Observatório Agropecuário",
      texto: "Leitura explicada do agro de Rondônia: o tamanho e a composição da produção, por que ela cresce, onde acontece e como vai a pecuária. Valores corrigidos pela inflação.",
      rotulo: "Abrir o Observatório",
      href: "/central-de-inteligencia/observatorio",
      icone: "insight",
    },
    {
      titulo: "Crédito rural e Pronaf",
      texto: "Quanto crédito rural cada município contratou, mês a mês desde 2018: o total, a parte do Pronaf da agricultura familiar, as finalidades e os produtos financiados. Dados abertos do Banco Central.",
      rotulo: "Abrir o painel de crédito rural",
      href: "/credito-rural",
      icone: "credito",
    },
  ] satisfies { titulo: string; texto: string; rotulo: string; href: string; icone: NomeIcone }[],
  cta_texto: "Abrir o Painel Agro Analítico",
  cta_url: "/painel",
  seo: {
    titulo: "Central de Inteligência",
    descricao:
      "Observatório e Painel com dados oficiais do IBGE sobre agricultura e pecuária dos municípios de Rondônia: leitura explicada, ranking, série histórica, comparação e análise.",
  },
};
