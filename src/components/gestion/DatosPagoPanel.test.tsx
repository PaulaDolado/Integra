import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { DatosPagoPanel } from "./DatosPagoPanel";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

// IBAN ficticio de ejemplo (no es de nadie)
const IBAN = "ES9121000418450200051332";
const ENMASCARADO = "ES" + "•".repeat(IBAN.length - 6) + "1332";

describe("Datos de pago en la ficha del empleado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({
        datos_pago_plantilla: [
          { empleado_id: "e1", empleado: "Laura Gómez", departamento: "RRHH", forma_pago: "transferencia", iban_enmascarado: ENMASCARADO, actualizado: "2026-09-01T10:00:00Z" },
          { empleado_id: "e2", empleado: "Pablo Sanz", departamento: "Finanzas", forma_pago: null, iban_enmascarado: null, actualizado: null },
        ],
        guardar_datos_pago: null,
      }) as never
    );
  });

  it("muestra el IBAN enmascarado del empleado, nunca el completo", async () => {
    renderConQuery(<DatosPagoPanel empleadoId="e1" />);
    expect(await screen.findByText("ES•• •••• •••• •••• •••• 1332")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("2100");
    expect(supabase.rpc).not.toHaveBeenCalledWith("ver_iban", expect.anything());
  });

  it("cambia el IBAN y lo deja registrado", async () => {
    renderConQuery(<DatosPagoPanel empleadoId="e2" />);
    expect(await screen.findByText("Sin IBAN")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar IBAN" }));
    await userEvent.type(screen.getByLabelText("Nuevo IBAN"), "es91 2100 0418 4502 0005 1332");
    await userEvent.click(screen.getByRole("button", { name: "Guardar IBAN" }));

    expect(supabase.rpc).toHaveBeenCalledWith("guardar_datos_pago", { p_empleado: "e2", p_forma_pago: "transferencia", p_iban: IBAN });
    await waitFor(() => expect(screen.queryByLabelText("Nuevo IBAN")).not.toBeInTheDocument());
  });

  it("no guarda un IBAN con el dígito de control mal", async () => {
    renderConQuery(<DatosPagoPanel empleadoId="e1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar IBAN" }));
    await userEvent.type(screen.getByLabelText("Nuevo IBAN"), "ES92 2100 0418 4502 0005 1332");
    await userEvent.click(screen.getByRole("button", { name: "Guardar IBAN" }));
    expect(supabase.rpc).not.toHaveBeenCalledWith("guardar_datos_pago", expect.anything());
  });
});
