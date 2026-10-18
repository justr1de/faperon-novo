export const CREDITO = {
  titulo: "Crédito rural e Pronaf",
  intro:
    "Quanto crédito rural os produtores de Rondônia contrataram, mês a mês, em cada município: o total, o Pronaf da agricultura familiar, o Pronamp e os demais programas, por finalidade e por produto. Dados abertos do Banco Central. Os filtros ficam no link, que reproduz a mesma visão.",
  secoes: [
    { id: "numeros", titulo: "Números" },
    { id: "evolucao", titulo: "Evolução" },
    { id: "municipios", titulo: "Municípios" },
    { id: "produtos", titulo: "Produtos" },
    { id: "metodologia", titulo: "Metodologia" },
  ],
  nota: {
    pronaf:
      "O Pronaf (Programa Nacional de Fortalecimento da Agricultura Familiar) é a linha de crédito rural da agricultura familiar, com juros menores e limites por produtor. O Pronamp atende o médio produtor. \"Demais\" reúne os outros programas (Inovagro, Moderfrota, RenovAgro e outros) e o crédito sem programa específico.",
    finalidades:
      "Custeio financia as despesas da safra ou do rebanho; investimento, bens e melhorias que duram vários anos (máquinas, pastagem, currais, armazéns); comercialização e industrialização, a venda e o beneficiamento da produção.",
    defasagem:
      "O Banco Central atualiza a matriz uma vez por mês, com cerca de um mês de defasagem: o ano corrente aparece incompleto e a variação compara os mesmos meses do ano anterior. Os valores estão em reais da época, sem correção pela inflação.",
    limites:
      "O painel mostra totais por município e mês, sem operações individuais nem valores por produtor. Município sem contrato num mês já publicado aparece com zero; mês ainda não publicado aparece sem dado. O detalhe por produto existe só para custeio e investimento, e o Banco Central não publica o número de contratos por produto.",
  },
  seo: {
    titulo: "Crédito rural e Pronaf em Rondônia",
    descricao:
      "Crédito rural contratado nos 52 municípios de Rondônia, mês a mês desde 2018: total, Pronaf, Pronamp, finalidades e produtos, com dados abertos do Banco Central (SICOR).",
  },
};
