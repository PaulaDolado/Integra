import { describe, expect, it } from "vitest";
import { AuthWeakPasswordError } from "@supabase/supabase-js";
import { mensajeContrasenaRechazada } from "./errores-contrasena";

const debil = (...motivos: string[]) => new AuthWeakPasswordError("Password is known to be weak", 422, motivos as never);

describe("mensajeContrasenaRechazada", () => {
  it("explica que la contraseña aparece en filtraciones conocidas", () => {
    expect(mensajeContrasenaRechazada(debil("pwned"))).toMatch(/filtraciones de datos conocidas/);
    // Aunque haya otros motivos, el de la filtración es el más útil
    expect(mensajeContrasenaRechazada(debil("characters", "pwned"))).toMatch(/filtraciones/);
  });

  it("explica los demás motivos de una contraseña débil", () => {
    expect(mensajeContrasenaRechazada(debil("length"))).toBe("La contraseña es demasiado corta");
    expect(mensajeContrasenaRechazada(debil("characters"))).toMatch(/tipos de caracteres/);
    expect(mensajeContrasenaRechazada({ code: "weak_password" })).toMatch(/demasiado débil/);
  });

  it("avisa si la contraseña nueva es igual a la actual", () => {
    expect(mensajeContrasenaRechazada({ code: "same_password" })).toBe("La nueva contraseña debe ser distinta a la actual");
  });

  it("no se aplica a otros errores", () => {
    expect(mensajeContrasenaRechazada({ code: "over_request_rate_limit" })).toBeNull();
    expect(mensajeContrasenaRechazada(null)).toBeNull();
  });
});
