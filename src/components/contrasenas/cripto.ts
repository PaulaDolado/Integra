// Cifrado de la bóveda de contraseñas. Todo ocurre en el navegador con Web
// Crypto: la contraseña maestra se convierte en una clave AES-GCM de 256 bits
// con PBKDF2-SHA256, y al servidor solo llega el texto cifrado.

// Recomendación de OWASP (2023) para PBKDF2-HMAC-SHA256
export const ITERACIONES = 600_000;

// Texto conocido que se cifra al crear la bóveda; si se descifra bien, la
// contraseña maestra es correcta
const VERIFICADOR = "integra-boveda-v1";
const LONGITUD_IV = 12;
const LONGITUD_SAL = 16;

export interface Entrada {
  nombre: string;
  url: string;
  usuario: string;
  contrasena: string;
  notas: string;
  favorito: boolean;
}

export interface ParametrosBoveda {
  sal: string;
  iteraciones: number;
  verificador: string;
}

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

export function aBase64(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

export async function derivarClave(maestra: string, sal: Uint8Array, iteraciones: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", codificador.encode(maestra), "PBKDF2", false, ["deriveKey"]);
  // La clave no es exportable: no se puede sacar de la memoria del navegador
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Devuelve base64(iv || texto cifrado). Cada cifrado usa un IV aleatorio nuevo.
export async function cifrar(clave: CryptoKey, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(LONGITUD_IV));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, codificador.encode(texto)));
  const salida = new Uint8Array(iv.length + cifrado.length);
  salida.set(iv);
  salida.set(cifrado, iv.length);
  return aBase64(salida);
}

// Falla si la clave no es la correcta o si el texto se ha manipulado (AES-GCM
// autentica el contenido)
export async function descifrar(clave: CryptoKey, cifrado: string): Promise<string> {
  const bytes = deBase64(cifrado);
  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, LONGITUD_IV) },
    clave,
    bytes.slice(LONGITUD_IV)
  );
  return decodificador.decode(claro);
}

export async function crearBoveda(
  maestra: string,
  iteraciones = ITERACIONES
): Promise<{ clave: CryptoKey; parametros: ParametrosBoveda }> {
  const sal = crypto.getRandomValues(new Uint8Array(LONGITUD_SAL));
  const clave = await derivarClave(maestra, sal, iteraciones);
  return {
    clave,
    parametros: { sal: aBase64(sal), iteraciones, verificador: await cifrar(clave, VERIFICADOR) },
  };
}

// Devuelve la clave si la contraseña maestra es correcta, o null si no lo es
export async function abrirBoveda(maestra: string, parametros: ParametrosBoveda): Promise<CryptoKey | null> {
  const clave = await derivarClave(maestra, deBase64(parametros.sal), parametros.iteraciones);
  try {
    return (await descifrar(clave, parametros.verificador)) === VERIFICADOR ? clave : null;
  } catch {
    return null;
  }
}

export const cifrarEntrada = (clave: CryptoKey, entrada: Entrada) => cifrar(clave, JSON.stringify(entrada));

export async function descifrarEntrada(clave: CryptoKey, datos: string): Promise<Entrada> {
  const e = JSON.parse(await descifrar(clave, datos)) as Partial<Entrada>;
  return {
    nombre: e.nombre ?? "",
    url: e.url ?? "",
    usuario: e.usuario ?? "",
    contrasena: e.contrasena ?? "",
    notas: e.notas ?? "",
    favorito: !!e.favorito,
  };
}
