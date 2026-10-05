import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Login from "./Login";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const conSesion = (estado: { user?: object | null; mfaPending?: boolean } = {}) =>
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    mfaPending: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshMfaStatus: vi.fn(),
    ...estado,
  } as unknown as ReturnType<typeof useAuth>);

const pintar = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe("Login", () => {
  it("el botón del ojo dice si muestra u oculta la contraseña", async () => {
    conSesion();
    pintar();
    const contrasena = screen.getByLabelText("Contraseña");
    expect(contrasena).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(contrasena).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    conSesion();
    const { unmount } = pintar();
    await expectSinViolaciones(document.body, { conLayout: true });

    // Formulario de recuperar la contraseña
    await userEvent.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    screen.getByRole("heading", { name: "Recuperar Contraseña" });
    await expectSinViolaciones(document.body, { conLayout: true });
    unmount();

    // Verificación en dos pasos
    conSesion({ user: { id: "u1" }, mfaPending: true });
    pintar();
    screen.getByLabelText("Código de verificación");
    await expectSinViolaciones(document.body, { conLayout: true });
  });
});
