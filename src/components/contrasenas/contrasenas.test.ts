import { describe, expect, it } from "vitest";
import {
  analizarSalud,
  dominio,
  fuerzaContrasena,
  generarContrasena,
  urlAbrible,
  type EntradaDescifrada,
} from "./contrasenas";

const entrada = (id: string, contrasena: string): EntradaDescifrada => ({
  id,
  contrasena,
  nombre: id,
  url: "",
  usuario: "",
  notas: "",
  favorito: false,
  updated_at: "2026-10-01T10:00:00Z",
});

describe("generador", () => {
  it("respeta la longitud y los tipos de carácter elegidos", () => {
    for (let i = 0; i < 50; i++) {
      const c = generarContrasena({ longitud: 16, mayusculas: true, minusculas: true, numeros: true, simbolos: true });
      expect(c).toHaveLength(16);
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[a-z]/);
      expect(c).toMatch(/[0-9]/);
      expect(c).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("solo usa los tipos activados", () => {
    const c = generarContrasena({ longitud: 40, mayusculas: false, minusculas: false, numeros: true, simbolos: false });
    expect(c).toMatch(/^[0-9]{40}$/);
  });

  it("limita la longitud entre 8 y 64", () => {
    const base = { mayusculas: true, minusculas: true, numeros: true, simbolos: false };
    expect(generarContrasena({ ...base, longitud: 2 })).toHaveLength(8);
    expect(generarContrasena({ ...base, longitud: 500 })).toHaveLength(64);
  });

  it("no repite contraseñas", () => {
    const generadas = new Set(Array.from({ length: 200 }, () => generarContrasena({ longitud: 20, mayusculas: true, minusculas: true, numeros: true, simbolos: true })));
    expect(generadas.size).toBe(200);
  });
});

describe("fuerza", () => {
  it("las habituales y las cortas son débiles", () => {
    expect(fuerzaContrasena("")).toBe(0);
    expect(fuerzaContrasena("password1")).toBe(0);
    expect(fuerzaContrasena("123456789")).toBe(0);
    expect(fuerzaContrasena("aaaaaaaaaaaa")).toBeLessThan(2);
    expect(fuerzaContrasena("Gato12")).toBeLessThan(2);
  });

  it("las largas y variadas son fuertes", () => {
    expect(fuerzaContrasena("X7#pQ9!vLm2$Rk8@")).toBe(4);
    expect(fuerzaContrasena("correcto-caballo-bateria-grapa")).toBeGreaterThanOrEqual(3);
  });
});

describe("salud de la bóveda", () => {
  it("detecta las débiles y las repetidas", () => {
    const salud = analizarSalud([
      entrada("a", "X7#pQ9!vLm2$Rk8@"),
      entrada("b", "X7#pQ9!vLm2$Rk8@"),
      entrada("c", "1234"),
      entrada("d", "Zq9!mW3#tY6&uP1^"),
      entrada("e", ""),
    ]);
    expect([...salud.repetidas].sort()).toEqual(["a", "b"]);
    expect([...salud.debiles]).toEqual(["c"]);
    // Solo «d» está sana de las 4 que tienen contraseña
    expect(salud.puntuacion).toBe(25);
  });

  it("sin contraseñas no hay puntuación", () => {
    expect(analizarSalud([]).puntuacion).toBeNull();
  });
});

describe("webs", () => {
  it("añade https a las direcciones sin protocolo", () => {
    expect(urlAbrible("gmail.com")).toBe("https://gmail.com/");
    expect(dominio("https://www.github.com/login")).toBe("github.com");
  });

  it("nunca abre enlaces javascript:", () => {
    expect(urlAbrible("javascript:alert(1)")).toBeNull();
    expect(urlAbrible("data:text/html,hola")).toBeNull();
  });
});
