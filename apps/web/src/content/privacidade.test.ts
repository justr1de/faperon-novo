import { describe, expect, it } from "vitest";
import { PRIVACIDADE } from "./privacidade";

const texto = [
  PRIVACIDADE.introducao,
  ...PRIVACIDADE.secoes.flatMap((s) => [s.titulo, ...(s.paragrafos ?? []), ...(s.itens ?? [])]),
].join("\n");

describe("Política de Privacidade descreve só o que o sistema faz hoje", () => {
  it("explica o login de verdade da área do sistema (ADR 0035): conta, cookie de sessão e registro de acessos", () => {
    expect(texto).toMatch(/login é conferido no servidor/);
    expect(texto).toMatch(/cookie de sessão, necessário/);
    expect(texto).toMatch(/usuários de demonstração/);
    expect(texto).toMatch(/Google só confirma o seu e-mail/);
    expect(texto).toMatch(/tentativa sem sucesso[^.]*endereço IP/);
    expect(texto).toMatch(/continua salvo só no seu navegador/);
  });

  it("informa o tratamento técnico do IP para limitar abusos, sem gravar em banco", () => {
    expect(texto).toMatch(/endereço IP/);
    expect(texto).toMatch(/limitar abusos/);
    expect(texto).toMatch(/No painel e no Zétele[^.]*não é gravado em banco de dados/);
  });

  it("mantém o formulário via WhatsApp, a preferência de tema e os canais de contato", () => {
    expect(texto).toMatch(/WhatsApp da FAPERON/);
    expect(texto).toMatch(/Preferência de tema/);
    expect(texto).toMatch(/\(69\) 3214-8371/);
    expect(texto).toMatch(/\(69\) 3224-7620/);
  });

  it("tem a data da revisão atual", () => {
    expect(PRIVACIDADE.atualizadoEm).toBe("2026-10-18");
  });

  it("descreve o Zétele: o que guarda, por quanto tempo, sem IP, e o envio à Anthropic", () => {
    expect(texto).toMatch(/Zétele/);
    expect(texto).toMatch(/90 dias/);
    expect(texto).toMatch(/não guardamos seu endereço IP/i);
    expect(texto).toMatch(/Anthropic/);
    expect(texto).toMatch(/art\. 33 da LGPD/);
  });

  it("nomeia o encarregado de dados", () => {
    expect(texto).toMatch(/Weslley Hariel Lima e Silva Palomeque Gonçalves/);
    expect(texto).toMatch(/weslley\.palomeque@dataro-it\.com\.br/);
  });
});
