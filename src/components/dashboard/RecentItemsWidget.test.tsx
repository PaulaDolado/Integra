import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { RecentItemsWidget } from "./RecentItemsWidget";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const pintar = () =>
  renderConQuery(
    <MemoryRouter>
      <RecentItemsWidget />
    </MemoryRouter>
  );

describe("Abierto recientemente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enlaza a las últimas notas abiertas de Gestión Documental", async () => {
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({
        notas_recientes: [
          { id: "n1", titulo: "Acta de la reunión", extracto: "Puntos tratados", mi_rol: "propietario", propietario_nombre: "Ana López", abierta_at: hace(5), updated_at: hace(5) },
          { id: "n2", titulo: "", extracto: "", mi_rol: "lector", propietario_nombre: "Pablo Sanz", abierta_at: hace(60 * 24), updated_at: hace(60) },
        ],
      }) as never
    );
    pintar();

    expect(await screen.findByRole("link", { name: /Acta de la reunión/ })).toHaveAttribute("href", "/documentos/n1");
    // Sin título y compartida por otra persona
    const compartida = screen.getByRole("link", { name: /Sin título/ });
    expect(compartida).toHaveAttribute("href", "/documentos/n2");
    expect(compartida).toHaveTextContent("de Pablo Sanz");
    expect(screen.getByRole("link", { name: "Ir a Gestión Documental →" })).toHaveAttribute("href", "/documentos");
    expect(supabase.rpc).toHaveBeenCalledWith("notas_recientes", { p_limite: 4 });
  });

  it("sin notas abiertas lo explica", async () => {
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({ notas_recientes: [] }) as never);
    pintar();
    expect(await screen.findByText("Todavía no has abierto ninguna nota de Gestión Documental.")).toBeInTheDocument();
  });
});
