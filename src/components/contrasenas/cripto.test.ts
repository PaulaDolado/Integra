import { describe, expect, it } from "vitest";
import { abrirBoveda, cifrar, cifrarEntrada, crearBoveda, deBase64, descifrar, descifrarEntrada, type Entrada } from "./cripto";

// Pocas iteraciones para que los tests vayan rápido; en la app se usan 600.000
const ITER = 1000;

const ENTRADA: Entrada = {
  nombre: "Correo",
  url: "outlook.office.com",
  usuario: "laura@empresa.test",
  contrasena: "X7#pQ9!vLm2$",
  notas: "",
  favorito: true,
};

describe("cifrado de la bóveda", () => {
  it("abre la bóveda solo con la contraseña maestra correcta", async () => {
    const { parametros } = await crearBoveda("caballo-bateria-grapa", ITER);
    expect(await abrirBoveda("caballo-bateria-grapa", parametros)).not.toBeNull();
    expect(await abrirBoveda("caballo-bateria-grapa ", parametros)).toBeNull();
    expect(await abrirBoveda("", parametros)).toBeNull();
  });

  it("los parámetros guardados no contienen la contraseña maestra", async () => {
    const { parametros } = await crearBoveda("caballo-bateria-grapa", ITER);
    expect(JSON.stringify(parametros)).not.toContain("caballo");
    expect(deBase64(parametros.sal)).toHaveLength(16);
  });

  it("cifra y descifra una entrada sin dejar texto legible", async () => {
    const { clave } = await crearBoveda("caballo-bateria-grapa", ITER);
    const datos = await cifrarEntrada(clave, ENTRADA);
    expect(datos).not.toContain("X7#pQ9");
    expect(atob(datos)).not.toContain("laura");
    expect(await descifrarEntrada(clave, datos)).toEqual(ENTRADA);
  });

  it("usa un IV distinto en cada cifrado", async () => {
    const { clave } = await crearBoveda("caballo-bateria-grapa", ITER);
    expect(await cifrar(clave, "hola")).not.toBe(await cifrar(clave, "hola"));
  });

  it("no descifra con otra clave ni si el texto se ha manipulado", async () => {
    const a = await crearBoveda("caballo-bateria-grapa", ITER);
    const b = await crearBoveda("otra-clave-distinta", ITER);
    const datos = await cifrar(a.clave, "secreto");
    await expect(descifrar(b.clave, datos)).rejects.toThrow();

    const bytes = deBase64(datos);
    bytes[bytes.length - 1] ^= 1;
    const manipulado = btoa(String.fromCharCode(...bytes));
    await expect(descifrar(a.clave, manipulado)).rejects.toThrow();
  });

  it("la misma contraseña maestra con distinta sal da claves distintas", async () => {
    const a = await crearBoveda("caballo-bateria-grapa", ITER);
    const b = await crearBoveda("caballo-bateria-grapa", ITER);
    expect(a.parametros.sal).not.toBe(b.parametros.sal);
    await expect(descifrar(b.clave, await cifrar(a.clave, "x"))).rejects.toThrow();
  });
});
