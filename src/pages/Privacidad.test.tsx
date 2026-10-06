import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Privacidad from "./Privacidad";

const pintar = () =>
  render(
    <MemoryRouter>
      <Privacidad />
    </MemoryRouter>
  );

describe("Política de privacidad", () => {
  it("explica el uso de los datos de Google con la declaración de uso limitado", () => {
    pintar();
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidad de Integra" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByText(/calendar\.events\.readonly/)).toBeInTheDocument();
    expect(screen.getByText(/requisitos de uso limitado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Política de datos de usuario de los servicios de API de Google/ })).toHaveAttribute(
      "href",
      "https://developers.google.com/terms/api-services-user-data-policy"
    );
  });

  it("no tiene problemas de accesibilidad", async () => {
    pintar();
    await expectSinViolaciones(document.body, { conLayout: true });
  });
});
