import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { usePermisos } from "@/hooks/usePermisos";
import { expectSinViolaciones } from "@/test/accesibilidad";
import { AppLayout } from "./AppLayout";

vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "laura@empresa.test" }, signOut: vi.fn() }),
}));
vi.mock("@/hooks/useEmployeeProfile", () => ({
  useEmployeeProfile: () => ({
    profile: { cargo_nombre: "Técnica", correo_electronico: "laura@empresa.test" },
    getDisplayName: () => "Laura Gómez",
    getFirstName: () => "Laura",
  }),
}));
vi.mock("@/hooks/useFichajeActual", () => ({
  useFichajeActual: () => ({ dentro: false, loading: false, registrando: false, fichar: vi.fn() }),
}));

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/tareas"]}>
      <AppLayout>
        <h1>Tareas</h1>
        <p>Contenido de la página</p>
      </AppLayout>
    </MemoryRouter>
  );

describe("AppLayout", () => {
  beforeEach(() => {
    vi.mocked(usePermisos).mockReturnValue({
      permisos: new Set(["datos_pago.ver"]),
      loading: false,
      tiene: (p: string) => p === "datos_pago.ver",
    } as ReturnType<typeof usePermisos>);
  });

  it("lo primero que se enfoca es el enlace para saltar al contenido", async () => {
    pintar();
    await userEvent.tab();

    const saltar = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(saltar).toHaveFocus();
    const principal = screen.getByRole("main");
    expect(saltar).toHaveAttribute("href", `#${principal.id}`);
    expect(principal).toHaveTextContent("Contenido de la página");

    // Al seguirlo, el foco pasa al contenido principal
    await userEvent.keyboard("{Enter}");
    expect(principal).toHaveFocus();
  });

  it("los botones de la barra superior tienen nombre", () => {
    pintar();
    expect(screen.getByRole("button", { name: "Cambiar a modo oscuro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notificaciones/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    pintar();
    await expectSinViolaciones(document.body, { conLayout: true });

    // Menú de usuario abierto. Radix lo pinta en un portal al final de <body>,
    // fuera de los landmarks a propósito, así que aquí no se mira la regla de regiones
    await userEvent.click(screen.getByRole("button", { name: "Menú de usuario" }));
    await screen.findByRole("menu");
    await expectSinViolaciones();
  });
});
