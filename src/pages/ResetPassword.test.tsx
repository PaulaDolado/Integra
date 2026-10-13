import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AuthWeakPasswordError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import ResetPassword from "./ResetPassword";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(), updateUser: vi.fn() } },
}));

describe("Restablecer contraseña", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: {} }, error: null } as never);
  });

  it("explica en español que la contraseña aparece en filtraciones", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: new AuthWeakPasswordError("Password is known to be weak and easy to guess", 422, ["pwned"]),
    } as never);
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText("Nueva Contraseña"), "password123");
    await userEvent.type(screen.getByLabelText("Confirmar Contraseña"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /Actualizar/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/filtraciones de datos conocidas/) }))
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/known to be weak/) }));
  });
});
