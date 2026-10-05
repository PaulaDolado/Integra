import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Vacaciones from "./Vacaciones";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const UUID = "00000000-0000-4000-8000-000000000001";

const solicitud = (datos: Record<string, unknown>) => ({
  id: "s1",
  tipo_ausencia: "vacaciones",
  razon_especifica: null,
  justificante_path: null,
  fecha_inicio: "2026-10-12",
  fecha_fin: "2026-10-16",
  motivo: null,
  estado: "pendiente",
  created_at: "2026-10-01T09:00:00Z",
  fecha_revision: null,
  comentario_revision: null,
  ...datos,
});

const SOLICITUDES = [
  solicitud({ id: "s1" }),
  solicitud({
    id: "s2",
    tipo_ausencia: "compensacion_dias_trabajados",
    razon_especifica: "descanso_festivo_trabajado",
    fecha_inicio: "2026-09-07",
    fecha_fin: "2026-09-07",
    estado: "aprobada",
    fecha_revision: "2026-09-03T10:00:00Z",
    comentario_revision: "Sin problema",
    justificante_path: "u1/parte.pdf",
  }),
  solicitud({ id: "s3", tipo_ausencia: "visita_medica", estado: "rechazada", motivo: "Revisión anual" }),
];

// Fake encadenable de supabase.from(...): registra los filtros y resuelve al hacer await
let lectura: () => { data: unknown; error: { message: string } | null };
const filtros = vi.fn();
const insert = vi.fn();

function simularTabla() {
  vi.mocked(supabase.from).mockImplementation((() => {
    const consulta = {
      select: () => consulta,
      eq: (columna: string, valor: unknown) => {
        filtros(columna, valor);
        return consulta;
      },
      order: () => consulta,
      then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(lectura()).then(ok, ko),
      insert,
    };
    return consulta;
  }) as never);
}

const upload = vi.fn();
const remove = vi.fn();
const createSignedUrl = vi.fn();

const lecturas = () => vi.mocked(supabase.from).mock.calls.length - insert.mock.calls.length;

async function elegir(combo: HTMLElement, opcion: string) {
  await userEvent.click(combo);
  await userEvent.click(await screen.findByRole("option", { name: opcion }));
}

async function abrirFormulario() {
  await userEvent.click(screen.getByRole("button", { name: "Nueva Solicitud" }));
  return screen.getByRole("dialog", { name: "Nueva Solicitud de Ausencia" });
}

function ponerFechas(dialogo: HTMLElement, inicio: string, fin: string) {
  fireEvent.change(within(dialogo).getByLabelText("Fecha de Inicio"), { target: { value: inicio } });
  fireEvent.change(within(dialogo).getByLabelText("Fecha de Fin"), { target: { value: fin } });
}

const enviar = (dialogo: HTMLElement) =>
  userEvent.click(within(dialogo).getByRole("button", { name: "Enviar Solicitud" }));

describe("Solicitud de ausencia", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    toast.mockReset();
    filtros.mockReset();
    insert.mockReset().mockResolvedValue({ data: null, error: null });
    upload.mockReset().mockResolvedValue({ data: {}, error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
    createSignedUrl.mockReset();
    lectura = () => ({ data: SOLICITUDES, error: null });
    simularTabla();
    vi.mocked(supabase.storage.from).mockReturnValue({ upload, remove, createSignedUrl } as never);
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: "e1", loading: false });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(UUID);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("muestra el historial propio con su estado, razón y revisión", async () => {
    renderConQuery(<Vacaciones />);

    const compensacion = (await screen.findByText("Compensación de días trabajados")).closest(".p-4") as HTMLElement;
    expect(supabase.from).toHaveBeenCalledWith("solicitudes_vacacion");
    expect(filtros).toHaveBeenCalledWith("empleado_id", "e1");
    expect(filtros).not.toHaveBeenCalledWith("estado", expect.anything());

    expect(within(compensacion).getByText("Aprobada")).toBeInTheDocument();
    expect(within(compensacion).getByText("Descanso por festivo trabajado")).toBeInTheDocument();
    expect(within(compensacion).getByText(/1 día\(s\)/)).toBeInTheDocument();
    expect(within(compensacion).getByText(/Aprobada el 03\/09\/2026/)).toBeInTheDocument();
    expect(within(compensacion).getByText("Sin problema")).toBeInTheDocument();

    const vacaciones = screen.getByText("Vacaciones").closest(".p-4") as HTMLElement;
    expect(within(vacaciones).getByText("Pendiente")).toBeInTheDocument();
    expect(within(vacaciones).getByText(/5 día\(s\)/)).toBeInTheDocument();
    expect(within(vacaciones).getByText(/Solicitado el 01\/10\/2026/)).toBeInTheDocument();
    expect(within(vacaciones).queryByRole("button", { name: "Ver justificante" })).not.toBeInTheDocument();

    const visita = screen.getByText("Visita médica").closest(".p-4") as HTMLElement;
    expect(within(visita).getByText("Rechazada")).toBeInTheDocument();
    expect(within(visita).getByText("Revisión anual")).toBeInTheDocument();
  });

  it("filtra por estado en la consulta", async () => {
    renderConQuery(<Vacaciones />);
    await screen.findByText("Vacaciones");

    await elegir(screen.getAllByRole("combobox")[0], "Aprobadas");

    await waitFor(() => expect(filtros).toHaveBeenCalledWith("estado", "aprobada"));
  });

  it("sin ficha de empleado avisa y no consulta nada", () => {
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: null, loading: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<Vacaciones />);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "No se pudo obtener la información del empleado", variant: "destructive" })
    );
    expect(supabase.from).not.toHaveBeenCalled();
    expect(screen.getByText("No hay solicitudes")).toBeInTheDocument();
  });

  it("si falla la carga del historial avisa", async () => {
    lectura = () => ({ data: null, error: { message: "permiso denegado" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<Vacaciones />);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar las solicitudes", variant: "destructive" })
      )
    );
  });

  it("envía una solicitud sin justificante con el payload exacto y recarga el historial", async () => {
    renderConQuery(<Vacaciones />);
    await screen.findByText("Vacaciones");
    expect(lecturas()).toBe(1);

    const dialogo = await abrirFormulario();
    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Asunto personal");
    // Este tipo no tiene razones específicas
    expect(within(dialogo).queryByLabelText("Razón específica")).not.toBeInTheDocument();
    ponerFechas(dialogo, "2026-11-02", "2026-11-03");
    await enviar(dialogo);

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith({
        empleado_id: "e1",
        tipo_ausencia: "asunto_personal",
        razon_especifica: null,
        justificante_path: null,
        fecha_inicio: "2026-11-02",
        fecha_fin: "2026-11-03",
        estado: "pendiente",
      })
    );
    expect(upload).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Solicitud enviada" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(lecturas()).toBe(2));
  });

  it("exige la razón específica cuando el tipo la tiene y la incluye al enviar", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Compensación de días trabajados");
    ponerFechas(dialogo, "2026-11-02", "2026-11-02");
    await enviar(dialogo);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Selecciona la razón específica", variant: "destructive" })
    );
    expect(insert).not.toHaveBeenCalled();

    await elegir(within(dialogo).getByLabelText("Razón específica"), "Descanso por horas extras");
    await enviar(dialogo);

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_ausencia: "compensacion_dias_trabajados",
          razon_especifica: "descanso_horas_extras",
          fecha_inicio: "2026-11-02",
          fecha_fin: "2026-11-02",
        })
      )
    );
  });

  it("no envía sin tipo de ausencia ni con la fecha de fin anterior a la de inicio", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    ponerFechas(dialogo, "2026-11-10", "2026-11-05");
    await enviar(dialogo);
    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: "Selecciona el tipo de ausencia", variant: "destructive" })
    );

    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Vacaciones");
    await enviar(dialogo);
    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: "La fecha de fin no puede ser anterior a la fecha de inicio",
        variant: "destructive",
      })
    );
    expect(insert).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sube el justificante con un nombre seguro bajo la carpeta del usuario", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    const input = within(dialogo).getByLabelText(/Importa el justificante/);
    expect(input).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png,.doc,.docx");
    const archivo = new File(["contenido"], "parte médico (1).pdf", { type: "application/pdf" });
    await userEvent.upload(input, archivo);

    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Visita médica");
    ponerFechas(dialogo, "2026-11-02", "2026-11-02");
    await enviar(dialogo);

    const ruta = `u1/${UUID}-parte_m_dico__1_.pdf`;
    await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({ justificante_path: ruta })));
    expect(supabase.storage.from).toHaveBeenCalledWith("justificantes");
    expect(upload).toHaveBeenCalledWith(ruta, archivo);
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(insert.mock.invocationCallOrder[0]);
  });

  it("rechaza un justificante de más de 5 MB y no lo sube", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    const grande = new File(["x"], "escaneo.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 5 * 1024 * 1024 + 1 });
    const input = within(dialogo).getByLabelText(/Importa el justificante/) as HTMLInputElement;
    await userEvent.upload(input, grande);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Archivo demasiado grande", variant: "destructive" })
    );
    expect(input.value).toBe("");

    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Vacaciones");
    ponerFechas(dialogo, "2026-11-02", "2026-11-06");
    await enviar(dialogo);

    await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({ justificante_path: null })));
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza un justificante de un tipo no admitido aunque se salte el filtro del selector", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    const input = within(dialogo).getByLabelText(/Importa el justificante/) as HTMLInputElement;
    // fireEvent no aplica `accept`, como cuando se elige «Todos los archivos»
    fireEvent.change(input, { target: { files: [new File(["x"], "programa.EXE", { type: "application/octet-stream" })] } });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tipo de archivo no admitido", variant: "destructive" })
    );

    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Vacaciones");
    ponerFechas(dialogo, "2026-11-02", "2026-11-06");
    await enviar(dialogo);

    await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({ justificante_path: null })));
    expect(upload).not.toHaveBeenCalled();
  });

  it("acepta extensiones admitidas en mayúsculas", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    const input = within(dialogo).getByLabelText(/Importa el justificante/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "PARTE.PDF", { type: "application/pdf" })] } });

    expect(toast).not.toHaveBeenCalled();
  });

  it("no envía sin fechas aunque el navegador no lo impida", async () => {
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();
    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Vacaciones");

    // Se envía el formulario directamente, sin la validación `required` del navegador
    fireEvent.submit(within(dialogo).getByRole("button", { name: "Enviar Solicitud" }).closest("form")!);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Indica las fechas de inicio y de fin", variant: "destructive" })
      )
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("si falla el alta borra el justificante subido, avisa y deja el diálogo abierto", async () => {
    insert.mockResolvedValue({ data: null, error: { message: "violación de política" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    await userEvent.upload(
      within(dialogo).getByLabelText(/Importa el justificante/),
      new File(["c"], "parte.pdf", { type: "application/pdf" })
    );
    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Visita médica");
    ponerFechas(dialogo, "2026-11-02", "2026-11-02");
    await enviar(dialogo);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudo enviar la solicitud", variant: "destructive" })
      )
    );
    expect(remove).toHaveBeenCalledWith([`u1/${UUID}-parte.pdf`]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Enviar Solicitud" })).toBeEnabled();
  });

  it("si falla la subida del justificante no crea la solicitud", async () => {
    upload.mockResolvedValue({ data: null, error: { message: "bucket lleno" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<Vacaciones />);
    const dialogo = await abrirFormulario();

    await userEvent.upload(
      within(dialogo).getByLabelText(/Importa el justificante/),
      new File(["c"], "parte.pdf", { type: "application/pdf" })
    );
    await elegir(within(dialogo).getByLabelText("Tipo de ausencia"), "Visita médica");
    ponerFechas(dialogo, "2026-11-02", "2026-11-02");
    await enviar(dialogo);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "No se pudo enviar la solicitud" }))
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("abre el justificante propio con un enlace firmado", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://firmado.test/parte.pdf" }, error: null });
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    renderConQuery(<Vacaciones />);

    await userEvent.click(await screen.findByRole("button", { name: "Ver justificante" }));

    expect(createSignedUrl).toHaveBeenCalledWith("u1/parte.pdf", 60);
    expect(abrir).toHaveBeenCalledWith("https://firmado.test/parte.pdf", "_blank", "noopener,noreferrer");
  });

  it("si falla la conexión al pedir el enlace del justificante avisa", async () => {
    createSignedUrl.mockRejectedValue(new TypeError("Failed to fetch"));
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    renderConQuery(<Vacaciones />);

    await userEvent.click(await screen.findByRole("button", { name: "Ver justificante" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudo abrir el justificante", variant: "destructive" })
      )
    );
    expect(abrir).not.toHaveBeenCalled();
  });

  it("no tiene problemas de accesibilidad", async () => {
    renderConQuery(<Vacaciones />);
    await screen.findByText("Compensación de días trabajados");
    await expectSinViolaciones();

    await abrirFormulario();
    await expectSinViolaciones();
  });
});
