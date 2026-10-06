import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import GoogleCallback from "./GoogleCallback";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

const ESTADO = "a".repeat(64);

// Muestra a dónde lleva la página al terminar
function Destino() {
  const { pathname, search } = useLocation();
  return <p>Destino: {pathname + search}</p>;
}

const volverDeGoogle = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/google-callback?${query}`]}>
      <Routes>
        <Route path="/google-callback" element={<GoogleCallback />} />
        <Route path="/calendario" element={<Destino />} />
      </Routes>
    </MemoryRouter>
  );

describe("Vuelta de Google", () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
  });

  it("manda el código a la función una sola vez y vuelve al Calendario con el resultado", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { resultado: "conectado" }, error: null } as never);
    volverDeGoogle(`code=4/abc&state=${ESTADO}&scope=x`);

    expect(screen.getByText("Conectando con Google Calendar…")).toBeInTheDocument();
    expect(await screen.findByText("Destino: /calendario?google=conectado")).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("google-calendar", {
      body: { accion: "completar", code: "4/abc", state: ESTADO, error: null },
    });
  });

  it("si se cancela en Google se lo dice a la función y vuelve con «cancelado»", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { resultado: "cancelado" }, error: null } as never);
    volverDeGoogle(`error=access_denied&state=${ESTADO}`);

    expect(await screen.findByText("Destino: /calendario?google=cancelado")).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledWith("google-calendar", {
      body: { accion: "completar", code: null, state: ESTADO, error: "access_denied" },
    });
  });

  it("si la función falla vuelve con «error»", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error("500") } as never);
    volverDeGoogle(`code=x&state=${ESTADO}`);
    await waitFor(() => expect(screen.getByText("Destino: /calendario?google=error")).toBeInTheDocument());
  });
});
