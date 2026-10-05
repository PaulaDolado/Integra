import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import type { Adjunto } from "@/components/tickets/adjuntos";
import type { Seguimiento, Ticket } from "@/components/tickets/ticket-config";
import { simularRpc, type RespuestasRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import TicketDetalle from "./TicketDetalle";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

// Personas ficticias: el solicitante, la técnica asignada y alguien de soporte
const SOLICITANTE = "e-sol";
const TECNICA = "e-tec";
const SOPORTE = "e-sop";
const TICKET_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const PERSONAS = [
  { id: SOLICITANTE, nombre: "Laura Gómez" },
  { id: TECNICA, nombre: "Marta Ruiz" },
  { id: SOPORTE, nombre: "Pablo Sanz" },
];

const crearTicket = (datos: Partial<Ticket> = {}): Ticket => ({
  id: TICKET_ID,
  autor_id: SOLICITANTE,
  asignado_a_id: TECNICA,
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

const seguimiento = (datos: Partial<Seguimiento>): Seguimiento => ({
  id: "s1",
  ticket_id: TICKET_ID,
  autor_id: TECNICA,
  tipo: "respuesta",
  contenido: "",
  created_at: "2026-10-02T10:00:00Z",
  ...datos,
});

const adjunto = (datos: Partial<Adjunto>): Adjunto => ({
  id: "adj1",
  ticket_id: TICKET_ID,
  seguimiento_id: null,
  autor_id: SOLICITANTE,
  path: `${TICKET_ID}/foto.png`,
  nombre: "foto.png",
  tamano: 1000,
  created_at: "2026-10-01T09:00:00Z",
  ...datos,
});

// Base de datos en memoria con lo justo de supabase.from() que usa la página
let filas: {
  ticket: Ticket | null;
  seguimientos: Seguimiento[];
  adjuntos: Adjunto[];
  plantillas: { id: string; nombre: string; contenido: string }[];
};
let consultas: { tabla: string; filtros: [string, unknown][] }[];
const insertar = vi.fn();
const subir = vi.fn();
const firmar = vi.fn();

function tabla(nombre: string) {
  const consulta = { tabla: nombre, filtros: [] as [string, unknown][] };
  consultas.push(consulta);
  const datos = () =>
    nombre === "tickets"
      ? filas.ticket
      : nombre === "ticket_seguimientos"
        ? filas.seguimientos
        : nombre === "ticket_adjuntos"
          ? filas.adjuntos
          : filas.plantillas;
  const cadena = {
    select: () => cadena,
    eq: (columna: string, valor: unknown) => (consulta.filtros.push([columna, valor]), cadena),
    order: () => cadena,
    maybeSingle: () => cadena,
    insert: (fila: unknown) => (insertar(nombre, fila), Promise.resolve({ data: null, error: null })),
    then: <T,>(ok: (r: { data: unknown; error: null }) => T) => Promise.resolve({ data: datos(), error: null }).then(ok),
  };
  return cadena;
}

const lecturasDe = (nombre: string) => consultas.filter((c) => c.tabla === nombre);

const simularRpcs = (extra: RespuestasRpc = {}) =>
  vi.mocked(supabase.rpc).mockImplementation(
    simularRpc({
      personas_tickets: PERSONAS,
      tecnicos_tickets: [
        { id: TECNICA, nombre: "Marta Ruiz" },
        { id: SOPORTE, nombre: "Pablo Sanz" },
      ],
      responder_ticket: "s-nuevo",
      solucionar_ticket: "s-nuevo",
      valorar_solucion: null,
      actualizar_ticket: null,
      mi_empleado_id: SOLICITANTE,
      ...extra,
    }) as never
  );

// Quién mira el ticket: su ficha y si es de soporte (tickets.gestionar)
const comoUsuario = (empleadoId: string, { soporte = false } = {}) => {
  vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId, loading: false });
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(soporte ? ["tickets.gestionar"] : []),
    loading: false,
    tiene: (p: string) => soporte && p === "tickets.gestionar",
  } as ReturnType<typeof usePermisos>);
};

const abrirTicket = (id = TICKET_ID) =>
  renderConQuery(
    <MemoryRouter initialEntries={[`/tickets/${id}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetalle />} />
      </Routes>
    </MemoryRouter>
  );

const titulo = () => screen.findByRole("heading", { name: "La impresora no imprime" });

describe("Detalle de un ticket", () => {
  beforeEach(() => {
    toast.mockReset();
    insertar.mockReset();
    consultas = [];
    filas = { ticket: crearTicket(), seguimientos: [], adjuntos: [], plantillas: [] };
    vi.mocked(supabase.from).mockImplementation(tabla as never);
    subir.mockResolvedValue({ data: null, error: null });
    firmar.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://firmado.test/${path}` })),
      error: null,
    }));
    vi.mocked(supabase.storage.from).mockReturnValue({ upload: subir, createSignedUrls: firmar, remove: vi.fn() } as never);
    simularRpcs();
  });

  it("muestra el ticket con su historial, nombres y adjuntos firmados", async () => {
    comoUsuario(SOLICITANTE);
    filas.seguimientos = [
      seguimiento({ id: "s1", autor_id: TECNICA, contenido: "¿Has probado a reiniciarla?" }),
      seguimiento({ id: "s2", autor_id: null, tipo: "evento", contenido: "Prioridad cambiada a Alta" }),
      seguimiento({ id: "s3", autor_id: SOLICITANTE, contenido: "Sí, y sigue igual" }),
    ];
    filas.adjuntos = [
      adjunto({ id: "adj1", seguimiento_id: null, nombre: "error.png", path: `${TICKET_ID}/error.png` }),
      adjunto({ id: "adj2", seguimiento_id: "s1", nombre: "manual.png", path: `${TICKET_ID}/manual.png` }),
    ];
    abrirTicket();

    expect(await titulo()).toBeInTheDocument();
    expect(screen.getByText("#A1B2C3")).toBeInTheDocument();
    expect(screen.getByText("Sale un error de papel atascado")).toBeInTheDocument();
    expect(screen.getByText("¿Has probado a reiniciarla?")).toBeInTheDocument();
    expect(screen.getByText("Prioridad cambiada a Alta")).toBeInTheDocument();
    expect(screen.getByText(/^Sistema ·/)).toBeInTheDocument();
    // El solicitante se ve a sí mismo como «Tú» y a la técnica por su nombre
    expect(screen.getAllByText("Tú").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marta Ruiz").length).toBeGreaterThan(0);

    // Cada imagen sale en su mensaje con la URL firmada
    expect(screen.getByRole("img", { name: "error.png" })).toHaveAttribute("src", `https://firmado.test/${TICKET_ID}/error.png`);
    const respuesta = screen.getByText("¿Has probado a reiniciarla?").parentElement as HTMLElement;
    expect(within(respuesta).getByRole("img", { name: "manual.png" })).toBeInTheDocument();
    expect(supabase.storage.from).toHaveBeenCalledWith("tickets");
    expect(firmar).toHaveBeenCalledWith([`${TICKET_ID}/error.png`, `${TICKET_ID}/manual.png`], 3600);

    // Consultas filtradas por el id de la ruta y suscripción a sus cambios
    expect(lecturasDe("tickets")[0].filtros).toEqual([["id", TICKET_ID]]);
    expect(lecturasDe("ticket_seguimientos")[0].filtros).toEqual([["ticket_id", TICKET_ID]]);
    expect(lecturasDe("ticket_adjuntos")[0].filtros).toEqual([["ticket_id", TICKET_ID]]);
    expect(useInvalidarEnCambios).toHaveBeenCalledWith(
      `ticket-${TICKET_ID}`,
      expect.arrayContaining([{ table: "tickets", filter: `id=eq.${TICKET_ID}` }]),
      [["ticket", TICKET_ID]]
    );
  });

  it("si el ticket no existe o no es accesible lo dice y ofrece volver", async () => {
    comoUsuario(SOLICITANTE);
    filas.ticket = null;
    abrirTicket();

    expect(await screen.findByText("El ticket no existe o no tienes acceso a él.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a los tickets/ })).toHaveAttribute("href", "/tickets");
  });

  it("el solicitante solo puede responder: ni soluciones ni edición de propiedades", async () => {
    comoUsuario(SOLICITANTE);
    filas.ticket = crearTicket({ estado: "en_espera" });
    abrirTicket();
    await titulo();

    expect(screen.queryByRole("tab", { name: /Añadir una solución/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar solución" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mis tickets/ })).toHaveAttribute("href", "/tickets");
    expect(screen.getByText("Al responder, el ticket volverá a estar en curso.")).toBeInTheDocument();
    // Sin permiso de soporte no se pide la lista de técnicos
    expect(vi.mocked(supabase.rpc).mock.calls.map(([n]) => n)).not.toContain("tecnicos_tickets");
    expect(screen.getByRole("button", { name: "Responder" })).toBeDisabled();
  });

  it("envía una respuesta, limpia el cuadro y recarga el ticket", async () => {
    comoUsuario(SOLICITANTE);
    abrirTicket();
    await titulo();

    await userEvent.type(screen.getByRole("textbox", { name: "Respuesta" }), "Ya lo he intentado");
    await userEvent.click(screen.getByRole("button", { name: "Responder" }));

    expect(supabase.rpc).toHaveBeenCalledWith("responder_ticket", { p_ticket: TICKET_ID, p_contenido: "Ya lo he intentado" });
    expect(supabase.rpc).not.toHaveBeenCalledWith("solucionar_ticket", expect.anything());
    // Sin imágenes no se sube nada
    expect(subir).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Respuesta enviada" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Respuesta" })).toHaveValue(""));
    await waitFor(() => expect(lecturasDe("tickets")).toHaveLength(2));
  });

  it("adjunta las imágenes de la respuesta al mensaje creado", async () => {
    comoUsuario(SOLICITANTE);
    const { container } = abrirTicket();
    await titulo();

    const imagen = new File(["png"], "pantallazo.png", { type: "image/png" });
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, imagen);
    expect(screen.getByRole("img", { name: "pantallazo.png" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Respuesta" }), "Adjunto captura");
    await userEvent.click(screen.getByRole("button", { name: "Responder" }));

    await waitFor(() => expect(insertar).toHaveBeenCalled());
    expect(subir).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${TICKET_ID}/.+\\.png$`)), imagen, { contentType: "image/png" });
    expect(insertar).toHaveBeenCalledWith(
      "ticket_adjuntos",
      expect.objectContaining({ ticket_id: TICKET_ID, seguimiento_id: "s-nuevo", autor_id: SOLICITANTE, nombre: "pantallazo.png" })
    );
    await waitFor(() => expect(screen.queryByRole("img", { name: "pantallazo.png" })).not.toBeInTheDocument());
  });

  it("si falla el envío avisa, conserva el texto y no sube imágenes", async () => {
    comoUsuario(SOLICITANTE);
    vi.mocked(supabase.rpc).mockImplementation((async (nombre: string) =>
      nombre === "personas_tickets"
        ? { data: PERSONAS, error: null }
        : { data: null, error: { message: "El ticket está cerrado" } }) as never);
    abrirTicket();
    await titulo();

    await userEvent.type(screen.getByRole("textbox", { name: "Respuesta" }), "Hola");
    await userEvent.click(screen.getByRole("button", { name: "Responder" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "El ticket está cerrado", variant: "destructive" }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Respuesta enviada" }));
    expect(screen.getByRole("textbox", { name: "Respuesta" })).toHaveValue("Hola");
    expect(subir).not.toHaveBeenCalled();
  });

  it("la técnica asignada añade una solución partiendo de una plantilla", async () => {
    comoUsuario(TECNICA);
    filas.plantillas = [{ id: "p1", nombre: "Reinicio", contenido: "Se ha reiniciado el equipo y funciona." }];
    abrirTicket();
    await titulo();

    // Sin permiso de soporte pero asignada: puede solucionar, no editar propiedades
    expect(screen.queryByRole("combobox", { name: "Estado" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Añadir una solución/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Plantilla de solución" }));
    await userEvent.click(await screen.findByRole("option", { name: "Reinicio" }));
    expect(screen.getByRole("textbox", { name: "Solución" })).toHaveValue("Se ha reiniciado el equipo y funciona.");

    await userEvent.click(screen.getByRole("button", { name: "Añadir solución" }));

    expect(supabase.rpc).toHaveBeenCalledWith("solucionar_ticket", {
      p_ticket: TICKET_ID,
      p_contenido: "Se ha reiniciado el equipo y funciona.",
    });
    expect(supabase.rpc).not.toHaveBeenCalledWith("responder_ticket", expect.anything());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Solución añadida" }));
    // Vuelve al modo respuesta
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Respuesta" })).toHaveValue(""));
  });

  it("con la solución propuesta, el solicitante la aprueba", async () => {
    comoUsuario(SOLICITANTE);
    filas.ticket = crearTicket({ estado: "resuelto", fecha_resolucion: "2026-10-03T12:00:00Z" });
    filas.seguimientos = [seguimiento({ id: "s1", tipo: "solucion", contenido: "Cambiado el tóner" })];
    abrirTicket();
    await titulo();

    expect(screen.getByText("Se ha propuesto una solución")).toBeInTheDocument();
    expect(screen.getByText("Solución")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprobar solución" }));

    expect(supabase.rpc).toHaveBeenCalledWith("valorar_solucion", { p_ticket: TICKET_ID, p_aprobar: true, p_comentario: undefined });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Solución aprobada", description: "El ticket se ha cerrado" }));
    await waitFor(() => expect(lecturasDe("tickets")).toHaveLength(2));
  });

  it("para rechazar la solución exige un motivo y lo envía", async () => {
    comoUsuario(SOLICITANTE);
    filas.ticket = crearTicket({ estado: "resuelto" });
    abrirTicket();
    await titulo();

    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    const rechazar = screen.getByRole("button", { name: "Rechazar solución" });
    expect(rechazar).toBeDisabled();
    await userEvent.type(screen.getByLabelText("¿Por qué no resuelve tu solicitud?"), "Sigue atascándose");
    await userEvent.click(rechazar);

    expect(supabase.rpc).toHaveBeenCalledWith("valorar_solucion", {
      p_ticket: TICKET_ID,
      p_aprobar: false,
      p_comentario: "Sigue atascándose",
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Solución rechazada" }));
    await waitFor(() => expect(screen.queryByLabelText("¿Por qué no resuelve tu solicitud?")).not.toBeInTheDocument());
  });

  it("soporte reasigna el ticket y guarda solo cuando hay cambios", async () => {
    comoUsuario(SOPORTE, { soporte: true });
    abrirTicket();
    await titulo();

    expect(screen.getByRole("link", { name: /Todos los tickets/ })).toHaveAttribute("href", "/gestion-tickets");
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();

    // «Resuelto» solo se alcanza añadiendo una solución
    await userEvent.click(screen.getByRole("combobox", { name: "Estado" }));
    expect(await screen.findByRole("option", { name: "Resuelto" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("option", { name: "En espera" }));

    await userEvent.click(screen.getByRole("combobox", { name: "Asignado a" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pablo Sanz (tú)" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(supabase.rpc).toHaveBeenCalledWith("actualizar_ticket", {
      p_ticket: TICKET_ID,
      p_tipo: "incidencia",
      p_prioridad: "media",
      p_estado: "en_espera",
      p_asignado: SOPORTE,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Ticket actualizado" }));
  });

  it("dejar el ticket sin asignar envía null", async () => {
    comoUsuario(SOPORTE, { soporte: true });
    abrirTicket();
    await titulo();

    await userEvent.click(screen.getByRole("combobox", { name: "Asignado a" }));
    await userEvent.click(await screen.findByRole("option", { name: "Sin asignar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(supabase.rpc).toHaveBeenCalledWith("actualizar_ticket", expect.objectContaining({ p_asignado: null, p_estado: "en_curso" }));
  });

  it("un ticket cerrado no admite respuestas ni cambios, ni siquiera de soporte", async () => {
    comoUsuario(SOPORTE, { soporte: true });
    filas.ticket = crearTicket({ estado: "cerrado", fecha_cierre: "2026-10-04T08:00:00Z" });
    abrirTicket();
    await titulo();

    expect(screen.getByText(/Este ticket está cerrado/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Respuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Estado" })).not.toBeInTheDocument();
    // Insignias de cabecera y de detalles, más la fecha de cierre
    expect(screen.getAllByText("Cerrado")).toHaveLength(3);
  });
});
