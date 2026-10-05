import type { EntradaDescifrada, Salud } from "./contrasenas";

// Filtros, orden y búsqueda de la lista de entradas de la bóveda

export type Filtro = "todas" | "favoritas" | "debiles" | "repetidas";

export const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "favoritas", etiqueta: "Favoritas" },
  { valor: "debiles", etiqueta: "Débiles" },
  { valor: "repetidas", etiqueta: "Repetidas" },
];

// Primero las favoritas y después por nombre
export const ordenar = (lista: EntradaDescifrada[]) =>
  [...lista].sort((a, b) => Number(b.favorito) - Number(a.favorito) || a.nombre.localeCompare(b.nombre, "es"));

export function filtrarEntradas(entradas: EntradaDescifrada[], salud: Salud, filtro: Filtro, busqueda: string) {
  const texto = busqueda.trim().toLowerCase();
  return entradas.filter((e) => {
    if (filtro === "favoritas" && !e.favorito) return false;
    if (filtro === "debiles" && !salud.debiles.has(e.id)) return false;
    if (filtro === "repetidas" && !salud.repetidas.has(e.id)) return false;
    return !texto || [e.nombre, e.usuario, e.url, e.notas].some((c) => c.toLowerCase().includes(texto));
  });
}

const COLORES_AVATAR = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
];

// Siempre el mismo color para el mismo nombre
export function colorAvatar(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_AVATAR[h % COLORES_AVATAR.length];
}
