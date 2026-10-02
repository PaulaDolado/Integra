import type { Entrada } from "./cripto";

// Generador ----------------------------------------------------------------------

export interface OpcionesGenerador {
  longitud: number;
  mayusculas: boolean;
  minusculas: boolean;
  numeros: boolean;
  simbolos: boolean;
}

export const OPCIONES_POR_DEFECTO: OpcionesGenerador = {
  longitud: 20,
  mayusculas: true,
  minusculas: true,
  numeros: true,
  simbolos: true,
};

export const LONGITUD_MINIMA = 8;
export const LONGITUD_MAXIMA = 64;

const CONJUNTOS = {
  mayusculas: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  minusculas: "abcdefghijklmnopqrstuvwxyz",
  numeros: "0123456789",
  simbolos: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;

// Entero aleatorio uniforme en [0, max) con el generador criptográfico.
// Se descartan los valores del final del rango para no favorecer ningún carácter.
function aleatorio(max: number): number {
  const limite = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limite);
  return buffer[0] % max;
}

// Incluye al menos un carácter de cada tipo elegido
export function generarContrasena(opciones: OpcionesGenerador): string {
  const elegidos = (Object.keys(CONJUNTOS) as (keyof typeof CONJUNTOS)[])
    .filter((k) => opciones[k])
    .map((k) => CONJUNTOS[k]);
  if (elegidos.length === 0) elegidos.push(CONJUNTOS.minusculas);

  const longitud = Math.min(LONGITUD_MAXIMA, Math.max(LONGITUD_MINIMA, opciones.longitud));
  const todos = elegidos.join("");
  const caracteres = elegidos.map((c) => c[aleatorio(c.length)]);
  while (caracteres.length < longitud) caracteres.push(todos[aleatorio(todos.length)]);

  // Fisher-Yates, para que los obligatorios no queden siempre al principio
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

// Fuerza -------------------------------------------------------------------------

export type Fuerza = 0 | 1 | 2 | 3 | 4;

export const ETIQUETAS_FUERZA: Record<Fuerza, string> = {
  0: "Muy débil",
  1: "Débil",
  2: "Aceptable",
  3: "Fuerte",
  4: "Muy fuerte",
};

const COMUNES = ["password", "contrasena", "contraseña", "qwerty", "123456", "abc123", "admin", "letmein", "welcome", "integra", "iloveyou", "111111"];

// Estimación por entropía: tamaño del alfabeto usado y longitud, con
// penalizaciones por palabras habituales, repeticiones y secuencias
export function fuerzaContrasena(contrasena: string): Fuerza {
  if (!contrasena) return 0;
  const minus = contrasena.toLowerCase();
  if (COMUNES.some((c) => minus.includes(c)) && contrasena.length < 16) return 0;

  let alfabeto = 0;
  if (/[a-z]/.test(contrasena)) alfabeto += 26;
  if (/[A-Z]/.test(contrasena)) alfabeto += 26;
  if (/[0-9]/.test(contrasena)) alfabeto += 10;
  if (/[^a-zA-Z0-9]/.test(contrasena)) alfabeto += 33;

  // Los caracteres repetidos o en secuencia (aaa, abc, 123) apenas suman
  let efectiva = 0;
  for (let i = 0; i < contrasena.length; i++) {
    const anterior = contrasena.charCodeAt(i - 1);
    const actual = contrasena.charCodeAt(i);
    efectiva += i > 0 && Math.abs(actual - anterior) <= 1 ? 0.25 : 1;
  }

  const bits = efectiva * Math.log2(Math.max(alfabeto, 1));
  if (bits < 28) return 0;
  if (bits < 40) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}

export const esDebil = (contrasena: string) => fuerzaContrasena(contrasena) < 2;

// Contraseña maestra -----------------------------------------------------------------

export const LONGITUD_MINIMA_MAESTRA = 12;

// La contraseña maestra protege todas las demás: se exige que sea larga y al
// menos «Aceptable»
export function errorMaestra(maestra: string, confirmacion: string): string | null {
  if (maestra.length < LONGITUD_MINIMA_MAESTRA) return `Debe tener al menos ${LONGITUD_MINIMA_MAESTRA} caracteres`;
  if (fuerzaContrasena(maestra) < 2) return "Es demasiado fácil de adivinar";
  if (maestra !== confirmacion) return "Las contraseñas no coinciden";
  return null;
}

// Salud de la bóveda --------------------------------------------------------------

export interface EntradaDescifrada extends Entrada {
  id: string;
  updated_at: string;
}

export interface Salud {
  debiles: Set<string>;
  repetidas: Set<string>;
  // Porcentaje de contraseñas que no son débiles ni están repetidas
  puntuacion: number | null;
}

export function analizarSalud(entradas: EntradaDescifrada[]): Salud {
  const conContrasena = entradas.filter((e) => e.contrasena);
  const usos = new Map<string, number>();
  for (const e of conContrasena) usos.set(e.contrasena, (usos.get(e.contrasena) ?? 0) + 1);

  const debiles = new Set(conContrasena.filter((e) => esDebil(e.contrasena)).map((e) => e.id));
  const repetidas = new Set(conContrasena.filter((e) => usos.get(e.contrasena)! > 1).map((e) => e.id));
  const sanas = conContrasena.filter((e) => !debiles.has(e.id) && !repetidas.has(e.id)).length;

  return {
    debiles,
    repetidas,
    puntuacion: conContrasena.length ? Math.round((sanas / conContrasena.length) * 100) : null,
  };
}

// Utilidades de la web de cada entrada ----------------------------------------------

// Normaliza lo que escribe el usuario ("gmail.com") a una URL que se puede abrir
export function normalizarUrl(url: string): string {
  const limpia = url.trim();
  if (!limpia) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(limpia) ? limpia : `https://${limpia}`;
}

// Solo se abren enlaces http(s), nunca javascript: ni similares
export function urlAbrible(url: string): string | null {
  try {
    const u = new URL(normalizarUrl(url));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function dominio(url: string): string {
  try {
    return new URL(normalizarUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
