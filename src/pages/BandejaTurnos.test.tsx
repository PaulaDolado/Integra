import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import type { SolicitudTurno } from "@/components/turnos/SolicitudTurnoCard";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import BandejaTurnos from "./BandejaTurnos";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const MI_ID = "yo";

const solicitud = (datos: Partial<SolicitudTurno>): SolicitudTurno => ({
  id: "t1",
  fecha: "2026-10-20",
  estado: "pendiente",
  motivo: "Cita médica",
  solicitante_id: "e1",
  solicitante: "Laura Gómez",
  departamento: "Marketing",
  companero_id: null,
  companero: null,
  turno_actual: "Mañana (8:00-15:00)",
  turno_solicitado: "Tarde (15:00-22:00)",
  respuesta_companero: null,
  fecha_respuesta_companero: null,
  revisor: null,
  fecha_revision: null,
  comentario_revision: null,
  created_at: "2026-10-01T09:00:00Z",
  ...datos,
});

const SOLICITUDES = [
  solicitud({ id: "t1", solicitante: "Laura Gómez", departamento: "Marketing" }),
  solicitud({ id: "t2", solicitante: "Pablo Sanz", departamento: "Finanzas", companero_id: MI_ID, companero: "Yo Misma" }),
  solicitud({ id: "t3", solicitante: "Marta Ruiz", estado: "pendiente_companero", companero_id: "e9", companero: "Jorge Pérez" }),
  solicitud({ id: "t4", solicitante: "Ana López", estado: "aprobada" }),
  solicitud({ id: "t5", solicitante: "Luis Mora", estado: "rechazada" }),
  solicitud({ id: "t6", solicitante: "Eva Gil", estado: "cancelada" }),
];

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

const tarjetaDe = (nombre: string) => screen.getByText(new RegExp(`^${nombre}`)).closest(".p-4") as HTMLElement;

describe("Bandeja de cambios de turno", () => {
  beforeEach(() => {
    toast.mockReset();
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ solicitudes_turno_detalle: SOLICITUDES, revisar_solicitud_turno: null }) as never
    );
  });

  it("sin el permiso no consulta nada y muestra el aviso", () => {
    conPermisos();
    renderConQuery(<BandejaTurnos />);
    expect(screen.getByText("No tienes acceso a los cambios de turno")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("cuenta las canceladas dentro de las rechazadas", async () => {
    conPermisos("turnos.aprobar");
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Laura Gómez/);

    expect(screen.getByRole("tab", { name: "Pendientes (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Esperando al compañero (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aprobadas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rechazadas (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todas (6)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Rechazadas (2)" }));
    expect(screen.getByText(/^Luis Mora/)).toBeInTheDocument();
    expect(screen.getByText(/^Eva Gil/)).toBeInTheDocument();
    expect(screen.queryByText(/^Laura Gómez/)).not.toBeInTheDocument();
  });

  it("no deja revisar un cambio en el que participo como compañero", async () => {
    conPermisos("turnos.aprobar");
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Pablo Sanz/);

    const mia = tarjetaDe("Pablo Sanz");
    expect(within(mia).getByText(/Participas en este cambio/)).toBeInTheDocument();
    expect(within(mia).queryByRole("button", { name: /Aprobar/ })).not.toBeInTheDocument();
    expect(within(tarjetaDe("Laura Gómez")).getByRole("button", { name: /Aprobar/ })).toBeInTheDocument();
  });

  it("espera a saber quién soy antes de mostrar las solicitudes", async () => {
    conPermisos("turnos.aprobar");
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: null, loading: true });
    const { rerender } = renderConQuery(<BandejaTurnos />);

    // Las solicitudes ya han llegado, pero aún no se sabe en cuáles participo
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("solicitudes_turno_detalle"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/^Pablo Sanz/)).not.toBeInTheDocument();

    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
    rerender(<BandejaTurnos />);
    expect(within(tarjetaDe("Pablo Sanz")).queryByRole("button", { name: /Aprobar/ })).not.toBeInTheDocument();
  });

  it("busca también por el nombre del compañero", async () => {
    conPermisos("turnos.aprobar");
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Laura Gómez/);

    await userEvent.click(screen.getByRole("tab", { name: "Todas (6)" }));
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado o departamento..."), "jorge");
    expect(screen.getByText(/^Marta Ruiz/)).toBeInTheDocument();
    expect(screen.queryByText(/^Laura Gómez/)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todas (1)" })).toBeInTheDocument();
  });

  it("aprueba sin comentario obligatorio", async () => {
    conPermisos("turnos.aprobar");
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Laura Gómez/);

    await userEvent.click(within(tarjetaDe("Laura Gómez")).getByRole("button", { name: /Aprobar/ }));
    const dialogo = screen.getByRole("dialog", { name: "Aprobar el cambio de turno" });
    expect(within(dialogo).getByText("Laura Gómez: Mañana (8:00-15:00) → Tarde (15:00-22:00)")).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Aprobar" }));

    expect(supabase.rpc).toHaveBeenCalledWith("revisar_solicitud_turno", {
      p_solicitud: "t1",
      p_aprobar: true,
      p_comentario: undefined,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cambio de turno aprobado" }));
    await waitFor(() =>
      expect(vi.mocked(supabase.rpc).mock.calls.filter(([n]) => n === "solicitudes_turno_detalle")).toHaveLength(2)
    );
  });

  it("para rechazar exige un comentario", async () => {
    conPermisos("turnos.aprobar");
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Laura Gómez/);

    await userEvent.click(within(tarjetaDe("Laura Gómez")).getByRole("button", { name: /Rechazar/ }));
    const dialogo = screen.getByRole("dialog", { name: "Rechazar el cambio de turno" });
    const confirmar = within(dialogo).getByRole("button", { name: "Rechazar" });
    expect(confirmar).toBeDisabled();

    await userEvent.type(within(dialogo).getByLabelText(/Comentario/), "   ");
    expect(confirmar).toBeDisabled();

    await userEvent.type(within(dialogo).getByLabelText(/Comentario/), "No hay cobertura");
    await userEvent.click(confirmar);

    expect(supabase.rpc).toHaveBeenCalledWith("revisar_solicitud_turno", {
      p_solicitud: "t1",
      p_aprobar: false,
      p_comentario: "No hay cobertura",
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Cambio de turno rechazado" }));
  });

  it("si falla la revisión avisa y deja el diálogo abierto", async () => {
    conPermisos("turnos.aprobar");
    vi.mocked(supabase.rpc).mockImplementation((async (nombre: string) =>
      nombre === "solicitudes_turno_detalle"
        ? { data: SOLICITUDES, error: null }
        : { data: null, error: { message: "La solicitud ya no está pendiente" } }) as never);
    renderConQuery(<BandejaTurnos />);
    await screen.findByText(/^Laura Gómez/);

    await userEvent.click(within(tarjetaDe("Laura Gómez")).getByRole("button", { name: /Aprobar/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aprobar" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "La solicitud ya no está pendiente", variant: "destructive" })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
