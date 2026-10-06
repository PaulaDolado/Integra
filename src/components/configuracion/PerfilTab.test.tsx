import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { renderConQuery } from "@/test/render";
import { PerfilTab } from "./PerfilTab";
import type { Empleado } from "./types";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CONTACTOS = [
  { id: "c1", empleado_id: "e1", nombre: "Ana Gómez", relacion: "Madre", telefono: "600111222", created_at: "2026-09-01T10:00:00Z" },
];

// contactos_emergencia: select().eq().order() para leer y update().eq() para corregir
const eq = vi.fn(async () => ({ error: null }));
const tabla = {
  select: () => ({ eq: () => ({ order: async () => ({ data: CONTACTOS, error: null }) }) }),
  update: vi.fn(() => ({ eq })),
};

const empleado = { id: "e1", nombre: "Laura", primer_apellido: "Gómez", segundo_apellido: "", numero_telefono: null, idioma: "es" } as unknown as Empleado;

describe("Contactos de emergencia en Configuración", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockReturnValue(tabla as never);
  });

  it("el empleado corrige el teléfono de uno de sus contactos", async () => {
    renderConQuery(<PerfilTab empleado={empleado} onUpdated={async () => {}} />);
    // La tarjeta de contactos: el primer antepasado que tiene su botón «Modificar»
    let seccion = await screen.findByText("Ana Gómez");
    while (!within(seccion).queryByRole("button", { name: "Modificar" })) seccion = seccion.parentElement!;
    await userEvent.click(within(seccion).getByRole("button", { name: "Modificar" }));
    await userEvent.click(screen.getByRole("button", { name: "Editar a Ana Gómez" }));

    // Mientras se corrige un contacto no se muestra el formulario de añadir
    expect(screen.queryByText("Añadir contacto")).not.toBeInTheDocument();
    const telefono = screen.getByLabelText("Teléfono *");
    expect(telefono).toHaveValue("600111222");
    await userEvent.clear(telefono);
    await userEvent.type(telefono, "699000111");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(tabla.update).toHaveBeenCalledWith({ nombre: "Ana Gómez", relacion: "Madre", telefono: "699000111" }));
    expect(eq).toHaveBeenCalledWith("id", "c1");
  });
});
