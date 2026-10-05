import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { cifrarEntrada, crearBoveda, type ParametrosBoveda } from "@/components/contrasenas/cripto";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Contrasenas from "./Contrasenas";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Pocas iteraciones para que los tests vayan rápido; en la app se usan 600.000
vi.mock("@/components/contrasenas/cripto", async (original) => {
  const real = await original<typeof import("@/components/contrasenas/cripto")>();
  return { ...real, crearBoveda: (maestra: string) => real.crearBoveda(maestra, 1000) };
});

const MAESTRA = "caballo-bateria-grapa-azul";
const SECRETO = "X7#pQ9!vLm2$Rk8@";

// Base de datos en memoria con lo justo de la API de Supabase que usa la página
let boveda: ParametrosBoveda | null;
let entradas: { id: string; datos: string; updated_at: string }[];
let enviados: unknown[];

function tabla(nombre: string) {
  const resultado = (data: unknown) => Promise.resolve({ data, error: null });
  if (nombre === "boveda_claves") {
    return {
      select: () => ({ maybeSingle: () => resultado(boveda) }),
      insert: (p: ParametrosBoveda) => {
        enviados.push(p);
        boveda = p;
        return resultado(null);
      },
      delete: () => ({ eq: () => ((boveda = null), (entradas = []), resultado(null)) }),
    };
  }
  return {
    select: () => ({ order: () => resultado(entradas) }),
    insert: (fila: { datos: string }) => {
      enviados.push(fila);
      const nueva = { id: `e${entradas.length + 1}`, datos: fila.datos, updated_at: "2026-10-02T10:00:00Z" };
      entradas.push(nueva);
      return { select: () => ({ single: () => resultado(nueva) }) };
    },
  };
}

const conBoveda = async (...filas: { nombre: string; usuario: string; contrasena: string }[]) => {
  const { clave, parametros } = await crearBoveda(MAESTRA);
  boveda = parametros;
  for (const [i, f] of filas.entries()) {
    const datos = await cifrarEntrada(clave, { ...f, url: "", notas: "", favorito: false });
    entradas.push({ id: `e${i + 1}`, datos, updated_at: "2026-10-01T10:00:00Z" });
  }
};

const desbloquear = async (maestra = MAESTRA) => {
  await userEvent.type(await screen.findByLabelText("Contraseña maestra"), maestra);
  await userEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
};

// Escribir las contraseñas tecla a tecla es lento cuando corren todos los tests a la vez
describe("Contraseñas", { timeout: 20_000 }, () => {
  beforeEach(() => {
    boveda = null;
    entradas = [];
    enviados = [];
    vi.mocked(supabase.from).mockImplementation(tabla as never);
  });

  it("crea la bóveda sin enviar la contraseña maestra", async () => {
    render(<Contrasenas />);
    await userEvent.type(await screen.findByLabelText("Contraseña maestra"), "corta");
    await userEvent.type(screen.getByLabelText("Repite la contraseña maestra"), "corta");
    await userEvent.click(screen.getByRole("button", { name: "Crear bóveda" }));
    expect(screen.getByText("Debe tener al menos 12 caracteres")).toBeInTheDocument();
    expect(enviados).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText("Contraseña maestra"));
    await userEvent.clear(screen.getByLabelText("Repite la contraseña maestra"));
    await userEvent.type(screen.getByLabelText("Contraseña maestra"), MAESTRA);
    await userEvent.type(screen.getByLabelText("Repite la contraseña maestra"), MAESTRA);
    await userEvent.click(screen.getByRole("button", { name: "Crear bóveda" }));

    expect(await screen.findByText("Tu bóveda está vacía")).toBeInTheDocument();
    expect(enviados).toHaveLength(1);
    expect(JSON.stringify(enviados)).not.toContain("caballo");
  });

  it("no se abre con una contraseña maestra incorrecta", async () => {
    await conBoveda({ nombre: "GitHub", usuario: "laura", contrasena: SECRETO });
    render(<Contrasenas />);
    await desbloquear("otra-contraseña-mala");
    expect(await screen.findByText("Contraseña maestra incorrecta")).toBeInTheDocument();
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  });

  it("descifra las entradas y solo muestra la contraseña al pedirla", async () => {
    await conBoveda({ nombre: "GitHub", usuario: "laura", contrasena: SECRETO });
    render(<Contrasenas />);
    await desbloquear();

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SECRETO);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña de GitHub" }));
    expect(screen.getByTestId("contrasena-revelada")).toHaveTextContent(SECRETO);
  });

  it("guarda las entradas nuevas cifradas", async () => {
    await conBoveda();
    render(<Contrasenas />);
    await desbloquear();

    await userEvent.click(await screen.findByRole("button", { name: "Nueva contraseña" }));
    await userEvent.type(screen.getByLabelText("Nombre *"), "Intranet");
    await userEvent.type(screen.getByLabelText("Usuario o email"), "laura@empresa.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), SECRETO);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Intranet")).toBeInTheDocument();
    const enviado = JSON.stringify(enviados);
    expect(enviado).not.toContain("Intranet");
    expect(enviado).not.toContain("laura");
    expect(enviado).not.toContain("X7#pQ9");
  });

  it("al bloquear deja de mostrar las contraseñas", async () => {
    await conBoveda({ nombre: "GitHub", usuario: "laura", contrasena: SECRETO });
    render(<Contrasenas />);
    await desbloquear();
    await screen.findByText("GitHub");

    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }));
    await waitFor(() => expect(screen.queryByText("GitHub")).not.toBeInTheDocument());
    expect(screen.getByText("Bóveda bloqueada")).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    await conBoveda({ nombre: "GitHub", usuario: "laura", contrasena: SECRETO });
    render(<Contrasenas />);
    await screen.findByLabelText("Contraseña maestra");
    await expectSinViolaciones();

    await desbloquear();
    await screen.findByText("GitHub");
    await expectSinViolaciones();

    await userEvent.click(screen.getByRole("button", { name: "Nueva contraseña" }));
    await screen.findByLabelText("Nombre *");
    await expectSinViolaciones();
  });
});
