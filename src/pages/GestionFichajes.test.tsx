import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { descargarCsv, type Fichaje } from "@/components/fichajes/calculo";
import type { Database } from "@/integrations/supabase/types";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import GestionFichajes from "./GestionFichajes";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));
// El cálculo es el real; solo se intercepta la descarga del CSV
vi.mock("@/components/fichajes/calculo", async (original) => ({
  ...(await original<typeof import("@/components/fichajes/calculo")>()),
  descargarCsv: vi.fn(),
}));

type Correccion = Database["public"]["Tables"]["fichaje_correcciones"]["Row"];

const MI_ID = "yo";
// Miércoles; "esta semana" va del lunes 5 al domingo 11 de octubre
const AHORA = new Date("2026-10-07T11:00:00");

const PLANTILLA = [
  { id: "e1", nombre: "Laura Gómez", departamento_id: "d1", departamento: "Marketing" },
  { id: "e2", nombre: "Pablo Sanz", departamento_id: "d2", departamento: "Finanzas" },
  { id: "e3", nombre: "Marta Ruiz", departamento_id: null, departamento: null },
  { id: MI_ID, nombre: "Yo Misma", departamento_id: "d1", departamento: "Marketing" },
];

let n = 0;
const fichaje = (empleado_id: string, tipo: "entrada" | "salida", local: string, extra: Partial<Fichaje> = {}): Fichaje => ({
  id: `f${++n}`,
  empleado_id,
  tipo,
  fecha_hora: new Date(local).toISOString(),
  es_manual: false,
  anulado: false,
  fecha_hora_original: null,
  justificacion: null,
  ...extra,
});

const iso = (local: string) => new Date(local).toISOString();

const fichajesIniciales = (): Fichaje[] => [
  // Laura: solo entra en "este mes"
  fichaje("e1", "entrada", "2026-10-01T09:00:00"),
  fichaje("e1", "salida", "2026-10-01T10:00:00"),
  // Laura: lunes 5 h, martes 4 h 30 (entrada corregida) y hoy sigue trabajando
  fichaje("e1", "entrada", "2026-10-05T09:00:00"),
  fichaje("e1", "salida", "2026-10-05T14:00:00"),
  fichaje("e1", "entrada", "2026-10-06T09:00:00", {
    fecha_hora_original: iso("2026-10-06T09:15:00"),
    justificacion: "Olvidó fichar a tiempo",
  }),
  fichaje("e1", "salida", "2026-10-06T13:30:00"),
  fichaje("e1", "entrada", "2026-10-07T08:30:00"),
  // Pablo: el lunes se le olvidó la salida; el martes tiene un fichaje anulado; hoy ya salió
  fichaje("e2", "entrada", "2026-10-05T09:00:00"),
  fichaje("e2", "entrada", "2026-10-06T09:00:00", { anulado: true, justificacion: "Fichaje duplicado" }),
  fichaje("e2", "entrada", "2026-10-07T08:00:00"),
  fichaje("e2", "salida", "2026-10-07T10:00:00"),
];

const CORRECCIONES: Correccion[] = [
  {
    id: "c1",
    accion: "modificacion",
    tipo: "entrada",
    empleado_id: "e1",
    fichaje_id: "f5",
    autor_id: "a1",
    fecha_hora_anterior: iso("2026-10-06T09:15:00"),
    fecha_hora_nueva: iso("2026-10-06T09:00:00"),
    justificacion: "Olvidó fichar a tiempo",
    created_at: iso("2026-10-06T12:00:00"),
  },
];

let fichajes: Fichaje[] = [];
let correcciones: { data: Correccion[] | null; error: { message: string } | null };
let llamadas: { tabla: string; metodo: string; args: unknown[] }[] = [];

// Constructor de consultas encadenable: aplica eq/gte/lte sobre los datos simulados
function tabla(nombre: string) {
  const eq: [string, unknown][] = [];
  const rango: { gte?: string; lte?: string } = {};
  const resolver = () => {
    if (nombre === "fichaje_correcciones") return correcciones;
    const data = fichajes
      .filter((f) => eq.every(([campo, valor]) => f[campo as keyof Fichaje] === valor))
      .filter((f) => (!rango.gte || f.fecha_hora >= rango.gte) && (!rango.lte || f.fecha_hora <= rango.lte))
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
    return { data, error: null };
  };
  const consulta = {
    select: (...args: unknown[]) => anotar("select", args),
    eq: (campo: string, valor: unknown) => (eq.push([campo, valor]), anotar("eq", [campo, valor])),
    gte: (_campo: string, valor: string) => ((rango.gte = valor), anotar("gte", [_campo, valor])),
    lte: (_campo: string, valor: string) => ((rango.lte = valor), anotar("lte", [_campo, valor])),
    or: (...args: unknown[]) => anotar("or", args),
    order: (...args: unknown[]) => anotar("order", args),
    then: (ok: (r: ReturnType<typeof resolver>) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(ok, ko),
  };
  function anotar(metodo: string, args: unknown[]) {
    llamadas.push({ tabla: nombre, metodo, args });
    return consulta;
  }
  return consulta;
}

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

const filaDe = (nombre: string) => screen.getByText(nombre).closest("tr") as HTMLElement;
const celdas = (nombre: string) => within(filaDe(nombre)).getAllByRole("cell").map((c) => c.textContent);
// Las tarjetas de arriba (el texto "Sin fichar hoy" también sale en la tabla, en un span)
const indicador = (etiqueta: string) => screen.getByText(etiqueta, { selector: "div" }).previousElementSibling?.textContent;
const desdesDeFichajes = () => llamadas.filter((l) => l.tabla === "fichajes" && l.metodo === "gte").map((l) => l.args[1]);

describe("Fichajes de la plantilla", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(AHORA);
    toast.mockReset();
    fichajes = fichajesIniciales();
    correcciones = { data: CORRECCIONES, error: null };
    llamadas = [];
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
    vi.mocked(supabase.from).mockImplementation(tabla as never);
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({
        plantilla_fichajes: PLANTILLA,
        autores_correcciones_fichajes: [{ id: "a1", nombre: "Elena Ramos" }],
        anadir_fichaje_manual: (args?: Record<string, unknown>) => {
          const a = args as { p_empleado: string; p_tipo: string; p_fecha_hora: string };
          fichajes.push({ id: "nuevo", empleado_id: a.p_empleado, tipo: a.p_tipo, fecha_hora: a.p_fecha_hora, es_manual: true });
          return null;
        },
      }) as never
    );
  });
  afterEach(() => vi.useRealTimers());

  it("sin el permiso no consulta nada y muestra el aviso", () => {
    conPermisos("fichajes.editar");
    renderConQuery(<GestionFichajes />);
    expect(screen.getByText("No tienes acceso a los fichajes de la plantilla")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("resume por empleado las horas, los días y las incidencias de la semana", async () => {
    conPermisos("fichajes.ver_todos");
    renderConQuery(<GestionFichajes />);
    await screen.findByText("Laura Gómez");

    // Empleado, Ahora, Días, Horas, Media diaria, Incidencias, (detalle)
    expect(celdas("Laura Gómez")).toEqual([
      "Laura GómezMarketing", "Trabajando desde las 08:30", "3", "9 h 30 min", "3 h 10 min", "—", "",
    ]);
    // El fichaje anulado no cuenta
    expect(celdas("Pablo Sanz")).toEqual([
      "Pablo SanzFinanzas", "Salió a las 10:00", "2", "2 h 00 min", "1 h 00 min", "1 incompleto", "",
    ]);
    expect(celdas("Marta Ruiz")).toEqual([
      "Marta RuizSin departamento", "Sin fichar hoy", "0", "0 h 00 min", "—", "—", "",
    ]);

    expect(indicador("Trabajando ahora")).toBe("1");
    expect(indicador("Han fichado hoy")).toBe("2");
    expect(indicador("Sin fichar hoy")).toBe("2");
    expect(indicador("Incidencias del periodo")).toBe("1");
    expect(screen.getByText(/Total del periodo/)).toHaveTextContent("11 h 30 min");

    // Pide los fichajes de lunes a domingo, y aparte los de hoy
    expect(desdesDeFichajes()).toEqual(expect.arrayContaining([iso("2026-10-05T00:00:00"), iso("2026-10-07T00:00:00")]));
    expect(llamadas).toContainEqual({ tabla: "fichajes", metodo: "lte", args: ["fecha_hora", iso("2026-10-11T23:59:59.999")] });
  });

  it("al desplegar un empleado muestra sus tramos por día y las correcciones con su autor", async () => {
    conPermisos("fichajes.ver_todos");
    renderConQuery(<GestionFichajes />);
    await userEvent.click(await screen.findByText("Laura Gómez"));

    expect(screen.getByRole("button", { name: /^Laura Gómez/ })).toHaveAttribute("aria-expanded", "true");
    const detalle = filaDe("Laura Gómez").nextElementSibling as HTMLElement;
    const dias = within(detalle).getAllByRole("listitem").slice(0, 3).map((li) => li.textContent);
    expect(dias).toEqual([
      "mié 7 oct08:30 – ahora0 h 00 min",
      "mar 6 oct09:00 – 13:304 h 30 min",
      "lun 5 oct09:00 – 14:005 h 00 min",
    ]);
    expect(within(detalle).getByText("09:00 – 13:30", { exact: false })).toHaveAttribute(
      "title",
      "Corregido: Olvidó fichar a tiempo"
    );
    expect(within(detalle).getByText("Correcciones del periodo")).toBeInTheDocument();
    expect(within(detalle).getByText("Cambiada entrada: 6 oct 09:15 → 09:00").parentElement).toHaveTextContent(
      "«Olvidó fichar a tiempo» · Elena Ramos, 6 oct 2026 12:00"
    );
    // Sin permiso de edición no se ofrece corregir
    expect(within(detalle).queryByRole("button", { name: /Corregir|Añadir fichajes olvidados/ })).not.toBeInTheDocument();

    // La salida que falta se marca como incidencia
    await userEvent.click(screen.getByText("Pablo Sanz"));
    expect(screen.getByRole("button", { name: /^Laura Gómez/ })).toHaveAttribute("aria-expanded", "false");
    const detallePablo = filaDe("Pablo Sanz").nextElementSibling as HTMLElement;
    expect(within(detallePablo).getByText("09:00 – ¿?", { exact: false })).toHaveAttribute("title", "Falta la salida");
  });

  it("una modificación sin hora nueva no rompe la página", async () => {
    conPermisos("fichajes.ver_todos");
    correcciones = { data: [{ ...CORRECCIONES[0], fecha_hora_nueva: null }], error: null };
    renderConQuery(<GestionFichajes />);
    await userEvent.click(await screen.findByText("Laura Gómez"));

    expect(screen.getByText("Cambiada entrada: 6 oct 09:15 → —")).toBeInTheDocument();
  });

  it("avisa si no se pueden cargar las correcciones, sin dejar de mostrar los fichajes", async () => {
    conPermisos("fichajes.ver_todos");
    correcciones = { data: null, error: { message: "permission denied" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<GestionFichajes />);

    expect(await screen.findByText("Laura Gómez")).toBeInTheDocument();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar las correcciones de los fichajes", variant: "destructive" })
      )
    );
  });

  it("filtra por departamento y por nombre, y los indicadores siguen al filtro", async () => {
    conPermisos("fichajes.ver_todos");
    renderConQuery(<GestionFichajes />);
    await screen.findByText("Laura Gómez");

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos los departamentos", "Finanzas", "Marketing"]);
    await userEvent.click(screen.getByRole("option", { name: "Finanzas" }));

    expect(screen.getByText("Pablo Sanz")).toBeInTheDocument();
    expect(screen.queryByText("Laura Gómez")).not.toBeInTheDocument();
    expect(indicador("Trabajando ahora")).toBe("0");
    expect(indicador("Sin fichar hoy")).toBe("0");
    expect(screen.getByText(/Total del periodo/)).toHaveTextContent("2 h 00 min");

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar por departamento" }));
    await userEvent.click(screen.getByRole("option", { name: "Todos los departamentos" }));
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado..."), "  MARTA ");
    expect(screen.getByText("Marta Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Pablo Sanz")).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Buscar empleado..."), "xyz");
    expect(screen.getByText("No hay empleados que coincidan")).toBeInTheDocument();
  });

  it("cambia el periodo y avisa de un rango personalizado imposible", async () => {
    conPermisos("fichajes.ver_todos");
    renderConQuery(<GestionFichajes />);
    await screen.findByText("Laura Gómez");

    await userEvent.click(screen.getByRole("radio", { name: "Este mes" }));
    await waitFor(() => expect(celdas("Laura Gómez")[3]).toBe("10 h 30 min"));
    expect(desdesDeFichajes()).toContain(iso("2026-10-01T00:00:00"));
    expect(screen.getByText("1 oct – 31 oct 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-02" } });
    expect(screen.getByText("La fecha de inicio es posterior a la de fin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
    expect(screen.queryByText(/Total del periodo/)).not.toBeInTheDocument();
    // Con el rango al revés no se lanza ninguna consulta con ese rango
    expect(desdesDeFichajes()).not.toContain(iso("2026-10-08T00:00:00"));
  });

  it("añade la salida olvidada con su justificación y recarga los fichajes", async () => {
    conPermisos("fichajes.ver_todos", "fichajes.editar");
    renderConQuery(<GestionFichajes />);
    await userEvent.click(await screen.findByText("Pablo Sanz"));

    const detalle = filaDe("Pablo Sanz").nextElementSibling as HTMLElement;
    const lunes = within(detalle).getByText("lun 5 oct").closest("li") as HTMLElement;
    await userEvent.click(within(lunes).getByRole("button", { name: "Corregir" }));

    const dialogo = await screen.findByRole("dialog", { name: "Corregir fichajes" });
    expect(await within(dialogo).findByLabelText("Hora de entrada")).toHaveValue("09:00");
    expect(llamadas).toContainEqual({ tabla: "fichajes", metodo: "eq", args: ["empleado_id", "e2"] });

    await userEvent.click(within(dialogo).getByRole("button", { name: "Añadir fichaje" }));
    // Tras una entrada propone una salida
    expect(within(dialogo).getByLabelText("Tipo de fichaje")).toHaveValue("salida");
    fireEvent.change(within(dialogo).getByLabelText("Hora del nuevo fichaje"), { target: { value: "17:00" } });
    const guardar = within(dialogo).getByRole("button", { name: "Guardar correcciones" });
    await userEvent.type(within(dialogo).getByLabelText(/Justificación/), "Corto");
    expect(guardar).toBeDisabled();
    await userEvent.type(within(dialogo).getByLabelText(/Justificación/), " y olvidado al salir");
    await userEvent.click(guardar);

    expect(supabase.rpc).toHaveBeenCalledWith("anadir_fichaje_manual", {
      p_empleado: "e2",
      p_tipo: "salida",
      p_fecha_hora: iso("2026-10-05T17:00:00"),
      p_justificacion: "Corto y olvidado al salir",
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Fichajes corregidos" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // La tabla se recarga: ya no hay incidencia y suma las 8 horas del lunes
    await waitFor(() => expect(celdas("Pablo Sanz")[3]).toBe("10 h 00 min"));
    expect(celdas("Pablo Sanz")[5]).toBe("—");
  });

  it("nadie puede corregir sus propios fichajes", async () => {
    conPermisos("fichajes.ver_todos", "fichajes.editar");
    renderConQuery(<GestionFichajes />);

    await userEvent.click(await screen.findByText("Yo Misma"));
    const mio = filaDe("Yo Misma").nextElementSibling as HTMLElement;
    expect(within(mio).getByText("Sin fichajes en este periodo.")).toBeInTheDocument();
    expect(within(mio).queryByRole("button", { name: "Añadir fichajes olvidados" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Marta Ruiz"));
    const otro = filaDe("Marta Ruiz").nextElementSibling as HTMLElement;
    await userEvent.click(within(otro).getByRole("button", { name: "Añadir fichajes olvidados" }));
    // Por defecto propone hoy, que es el último día no futuro de la semana
    expect(await screen.findByLabelText("Día")).toHaveValue("2026-10-07");
  });

  it("exporta al CSV los fichajes de los empleados visibles, con su estado y motivo", async () => {
    conPermisos("fichajes.ver_todos");
    renderConQuery(<GestionFichajes />);
    await screen.findByText("Laura Gómez");
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado..."), "pablo");

    await userEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    expect(descargarCsv).toHaveBeenCalledWith("fichajes_2026-10-05_2026-10-11.csv", [
      ["Empleado", "Departamento", "Fecha", "Hora", "Tipo", "Estado", "Hora original", "Justificación"],
      ["Pablo Sanz", "Finanzas", "05/10/2026", "09:00:00", "Entrada", "Original", "", ""],
      ["Pablo Sanz", "Finanzas", "06/10/2026", "09:00:00", "Entrada", "Anulado", "", "Fichaje duplicado"],
      ["Pablo Sanz", "Finanzas", "07/10/2026", "08:00:00", "Entrada", "Original", "", ""],
      ["Pablo Sanz", "Finanzas", "07/10/2026", "10:00:00", "Salida", "Original", "", ""],
    ]);

    await userEvent.clear(screen.getByPlaceholderText("Buscar empleado..."));
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado..."), "laura");
    await userEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(vi.mocked(descargarCsv).mock.calls[1][1]).toContainEqual([
      "Laura Gómez", "Marketing", "06/10/2026", "09:00:00", "Entrada", "Hora modificada", "09:15:00", "Olvidó fichar a tiempo",
    ]);
  });

  it("si falla la carga de la plantilla avisa con un error", async () => {
    conPermisos("fichajes.ver_todos");
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ autores_correcciones_fichajes: [] }) as never
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<GestionFichajes />);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar los fichajes", variant: "destructive" })
      )
    );
    expect(await screen.findByText("No hay empleados que coincidan")).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    conPermisos("fichajes.ver_todos", "fichajes.editar");
    renderConQuery(<GestionFichajes />);
    await userEvent.click(await screen.findByText("Pablo Sanz"));
    await expectSinViolaciones();

    const detalle = filaDe("Pablo Sanz").nextElementSibling as HTMLElement;
    const lunes = within(detalle).getByText("lun 5 oct").closest("li") as HTMLElement;
    await userEvent.click(within(lunes).getByRole("button", { name: "Corregir" }));
    const dialogo = await screen.findByRole("dialog", { name: "Corregir fichajes" });
    await within(dialogo).findByLabelText("Hora de entrada");
    await expectSinViolaciones();
  });
});
