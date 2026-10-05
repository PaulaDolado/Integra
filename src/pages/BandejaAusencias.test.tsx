import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import type { Database } from "@/integrations/supabase/types";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import BandejaAusencias from "./BandejaAusencias";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

type Solicitud = Database["public"]["Functions"]["bandeja_ausencias"]["Returns"][number];

const solicitud = (datos: Partial<Solicitud>): Solicitud => ({
  id: "s1",
  empleado_id: "e1",
  empleado_nombre: "Laura Gómez",
  departamento: "Marketing",
  tipo_ausencia: "vacaciones",
  razon_especifica: null,
  fecha_inicio: "2026-10-12",
  fecha_fin: "2026-10-16",
  motivo: null,
  justificante_path: null,
  estado: "pendiente",
  created_at: "2026-10-01T09:00:00Z",
  revisado_por_nombre: null,
  fecha_revision: null,
  comentario_revision: null,
  es_mia: false,
  ...datos,
});

const SOLICITUDES = [
  solicitud({ id: "s1", empleado_nombre: "Laura Gómez", departamento: "Marketing", justificante_path: "e1/justificante.pdf" }),
  solicitud({ id: "s2", empleado_nombre: "Pablo Sanz", departamento: "Finanzas" }),
  solicitud({ id: "s3", empleado_nombre: "Yo Misma", departamento: "RRHH", es_mia: true }),
  solicitud({
    id: "s4",
    empleado_nombre: "Marta Ruiz",
    estado: "aprobada",
    revisado_por_nombre: "Ana López",
    fecha_revision: "2026-09-20T10:00:00Z",
    comentario_revision: "Disfruta",
  }),
  solicitud({ id: "s5", empleado_nombre: "Jorge Pérez", estado: "rechazada" }),
];

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

// Tarjeta de la solicitud de una persona, para buscar dentro de ella
const tarjetaDe = (nombre: string) => screen.getByText(nombre).closest(".p-4") as HTMLElement;

describe("Bandeja de ausencias", () => {
  beforeEach(() => {
    toast.mockReset();
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ bandeja_ausencias: SOLICITUDES, revisar_ausencia: null }) as never
    );
  });

  it("sin el permiso no consulta nada y muestra el aviso", () => {
    conPermisos();
    renderConQuery(<BandejaAusencias />);
    expect(screen.getByText("No tienes acceso a la bandeja de ausencias")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("muestra las pendientes por defecto y cuenta cada estado", async () => {
    conPermisos("ausencias.aprobar");
    renderConQuery(<BandejaAusencias />);

    expect(await screen.findByText("Laura Gómez")).toBeInTheDocument();
    expect(screen.getByText("Pablo Sanz")).toBeInTheDocument();
    expect(screen.queryByText("Marta Ruiz")).not.toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Pendientes (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aprobadas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rechazadas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Todas (5)" })).toBeInTheDocument();
  });

  it("no deja revisar la solicitud propia", async () => {
    conPermisos("ausencias.aprobar");
    renderConQuery(<BandejaAusencias />);

    await screen.findByText("Yo Misma");
    const mia = tarjetaDe("Yo Misma");
    expect(within(mia).getByText(/Es tu solicitud/)).toBeInTheDocument();
    expect(within(mia).queryByRole("button", { name: /Aprobar/ })).not.toBeInTheDocument();
    expect(within(tarjetaDe("Pablo Sanz")).getByRole("button", { name: /Aprobar/ })).toBeInTheDocument();
  });

  it("filtra por estado y por texto", async () => {
    conPermisos("ausencias.aprobar");
    renderConQuery(<BandejaAusencias />);
    await screen.findByText("Laura Gómez");

    await userEvent.click(screen.getByRole("tab", { name: "Aprobadas (1)" }));
    expect(screen.getByText("Marta Ruiz")).toBeInTheDocument();
    expect(screen.getByText(/Aprobada por Ana López/)).toBeInTheDocument();
    expect(screen.getByText("«Disfruta»")).toBeInTheDocument();
    expect(screen.queryByText("Laura Gómez")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Pendientes (3)" }));
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado o departamento..."), "finanzas");
    expect(screen.getByText("Pablo Sanz")).toBeInTheDocument();
    expect(screen.queryByText("Laura Gómez")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText("Buscar empleado o departamento..."));
    await userEvent.type(screen.getByPlaceholderText("Buscar empleado o departamento..."), "nadie");
    expect(screen.getByText("No hay solicitudes")).toBeInTheDocument();
  });

  it("aprueba con comentario y recarga la bandeja", async () => {
    conPermisos("ausencias.aprobar");
    renderConQuery(<BandejaAusencias />);
    await screen.findByText("Pablo Sanz");

    await userEvent.click(within(tarjetaDe("Pablo Sanz")).getByRole("button", { name: /Aprobar/ }));
    const dialogo = screen.getByRole("dialog", { name: "Aprobar solicitud" });
    await userEvent.type(within(dialogo).getByLabelText(/Comentario/), "  Sin problema  ");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Aprobar" }));

    expect(supabase.rpc).toHaveBeenCalledWith("revisar_ausencia", {
      solicitud_id: "s2",
      decision: "aprobada",
      comentario: "Sin problema",
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Solicitud aprobada", description: "Se ha notificado el cambio a Pablo Sanz" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(vi.mocked(supabase.rpc).mock.calls.filter(([n]) => n === "bandeja_ausencias")).toHaveLength(2)
    );
  });

  it("rechaza sin comentario enviándolo vacío", async () => {
    conPermisos("ausencias.aprobar");
    renderConQuery(<BandejaAusencias />);
    await screen.findByText("Laura Gómez");

    await userEvent.click(within(tarjetaDe("Laura Gómez")).getByRole("button", { name: /Rechazar/ }));
    const dialogo = screen.getByRole("dialog", { name: "Rechazar solicitud" });
    expect(within(dialogo).getByLabelText(/Motivo del rechazo/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Rechazar" }));

    expect(supabase.rpc).toHaveBeenCalledWith("revisar_ausencia", {
      solicitud_id: "s1",
      decision: "rechazada",
      comentario: undefined,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Solicitud rechazada" }));
  });

  it("si falla la revisión avisa y deja el diálogo abierto", async () => {
    conPermisos("ausencias.aprobar");
    vi.mocked(supabase.rpc).mockImplementation((async (nombre: string) =>
      nombre === "bandeja_ausencias"
        ? { data: SOLICITUDES, error: null }
        : { data: null, error: { message: "La solicitud ya fue revisada" } }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderConQuery(<BandejaAusencias />);
    await screen.findByText("Pablo Sanz");

    await userEvent.click(within(tarjetaDe("Pablo Sanz")).getByRole("button", { name: /Aprobar/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aprobar" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "La solicitud ya fue revisada", variant: "destructive" })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("abre el justificante con un enlace firmado", async () => {
    conPermisos("ausencias.aprobar");
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://firmado.test/j.pdf" }, error: null }));
    vi.mocked(supabase.storage.from).mockReturnValue({ createSignedUrl } as never);
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    renderConQuery(<BandejaAusencias />);

    await userEvent.click(await screen.findByRole("button", { name: "Ver justificante" }));

    expect(supabase.storage.from).toHaveBeenCalledWith("justificantes");
    expect(createSignedUrl).toHaveBeenCalledWith("e1/justificante.pdf", 60);
    expect(abrir).toHaveBeenCalledWith("https://firmado.test/j.pdf", "_blank", "noopener,noreferrer");
  });
});
