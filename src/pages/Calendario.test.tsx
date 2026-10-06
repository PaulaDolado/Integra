import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { renderConQuery } from "@/test/render";
import { MemoryRouter } from "react-router";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Calendario from "./Calendario";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useEmployeeProfile", () => ({ useEmployeeProfile: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

// "Hoy" en los tests: miércoles 7 de octubre de 2026 a las 10:00 (hora local)
const AHORA = new Date(2026, 9, 7, 10, 0);
const iso = (...partes: [number, number, number, number?, number?]) => new Date(...partes).toISOString();

interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
  es_privado: boolean;
  creador_id: string;
}

const evento = (datos: Partial<Evento>): Evento => ({
  id: "ev1",
  titulo: "Reunión de equipo",
  descripcion: null,
  fecha_inicio: iso(2026, 9, 7, 9, 0),
  fecha_fin: iso(2026, 9, 7, 10, 30),
  ubicacion: null,
  es_privado: false,
  creador_id: "emp1",
  ...datos,
});

// Cada llamada a supabase.from() deja aquí la cadena de métodos que se le aplicó
type Cadena = [string, ...unknown[]][];
let consultas: Cadena[];
let eventos: Evento[];
let proximos: Evento[];
let errorLectura: { message: string } | null;
let errorEscritura: { message: string } | null;
// Filas que devuelve un update o delete: 0 si la base de datos no deja tocar el evento
let filasAfectadas: number;

const responder = (cadena: Cadena) => {
  const metodos = cadena.map(([m]) => m);
  if (metodos.some((m) => m === "insert" || m === "update" || m === "delete")) {
    if (errorEscritura) return { data: null, error: errorEscritura };
    return { data: metodos.includes("insert") ? null : Array.from({ length: filasAfectadas }, () => ({ id: "ev1" })), error: null };
  }
  if (metodos.includes("limit")) return { data: proximos, error: null };
  return { data: errorLectura ? null : eventos, error: errorLectura };
};

function tabla() {
  const cadena: Cadena = [];
  consultas.push(cadena);
  const paso = (metodo: string) => (...args: unknown[]) => {
    cadena.push([metodo, ...args]);
    return builder;
  };
  const builder = {
    select: paso("select"),
    lte: paso("lte"),
    gte: paso("gte"),
    order: paso("order"),
    limit: paso("limit"),
    insert: paso("insert"),
    update: paso("update"),
    delete: paso("delete"),
    eq: paso("eq"),
    then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(responder(cadena)).then(ok, ko),
  };
  return builder;
}

// Sin Google Calendar conectado salvo que el test diga otra cosa
let conexionGoogle: { email: string | null; conectado_en: string }[];
let eventosGoogle: Record<string, unknown>[];

const pintar = (ruta = "/calendario") =>
  renderConQuery(
    <MemoryRouter initialEntries={[ruta]}>
      <Calendario />
    </MemoryRouter>
  );

// Consultas del rango visible (las que no son de "próximos" ni escrituras)
const consultasDeRango = () =>
  consultas.filter((c) => c.some(([m]) => m === "lte") && !c.some(([m]) => m === "limit"));
const escrituras = (metodo: string) => consultas.filter((c) => c.some(([m]) => m === metodo));

// La rejilla horaria pinta 168 huecos con botón: con toda la batería en paralelo,
// cada clic puede tardar varios segundos en volver a renderizarse
describe("Calendario", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(AHORA);
    toast.mockReset();
    consultas = [];
    eventos = [evento({})];
    proximos = [evento({ ubicacion: "Sala Azul" })];
    errorLectura = null;
    errorEscritura = null;
    filasAfectadas = 1;
    vi.mocked(supabase.from).mockImplementation(tabla as never);
    conexionGoogle = [];
    eventosGoogle = [];
    vi.mocked(supabase.rpc).mockImplementation((async (nombre: string) =>
      nombre === "mi_conexion_google_calendar" ? { data: conexionGoogle, error: null } : { data: null, error: { message: nombre } }) as never);
    vi.mocked(supabase.functions.invoke).mockImplementation((async () => ({
      data: { conectado: true, email: "laura@empresa.test", eventos: eventosGoogle },
      error: null,
    })) as never);
    vi.mocked(useAuth).mockReturnValue({ user: { id: "u1" } } as ReturnType<typeof useAuth>);
    vi.mocked(useEmployeeProfile).mockReturnValue({ profile: { id: "emp1" } } as ReturnType<typeof useEmployeeProfile>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("abre en la semana actual, pide de lunes a domingo y muestra los eventos", async () => {
    pintar();

    expect(screen.getByText("5 oct – 11 oct 2026")).toBeInTheDocument();
    expect(await screen.findAllByText("Reunión de equipo")).toHaveLength(2); // rejilla y próximos
    expect(screen.getByText("Sala Azul")).toBeInTheDocument();
    expect(screen.getByText(/Hoy · 09:00 – 10:30/)).toBeInTheDocument();

    expect(supabase.from).toHaveBeenCalledWith("eventos");
    expect(consultasDeRango()[0]).toEqual([
      ["select", "*"],
      ["lte", "fecha_inicio", new Date(2026, 9, 11, 23, 59, 59, 999).toISOString()],
      ["gte", "fecha_fin", iso(2026, 9, 5)],
      ["order", "fecha_inicio", { ascending: true }],
    ]);
    const proxima = consultas.find((c) => c.some(([m]) => m === "limit"));
    expect(proxima).toEqual([
      ["select", "*"],
      ["gte", "fecha_fin", AHORA.toISOString()],
      ["order", "fecha_inicio", { ascending: true }],
      ["limit", 5],
    ]);
  });

  it("navega entre semanas y vuelve a hoy, pidiendo el nuevo rango", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("12 oct – 18 oct 2026")).toBeInTheDocument();
    await waitFor(() => expect(consultasDeRango()).toHaveLength(2));
    expect(consultasDeRango()[1]).toContainEqual(["gte", "fecha_fin", iso(2026, 9, 12)]);

    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText(/^28 sept? – 4 oct 2026$/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(screen.getByText("5 oct – 11 oct 2026")).toBeInTheDocument();
  });

  it("cambia entre las vistas de día, mes y año", async () => {
    eventos = [evento({}), evento({ id: "ev2", titulo: "Formación", fecha_inicio: iso(2026, 9, 20, 9), fecha_fin: iso(2026, 9, 20, 11) })];
    pintar();
    await screen.findAllByText("Reunión de equipo");

    await userEvent.click(screen.getByRole("radio", { name: "Vista diaria" }));
    expect(screen.getByText("Miércoles, 7 de octubre 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Jueves, 8 de octubre 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Vista mensual" }));
    expect(screen.getByText("Octubre 2026")).toBeInTheDocument();
    // La rejilla del mes empieza el lunes anterior al día 1
    await waitFor(() =>
      expect(consultasDeRango().at(-1)).toContainEqual(["gte", "fecha_fin", iso(2026, 8, 28)])
    );

    await userEvent.click(screen.getByRole("radio", { name: "Vista anual" }));
    expect(screen.getByText("2026")).toBeInTheDocument();
    await waitFor(() =>
      expect(consultasDeRango().at(-1)).toContainEqual(["gte", "fecha_fin", iso(2026, 0, 1)])
    );
    const octubre = await screen.findByRole("button", { name: /Octubre/ });
    expect(within(octubre).getByText("2 eventos")).toBeInTheDocument();

    // Pulsar un mes del año lleva a la vista mensual de ese mes
    await userEvent.click(screen.getByRole("button", { name: /^Marzo/ }));
    expect(screen.getByText("Marzo 2026")).toBeInTheDocument();
  });

  it("en la vista de mes agrupa lo que no cabe en «+N más» y abre ese día", async () => {
    eventos = ["A", "B", "C", "D"].map((letra, i) =>
      evento({ id: `m${i}`, titulo: `Visita ${letra}`, fecha_inicio: iso(2026, 9, 14, 9 + i), fecha_fin: iso(2026, 9, 14, 10 + i) })
    );
    pintar();
    await userEvent.click(screen.getByRole("radio", { name: "Vista mensual" }));

    expect(await screen.findByText("Visita C")).toBeInTheDocument();
    expect(screen.queryByText("Visita D")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+1 más" }));

    expect(screen.getByText("Miércoles, 14 de octubre 2026")).toBeInTheDocument();
    expect(screen.getByText("Visita D")).toBeInTheDocument();
  });

  it("crea un evento con los datos del formulario y el creador del perfil", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");

    await userEvent.click(screen.getByRole("button", { name: /Nuevo Evento/ }));
    const dialogo = screen.getByRole("dialog", { name: "Crear Nuevo Evento" });
    // Se propone la siguiente hora en punto, con una hora de duración
    expect(within(dialogo).getByLabelText("Inicio")).toHaveValue("2026-10-07T11:00");
    expect(within(dialogo).getByLabelText("Fin")).toHaveValue("2026-10-07T12:00");

    await userEvent.type(within(dialogo).getByLabelText("Título del evento"), "Revisión trimestral");
    await userEvent.type(within(dialogo).getByLabelText("Ubicación (opcional)"), "Sala Verde");
    await userEvent.click(within(dialogo).getByLabelText("Evento privado"));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear Evento" }));

    const [insercion] = escrituras("insert");
    expect(insercion).toEqual([
      [
        "insert",
        [
          {
            titulo: "Revisión trimestral",
            descripcion: null,
            fecha_inicio: iso(2026, 9, 7, 11),
            fecha_fin: iso(2026, 9, 7, 12),
            ubicacion: "Sala Verde",
            es_privado: true,
            creador_id: "emp1",
          },
        ],
      ],
    ]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Evento creado" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(consultasDeRango()).toHaveLength(2));
  });

  it("al pulsar un hueco de la rejilla propone esa hora", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");

    // Jueves (cuarta columna) a las 15:00
    await userEvent.click(screen.getAllByTitle("Crear evento")[3 * 24 + 15]);
    const dialogo = screen.getByRole("dialog", { name: "Crear Nuevo Evento" });
    expect(within(dialogo).getByLabelText("Inicio")).toHaveValue("2026-10-08T15:00");
    expect(within(dialogo).getByLabelText("Fin")).toHaveValue("2026-10-08T16:00");
  });

  it("no crea el evento si el fin no es posterior al inicio", async () => {
    pintar();
    await userEvent.click(screen.getByRole("button", { name: /Nuevo Evento/ }));
    const dialogo = screen.getByRole("dialog", { name: "Crear Nuevo Evento" });

    await userEvent.type(within(dialogo).getByLabelText("Título del evento"), "Al revés");
    fireEvent.change(within(dialogo).getByLabelText("Fin"), { target: { value: "2026-10-07T10:30" } });
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear Evento" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Datos no válidos", variant: "destructive" }));
    expect(escrituras("insert")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sin perfil de empleado avisa y no crea nada", async () => {
    vi.mocked(useEmployeeProfile).mockReturnValue({ profile: null } as ReturnType<typeof useEmployeeProfile>);
    pintar();
    await userEvent.click(screen.getByRole("button", { name: /Nuevo Evento/ }));
    const dialogo = screen.getByRole("dialog", { name: "Crear Nuevo Evento" });

    await userEvent.type(within(dialogo).getByLabelText("Título del evento"), "Sin perfil");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear Evento" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Perfil de empleado no encontrado", variant: "destructive" })
    );
    expect(escrituras("insert")).toHaveLength(0);
  });

  it("edita un evento existente y guarda solo los campos editables", async () => {
    pintar();
    const [enRejilla] = await screen.findAllByRole("button", { name: /Reunión de equipo/ });

    await userEvent.click(enRejilla);
    const dialogo = screen.getByRole("dialog", { name: "Editar Evento" });
    expect(within(dialogo).getByLabelText("Inicio")).toHaveValue("2026-10-07T09:00");
    expect(within(dialogo).getByLabelText("Fin")).toHaveValue("2026-10-07T10:30");

    const campoTitulo = within(dialogo).getByLabelText("Título del evento");
    await userEvent.clear(campoTitulo);
    await userEvent.type(campoTitulo, "Reunión de planificación");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar Cambios" }));

    expect(escrituras("update")[0]).toEqual([
      [
        "update",
        {
          titulo: "Reunión de planificación",
          descripcion: null,
          ubicacion: null,
          es_privado: false,
          fecha_inicio: iso(2026, 9, 7, 9),
          fecha_fin: iso(2026, 9, 7, 10, 30),
        },
      ],
      ["eq", "id", "ev1"],
      ["select", "id"],
    ]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Evento actualizado" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("elimina el evento abierto tras confirmarlo", async () => {
    pintar();
    const [enRejilla] = await screen.findAllByRole("button", { name: /Reunión de equipo/ });
    await userEvent.click(enRejilla);

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }));
    const confirmacion = screen.getByRole("alertdialog", { name: "¿Eliminar este evento?" });
    expect(escrituras("delete")).toHaveLength(0);

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Eliminar" }));

    expect(escrituras("delete")[0]).toEqual([["delete"], ["eq", "id", "ev1"], ["select", "id"]]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Evento eliminado" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("si falla la eliminación avisa y deja el diálogo abierto", async () => {
    errorEscritura = { message: "permiso denegado" };
    pintar();
    const [enRejilla] = await screen.findAllByRole("button", { name: /Reunión de equipo/ });
    await userEvent.click(enRejilla);

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "No se pudo eliminar el evento", variant: "destructive" })
    );
    // La confirmación sigue abierta para reintentar, y el evento detrás
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Editar Evento")).toBeInTheDocument();
  });

  it("los eventos de otra persona se ven pero no se pueden editar ni borrar", async () => {
    eventos = [evento({ creador_id: "emp9" })];
    pintar();
    const [enRejilla] = await screen.findAllByRole("button", { name: /Reunión de equipo/ });
    await userEvent.click(enRejilla);

    const dialogo = screen.getByRole("dialog", { name: "Detalle del evento" });
    expect(within(dialogo).getByText(/Solo quien creó el evento/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Título del evento")).toBeDisabled();
    expect(within(dialogo).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("button", { name: "Guardar Cambios" })).not.toBeInTheDocument();
  });

  it("si la base de datos no actualiza ninguna fila no dice que se ha guardado", async () => {
    filasAfectadas = 0;
    pintar();
    const [enRejilla] = await screen.findAllByRole("button", { name: /Reunión de equipo/ });
    await userEvent.click(enRejilla);

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar Cambios" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "No se pudo actualizar el evento", variant: "destructive" })
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Evento actualizado" }));
    expect(screen.getByRole("dialog", { name: "Editar Evento" })).toBeInTheDocument();
  });

  it("un evento que acaba a medianoche no aparece en el día siguiente", async () => {
    eventos = [evento({ titulo: "Cena de empresa", fecha_inicio: iso(2026, 9, 7, 21), fecha_fin: iso(2026, 9, 8) })];
    pintar();
    await screen.findAllByText("Cena de empresa");

    await userEvent.click(screen.getByRole("radio", { name: "Vista diaria" }));
    expect(screen.getAllByText("Cena de empresa").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Jueves, 8 de octubre 2026")).toBeInTheDocument();
    expect(screen.queryByText("Cena de empresa")).not.toBeInTheDocument();
  });

  it("en la vista de año cuenta un evento en todos los meses que ocupa", async () => {
    eventos = [evento({ titulo: "Auditoría", fecha_inicio: iso(2026, 9, 28, 9), fecha_fin: iso(2026, 10, 3, 18) })];
    pintar();
    await userEvent.click(screen.getByRole("radio", { name: "Vista anual" }));

    expect(await screen.findByRole("button", { name: /Octubre\s*1 evento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Noviembre\s*1 evento/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Diciembre$/ })).toBeInTheDocument();
  });

  it("muestra el tiempo libre de la semana y crea un evento en un hueco", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");

    const boton = screen.getByRole("button", { name: "Mostrar tiempo libre" });
    expect(boton).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(boton);
    expect(screen.getByRole("button", { name: "Ocultar tiempo libre" })).toHaveAttribute("aria-pressed", "true");

    // Hoy (miércoles, 10:00) desde que acaba la reunión; jueves y viernes enteros.
    // Lunes y martes ya han pasado y el fin de semana no hay jornada.
    const huecos = screen.getAllByRole("button", { name: /^Tiempo libre de/ });
    expect(huecos.map((h) => h.getAttribute("aria-label"))).toEqual([
      "Tiempo libre de 10:30 a 18:00 (7 h 30 min). Crear evento",
      "Tiempo libre de 08:00 a 18:00 (10 h). Crear evento",
      "Tiempo libre de 08:00 a 18:00 (10 h). Crear evento",
    ]);
    expect(screen.getByText(/27 h 30 min libres en 3 huecos/)).toBeInTheDocument();

    await userEvent.click(huecos[0]);
    const dialogo = screen.getByRole("dialog", { name: "Crear Nuevo Evento" });
    expect(within(dialogo).getByLabelText("Inicio")).toHaveValue("2026-10-07T10:30");
  });

  it("al pedir el tiempo libre desde la vista de mes pasa a la semana, y se puede ocultar", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");
    await userEvent.click(screen.getByRole("radio", { name: "Vista mensual" }));

    await userEvent.click(screen.getByRole("button", { name: "Mostrar tiempo libre" }));
    expect(screen.getByText("5 oct – 11 oct 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Tiempo libre de/ })).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Ocultar tiempo libre" }));
    expect(screen.queryByRole("button", { name: /^Tiempo libre de/ })).not.toBeInTheDocument();
  });

  it("sin Google Calendar conectado no pide sus eventos", async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("mi_conexion_google_calendar"));
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("con Google Calendar conectado muestra sus eventos, en solo lectura y ocupando tiempo", async () => {
    conexionGoogle = [{ email: "laura@empresa.test", conectado_en: "2026-10-01T10:00:00Z" }];
    eventosGoogle = [
      {
        id: "g1",
        titulo: "Cita médica",
        descripcion: "Traer la tarjeta",
        ubicacion: "Centro de salud",
        fecha_inicio: iso(2026, 9, 8, 12),
        fecha_fin: iso(2026, 9, 8, 13),
        todo_el_dia: false,
        ocupado: true,
        enlace: "https://www.google.com/calendar/event?eid=g1",
      },
      {
        id: "g2",
        titulo: "Puente",
        descripcion: null,
        ubicacion: null,
        fecha_inicio: iso(2026, 9, 9),
        fecha_fin: iso(2026, 9, 10),
        todo_el_dia: true,
        ocupado: false,
        enlace: null,
      },
    ];
    pintar();

    // Se piden los de Google del rango visible (la semana)
    expect(await screen.findByRole("button", { name: /Cita médica/ })).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledWith("google-calendar", {
      body: { accion: "eventos", desde: iso(2026, 9, 5), hasta: new Date(2026, 9, 11, 23, 59, 59, 999).toISOString() },
    });
    // Los de todo el día van en su propia fila
    expect(screen.getByText("Todo el día")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Puente" })).toBeInTheDocument();

    // Al pulsarlo se ve el detalle, no el editor
    await userEvent.click(screen.getByRole("button", { name: /Cita médica/ }));
    const detalle = screen.getByRole("dialog", { name: "Cita médica" });
    expect(within(detalle).getByText(/Evento de tu Google Calendar/)).toBeInTheDocument();
    expect(within(detalle).getByText("Centro de salud")).toBeInTheDocument();
    expect(within(detalle).getByRole("link", { name: /Abrir en Google Calendar/ })).toHaveAttribute(
      "href",
      "https://www.google.com/calendar/event?eid=g1"
    );
    expect(screen.queryByRole("dialog", { name: "Editar Evento" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    // La cita ocupa tiempo; el puente («Disponible» en Google) no
    await userEvent.click(screen.getByRole("button", { name: "Mostrar tiempo libre" }));
    const huecos = screen.getAllByRole("button", { name: /^Tiempo libre de/ }).map((h) => h.getAttribute("aria-label"));
    expect(huecos).toEqual([
      "Tiempo libre de 10:30 a 18:00 (7 h 30 min). Crear evento",
      "Tiempo libre de 08:00 a 12:00 (4 h). Crear evento",
      "Tiempo libre de 13:00 a 18:00 (5 h). Crear evento",
      "Tiempo libre de 08:00 a 18:00 (10 h). Crear evento",
    ]);
  });

  it("al volver de Google avisa del resultado", async () => {
    pintar("/calendario?google=conectado");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Google Calendar conectado" }))
    );
  });

  it("avisa si no se pueden cargar los eventos", async () => {
    errorLectura = { message: "sin conexión" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    pintar();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar los eventos", variant: "destructive" })
      )
    );
  });

  // axe recorre los 168 huecos de la semana y los 42 días del mes: tarda más de lo normal
  it("no tiene problemas de accesibilidad", { timeout: 60_000 }, async () => {
    pintar();
    await screen.findAllByText("Reunión de equipo");
    await expectSinViolaciones();

    // Los huecos de la rejilla se pueden usar con teclado y dicen qué crean
    expect(screen.getByRole("button", { name: "Crear evento el jueves 8 de octubre a las 15:00" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Vista mensual" }));
    await screen.findByText("Octubre 2026");
    expect(screen.getByRole("button", { name: "Crear evento el jueves 8 de octubre" })).toBeInTheDocument();
    await expectSinViolaciones();

    await userEvent.click(screen.getByRole("radio", { name: "Vista anual" }));
    await screen.findByRole("button", { name: /Octubre/ });
    await expectSinViolaciones();

    await userEvent.click(screen.getByRole("button", { name: /Nuevo Evento/ }));
    screen.getByRole("dialog", { name: "Crear Nuevo Evento" });
    await expectSinViolaciones();
  });
});
