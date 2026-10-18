// Servidor mock da API FAPERON (docs/api-contract.md). Dados FICTÍCIOS, formato exato do contrato.
// Uso: npm run mock  (porta 8000, ou MOCK_PORT)
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8000);

const MUNICIPIOS = [
  ["1100015", "Alta Floresta D'Oeste"], ["1100023", "Ariquemes"], ["1100031", "Cabixi"], ["1100049", "Cacoal"],
  ["1100056", "Cerejeiras"], ["1100064", "Colorado do Oeste"], ["1100072", "Corumbiara"], ["1100080", "Costa Marques"],
  ["1100098", "Espigão D'Oeste"], ["1100106", "Guajará-Mirim"], ["1100114", "Jaru"], ["1100122", "Ji-Paraná"],
  ["1100130", "Machadinho D'Oeste"], ["1100148", "Nova Brasilândia D'Oeste"], ["1100155", "Ouro Preto do Oeste"],
  ["1100189", "Pimenta Bueno"], ["1100205", "Porto Velho"], ["1100254", "Presidente Médici"], ["1100262", "Rio Crespo"],
  ["1100288", "Rolim de Moura"], ["1100296", "Santa Luzia D'Oeste"], ["1100304", "Vilhena"],
  ["1100320", "São Miguel do Guaporé"], ["1100338", "Nova Mamoré"], ["1100346", "Alvorada D'Oeste"],
  ["1100379", "Alto Alegre dos Parecis"], ["1100403", "Alto Paraíso"], ["1100452", "Buritis"],
  ["1100502", "Novo Horizonte do Oeste"], ["1100601", "Cacaulândia"], ["1100700", "Campo Novo de Rondônia"],
  ["1100809", "Candeias do Jamari"], ["1100908", "Castanheiras"], ["1100924", "Chupinguaia"], ["1100940", "Cujubim"],
  ["1101005", "Governador Jorge Teixeira"], ["1101104", "Itapuã do Oeste"], ["1101203", "Ministro Andreazza"],
  ["1101302", "Mirante da Serra"], ["1101401", "Monte Negro"], ["1101435", "Nova União"], ["1101450", "Parecis"],
  ["1101468", "Pimenteiras do Oeste"], ["1101476", "Primavera de Rondônia"], ["1101484", "São Felipe D'Oeste"],
  ["1101492", "São Francisco do Guaporé"], ["1101500", "Seringueiras"], ["1101559", "Teixeirópolis"],
  ["1101609", "Theobroma"], ["1101708", "Urupá"], ["1101757", "Vale do Anari"], ["1101807", "Vale do Paraíso"],
].map(([codigo_ibge, nome]) => ({ codigo_ibge, nome }));

if (MUNICIPIOS.length !== 52) throw new Error(`mock precisa de 52 municípios, tem ${MUNICIPIOS.length}`);

const ANO_MIN = 2000;
const ANO_MAX = 2024;
const ATUALIZADO_EM = "2026-09-24T14:00:00Z";

// Zétele: o mock não lê o corpo do POST; toda pergunta recebe a resposta de soja.
const ZETELE_RESPOSTA = {
  status: "respondida",
  texto: "Em 2024, o município que mais produziu soja foi Ariquemes (dados fictícios do mock).",
  fontes: [{
    rotulo: "IBGE – Pesquisa Agrícola Municipal (PAM), tabela 5457, ano 2024",
    url_fonte: "https://sidra.ibge.gov.br/Tabela/5457",
    url_interna: "/painel?segmento=agricultura&produto=soja-em-grao&indicador=quantidade-produzida&fim=2024",
    atualizado_em: ATUALIZADO_EM,
  }],
  sugestoes: ["Como foi a evolução da soja nos últimos 10 anos?"],
};

const IND = {
  "area-plantada": { slug: "area-plantada", nome: "Área plantada", unidade: "Hectares", agregacao: "soma" },
  "area-colhida": { slug: "area-colhida", nome: "Área colhida", unidade: "Hectares", agregacao: "soma" },
  "quantidade-produzida": { slug: "quantidade-produzida", nome: "Quantidade produzida", unidade: "Toneladas", agregacao: "soma" },
  "rendimento-medio": { slug: "rendimento-medio", nome: "Rendimento médio", unidade: "Quilogramas por Hectare", agregacao: "media_ponderada" },
  "valor-da-producao": { slug: "valor-da-producao", nome: "Valor da produção", unidade: "Mil Reais", agregacao: "soma" },
  efetivo: { slug: "efetivo", nome: "Efetivo dos rebanhos", unidade: "Cabeças", agregacao: "soma" },
  "producao-de-origem-animal": { slug: "producao-de-origem-animal", nome: "Produção de origem animal", unidade: "Mil litros", agregacao: "soma" },
};

const AGRI = ["area-plantada", "area-colhida", "quantidade-produzida", "rendimento-medio", "valor-da-producao"];

const PRODUTOS = [
  { slug: "soja-em-grao", nome: "Soja (em grão)", segmento: "agricultura", tabela_sidra: 5457, escala: 60000, preco: 2.4, inds: AGRI },
  { slug: "milho-em-grao", nome: "Milho (em grão)", segmento: "agricultura", tabela_sidra: 5457, escala: 30000, preco: 1.1, inds: AGRI },
  { slug: "cafe-em-grao-canephora", nome: "Café (em grão) Canephora", segmento: "agricultura", tabela_sidra: 5457, escala: 8000, preco: 12, inds: AGRI },
  { slug: "cafe-em-grao-total", nome: "Café (em grão) Total", segmento: "agricultura", tabela_sidra: 5457, escala: 9000, preco: 12, inds: AGRI },
  { slug: "cacau-em-amendoa", nome: "Cacau (em amêndoa)", segmento: "agricultura", tabela_sidra: 5457, escala: 1500, preco: 20, inds: AGRI },
  { slug: "bovino", nome: "Bovino", segmento: "pecuaria", tabela_sidra: 3939, escala: 220000, preco: 0, inds: ["efetivo"] },
  { slug: "leite", nome: "Leite", segmento: "pecuaria", tabela_sidra: 74, escala: 12000, preco: 1.9, inds: ["producao-de-origem-animal", "valor-da-producao"] },
];

const TABELAS = {
  5457: { fonte: "IBGE – Pesquisa Agrícola Municipal (PAM)", url_fonte: "https://sidra.ibge.gov.br/Tabela/5457" },
  3939: { fonte: "IBGE – Pesquisa da Pecuária Municipal (PPM)", url_fonte: "https://sidra.ibge.gov.br/Tabela/3939" },
  74: { fonte: "IBGE – Pesquisa da Pecuária Municipal (PPM)", url_fonte: "https://sidra.ibge.gov.br/tabela/74" },
};

// ---------- geração determinística ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function statusDe(produto, mi, ano) {
  const r = hash(`s|${produto.slug}|${mi}|${ano}`);
  if (mi % 13 === 5 && ano === ANO_MAX) return "sigiloso";
  if (produto.slug === "cacau-em-amendoa" && mi % 4 === 0) return "inexistente";
  if (r < 0.03) return "inexistente";
  return "ok";
}

function base(produto, mi, ano) {
  const peso = 0.15 + hash(`p|${produto.slug}|${mi}`) * 1.85;
  const crescimento = 0.6 + ((ano - ANO_MIN) / (ANO_MAX - ANO_MIN)) * 0.9;
  const ruido = 0.85 + hash(`r|${produto.slug}|${mi}|${ano}`) * 0.3;
  const colhida = Math.round((produto.escala / 6) * peso * crescimento * ruido);
  const rend = 1800 + hash(`y|${produto.slug}|${mi}`) * 2200 * (0.8 + (ano - ANO_MIN) / 60);
  return { colhida, qtd: Math.round((colhida * rend) / 1000), plantada: Math.round(colhida * 1.03), rend };
}

function celula(produto, indSlug, mi, ano) {
  const status = statusDe(produto, mi, ano);
  if (status !== "ok") return { valor: null, status, partes: null };
  const b = base(produto, mi, ano);
  switch (indSlug) {
    case "area-plantada": return { valor: b.plantada, status, partes: null };
    case "area-colhida": return { valor: b.colhida, status, partes: null };
    case "quantidade-produzida": return { valor: b.qtd, status, partes: null };
    case "rendimento-medio":
      return { valor: b.colhida ? Math.round((b.qtd * 1000) / b.colhida) : null, status, partes: { qtd: b.qtd, area: b.colhida } };
    case "valor-da-producao": return { valor: Math.round(b.qtd * produto.preco * 1000), status, partes: null };
    case "efetivo": return { valor: Math.round((produto.escala / 6) * (0.15 + hash(`p|${produto.slug}|${mi}`) * 1.85) * (0.7 + (ano - ANO_MIN) / 50) * (0.9 + hash(`r|${ano}|${mi}`) * 0.2)), status, partes: null };
    case "producao-de-origem-animal":
      return { valor: Math.round((produto.escala / 6) * (0.15 + hash(`p|${produto.slug}|${mi}`) * 1.85) * (0.6 + (ano - ANO_MIN) / 40) * (0.9 + hash(`r|${ano}|${mi}`) * 0.2)), status, partes: null };
    default: return { valor: null, status: "inexistente", partes: null };
  }
}

function indicadorDo(produto, slug) {
  const ind = { ...IND[slug] };
  // Unidade divergente de propósito: exercita o 422 da comparação entre produtos.
  if (produto.slug === "cacau-em-amendoa" && slug === "quantidade-produzida") ind.unidade = "Quilogramas";
  return ind;
}

function totalEstadual(produto, indSlug, ano) {
  let soma = 0, qtd = 0, area = 0, algum = false;
  for (let mi = 0; mi < MUNICIPIOS.length; mi++) {
    const c = celula(produto, indSlug, mi, ano);
    if (c.valor === null) continue;
    algum = true;
    soma += c.valor;
    if (c.partes) { qtd += c.partes.qtd; area += c.partes.area; }
  }
  if (!algum) return null;
  if (IND[indSlug].agregacao === "media_ponderada") return area ? Math.round((qtd * 1000) / area) : null;
  return soma;
}

// ---------- parâmetros ----------
class HttpError extends Error {
  constructor(status, erro, campos) { super(erro); this.status = status; this.body = campos ? { erro, campos } : { erro }; }
}

function produtoDe(slug) {
  if (!slug) throw new HttpError(400, "Parâmetro obrigatório ausente", { produto: "obrigatório" });
  const p = PRODUTOS.find((x) => x.slug === slug);
  if (!p) throw new HttpError(404, `Produto '${slug}' não encontrado`);
  return p;
}

function indicadorDeProduto(produto, slug) {
  if (!slug) throw new HttpError(400, "Parâmetro obrigatório ausente", { indicador: "obrigatório" });
  if (!produto.inds.includes(slug)) throw new HttpError(404, `Indicador '${slug}' não existe para ${produto.nome}`);
  return indicadorDo(produto, slug);
}

function periodo(sp) {
  const fim = sp.get("fim") ? Number(sp.get("fim")) : ANO_MAX;
  const inicio = sp.get("inicio") ? Number(sp.get("inicio")) : fim - 9;
  if (!Number.isInteger(fim) || !Number.isInteger(inicio)) throw new HttpError(400, "Período inválido", { inicio: "inteiro", fim: "inteiro" });
  if (inicio > fim) throw new HttpError(400, "Ano inicial maior que o final", { inicio: "deve ser ≤ fim" });
  if (inicio < ANO_MIN || fim > ANO_MAX) throw new HttpError(400, `Período fora de ${ANO_MIN}–${ANO_MAX}`, { fim: "fora do intervalo" });
  return { inicio, fim };
}

const meta = (produto) => ({ ...TABELAS[produto.tabela_sidra], tabela_sidra: produto.tabela_sidra, atualizado_em: ATUALIZADO_EM });
const resumo = (p) => ({ slug: p.slug, nome: p.nome, segmento: p.segmento });
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function pontosSerie(produto, indSlug, inicio, fim, mi) {
  const pontos = [];
  for (let ano = inicio; ano <= fim; ano++) {
    if (mi === null) {
      const v = totalEstadual(produto, indSlug, ano);
      pontos.push({ ano, valor: v, status: v === null ? "inexistente" : "ok" });
    } else {
      const c = celula(produto, indSlug, mi, ano);
      pontos.push({ ano, valor: c.valor, status: c.status });
    }
  }
  return pontos;
}

function municipioIdx(codigo) {
  const mi = MUNICIPIOS.findIndex((m) => m.codigo_ibge === codigo);
  if (mi < 0) throw new HttpError(404, `Município '${codigo}' não encontrado`);
  return mi;
}

// ---------- rotas ----------
function ranking(sp) {
  const produto = produtoDe(sp.get("produto"));
  const ind = indicadorDeProduto(produto, sp.get("indicador"));
  const { inicio, fim } = periodo(sp);
  const total = totalEstadual(produto, ind.slug, fim);
  const linhas = MUNICIPIOS.map((m, mi) => ({ m, c: celula(produto, ind.slug, mi, fim) }));
  const ok = linhas.filter((l) => l.c.status === "ok" && l.c.valor !== null).sort((a, b) => b.c.valor - a.c.valor);
  const sig = linhas.filter((l) => l.c.status === "sigiloso");
  const ine = linhas.filter((l) => l.c.status === "inexistente" || (l.c.status === "ok" && l.c.valor === null));
  const itens = [
    ...ok.map((l, i) => ({
      posicao: i + 1, municipio: l.m, valor: l.c.valor, status: "ok",
      percentual_total: ind.agregacao === "soma" && total ? Math.round((l.c.valor / total) * 10000) / 100 : null,
    })),
    ...sig.map((l) => ({ posicao: null, municipio: l.m, valor: null, status: "sigiloso", percentual_total: null })),
    ...ine.map((l) => ({ posicao: null, municipio: l.m, valor: null, status: "inexistente", percentual_total: null })),
  ];
  return { produto: resumo(produto), indicador: ind, inicio, fim, ano_referencia: fim, total_estadual: ind.agregacao === "nao_agregavel" ? null : total, itens, meta: meta(produto) };
}

function serie(sp) {
  const produto = produtoDe(sp.get("produto"));
  const ind = indicadorDeProduto(produto, sp.get("indicador"));
  const { inicio, fim } = periodo(sp);
  const cod = sp.get("municipio");
  const mi = cod ? municipioIdx(cod) : null;
  return { produto: resumo(produto), indicador: ind, municipio: mi === null ? null : MUNICIPIOS[mi], inicio, fim, pontos: pontosSerie(produto, ind.slug, inicio, fim, mi), meta: meta(produto) };
}

function comparacao(sp) {
  const { inicio, fim } = periodo(sp);
  const indSlug = sp.get("indicador");
  const lista = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const anos = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
  if (sp.get("produtos")) {
    const slugs = lista(sp.get("produtos"));
    if (slugs.length < 2 || slugs.length > 5) throw new HttpError(400, "Informe de 2 a 5 produtos", { produtos: "2 a 5" });
    const prods = slugs.map(produtoDe);
    const inds = prods.map((p) => indicadorDeProduto(p, indSlug));
    const unidades = new Set(inds.map((i) => i.unidade));
    if (unidades.size > 1) throw new HttpError(422, `Unidades diferentes não podem ser comparadas: ${[...unidades].join(" × ")}`, { produtos: "unidades diferentes" });
    const cod = sp.get("municipio");
    const mi = cod ? municipioIdx(cod) : null;
    return {
      modo: "produtos", indicador: inds[0], unidade: inds[0].unidade, inicio, fim, anos,
      series: prods.map((p) => ({ id: p.slug, nome: p.nome, pontos: pontosSerie(p, indSlug, inicio, fim, mi) })),
      meta: meta(prods[0]),
    };
  }
  const produto = produtoDe(sp.get("produto"));
  const ind = indicadorDeProduto(produto, indSlug);
  const cods = lista(sp.get("municipios"));
  if (cods.length < 2 || cods.length > 5) throw new HttpError(400, "Informe de 2 a 5 municípios", { municipios: "2 a 5" });
  return {
    modo: "municipios", indicador: ind, unidade: ind.unidade, inicio, fim, anos,
    series: cods.map((c) => { const mi = municipioIdx(c); return { id: c, nome: MUNICIPIOS[mi].nome, pontos: pontosSerie(produto, ind.slug, inicio, fim, mi) }; }),
    meta: meta(produto),
  };
}

const br = (n, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function analise(sp) {
  const s = serie(sp);
  const r = ranking(sp);
  const validos = s.pontos.filter((p) => p.valor !== null);
  const primeiro = validos[0];
  const ultimo = validos[validos.length - 1];
  const nome = s.indicador.nome.toLowerCase();
  const paragrafos = [];
  const m = {
    variacao_absoluta: null, variacao_percentual: null, cagr_percentual: null, maior_ano: null, menor_ano: null,
    top5: [], concentracao_top5_percentual: null,
  };
  if (primeiro && ultimo && primeiro.ano !== ultimo.ano) {
    m.variacao_absoluta = ultimo.valor - primeiro.valor;
    if (primeiro.valor > 0) {
      m.variacao_percentual = Math.round(((ultimo.valor / primeiro.valor - 1) * 100) * 10) / 10;
      m.cagr_percentual = Math.round((Math.pow(ultimo.valor / primeiro.valor, 1 / (ultimo.ano - primeiro.ano)) - 1) * 1000) / 10;
      paragrafos.push(`A ${nome} de ${s.produto.nome} em Rondônia passou de ${br(primeiro.valor)} em ${primeiro.ano} para ${br(ultimo.valor)} em ${ultimo.ano} (${m.variacao_percentual >= 0 ? "+" : ""}${br(m.variacao_percentual, 1)}%), crescimento médio anual de ${br(m.cagr_percentual, 1)}%.`);
    }
  }
  if (validos.length) {
    const max = validos.reduce((a, b) => (b.valor > a.valor ? b : a));
    const min = validos.reduce((a, b) => (b.valor < a.valor ? b : a));
    m.maior_ano = { ano: max.ano, valor: max.valor };
    m.menor_ano = { ano: min.ano, valor: min.valor };
    paragrafos.push(`O maior valor do período foi em ${max.ano} (${br(max.valor)}) e o menor em ${min.ano} (${br(min.valor)}).`);
  }
  m.top5 = r.itens.filter((i) => i.status === "ok").slice(0, 5).map((i) => ({ municipio: i.municipio, valor: i.valor, percentual: i.percentual_total }));
  if (r.indicador.agregacao === "soma" && m.top5.length) {
    m.concentracao_top5_percentual = Math.round(m.top5.reduce((a, i) => a + (i.percentual ?? 0), 0) * 10) / 10;
    paragrafos.push(`Em ${r.fim}, os cinco maiores municípios (${m.top5.map((i) => i.municipio.nome).join(", ")}) concentraram ${br(m.concentracao_top5_percentual, 1)}% do total estadual.`);
  }
  return { titulo: `${s.produto.nome} — ${s.indicador.nome}, ${s.inicio}–${s.fim}`, paragrafos, metricas: m, meta: s.meta };
}

function pdfMinimo(titulo) {
  const texto = titulo.replace(/[()\\]/g, "").normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (FAPERON - relatorio mock) Tj 0 -28 Td /F1 12 Tf (${texto}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

const DESTAQUES = [
  ["soja", "Soja", "soja-em-grao", "quantidade-produzida"],
  ["milho", "Milho", "milho-em-grao", "quantidade-produzida"],
  ["cafe", "Café canéfora", "cafe-em-grao-canephora", "quantidade-produzida"],
  ["cacau", "Cacau", "cacau-em-amendoa", "quantidade-produzida"],
  ["bovino", "Rebanho bovino", "bovino", "efetivo"],
  ["leite", "Leite", "leite", "producao-de-origem-animal"],
];

function destaques() {
  const itens = DESTAQUES.map(([chave, rotulo, produtoSlug, indSlug]) => {
    const params = new URLSearchParams({ produto: produtoSlug, indicador: indSlug });
    const r = ranking(params);
    const pontos = pontosSerie(produtoDe(produtoSlug), indSlug, ANO_MAX - 9, ANO_MAX, null);
    const validos = pontos.filter((p) => p.valor !== null);
    const variacao = validos.length > 1 && validos[0].valor ? Math.round(((validos.at(-1).valor - validos[0].valor) / validos[0].valor) * 10000) / 100 : null;
    return {
      chave, rotulo, produto: r.produto, indicador: r.indicador, ano_referencia: ANO_MAX, total: r.total_estadual, serie: pontos, variacao_percentual: variacao,
      top: r.itens.filter((i) => i.status === "ok").slice(0, 5).map((i) => ({ municipio: i.municipio, valor: i.valor, percentual_total: i.percentual_total })),
      meta: r.meta,
    };
  });
  return { itens, meta: { atualizado_em: ATUALIZADO_EM } };
}

// ---- Observatório (/api/v1/observatorio/*): formato exato do contrato, dados fictícios ----
// Espelha apps/api/observatorio/servico.py: validação (400), inexistentes (404), padrões e avisos reais.
const META_OBS = {
  fontes: [{ fonte: "IBGE – Pesquisa Agrícola Municipal (PAM)", tabela_sidra: 5457, url_fonte: "https://sidra.ibge.gov.br/Tabela/5457" }],
  atualizado_em: "2026-10-01T12:00:00Z",
};
const COMO_LER = ["Explicação fictícia do mock.", "Segunda explicação."];
const OBS_DADOS_MIN = 2015; // anos com dado nos blocos de crescimento/território/pecuária
const OBS_DADOS_MAX = 2024;
const ANOS_OBS = Array.from({ length: OBS_DADOS_MAX - OBS_DADOS_MIN + 1 }, (_, i) => OBS_DADOS_MIN + i);
const ANOS_PAN = Array.from({ length: 30 }, (_, i) => 1995 + i); // panorama: PAM+PPM+IPCA desde 1995
const IPCA_MIN = 1995;
const CULTURAS_OBS = [{ slug: "soja-em-grao", nome: "Soja (em grão)" }, { slug: "cafe-em-grao-canephora", nome: "Café (em grão) Canephora" }, { slug: "milho-em-grao", nome: "Milho (em grão)" }];
const REBANHOS_OBS = [{ slug: "bovino", nome: "Bovino" }, { slug: "suino-total", nome: "Suíno - total" }];

// Textos copiados de apps/api/observatorio/regras.py
const AVISO_SEM_CARNE = "O valor da produção soma lavouras (PAM) e produtos de origem animal (PPM); não inclui carne bovina nem abate, que a PPM não publica.";
const avisoAnoRef = (pedido, usado) => `O IPCA de ${pedido} ainda não está fechado; os valores estão a preços de ${usado}.`;
const avisoInicioRecortado = (pedido, usado) => `O período começa em ${usado}: antes do Plano Real não há como corrigir valores pelo IPCA.`;
const avisoAntesPlanoReal = (fim) => `Antes de 1995 (Plano Real) não há como corrigir valores pelo IPCA; o valor por hectare não é calculado para ${fim}.`;
const avisoSigiloParcial = (n) => {
  const sujeito = n === 1 ? "1 município com dado sigiloso" : `${n} municípios com dado sigiloso`;
  return `${sujeito} para alguma cultura ${n === 1 ? "fica" : "ficam"} sem cultura dominante e fora da lista de dependentes.`;
};
const avisoSigiloPecuaria = (n, tema) => {
  const sujeito = n === 1 ? "1 município com dado sigiloso" : `${n} municípios com dado sigiloso`;
  return `${sujeito} no ${tema} ${n === 1 ? "fica" : "ficam"} fora dos totais e do ranking; o principal polo pode ser outro.`;
};
const avisoVariacaoBaseComum = (nComum, nFora) => {
  const comuns = nComum === 1 ? "o 1 município" : `os ${nComum} municípios`;
  const fora = nFora === 1 ? "1 município ficou" : `${nFora} municípios ficaram`;
  return `A variação do rebanho foi calculada sobre ${comuns} com dado nos dois anos; ${fora} de fora.`;
};

const camposInvalidos = (campo, detalhe) => new HttpError(400, "Parâmetros inválidos", { [campo]: detalhe });

// Valida como o DRF: ChoiceField, SlugField e IntegerField(min_value).
function escolha(sp, campo, validos, padrao) {
  const bruto = sp.get(campo);
  if (bruto === null || bruto === "") return padrao;
  const valor = typeof padrao === "number" ? Number(bruto) : bruto;
  if (!validos.includes(valor)) throw camposInvalidos(campo, `"${bruto}" não é uma escolha válida.`);
  return valor;
}
function slugParam(sp, campo) {
  const bruto = sp.get(campo);
  if (bruto === null || bruto === "") return null;
  if (!/^[-a-zA-Z0-9_]+$/.test(bruto)) throw camposInvalidos(campo, 'Informe um "slug" válido composto por letras, números, underscores ou hífens.');
  return bruto;
}
const ANO_TETO = 2100; // mesmo teto da API: impede janelas gigantes
function anoParam(sp, campo, minimo) {
  const bruto = sp.get(campo);
  if (bruto === null || bruto === "") return null;
  if (!/^-?\d+$/.test(bruto)) throw camposInvalidos(campo, "Um número inteiro válido é necessário.");
  const n = Number(bruto);
  if (minimo !== undefined && n < minimo) throw camposInvalidos(campo, `Certifique-se de que este valor seja maior ou igual a ${minimo}.`);
  if (n > ANO_TETO) throw camposInvalidos(campo, `Certifique-se de que este valor seja menor ou igual a ${ANO_TETO}.`);
  return n;
}
function validarAno(ano, anos) {
  if (!anos.includes(ano)) throw new HttpError(400, `Não há dados para ${ano}`, { ano: `use um ano entre ${anos[0]} e ${anos[anos.length - 1]}` });
}
function validarJanelaAnos(inicio, fim) {
  if (inicio > fim) throw new HttpError(400, "O ano inicial não pode ser maior que o ano final", { inicio: "maior que fim" });
}
function slugExistente(slug, lista, rotulo) {
  if (slug !== null && !lista.some((i) => i.slug === slug)) throw new HttpError(404, `${rotulo} '${slug}' não existe`, {});
}
const temDado = (ano) => ano >= OBS_DADOS_MIN && ano <= OBS_DADOS_MAX;
const rond = (v, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
// Número-índice base 100 no primeiro ano com dado; sem dado → null (nunca zero).
function indice(anos, valorDe) {
  const base = anos.map(valorDe).find((v) => v !== null);
  return anos.map((a) => { const v = valorDe(a); return v === null || base === undefined ? null : rond((v / base) * 100); });
}
// Anos percorridos nas séries: a janela cortada aos anos com dado; fora dos dados mantém os pedidos (valores null).
function anosDaJanela(inicio, fim) {
  const de = Math.max(inicio, OBS_DADOS_MIN), ate = Math.min(fim, OBS_DADOS_MAX);
  const [a, b] = de <= ate ? [de, ate] : [inicio, fim];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
// IPCA vai de 1995 a OBS_DADOS_MAX; depois disso usa o último disponível e avisa; antes de 1995 não há correção.
function refMonetaria(ano) {
  if (ano < IPCA_MIN) return { ano_ref: null, avisos: [] };
  if (ano > OBS_DADOS_MAX) return { ano_ref: OBS_DADOS_MAX, avisos: [avisoAnoRef(ano, OBS_DADOS_MAX)] };
  return { ano_ref: ano, avisos: [] };
}

function observatorio(bloco, sp) {
  if (bloco === "panorama") {
    anoParam(sp, "ano", 1974); // mesma validação de faixa do serializer antes da escolha
    const ano = escolha(sp, "ano", ANOS_PAN, OBS_DADOS_MAX);
    const janela = escolha(sp, "janela", [5, 10, 20], 10);
    validarAno(ano, ANOS_PAN);
    const inicioPedido = ano - janela + 1;
    const inicio = Math.max(inicioPedido, IPCA_MIN);
    const anos = Array.from({ length: ano - inicio + 1 }, (_, i) => inicio + i);
    const avisos = [AVISO_SEM_CARNE];
    if (inicioPedido < IPCA_MIN) avisos.push(avisoInicioRecortado(inicioPedido, IPCA_MIN));
    const composicao = [["soja-em-grao", "Soja (em grão)", 45], ["cafe-em-grao-canephora", "Café (em grão) Canephora", 20], ["milho-em-grao", "Milho (em grão)", 15], ["leite", "Leite", 12], ["demais", "Demais produtos", 8]]
      .map(([slug, nome, p]) => ({ slug, nome, valor: p * 1000, participacao: p }));
    return {
      filtros: { valores: { ano, janela, inicio }, opcoes: { anos: ANOS_PAN, janelas: [5, 10, 20] } },
      metricas: { valor_total_real: 14500000, valor_lavouras_real: 12900000, valor_origem_animal_real: 1600000, variacao_real_pct: 42.5, area_colhida_ha: 1500000 },
      series: {
        composicao,
        evolucao: { anos, itens: composicao.map((c) => ({ slug: c.slug, nome: c.nome, valores: anos.map((_, i) => Math.round(c.valor * (0.6 + i * 0.04))) })) },
      },
      texto: { manchete: `Em ${ano}, Soja (em grão) respondeu por 45,0% do valor da produção agropecuária de Rondônia (mock).`, como_ler: COMO_LER },
      qualidade: { municipios_sigilosos: 0, ano_ref_monetario: ano, avisos },
      meta: META_OBS,
    };
  }
  if (bloco === "crescimento") {
    const cultura = slugParam(sp, "cultura") ?? "soja-em-grao";
    const fimPedido = anoParam(sp, "fim", 1974);
    const inicioPedido = anoParam(sp, "inicio", 1974);
    slugExistente(cultura, CULTURAS_OBS, "Cultura");
    const fim = fimPedido ?? OBS_DADOS_MAX;
    const inicio = inicioPedido ?? fim - 9;
    validarJanelaAnos(inicio, fim);
    const nome = CULTURAS_OBS.find((c) => c.slug === cultura).nome;
    const anos = anosDaJanela(inicio, fim);
    const { ano_ref, avisos } = refMonetaria(fim);
    if (ano_ref === null) avisos.push(avisoAntesPlanoReal(fim));
    const dado = (fn) => (a) => (temDado(a) ? fn(a - OBS_DADOS_MIN) : null);
    const area = dado((i) => 100 + i * 4), rend = dado((i) => 100 + i * 7), prod = dado((i) => 100 + i * 12);
    const comDado = temDado(inicio) && temDado(fim) && fim > inicio;
    return {
      filtros: { valores: { cultura, inicio, fim }, opcoes: { culturas: CULTURAS_OBS, anos: ANOS_OBS } },
      metricas: comDado
        ? { variacao_producao_pct: 120, parte_area_pct: 35, parte_rendimento_pct: 65, perda_media_pct: 2.1, perda_ultimo_ano_pct: 1.8 }
        : { variacao_producao_pct: null, parte_area_pct: null, parte_rendimento_pct: null, perda_media_pct: null, perda_ultimo_ano_pct: null },
      series: {
        indices: { anos, area: indice(anos, area), rendimento: indice(anos, rend), producao: indice(anos, prod) },
        perda: anos.map((ano, i) => ({ ano, valor: temDado(ano) ? 1 + (i % 3) : null })),
        valor_por_hectare: [{ slug: "cafe-em-grao-canephora", nome: "Café (em grão) Canephora", valor: 18000, participacao: null }, { slug: "soja-em-grao", nome: "Soja (em grão)", valor: 6500, participacao: null }],
      },
      texto: { manchete: `A produção de ${nome} cresceu 120,0% entre ${inicio} e ${fim} (mock).`, como_ler: COMO_LER },
      qualidade: { municipios_sigilosos: 0, ano_ref_monetario: ano_ref, avisos },
      meta: META_OBS,
    };
  }
  if (bloco === "territorio") {
    const metrica = escolha(sp, "metrica", ["valor", "area", "rebanho", "dominante"], "valor");
    const culturaPedida = slugParam(sp, "cultura");
    const anoPedido = anoParam(sp, "ano", 1974);
    slugExistente(culturaPedida, CULTURAS_OBS, "Cultura");
    const cultura = metrica === "rebanho" || metrica === "dominante" ? null : culturaPedida;
    const ano = anoPedido ?? OBS_DADOS_MAX;
    validarAno(ano, ANOS_OBS);
    const dominante = metrica === "dominante";
    const monetaria = metrica === "valor" || dominante;
    const ref = monetaria ? refMonetaria(ano) : { ano_ref: null, avisos: [] };
    const municipios = MUNICIPIOS.map((m, i) => ({
      codigo_ibge: m.codigo_ibge, nome: m.nome, microrregiao: i % 2 ? "Ariquemes" : "Cacoal",
      valor: i < 2 ? null : (52 - i) * 100, status: i === 0 ? "sigiloso" : i === 1 ? "sem_dado" : "ok",
      categoria: dominante && i > 1 ? (i % 5 === 0 ? "outras" : i % 2 ? "soja-em-grao" : "cafe-em-grao-canephora") : null,
    }));
    return {
      filtros: {
        valores: { metrica, cultura, ano },
        opcoes: {
          metricas: [["valor", "Valor da produção das lavouras", "Mil Reais"], ["area", "Área colhida", "Hectares"], ["rebanho", "Rebanho bovino", "Cabeças"], ["dominante", "Cultura dominante", ""]].map(([slug, nome, unidade]) => ({ slug, nome, unidade })),
          culturas: CULTURAS_OBS, anos: ANOS_OBS,
        },
      },
      metricas: { unidade: dominante ? "" : metrica === "area" ? "Hectares" : metrica === "rebanho" ? "Cabeças" : "Mil Reais", total: 130000, top5_pct: 38.4, hhi: 520, concentracao: "baixa" },
      series: {
        municipios,
        microrregioes: [{ nome: "Ariquemes", valor: 70000 }, { nome: "Cacoal", valor: 60000 }],
        dependentes: [{ codigo_ibge: MUNICIPIOS[2].codigo_ibge, nome: MUNICIPIOS[2].nome, cultura: "Soja (em grão)", participacao: 71.2 }],
        categorias: dominante ? [...CULTURAS_OBS.slice(0, 2), { slug: "outras", nome: "Outras" }] : [],
      },
      texto: { manchete: `Em ${ano}, os cinco maiores municípios concentraram 38,4% do total (mock).`, como_ler: COMO_LER },
      qualidade: { municipios_sigilosos: 1, ano_ref_monetario: ref.ano_ref, avisos: [...ref.avisos, avisoSigiloParcial(1)] },
      meta: META_OBS,
    };
  }
  const rebanho = slugParam(sp, "rebanho") ?? "bovino";
  const fimPedido = anoParam(sp, "fim", 1974);
  const inicioPedido = anoParam(sp, "inicio", 1974);
  slugExistente(rebanho, REBANHOS_OBS, "Rebanho");
  const fim = fimPedido ?? OBS_DADOS_MAX;
  const inicio = inicioPedido ?? fim - 9;
  validarJanelaAnos(inicio, fim);
  const anos = anosDaJanela(inicio, fim);
  const { ano_ref, avisos } = refMonetaria(fim);
  const bovino = rebanho === "bovino";
  // Bovino: 1 município sigiloso fica fora da base comum (avisos reais); suíno: sem leite no mock.
  if (bovino) avisos.push(avisoVariacaoBaseComum(50, 1), avisoSigiloPecuaria(1, "rebanho"));
  const municipios = (bovino ? MUNICIPIOS.slice(1) : MUNICIPIOS).map((m, i) => ({ codigo_ibge: m.codigo_ibge, nome: m.nome, valor: 1000000 - i * 15000 }));
  return {
    filtros: { valores: { rebanho, inicio, fim }, opcoes: { rebanhos: REBANHOS_OBS, anos: ANOS_OBS } },
    metricas: {
      efetivo_final: temDado(fim) ? 18000000 : null,
      variacao_pct: temDado(inicio) && temDado(fim) && fim > inicio ? 30.2 : null,
      top5_pct: 25.1,
      leite: bovino ? { volume_mil_litros: 900000, valor_real: 1500000, produtividade_l_vaca: 1900, variacao_produtividade_pct: 22.4 } : null,
    },
    series: {
      efetivo: anos.map((ano) => ({ ano, valor: temDado(ano) ? 14000000 + (ano - OBS_DADOS_MIN) * 400000 : null })),
      municipios,
      composicao: [{ slug: "bovino", nome: "Bovino", valor: 18000000, participacao: 90 }, { slug: "suino-total", nome: "Suíno - total", valor: 2000000, participacao: 10 }],
      leite_polos: bovino ? MUNICIPIOS.slice(1, 6).map((m, i) => ({ codigo_ibge: m.codigo_ibge, nome: m.nome, volume: 90000 - i * 5000, produtividade: 2100 - i * 50 })) : [],
    },
    texto: { manchete: `O rebanho ${bovino ? "bovino" : "suíno"} cresceu 30,2% entre ${inicio} e ${fim} (mock).`, como_ler: COMO_LER },
    qualidade: { municipios_sigilosos: bovino ? 1 : 0, ano_ref_monetario: ano_ref, avisos },
    meta: META_OBS,
  };
}

// ---- Crédito rural (/api/v1/credito/*): formato exato do contrato (apps/api/credito/consultas.py), dados fictícios ----
const CREDITO_ANOS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const CREDITO_MESES_ULTIMO = 9; // o ano corrente vai até setembro
const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PROGRAMAS = [{ slug: "pronaf", nome: "Pronaf" }, { slug: "pronamp", nome: "Pronamp" }, { slug: "demais", nome: "Demais programas e sem programa" }];
const FINALIDADES = [{ slug: "custeio", nome: "Custeio" }, { slug: "investimento", nome: "Investimento" }, { slug: "comercializacao", nome: "Comercialização" }, { slug: "industrializacao", nome: "Industrialização" }];
const PESO_PROGRAMA = { pronaf: 0.35, pronamp: 0.2, demais: 0.45 };
const PESO_FINALIDADE = { custeio: 0.58, investimento: 0.38, comercializacao: 0.02, industrializacao: 0.02 };
const META_CREDITO = {
  fontes: [{ fonte: "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)", url_fonte: "https://www.bcb.gov.br/estabilidadefinanceira/micrrural", licenca: "ODbL" }],
  atualizado_em: "2026-10-18T12:00:00Z",
};
const slugMun = (nome) => semAcento(nome).replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MUN_CREDITO = MUNICIPIOS.map((m) => ({ ...m, slug: slugMun(m.nome) }));

function mesesDoAno(ano) {
  return ano === CREDITO_ANOS.at(-1) ? CREDITO_MESES_ULTIMO : 12;
}

/** Valor (R$) de um município num mês, para um programa e uma finalidade. Determinístico. */
function valorCredito(mi, ano, mes, programa, finalidade) {
  const base = 400_000 + (hash(`c${mi}`) % 9_000_000);
  const crescimento = 1 + (ano - 2018) * 0.07;
  const sazonal = 0.7 + ((mes * 7) % 12) / 20;
  return Math.round(base * crescimento * sazonal * PESO_PROGRAMA[programa] * PESO_FINALIDADE[finalidade] * 100) / 100;
}

function somaCredito({ ano, ateMes, mi, programa, finalidade, mes }) {
  let valor = 0;
  const municipios = mi === null ? MUN_CREDITO.map((_, i) => i) : [mi];
  const programas = programa ? [programa] : Object.keys(PESO_PROGRAMA);
  const finalidades = finalidade ? [finalidade] : Object.keys(PESO_FINALIDADE);
  const meses = mes ? [mes] : Array.from({ length: ateMes }, (_, i) => i + 1);
  for (const i of municipios) for (const p of programas) for (const f of finalidades) for (const m of meses) valor += valorCredito(i, ano, m, p, f);
  return { valor: Math.round(valor * 100) / 100, contratos: Math.round(valor / 85_000) };
}

function filtrosCredito(sp) {
  const ano = sp.get("ano") ? Number(sp.get("ano")) : CREDITO_ANOS.at(-1);
  if (!Number.isInteger(ano)) throw new HttpError(400, "Parâmetros inválidos", { ano: "Um número inteiro válido é necessário." });
  if (!CREDITO_ANOS.includes(ano)) throw new HttpError(400, "Parâmetros inválidos", { ano: `use um ano entre ${CREDITO_ANOS[0]} e ${CREDITO_ANOS.at(-1)}` });
  const programa = sp.get("programa") || null;
  if (programa && !PROGRAMAS.some((p) => p.slug === programa)) throw new HttpError(400, "Parâmetros inválidos", { programa: `"${programa}" não é um escolha válido.` });
  const finalidade = sp.get("finalidade") || null;
  if (finalidade && !FINALIDADES.some((f) => f.slug === finalidade)) throw new HttpError(400, "Parâmetros inválidos", { finalidade: `"${finalidade}" não é um escolha válido.` });
  const chave = sp.get("municipio");
  let mi = null;
  if (chave) {
    mi = MUN_CREDITO.findIndex((m) => m.codigo_ibge === chave || m.slug === chave);
    if (mi < 0) throw new HttpError(404, `Município '${chave}' não existe`, {});
  }
  const municipio = mi === null ? null : { codigo_ibge: MUN_CREDITO[mi].codigo_ibge, nome: MUN_CREDITO[mi].nome, slug: MUN_CREDITO[mi].slug };
  return { ano, programa, finalidade, mi, municipio };
}

function respostaCredito(f, metricas, series, extra = {}) {
  const meses = mesesDoAno(f.ano);
  const avisos = meses < 12 ? [`${f.ano} tem dados de janeiro a ${MESES_NOME[meses - 1]}: o Banco Central publica a matriz com cerca de um mês de defasagem. A variação compara com o mesmo período de ${f.ano - 1}.`] : [];
  return {
    filtros: {
      valores: { ano: f.ano, municipio: f.municipio, programa: f.programa, finalidade: f.finalidade },
      opcoes: { anos: CREDITO_ANOS, municipios: [...MUN_CREDITO].map(({ codigo_ibge, nome, slug }) => ({ codigo_ibge, nome, slug })).sort((a, b) => a.slug.localeCompare(b.slug)), programas: PROGRAMAS, finalidades: FINALIDADES },
    },
    metricas,
    series,
    qualidade: { ano_completo: meses === 12, meses_com_dado: meses, mes_mais_recente: `${CREDITO_ANOS.at(-1)}-0${CREDITO_MESES_ULTIMO}`, avisos },
    meta: META_CREDITO,
    ...extra,
  };
}

function divisaoCredito(itens, chave, f, ateMes) {
  const linhas = itens.map((i) => ({ ...i, ...somaCredito({ ano: f.ano, ateMes, mi: f.mi, programa: chave === "programa" ? i.slug : f.programa, finalidade: chave === "finalidade" ? i.slug : f.finalidade }) }));
  // Como na API, a divisão por finalidade respeita o filtro de finalidade: as outras ficam com zero.
  const ajustadas = linhas.map((l) => (chave === "finalidade" && f.finalidade && l.slug !== f.finalidade ? { ...l, valor: 0, contratos: 0 } : l));
  const total = ajustadas.reduce((a, b) => a + b.valor, 0);
  return ajustadas.map((l) => ({ slug: l.slug, nome: l.nome, valor: l.valor, contratos: l.contratos, participacao: total ? (l.valor / total) * 100 : null }));
}

function credito(rotaCredito, sp) {
  const f = filtrosCredito(sp);
  const ate = mesesDoAno(f.ano);
  if (rotaCredito === "resumo") {
    const atual = somaCredito({ ano: f.ano, ateMes: ate, mi: f.mi, programa: f.programa, finalidade: f.finalidade });
    const semPrograma = somaCredito({ ano: f.ano, ateMes: ate, mi: f.mi, programa: null, finalidade: f.finalidade });
    const pronaf = somaCredito({ ano: f.ano, ateMes: ate, mi: f.mi, programa: "pronaf", finalidade: f.finalidade });
    const anterior = f.ano > CREDITO_ANOS[0] ? somaCredito({ ano: f.ano - 1, ateMes: ate, mi: f.mi, programa: f.programa, finalidade: f.finalidade }).valor : null;
    const variacao = anterior ? (atual.valor / anterior - 1) * 100 : null;
    const onde = f.municipio ? f.municipio.nome : "Rondônia";
    const periodo = ate === 12 ? `em ${f.ano}` : `de janeiro a ${MESES_NOME[ate - 1]} de ${f.ano}`;
    const participacao = semPrograma.valor ? (pronaf.valor / semPrograma.valor) * 100 : null;
    const atividades = [{ slug: "agricola", nome: "Agrícola", fator: 0.32 }, { slug: "pecuaria", nome: "Pecuária", fator: 0.68 }]
      .map((a) => ({ slug: a.slug, nome: a.nome, valor: Math.round(atual.valor * a.fator * 100) / 100, contratos: Math.round(atual.contratos * a.fator), participacao: a.fator * 100 }));
    return respostaCredito(f, {
      valor_total: atual.valor, contratos: atual.contratos, valor_medio: atual.contratos ? atual.valor / atual.contratos : null,
      valor_pronaf: pronaf.valor, participacao_pronaf_pct: participacao, valor_ano_anterior: anterior, variacao_pct: variacao, area_custeio_ha: 125000,
    }, {
      programas: divisaoCredito(PROGRAMAS, "programa", { ...f, programa: null }, ate),
      finalidades: divisaoCredito(FINALIDADES, "finalidade", f, ate),
      atividades,
    }, {
      texto: {
        manchete: `${onde} contratou R$ ${(atual.valor / 1e9 >= 1 ? (atual.valor / 1e9).toFixed(1) + " bilhões" : (atual.valor / 1e6).toFixed(1) + " milhões").replace(".", ",")} em crédito rural ${periodo} (dados fictícios do mock).`,
        como_ler: participacao === null ? [] : [`O Pronaf, crédito da agricultura familiar, responde por ${participacao.toFixed(1).replace(".", ",")}% do valor contratado.`],
      },
    });
  }
  if (rotaCredito === "serie") {
    const mensal = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const publicado = mes <= ate;
      const atual = somaCredito({ ano: f.ano, mes, mi: f.mi, programa: f.programa, finalidade: f.finalidade });
      const pronaf = somaCredito({ ano: f.ano, mes, mi: f.mi, programa: "pronaf", finalidade: f.finalidade });
      const anterior = f.ano > CREDITO_ANOS[0] ? somaCredito({ ano: f.ano - 1, mes, mi: f.mi, programa: f.programa, finalidade: f.finalidade }).valor : null;
      return { mes, valor: publicado ? atual.valor : null, contratos: publicado ? atual.contratos : null, valor_pronaf: publicado ? (f.programa && f.programa !== "pronaf" ? 0 : pronaf.valor) : null, valor_ano_anterior: anterior };
    });
    const anual = CREDITO_ANOS.map((a) => {
      const meses = mesesDoAno(a);
      const t = somaCredito({ ano: a, ateMes: meses, mi: f.mi, programa: f.programa, finalidade: f.finalidade });
      const p = somaCredito({ ano: a, ateMes: meses, mi: f.mi, programa: "pronaf", finalidade: f.finalidade });
      return { ano: a, valor: t.valor, contratos: t.contratos, valor_pronaf: f.programa && f.programa !== "pronaf" ? 0 : p.valor, meses, completo: meses === 12 };
    });
    return respostaCredito(f, {}, { mensal, anual });
  }
  if (rotaCredito === "ranking") {
    const g = { ...f, mi: null };
    const itens = MUN_CREDITO.map((m, i) => {
      // Dois municípios sem contrato no período: zero de verdade, nunca "sem dado".
      const s = i % 26 === 25 ? { valor: 0, contratos: 0 } : somaCredito({ ano: f.ano, ateMes: ate, mi: i, programa: f.programa, finalidade: f.finalidade });
      return { codigo_ibge: m.codigo_ibge, nome: m.nome, slug: m.slug, microrregiao: m.nome, valor: s.valor, contratos: s.contratos, valor_por_contrato: s.contratos ? s.valor / s.contratos : null };
    }).sort((a, b) => b.valor - a.valor || a.slug.localeCompare(b.slug));
    const total = itens.reduce((a, b) => a + b.valor, 0);
    const linhas = itens.map((x, i) => ({ posicao: i + 1, ...x, participacao_pct: total ? (x.valor / total) * 100 : null }));
    return respostaCredito(g, { valor_total: total, top5_pct: total ? (linhas.slice(0, 5).reduce((a, b) => a + b.valor, 0) / total) * 100 : null }, { municipios: linhas });
  }
  // por-produto
  if (f.finalidade === "comercializacao" || f.finalidade === "industrializacao") {
    const r = respostaCredito(f, {}, {});
    r.qualidade.avisos.push("O Banco Central não detalha por produto o crédito de comercialização e industrialização; o detalhe por produto existe só para custeio e investimento.");
    return r;
  }
  const total = somaCredito({ ano: f.ano, ateMes: ate, mi: f.mi, programa: f.programa, finalidade: f.finalidade }).valor * 0.96;
  const PRODUTOS_CREDITO = [["bovinos", "Bovinos", "pecuaria", 0.52], ["soja", "Soja", "agricola", 0.11], ["tercos-porteiras-mata-burros-currais-cochos-cercas", "Terraços, porteiras, mata-burros, currais, cochos, cercas", "pecuaria", 0.07], ["cafe", "Café", "agricola", 0.05], ["pastagem", "Pastagem", "agricola", 0.04], ["milho", "Milho", "agricola", 0.03], ["maquinas-e-implementos", "Máquinas e implementos", "agricola", 0.03], ["trator", "Trator", "agricola", 0.02], ["peixe", "Peixe", "pecuaria", 0.02]];
  const resto = 1 - PRODUTOS_CREDITO.reduce((a, p) => a + p[3], 0);
  const produtos = [...PRODUTOS_CREDITO.map(([slug, nome, atividade, fator]) => ({ slug, nome, atividade, valor: Math.round(total * fator * 100) / 100, participacao_pct: fator * 100, area_ha: atividade === "agricola" ? 1000 : null })),
    { slug: "demais", nome: "Demais produtos (40)", atividade: null, valor: Math.round(total * resto * 100) / 100, participacao_pct: resto * 100, area_ha: null }];
  return respostaCredito(f, { valor_total: total, produtos: 49 }, { produtos });
}

function rota(url) {
  const sp = url.searchParams;
  switch (url.pathname.replace(/\/$/, "")) {
    case "/api/v1/saude": return { json: { status: "ok", banco: "ok" } };
    case "/api/v1/produtos": {
      const seg = sp.get("segmento");
      const q = semAcento(sp.get("q") ?? "");
      return { json: PRODUTOS.filter((p) => (!seg || p.segmento === seg) && semAcento(p.nome).includes(q)).map(({ slug, nome, segmento, tabela_sidra }) => ({ slug, nome, segmento, tabela_sidra })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
    }
    case "/api/v1/indicadores": {
      const p = produtoDe(sp.get("produto"));
      return { json: p.inds.map((s) => indicadorDo(p, s)) };
    }
    case "/api/v1/municipios": return { json: MUNICIPIOS };
    case "/api/v1/meta": return { json: { ultima_carga: ATUALIZADO_EM, cargas: [5457, 3939, 74].map((tabela) => ({ tabela, status: "sucesso", concluida_em: ATUALIZADO_EM, linhas: 1000 })), anos: { min: ANO_MIN, max: ANO_MAX } } };
    case "/api/v1/destaques": return { json: destaques() };
    case "/api/v1/ranking": return { json: ranking(sp) };
    case "/api/v1/serie": return { json: serie(sp) };
    case "/api/v1/comparacao": return { json: comparacao(sp) };
    case "/api/v1/analise": return { json: analise(sp) };
    case "/api/v1/observatorio/panorama": return { json: observatorio("panorama", sp) };
    case "/api/v1/observatorio/crescimento": return { json: observatorio("crescimento", sp) };
    case "/api/v1/observatorio/territorio": return { json: observatorio("territorio", sp) };
    case "/api/v1/observatorio/pecuaria": return { json: observatorio("pecuaria", sp) };
    case "/api/v1/credito/resumo": return { json: credito("resumo", sp) };
    case "/api/v1/credito/serie": return { json: credito("serie", sp) };
    case "/api/v1/credito/ranking": return { json: credito("ranking", sp) };
    case "/api/v1/credito/por-produto": return { json: credito("por-produto", sp) };
    case "/api/v1/relatorio.pdf": {
      const a = analise(sp);
      const { inicio, fim } = periodo(sp);
      return { pdf: pdfMinimo(a.titulo), nome: `faperon-${sp.get("produto")}-${sp.get("indicador")}-${inicio}-${fim}.pdf` };
    }
    case "/api/v1/zetele/estado": return { json: { disponivel: true, motivo: null } };
    case "/api/v1/zetele/perguntar": return { json: ZETELE_RESPOSTA };
    default: throw new HttpError(404, "Rota não encontrada");
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  try {
    const r = rota(url);
    if (r.pdf) {
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${r.nome}"` });
      res.end(r.pdf);
    } else {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(r.json));
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(e instanceof HttpError ? e.body : { erro: String(e) }));
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`mock-api em http://localhost:${PORT}`));
