import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CENTRAL } from "./central";
import { INICIO } from "./inicio";
import { INFORMATIVOS } from "./informativos";
import { NOTICIAS, noticiasRecentes } from "./noticias";
import { SOBRE } from "./sobre";

const PUBLIC = path.resolve(__dirname, "../../public");

describe("notícias", () => {
  it("traz as 20 notícias importadas do Wix, com slugs únicos", () => {
    expect(NOTICIAS).toHaveLength(20);
    expect(new Set(NOTICIAS.map((n) => n.slug)).size).toBe(NOTICIAS.length);
  });

  it("tem datas ISO válidas e ordem da mais recente para a mais antiga", () => {
    for (const n of NOTICIAS) {
      expect(n.data, n.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${n.data}T12:00:00Z`)), n.slug).toBe(false);
    }
    const datas = NOTICIAS.map((n) => n.data);
    expect(datas).toEqual([...datas].sort().reverse());
    expect(noticiasRecentes(3).map((n) => n.slug)).toEqual(NOTICIAS.slice(0, 3).map((n) => n.slug));
  });

  it("tem título, resumo e link do site atual em todas", () => {
    for (const n of NOTICIAS) {
      expect(n.titulo.length, n.slug).toBeGreaterThan(10);
      expect(n.resumo.length, n.slug).toBeGreaterThan(0);
      expect(n.url_original, n.slug).toMatch(/^https:\/\/www\.faperon\.com\.br\/post\//);
    }
  });

  it("aponta só para imagens que existem em public/noticias", () => {
    const comImagem = NOTICIAS.filter((n) => n.imagem !== null);
    expect(comImagem.length).toBeGreaterThanOrEqual(19);
    for (const n of comImagem) {
      expect(n.imagem, n.slug).toMatch(/^\/noticias\/[a-z0-9-]+\.(jpg|png|webp)$/);
      expect(existsSync(path.join(PUBLIC, n.imagem!)), n.imagem!).toBe(true);
    }
    for (const n of noticiasRecentes(3)) expect(n.imagem, n.slug).not.toBeNull();
  });
});

describe("Início e Central", () => {
  it("usa o link de preços das commodities da CNA", () => {
    expect(INICIO.commodities.url).toBe("https://www.cnabrasil.org.br/servicos/precos-commodities");
    expect(INICIO.central.cta_url).toBe("/central-de-inteligencia");
    expect(INICIO.nosso_agro.titulo).toBe("Nosso Agro");
  });

  it("descreve a Central e as três portas sem HTML solto", () => {
    expect(CENTRAL.paragrafos.every((p) => !p.includes("<"))).toBe(true);
    expect(CENTRAL.seo.descricao).toContain("Observatório");
    expect(CENTRAL.cta_url).toBe("/painel");
    expect(CENTRAL.portas.map((p) => p.href)).toEqual(["/painel", "/central-de-inteligencia/observatorio", "/credito-rural"]);
    expect(CENTRAL.portas.map((p) => p.rotulo)).toEqual(["Abrir o Painel Agro Analítico", "Abrir o Observatório", "Abrir o painel de crédito rural"]);
  });
});

describe("Sobre", () => {
  it("traz a diretoria 2024-2027 completa, com 15 nomes únicos", () => {
    const nomes = SOBRE.diretoria.grupos.flatMap((g) => g.membros.map((m) => m.nome));
    expect(nomes).toHaveLength(15);
    expect(new Set(nomes).size).toBe(15);
    expect(SOBRE.diretoria.grupos[0]?.membros[0]).toEqual({ cargo: "Presidente", nome: "Hélio Dias de Souza" });
  });

  it("tem os cinco valores e textos sem HTML", () => {
    expect(SOBRE.valores).toHaveLength(5);
    const textos = [...SOBRE.quem_somos.paragrafos, SOBRE.missao, SOBRE.visao];
    expect(textos.every((t) => !t.includes("<"))).toBe(true);
  });

  it("o Estatuto é um PDF do site atual, publicado em 01/01/2025", () => {
    expect(SOBRE.estatuto.titulo).toBe("Estatuto FAPERON");
    expect(SOBRE.estatuto.data).toBe("2025-01-01");
    expect(SOBRE.estatuto.url).toMatch(/^https:\/\/www\.faperon\.com\.br\/_files\/ugd\/cbbcc7_[0-9a-f]{32}\.pdf$/);
  });

  it("traz os quatro objetivos da entidade, como no site atual", () => {
    expect(SOBRE.quem_somos.objetivos).toHaveLength(4);
    expect(SOBRE.visao).toContain("instituição de excelência");
  });

  it("as âncoras das seções são únicas", () => {
    expect(new Set(SOBRE.secoes.map((s) => s.id)).size).toBe(SOBRE.secoes.length);
  });

  it("toda seção do índice tem conteúdo correspondente e todo grupo da diretoria tem coluna", () => {
    expect(SOBRE.secoes.map((s) => s.id)).toEqual([
      "quem-somos",
      "missao-visao-valores",
      "diretoria",
      "estatuto",
      "sistema",
    ]);
    expect(SOBRE.diretoria.grupos.every((g) => g.coluna.length > 0)).toBe(true);
    expect(new Set(SOBRE.diretoria.grupos.map((g) => g.coluna)).size).toBe(3);
  });

  it("o Sistema FAPERON tem 4 entidades com link https e o calendário aponta para um PDF", () => {
    expect(SOBRE.sistema.entidades).toHaveLength(4);
    for (const e of SOBRE.sistema.entidades) expect(e.url, e.nome).toMatch(/^(https:\/\/|\/[a-z-]+$)/);
    expect(SOBRE.sistema.calendario.url).toMatch(/^https:\/\/www\.faperon\.com\.br\/_files\/ugd\/cbbcc7_[0-9a-f]{32}\.pdf$/);
  });
});

describe("Informativos Técnicos", () => {
  const todos = [...INFORMATIVOS.categorias.flatMap((c) => c.itens), ...INFORMATIVOS.boletins];

  it("tem 12 de corte, 11 de leite e 2 boletins", () => {
    expect(INFORMATIVOS.categorias.map((c) => [c.id, c.itens.length])).toEqual([
      ["corte", 12],
      ["leite", 11],
    ]);
    expect(INFORMATIVOS.boletins).toHaveLength(2);
  });

  it("cada item aponta para um PDF próprio do site atual", () => {
    for (const i of todos)
      expect(i.url, i.titulo).toMatch(/^https:\/\/www\.faperon\.com\.br\/_files\/ugd\/cbbcc7_[0-9a-f]{32}\.pdf$/);
    expect(new Set(todos.map((i) => i.url)).size).toBe(todos.length);
  });

  it("datas ISO válidas, da mais recente para a mais antiga em cada categoria", () => {
    for (const c of INFORMATIVOS.categorias) {
      const datas = c.itens.map((i) => i.data);
      for (const d of datas) expect(Number.isNaN(Date.parse(`${d}T12:00:00Z`)), d).toBe(false);
      expect(datas).toEqual([...datas].sort().reverse());
    }
  });

  it("título do item corresponde ao mês da data", () => {
    const MESES = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    for (const c of INFORMATIVOS.categorias)
      for (const i of c.itens) {
        const [ano, mes] = i.data.split("-").map(Number) as [number, number];
        expect(i.titulo).toBe(`${MESES[mes - 1]}/${ano}`);
      }
  });
});

describe("Sindicatos Rurais", () => {
  it("tem os 34 cadastros do site atual, com telefone e e-mail válidos e sem repetição", async () => {
    const { SINDICATOS } = await import("./sindicatos");
    expect(SINDICATOS).toHaveLength(34);
    expect(new Set(SINDICATOS.map((s) => s.nome)).size).toBe(34);
    for (const s of SINDICATOS) {
      expect(s.presidente.length, s.nome).toBeGreaterThan(3);
      expect(s.email, s.nome).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]+$/);
      expect(s.telefones.length, s.nome).toBeGreaterThan(0);
      for (const t of s.telefones) expect(t, s.nome).toMatch(/^\(\d{2}\) \d{4,5}-\d{4}$/);
    }
  });
});

describe("IPAGRO", () => {
  it("o comunicado para download existe em public e é um PDF", async () => {
    const { IPAGRO } = await import("./ipagro");
    const arquivo = path.join(PUBLIC, IPAGRO.transparencia.arquivo.url);
    expect(existsSync(arquivo)).toBe(true);
    expect(readFileSync(arquivo).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
