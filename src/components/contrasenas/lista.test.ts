import { describe, expect, it } from "vitest";
import { analizarSalud, type EntradaDescifrada } from "./contrasenas";
import { colorAvatar, filtrarEntradas, ordenar } from "./lista";

const entrada = (id: string, cambios: Partial<EntradaDescifrada> = {}): EntradaDescifrada => ({
  id,
  nombre: id,
  usuario: "",
  contrasena: "X7#pQ9!vLm2$Rk8@",
  url: "",
  notas: "",
  favorito: false,
  updated_at: "2026-10-01T10:00:00Z",
  ...cambios,
});

describe("lista de entradas", () => {
  it("ordena primero las favoritas y después por nombre", () => {
    const lista = [entrada("Zoom"), entrada("Árbol"), entrada("GitHub", { favorito: true }), entrada("Correo")];
    expect(ordenar(lista).map((e) => e.nombre)).toEqual(["GitHub", "Árbol", "Correo", "Zoom"]);
    // No modifica la lista original
    expect(lista[0].nombre).toBe("Zoom");
  });

  it("filtra por favoritas, débiles y repetidas", () => {
    const lista = [
      entrada("fav", { favorito: true }),
      entrada("debil", { contrasena: "1234" }),
      entrada("a", { contrasena: "repetida-Larga#2026" }),
      entrada("b", { contrasena: "repetida-Larga#2026" }),
    ];
    const salud = analizarSalud(lista);
    const ids = (filtro: Parameters<typeof filtrarEntradas>[2]) => filtrarEntradas(lista, salud, filtro, "").map((e) => e.id);
    expect(ids("todas")).toEqual(["fav", "debil", "a", "b"]);
    expect(ids("favoritas")).toEqual(["fav"]);
    expect(ids("debiles")).toEqual(["debil"]);
    expect(ids("repetidas")).toEqual(["a", "b"]);
  });

  it("busca sin distinguir mayúsculas en nombre, usuario, web y notas, pero nunca en la contraseña", () => {
    const lista = [
      entrada("GitHub", { usuario: "laura" }),
      entrada("Intranet", { url: "intranet.empresa.test" }),
      entrada("Banco", { notas: "Tarjeta de empresa" }),
    ];
    const salud = analizarSalud(lista);
    const buscar = (texto: string) => filtrarEntradas(lista, salud, "todas", texto).map((e) => e.id);
    expect(buscar("  LAURA ")).toEqual(["GitHub"]);
    expect(buscar("empresa")).toEqual(["Intranet", "Banco"]);
    expect(buscar("X7#pQ9")).toEqual([]);
  });

  it("da siempre el mismo color de avatar al mismo nombre", () => {
    expect(colorAvatar("GitHub")).toBe(colorAvatar("GitHub"));
    expect(colorAvatar("")).toMatch(/^bg-/);
  });
});
