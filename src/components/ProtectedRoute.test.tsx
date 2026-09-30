import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

const conSesion = (estado: { user?: object | null; mfaPending?: boolean; loading?: boolean }) =>
  vi.mocked(useAuth).mockReturnValue({ user: null, mfaPending: false, loading: false, ...estado } as ReturnType<typeof useAuth>);

const pintar = () =>
  render(
    <MemoryRouter initialEntries={["/tareas"]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route
          path="/tareas"
          element={
            <ProtectedRoute>
              <p>Contenido privado</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  it("muestra la página con sesión iniciada", () => {
    conSesion({ user: { id: "u1" } });
    pintar();
    expect(screen.getByText("Contenido privado")).toBeInTheDocument();
  });

  it("manda al login sin sesión", () => {
    conSesion({ user: null });
    pintar();
    expect(screen.getByText("Pantalla de login")).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });

  it("manda al login si falta el segundo factor", () => {
    conSesion({ user: { id: "u1" }, mfaPending: true });
    pintar();
    expect(screen.getByText("Pantalla de login")).toBeInTheDocument();
  });

  it("no muestra nada privado mientras comprueba la sesión", () => {
    conSesion({ loading: true });
    pintar();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
    expect(screen.queryByText("Pantalla de login")).not.toBeInTheDocument();
  });
});
