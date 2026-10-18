import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { CENTRAL } from "./central";
import { CONTATO } from "./contato";
import { OBSERVATORIO } from "./observatorio";
import { ORDEM_POR_PAGINA, PAGINAS_COM_ZETELE, PERGUNTAS, ehPaginaComZetele, perguntasDaPagina } from "./zetele";

// Mesmo padrão de content.test.ts: no jsdom, import.meta.url não é file://.
// Bases do RAG de cada Zétele (ADR 0032): todos os .md da pasta do canal.
const PASTA_BASES = path.resolve(__dirname, "../../../api/zetele/conhecimento");
const lerBase = (canal: "publico" | "sistema") =>
  readdirSync(join(PASTA_BASES, canal))
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(PASTA_BASES, canal, f), "utf-8"))
    .join("\n");
const ROTAS = sitemap().map((e) => new URL(e.url).pathname);

describe("Zétele: conteúdo", () => {
  it("aparece no Início, na Central, no Observatório, no Painel e na área logada", () => {
    expect([...PAGINAS_COM_ZETELE].sort()).toEqual([
      "/", "/central-de-inteligencia", "/central-de-inteligencia/observatorio", "/painel",
      "/sistema", "/sistema/agenda", "/sistema/atividades", "/sistema/contas", "/sistema/espacos", "/sistema/frotas", "/sistema/relatorios", "/sistema/usuarios",
    ]);
    expect(ehPaginaComZetele("/sistema/frotas")).toBe(true);
    expect(ehPaginaComZetele("/painel")).toBe(true);
    expect(ehPaginaComZetele("/sobre")).toBe(false);
    expect(ehPaginaComZetele(null)).toBe(false);
  });

  it("aparece em todas as telas da área logada", () => {
    const raiz = join(process.cwd(), "src/app/sistema");
    const paginas = readdirSync(raiz, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith("page.tsx"))
      .map((f) => `/sistema/${dirname(f)}`.replace(/\/\.$/, ""));
    expect(paginas.length).toBeGreaterThan(5);
    for (const pagina of paginas) expect(ehPaginaComZetele(pagina), pagina).toBe(true);
  });

  it("tem as perguntas prontas; as estáticas têm resposta e link para página que existe", () => {
    expect(PERGUNTAS).toHaveLength(25);
    for (const p of PERGUNTAS.filter((q) => q.tipo === "estatica")) {
      expect(p.resposta, p.id).toBeTruthy();
      expect([...ROTAS, ...PAGINAS_COM_ZETELE], p.id).toContain(p.href!.split("?")[0]);
    }
  });

  it("cada página mostra 4 perguntas que existem, e o resto vai para 'mais sugestões'", () => {
    for (const pagina of PAGINAS_COM_ZETELE) {
      const { visiveis, demais } = perguntasDaPagina(pagina);
      expect(visiveis.map((p) => p.id)).toEqual(ORDEM_POR_PAGINA[pagina]);
      const area = pagina.startsWith("/sistema") ? "sistema" : "site";
      expect(visiveis.length + demais.length).toBe(PERGUNTAS.filter((p) => (p.area ?? "site") === area).length);
    }
  });

  it("na área logada, as sugestões são só do sistema e não se misturam com as do site", () => {
    for (const pagina of ["/sistema", "/sistema/agenda", "/sistema/frotas", "/sistema/espacos"] as const) {
      const { visiveis, demais } = perguntasDaPagina(pagina);
      expect([...visiveis, ...demais].every((p) => p.area === "sistema"), pagina).toBe(true);
    }
    expect(perguntasDaPagina("/").demais.some((p) => p.area === "sistema")).toBe(false);
  });

  it("no Início só há perguntas de orientação (estáticas)", () => {
    expect(perguntasDaPagina("/").visiveis.every((p) => p.tipo === "estatica")).toBe(true);
  });

  it("respostas estáticas usam os contatos reais", () => {
    const contato = PERGUNTAS.find((p) => p.id === "contato")!;
    expect(contato.resposta).toContain(CONTATO.telefone.texto);
    expect(contato.resposta).toContain(CONTATO.whatsapp.texto);
  });

  it("a resposta dos Informativos não rebaixa nome próprio a minúscula", () => {
    const informativos = PERGUNTAS.find((p) => p.id === "informativos")!;
    expect(informativos.resposta).toContain("Rondônia");
  });
});

describe("Zétele: bases de conhecimento acompanham o site e o sistema", () => {
  const md = lerBase("publico");
  const sistema = lerBase("sistema");

  it("a base do sistema tem uma seção para cada tela logada, e a pública não fala do sistema", () => {
    for (const pagina of PAGINAS_COM_ZETELE.filter((p) => p.startsWith("/sistema"))) expect(sistema, pagina).toContain(`## [${pagina}]`);
    expect(md).not.toContain("## [/sistema");
  });

  it("cita toda rota do sitemap", () => {
    for (const rota of ROTAS) expect(md, rota).toContain(`## [${rota}]`);
  });

  it("tem os telefones, as portas da Central e os blocos do Observatório", () => {
    expect(md).toContain(CONTATO.telefone.texto);
    expect(md).toContain(CONTATO.whatsapp.texto);
    for (const porta of CENTRAL.portas) expect(md).toContain(porta.titulo);
    for (const secao of OBSERVATORIO.secoes) expect(md).toContain(secao.titulo);
  });
});
