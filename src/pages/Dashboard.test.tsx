import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Dashboard from "./Dashboard";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useEmployeeProfile", () => ({ useEmployeeProfile: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const MI_ID = "yo";
// Miércoles 7 de octubre de 2026 a las 10:00
const AHORA = new Date(2026, 9, 7, 10, 0);

const FILAS: Record<string, unknown[]> = {
  tareas: [
    { id: "t1", titulo: "Preparar informe", estado: "pendiente", fecha_limite: "2026-10-09", asignado_a_id: MI_ID },
    { id: "t2", titulo: "Revisar contrato", estado: "en_progreso", fecha_limite: null, asignado_a_id: MI_ID },
  ],
  eventos: [
    { id: "ev1", titulo: "Reunión de equipo", fecha_inicio: new Date(2026, 9, 7, 9).toISOString(), fecha_fin: new Date(2026, 9, 7, 10).toISOString() },
  ],
  anuncios: [
    { id: "n1", titulo: "Nueva política de teletrabajo", contenido: "A partir de noviembre...", area: "rrhh", created_at: "2026-10-01T09:00:00Z", fecha_publicacion: "2026-10-01T09:00:00Z" },
  ],
  tickets: [
    { id: "a1b2c3d4-0000-4000-8000-000000000001", titulo: "La impresora no imprime", estado: "en_curso", prioridad: "media", tipo: "incidencia", autor_id: MI_ID, asignado_a_id: null, updated_at: "2026-10-01T09:00:00Z" },
  ],
};

// Cualquier cadena de supabase.from(tabla) acaba devolviendo las filas de esa tabla
function simularTablas() {
  vi.mocked(supabase.from).mockImplementation(((tabla: string) => {
    const consulta: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "neq", "in", "or", "lte", "gte", "lt", "gt", "order", "limit", "range"]) {
      consulta[metodo] = () => consulta;
    }
    consulta.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: FILAS[tabla] ?? [], error: null }).then(ok);
    return consulta;
  }) as never);
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(AHORA);
    simularTablas();
    vi.mocked(useEmployeeProfile).mockReturnValue({ profile: { id: MI_ID }, loading: false } as ReturnType<typeof useEmployeeProfile>);
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no tiene problemas de accesibilidad", async () => {
    renderConQuery(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Preparar informe")).toBeInTheDocument();
    await screen.findByText("Nueva política de teletrabajo");
    await screen.findByText("La impresora no imprime");
    await expectSinViolaciones();

    // Vista kanban de las tareas
    await userEvent.click(screen.getByRole("radio", { name: "Vista kanban" }));
    await expectSinViolaciones();
  });
});
