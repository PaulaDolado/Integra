import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import { SuscripcionCalendario } from "./SuscripcionCalendario";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const TOKEN = "a".repeat(64);
const NUEVO = "b".repeat(64);
// VITE_SUPABASE_URL de los tests (vitest.config.ts)
const enlace = (token: string) => `http://supabase.test/functions/v1/calendario-ics?token=${token}`;

const abrir = () => renderConQuery(<SuscripcionCalendario open onOpenChange={vi.fn()} />);

describe("Suscripción al calendario", () => {
  beforeEach(() => {
    toast.mockReset();
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ mi_token_calendario: TOKEN, regenerar_token_calendario: NUEVO }) as never
    );
  });

  it("muestra el enlace privado y los pasos para Google Calendar", async () => {
    abrir();
    expect(await screen.findByLabelText("Tu enlace privado")).toHaveValue(enlace(TOKEN));
    expect(supabase.rpc).toHaveBeenCalledWith("mi_token_calendario");
    expect(screen.getByText(/No lo compartas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir Google Calendar/ })).toHaveAttribute(
      "href",
      "https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
    );
  });

  it("no pide el enlace mientras el diálogo está cerrado", () => {
    renderConQuery(<SuscripcionCalendario open={false} onOpenChange={vi.fn()} />);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("copia el enlace al portapapeles", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    abrir();
    await screen.findByLabelText("Tu enlace privado");

    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(enlace(TOKEN));
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("genera un enlace nuevo solo tras confirmarlo", async () => {
    abrir();
    await screen.findByLabelText("Tu enlace privado");

    await userEvent.click(screen.getByRole("button", { name: /Generar un enlace nuevo/ }));
    const confirmacion = screen.getByRole("alertdialog", { name: "¿Generar un enlace nuevo?" });
    expect(supabase.rpc).not.toHaveBeenCalledWith("regenerar_token_calendario");

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Generar enlace nuevo" }));
    expect(supabase.rpc).toHaveBeenCalledWith("regenerar_token_calendario");
    await waitFor(() => expect(screen.getByLabelText("Tu enlace privado")).toHaveValue(enlace(NUEVO)));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Enlace nuevo generado" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("si no puede obtener el enlace lo dice", async () => {
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({}) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    abrir();
    expect(await screen.findByText(/No se pudo obtener tu enlace/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu enlace privado")).not.toBeInTheDocument();
  });

  it("sin Google conectado ofrece conectarlo", async () => {
    const google = { conexion: null, conectar: vi.fn(async () => undefined), desconectar: vi.fn() };
    renderConQuery(<SuscripcionCalendario open onOpenChange={vi.fn()} google={google} />);

    expect(screen.getByText(/Integra solo podrá leerlos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Conectar Google Calendar" }));
    expect(google.conectar).toHaveBeenCalled();
  });

  it("si no se puede empezar la conexión lo dice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const google = { conexion: null, conectar: vi.fn(async () => Promise.reject(new Error("503"))), desconectar: vi.fn() };
    renderConQuery(<SuscripcionCalendario open onOpenChange={vi.fn()} google={google} />);

    await userEvent.click(screen.getByRole("button", { name: "Conectar Google Calendar" }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "No se pudo conectar con Google Calendar", variant: "destructive" }));
    expect(screen.getByRole("button", { name: "Conectar Google Calendar" })).toBeEnabled();
  });

  it("con Google conectado muestra la cuenta y desconecta tras confirmarlo", async () => {
    const google = {
      conexion: { email: "laura@empresa.test", conectado_en: "2026-10-01T10:00:00Z" },
      conectar: vi.fn(),
      desconectar: vi.fn(async () => undefined),
    };
    renderConQuery(<SuscripcionCalendario open onOpenChange={vi.fn()} google={google} />);

    expect(screen.getByText("laura@empresa.test")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    const confirmacion = screen.getByRole("alertdialog", { name: "¿Desconectar Google Calendar?" });
    expect(google.desconectar).not.toHaveBeenCalled();

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Desconectar" }));
    expect(google.desconectar).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Google Calendar desconectado" }));
  });

  it("no tiene problemas de accesibilidad", async () => {
    const google = { conexion: null, conectar: vi.fn(), desconectar: vi.fn() };
    renderConQuery(<SuscripcionCalendario open onOpenChange={vi.fn()} google={google} />);
    await screen.findByLabelText("Tu enlace privado");
    await expectSinViolaciones();
  });
});
