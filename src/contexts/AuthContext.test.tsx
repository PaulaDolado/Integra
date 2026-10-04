import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "./AuthContext";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: null, error: null })) },
    },
  },
}));

const escucharCambiosDeSesion = () => {
  let avisar: (evento: string, sesion: null) => void = () => {};
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: typeof avisar) => {
    avisar = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }) as never);
  return (evento: string) => avisar(evento, null);
};

describe("AuthProvider", () => {
  it("al cerrar sesión borra de la caché todo lo que vio el usuario", async () => {
    const avisar = escucharCambiosDeSesion();
    render(<AuthProvider>contenido</AuthProvider>);
    queryClient.setQueryData(["datos-pago", "e1"], { iban: "ES00 0000" });

    avisar("TOKEN_REFRESHED");
    expect(queryClient.getQueryData(["datos-pago", "e1"])).toBeDefined();

    avisar("SIGNED_OUT");
    await waitFor(() => expect(queryClient.getQueryData(["datos-pago", "e1"])).toBeUndefined());
  });
});
