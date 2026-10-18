import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CentralPage from "./page";

describe("Central de Inteligência", () => {
  it("é um hub com as portas do Observatório e do Painel", () => {
    render(<CentralPage />);
    expect(screen.getByRole("link", { name: /Abrir o Observatório/ })).toHaveAttribute("href", "/central-de-inteligencia/observatorio");
    expect(screen.getByRole("link", { name: /Abrir o Painel Agro Analítico/ })).toHaveAttribute("href", "/painel");
    expect(screen.getByRole("link", { name: /Abrir o painel de crédito rural/ })).toHaveAttribute("href", "/credito-rural");
  });

  it("tem um único h1 e um h2 por porta", () => {
    render(<CentralPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 2, name: "Crédito rural e Pronaf" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Observatório Agropecuário" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Painel Agro Analítico" })).toBeInTheDocument();
  });
});
