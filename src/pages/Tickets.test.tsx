import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import type { Ticket } from "@/components/tickets/ticket-config";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Tickets from "./Tickets";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const MI_ID = "yo";
const TICKET_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const crearTicket = (datos: Partial<Ticket> = {}): Ticket => ({
  id: TICKET_ID,
  autor_id: MI_ID,
  asignado_a_id: "e-tec",
  titulo: "La impresora no imprime",
  descripcion: "Sale un error de papel atascado",
  tipo: "incidencia",
  estado: "en_curso",
  prioridad: "media",
  fecha_creacion: "2026-10-01T09:00:00Z",
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  fecha_resolucion: null,
  fecha_cierre: null,
  ...datos,
});

function simularTabla(filas: Ticket[]) {
  vi.mocked(supabase.from).mockImplementation((() => {
    const consulta = {
      select: () => consulta,
      order: () => consulta,
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok),
    };
    return consulta;
  }) as never);
}

const pintar = () =>
  renderConQuery(
    <MemoryRouter initialEntries={["/tickets"]}>
      <Routes>
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<p>Detalle del ticket</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("Mis tickets", () => {
  beforeEach(() => {
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
    vi.mocked(usePermisos).mockReturnValue({
      permisos: new Set<string>(),
      loading: false,
      tiene: () => false,
    } as ReturnType<typeof usePermisos>);
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ personas_tickets: [{ id: "e-tec", nombre: "Marta Ruiz" }] }) as never
    );
    simularTabla([crearTicket(), crearTicket({ id: "b2", titulo: "Pedir un portátil", tipo: "peticion", prioridad: "alta" })]);
  });

  it("cada ticket se abre con un enlace desde su título", async () => {
    pintar();
    const enlace = await screen.findByRole("link", { name: "La impresora no imprime" });
    expect(enlace).toHaveAttribute("href", `/tickets/${TICKET_ID}`);

    await userEvent.click(enlace);
    expect(screen.getByText("Detalle del ticket")).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    pintar();
    await screen.findByText("Pedir un portátil");
    await expectSinViolaciones();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo ticket" }));
    await screen.findByRole("dialog");
    await expectSinViolaciones();
  });
});
