import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import BandejaCursos from "./BandejaCursos";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const solicitud = (datos: Record<string, unknown>) => ({
  id: "i1",
  curso_id: "c1",
  curso_titulo: "Excel avanzado",
  curso_fecha_inicio: "2026-11-10",
  curso_fecha_fin: "2026-11-12",
  curso_cancelado: false,
  empleado_id: "e1",
  empleado_nombre: "Laura Gómez",
  departamento: "Operaciones",
  estado: "pendiente",
  motivo: "Lo uso a diario",
  created_at: "2026-10-01T09:00:00Z",
  revisado_por_nombre: null,
  fecha_revision: null,
  comentario_revision: null,
  es_mia: false,
  ...datos,
});

const SOLICITUDES = [
  solicitud({ id: "i1" }),
  solicitud({ id: "i2", empleado_nombre: "Ramón Pérez", es_mia: true }),
  solicitud({ id: "i3", empleado_nombre: "Pablo Sanz", curso_id: "c2", curso_titulo: "Primeros auxilios", estado: "aprobada" }),
];

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

describe("Bandeja de inscripciones a cursos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ bandeja_cursos: SOLICITUDES, revisar_inscripcion_curso: null }) as never
    );
  });

  it("sin el permiso no consulta nada", () => {
    conPermisos();
    renderConQuery(<BandejaCursos />);
    expect(screen.getByText("No tienes acceso a las inscripciones a cursos")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("muestra las pendientes y nadie revisa las suyas", async () => {
    conPermisos("cursos.gestionar");
    renderConQuery(<BandejaCursos />);
    expect(await screen.findByText("Laura Gómez")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pendientes (2)" })).toBeInTheDocument();
    expect(screen.queryByText("Pablo Sanz")).not.toBeInTheDocument();
    expect(screen.getByText("Es tu solicitud: la revisará otra persona con permiso.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Aprobar" })).toHaveLength(1);
  });

  it("rechaza una solicitud con un comentario", async () => {
    conPermisos("cursos.gestionar");
    renderConQuery(<BandejaCursos />);
    await userEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText(/Motivo del rechazo/), "No hay presupuesto este trimestre");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Rechazar" }));

    expect(supabase.rpc).toHaveBeenCalledWith("revisar_inscripcion_curso", {
      p_inscripcion: "i1",
      p_aprobar: false,
      p_comentario: "No hay presupuesto este trimestre",
    });
  });

  it("no tiene problemas de accesibilidad", async () => {
    conPermisos("cursos.gestionar");
    renderConQuery(<BandejaCursos />);
    await screen.findByText("Laura Gómez");
    await expectSinViolaciones();
  });
});
