import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, format } from "date-fns";
import { MemoryRouter } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Cursos from "./Cursos";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: () => ({ empleadoId: "e-yo", loading: false }) }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

// Fechas relativas a hoy: así las fases del curso no dependen del día del test
const dia = (dias: number) => format(addDays(new Date(), dias), "yyyy-MM-dd");

const curso = (datos: Record<string, unknown>) => ({
  id: "c1",
  titulo: "Excel avanzado",
  descripcion: "Tablas dinámicas y macros",
  modalidad: "presencial",
  lugar: "Sala 2",
  enlace: null,
  fecha_inicio: dia(20),
  fecha_fin: dia(21),
  horas: 8,
  certificado: true,
  plazo_inscripcion: dia(10),
  cancelado: false,
  creado_por: null,
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  ...datos,
});

const CURSOS = [
  curso({ id: "c1" }),
  curso({ id: "c2", titulo: "Seguridad informática", modalidad: "online", lugar: null, enlace: "https://teams.example.com/s" }),
  curso({ id: "c3", titulo: "Primeros auxilios", fecha_inicio: dia(-30), fecha_fin: dia(-29), plazo_inscripcion: null }),
];

let inscripciones: Record<string, unknown>[] = [];

function simularTablas() {
  vi.mocked(supabase.from).mockImplementation(((tabla: string) => {
    const datos = tabla === "cursos" ? CURSOS : inscripciones;
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: datos, error: null }).then(ok),
    };
    return consulta;
  }) as never);
}

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

const pintar = () =>
  renderConQuery(
    <MemoryRouter>
      <Cursos />
    </MemoryRouter>
  );

describe("Inscripción a cursos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inscripciones = [];
    simularTablas();
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({ solicitar_curso: "i-nueva", cancelar_inscripcion_curso: null }) as never);
    conPermisos();
  });

  it("muestra los próximos cursos y deja los terminados en Anteriores", async () => {
    pintar();
    expect(await screen.findByRole("heading", { name: "Excel avanzado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seguridad informática" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Primeros auxilios" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Anteriores/ }));
    expect(await screen.findByRole("heading", { name: "Primeros auxilios" })).toBeInTheDocument();
  });

  it("el empleado pide plaza con un motivo", async () => {
    pintar();
    await screen.findByRole("heading", { name: "Excel avanzado" });
    await userEvent.click(screen.getAllByRole("button", { name: "Pedir plaza" })[0]);
    await userEvent.type(screen.getByLabelText("Por qué te interesa (opcional)"), "Lo uso a diario");
    await userEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(supabase.rpc).toHaveBeenCalledWith("solicitar_curso", { p_curso: "c1", p_motivo: "Lo uso a diario" });
  });

  it("con la solicitud aprobada ve el enlace de la sesión online y puede cancelarla", async () => {
    inscripciones = [
      { id: "i1", curso_id: "c2", empleado_id: "e-yo", estado: "aprobada", motivo: null, comentario_revision: "¡Bienvenida!" },
    ];
    pintar();
    const enlace = await screen.findByRole("link", { name: /Unirse a la sesión/ });
    expect(enlace).toHaveAttribute("href", "https://teams.example.com/s");
    expect(screen.getByText("«¡Bienvenida!»")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar mi solicitud" }));
    const dialogo = screen.getByRole("alertdialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar solicitud" }));
    expect(supabase.rpc).toHaveBeenCalledWith("cancelar_inscripcion_curso", { p_inscripcion: "i1" });
  });

  it("sin la solicitud aprobada no ve el enlace de la sesión", async () => {
    inscripciones = [{ id: "i1", curso_id: "c2", empleado_id: "e-yo", estado: "pendiente", motivo: null, comentario_revision: null }];
    pintar();
    await screen.findByRole("heading", { name: "Seguridad informática" });
    expect(screen.queryByRole("link", { name: /Unirse a la sesión/ })).not.toBeInTheDocument();
    // Con la solicitud pendiente ya no puede volver a pedir plaza en ese curso
    expect(screen.getAllByRole("button", { name: "Pedir plaza" })).toHaveLength(1);
  });

  it("solo quien gestiona cursos ve las acciones de gestión", async () => {
    pintar();
    await screen.findByRole("heading", { name: "Excel avanzado" });
    expect(screen.queryByRole("button", { name: "Nuevo curso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar «Excel avanzado»" })).not.toBeInTheDocument();
  });

  it("quien gestiona cursos crea, edita y revisa inscripciones", async () => {
    conPermisos("cursos.gestionar");
    pintar();
    await screen.findByRole("heading", { name: "Excel avanzado" });
    expect(screen.getByRole("button", { name: "Nuevo curso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar inscripciones" })).toHaveAttribute("href", "/bandeja-cursos");
    expect(screen.getByRole("button", { name: "Editar «Excel avanzado»" })).toBeInTheDocument();
    // Quien gestiona ve el enlace aunque no esté inscrito
    expect(screen.getByRole("link", { name: /Unirse a la sesión/ })).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    pintar();
    await screen.findByRole("heading", { name: "Excel avanzado" });
    await expectSinViolaciones();
  });
});

