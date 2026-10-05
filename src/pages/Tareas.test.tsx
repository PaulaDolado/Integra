import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import type { Task } from "@/components/tareas/task-utils";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Tareas from "./Tareas";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

const MI_ID = "yo";

const tarea = (datos: Partial<Task>): Task => ({
  id: "t1",
  titulo: "Preparar informe",
  resumen: null,
  descripcion: null,
  estado: "pendiente",
  asignado_a_id: MI_ID,
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  etiquetas: [],
  fecha_limite: null,
  imagen_path: null,
  propiedades: [],
  proyecto_id: null,
  subtareas: [],
  tiempo_estimado_min: null,
  tiempo_real_min: 0,
  ...datos,
});

const TAREAS = [
  tarea({
    id: "t1",
    titulo: "Preparar informe",
    resumen: "Cifras del trimestre",
    etiquetas: ["urgente", "finanzas", "q4", "extra"],
    subtareas: [
      { id: "s1", titulo: "Recoger datos", completada: true },
      { id: "s2", titulo: "Redactar", completada: false },
    ],
    tiempo_estimado_min: 60,
    tiempo_real_min: 15,
    propiedades: [{ clave: "Cliente", tipo: "texto", valor: "Acme Ficticia" }],
  }),
  tarea({ id: "t2", titulo: "Revisar contrato", estado: "en_progreso" }),
  tarea({ id: "t3", titulo: "Enviar factura", estado: "completado" }),
];

// Cadena falsa de supabase.from(): apunta cada llamada y se resuelve con lo que diga `responder`
type Llamada = [metodo: string, ...args: unknown[]];
type Resultado = { data: unknown; error: { message: string } | null };
let consultas: Llamada[][] = [];
let responder: (llamadas: Llamada[]) => Resultado;

const respuestaPorDefecto = (llamadas: Llamada[]): Resultado => {
  const metodos = llamadas.map(([m]) => m);
  if (metodos.includes("insert")) {
    const valores = llamadas.find(([m]) => m === "insert")![1] as Partial<Task>;
    return { data: tarea({ ...valores, id: "nueva" }), error: null };
  }
  if (metodos.includes("update")) {
    const valores = llamadas.find(([m]) => m === "update")![1] as Partial<Task>;
    return { data: tarea(valores), error: null };
  }
  if (metodos.includes("delete")) return { data: null, error: null };
  return { data: TAREAS, error: null };
};

const crearConsulta = (tabla: string) => {
  const llamadas: Llamada[] = [["from", tabla]];
  consultas.push(llamadas);
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "order", "insert", "update", "delete", "single"]) {
    consulta[metodo] = (...args: unknown[]) => {
      llamadas.push([metodo, ...args]);
      return consulta;
    };
  }
  consulta.then = (ok: (r: Resultado) => unknown, ko: (e: unknown) => unknown) =>
    Promise.resolve().then(() => responder(llamadas)).then(ok, ko);
  return consulta;
};

const escrituras = (metodo: "insert" | "update" | "delete") =>
  consultas.filter((ll) => ll.some(([m]) => m === metodo));
const lecturas = () => consultas.filter((ll) => ll.length === 4 && ll[1][0] === "select");

const columna = (titulo: string) =>
  screen.getByRole("heading", { name: new RegExp(`^${titulo} \\(`) }).closest(".rounded-xl") as HTMLElement;
const tarjeta = (titulo: string) => screen.getByText(titulo).closest("[draggable]") as HTMLElement;

const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };

describe("Tareas", () => {
  beforeEach(() => {
    toast.mockReset();
    consultas = [];
    responder = respuestaPorDefecto;
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: MI_ID, loading: false });
    vi.mocked(supabase.from).mockImplementation(crearConsulta as never);
    storage.upload.mockResolvedValue({ data: {}, error: null });
    storage.remove.mockResolvedValue({ data: [], error: null });
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://firmado.test/img.png" }, error: null });
    vi.mocked(supabase.storage.from).mockReturnValue(storage as never);
  });

  it("pide solo mis tareas y las reparte por columnas con su resumen", async () => {
    renderConQuery(<Tareas />);

    expect(await screen.findByText("Preparar informe")).toBeInTheDocument();
    expect(consultas[0]).toEqual([
      ["from", "tareas"],
      ["select", "*"],
      ["eq", "asignado_a_id", MI_ID],
      ["order", "fecha_limite", { ascending: true, nullsFirst: false }],
    ]);
    expect(useInvalidarEnCambios).toHaveBeenCalledWith("tareas-page-changes", [{ table: "tareas" }], [["tareas", MI_ID]]);

    expect(within(columna("Pendientes")).getByText("Preparar informe")).toBeInTheDocument();
    expect(within(columna("En Progreso")).getByText("Revisar contrato")).toBeInTheDocument();
    expect(within(columna("Completadas")).getByText("Enviar factura")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pendientes (1)" })).toBeInTheDocument();

    const informe = tarjeta("Preparar informe");
    expect(within(informe).getByText("Cifras del trimestre")).toBeInTheDocument();
    // Solo se ven tres etiquetas y el resto se cuenta
    expect(within(informe).getByText("q4")).toBeInTheDocument();
    expect(within(informe).queryByText("extra")).not.toBeInTheDocument();
    expect(within(informe).getByText("+1")).toBeInTheDocument();
    expect(within(informe).getByText("1/2")).toBeInTheDocument();
    expect(informe).toHaveTextContent("15/60 min");
  });

  it("sin ficha de empleado no consulta y no deja crear tareas", () => {
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: null, loading: false });
    renderConQuery(<Tareas />);

    expect(screen.getByRole("button", { name: "Nueva Tarea" })).toBeDisabled();
    expect(screen.getByText("No hay tareas pendientes")).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(useInvalidarEnCambios).toHaveBeenCalledWith(null, expect.anything(), expect.anything());
  });

  it("avisa si no se pueden cargar las tareas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    responder = () => ({ data: null, error: { message: "sin conexión" } });
    renderConQuery(<Tareas />);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar las tareas", variant: "destructive" })
      )
    );
  });

  // Escribe en muchos campos tecla a tecla: con toda la batería en paralelo, 15 s a veces no bastan
  it("crea una tarea con el contenido del formulario y recarga la lista", { timeout: 30_000 }, async () => {
    renderConQuery(<Tareas />);
    await screen.findByText("Preparar informe");

    await userEvent.click(screen.getByRole("button", { name: "Nueva Tarea" }));
    const dialogo = screen.getByRole("dialog", { name: "Nueva tarea" });
    await userEvent.type(within(dialogo).getByLabelText("Título de la tarea"), "  Llamar a proveedor  ");
    await userEvent.type(within(dialogo).getByLabelText("Descripción"), "Pedir presupuesto");
    await userEvent.type(within(dialogo).getByPlaceholderText("+ Paso"), "Buscar teléfono{Enter}");
    await userEvent.type(within(dialogo).getByPlaceholderText("+ etiqueta"), "compras{Enter}");
    // Las etiquetas repetidas (sin distinguir mayúsculas) no se añaden
    await userEvent.type(within(dialogo).getByPlaceholderText("+ etiqueta"), "Compras{Enter}");
    await userEvent.type(within(dialogo).getByLabelText("Estimado"), "30");
    await userEvent.type(within(dialogo).getByLabelText("Minutos a registrar"), "10{Enter}");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Añadir propiedad" }));
    await userEvent.type(within(dialogo).getByLabelText("Nombre de la propiedad"), "Presupuesto{Enter}");
    await userEvent.type(within(dialogo).getByLabelText(/^Presupuesto/), "1200");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear tarea" }));

    await waitFor(() => expect(escrituras("insert")).toHaveLength(1));
    const [insercion] = escrituras("insert");
    expect(insercion[1]).toEqual(["insert", {
      titulo: "Llamar a proveedor",
      resumen: null,
      descripcion: "Pedir presupuesto",
      imagen_path: null,
      estado: "pendiente",
      subtareas: [{ id: expect.any(String), titulo: "Buscar teléfono", completada: false }],
      fecha_limite: null,
      etiquetas: ["compras"],
      propiedades: [{ clave: "Presupuesto", tipo: "texto", valor: "1200" }],
      tiempo_estimado_min: 30,
      tiempo_real_min: 10,
      asignado_a_id: MI_ID,
    }]);
    expect(insercion.slice(2)).toEqual([["select", "*"], ["single"]]);

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Tarea creada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(lecturas()).toHaveLength(2));
  });

  it("no crea la tarea sin título", async () => {
    renderConQuery(<Tareas />);
    await screen.findByText("Preparar informe");

    await userEvent.click(screen.getByRole("button", { name: "Nueva Tarea" }));
    await userEvent.type(screen.getByLabelText("Título de la tarea"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Crear tarea" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "El título es obligatorio", variant: "destructive" })
    );
    expect(escrituras("insert")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("abre el detalle de una tarea y guarda los cambios de título, estado y propiedades", async () => {
    renderConQuery(<Tareas />);
    await userEvent.click(await screen.findByText("Preparar informe"));

    const dialogo = screen.getByRole("dialog", { name: "Editar tarea" });
    expect(within(dialogo).getByLabelText("Título de la tarea")).toHaveValue("Preparar informe");
    expect(within(dialogo).getByLabelText("Resumen corto")).toHaveValue("Cifras del trimestre");
    expect(within(dialogo).getByLabelText(/^Cliente/)).toHaveValue("Acme Ficticia");
    expect(within(dialogo).getByText("Subtareas (1/2)")).toBeInTheDocument();

    const titulo = within(dialogo).getByLabelText("Título de la tarea");
    await userEvent.clear(titulo);
    await userEvent.type(titulo, "Preparar informe final");
    await userEvent.clear(within(dialogo).getByLabelText(/^Cliente/));
    await userEvent.type(within(dialogo).getByLabelText(/^Cliente/), "Globex Ficticia");
    await userEvent.click(within(dialogo).getByRole("checkbox", { name: "Completar Redactar" }));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Quitar etiqueta extra" }));

    await userEvent.click(within(dialogo).getByRole("combobox", { name: "Estado" }));
    await userEvent.click(await screen.findByRole("option", { name: "En Progreso" }));

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(escrituras("update")).toHaveLength(1));
    const [actualizacion] = escrituras("update");
    expect(actualizacion[1]).toEqual(["update", expect.objectContaining({
      titulo: "Preparar informe final",
      estado: "en_progreso",
      etiquetas: ["urgente", "finanzas", "q4"],
      subtareas: [
        { id: "s1", titulo: "Recoger datos", completada: true },
        { id: "s2", titulo: "Redactar", completada: true },
      ],
      propiedades: [{ clave: "Cliente", tipo: "texto", valor: "Globex Ficticia" }],
    })]);
    expect(actualizacion[2]).toEqual(["eq", "id", "t1"]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Tarea actualizada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(lecturas()).toHaveLength(2));
  });

  it("si falla el guardado avisa y deja el detalle abierto", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    responder = (ll) =>
      ll.some(([m]) => m === "update") ? { data: null, error: { message: "denegado" } } : respuestaPorDefecto(ll);
    renderConQuery(<Tareas />);
    await userEvent.click(await screen.findByText("Revisar contrato"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron guardar los cambios", variant: "destructive" })
      )
    );
    expect(screen.getByRole("dialog", { name: "Editar tarea" })).toBeInTheDocument();
  });

  it("elimina la tarea tras confirmar y borra su imagen", async () => {
    const conImagen = TAREAS.map((t) => (t.id === "t3" ? { ...t, imagen_path: "u1/factura.png" } : t));
    responder = (ll) => (ll.length === 4 ? { data: conImagen, error: null } : respuestaPorDefecto(ll));
    renderConQuery(<Tareas />);
    await userEvent.click(await screen.findByText("Enviar factura"));
    expect(await screen.findByRole("img", { name: "Imagen de la tarea" })).toHaveAttribute(
      "src",
      "https://firmado.test/img.png"
    );

    await userEvent.click(screen.getByRole("button", { name: "Eliminar tarea" }));
    const confirmacion = screen.getByRole("alertdialog", { name: "¿Eliminar esta tarea?" });
    expect(confirmacion).toHaveTextContent('Se eliminará "Enviar factura"');
    expect(escrituras("delete")).toHaveLength(0);

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(escrituras("delete")).toHaveLength(1));
    expect(escrituras("delete")[0].slice(1)).toEqual([["delete"], ["eq", "id", "t3"]]);
    await waitFor(() => expect(storage.remove).toHaveBeenCalledWith(["u1/factura.png"]));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Tarea eliminada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("al cancelar borra la imagen subida que no se llegó a guardar", async () => {
    renderConQuery(<Tareas />);
    await userEvent.click(await screen.findByText("Revisar contrato"));

    const archivo = new File(["png"], "foto plano.png", { type: "image/png" });
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, archivo);

    await waitFor(() => expect(storage.upload).toHaveBeenCalledTimes(1));
    const [ruta, subido] = storage.upload.mock.calls[0];
    expect(ruta).toMatch(/^u1\/.+-foto_plano\.png$/);
    expect(subido).toBe(archivo);
    expect(await screen.findByRole("img", { name: "Imagen de la tarea" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(storage.remove).toHaveBeenCalledWith([ruta]));
    expect(escrituras("update")).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("arrastrar una tarjeta a otra columna cambia su estado al momento", async () => {
    renderConQuery(<Tareas />);
    await screen.findByText("Preparar informe");

    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => "t1"), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(tarjeta("Preparar informe"), { dataTransfer });
    fireEvent.dragOver(columna("Completadas"), { dataTransfer });
    fireEvent.drop(columna("Completadas"), { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "t1");
    expect(within(columna("Completadas")).getByText("Preparar informe")).toBeInTheDocument();
    expect(screen.getByText("No hay tareas pendientes")).toBeInTheDocument();
    await waitFor(() => expect(escrituras("update")).toHaveLength(1));
    expect(escrituras("update")[0].slice(1)).toEqual([["update", { estado: "completado" }], ["eq", "id", "t1"]]);
  });

  it("soltar en la misma columna no hace nada y si falla el cambio la tarjeta vuelve", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    responder = (ll) =>
      ll.some(([m]) => m === "update") ? { data: null, error: { message: "denegado" } } : respuestaPorDefecto(ll);
    renderConQuery(<Tareas />);
    await screen.findByText("Revisar contrato");
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => "t2"), effectAllowed: "", dropEffect: "" };

    fireEvent.dragStart(tarjeta("Revisar contrato"), { dataTransfer });
    fireEvent.drop(columna("En Progreso"), { dataTransfer });
    expect(escrituras("update")).toHaveLength(0);

    fireEvent.dragStart(tarjeta("Revisar contrato"), { dataTransfer });
    fireEvent.drop(columna("Pendientes"), { dataTransfer });
    expect(within(columna("Pendientes")).getByText("Revisar contrato")).toBeInTheDocument();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudo actualizar la tarea", variant: "destructive" })
      )
    );
    expect(within(columna("En Progreso")).getByText("Revisar contrato")).toBeInTheDocument();
    expect(within(columna("Pendientes")).queryByText("Revisar contrato")).not.toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    renderConQuery(<Tareas />);
    await screen.findByText("Preparar informe");
    await expectSinViolaciones();

    // Las tarjetas también se abren con el teclado
    tarjeta("Preparar informe").focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("dialog", { name: "Editar tarea" });
    await expectSinViolaciones();
  });
});
