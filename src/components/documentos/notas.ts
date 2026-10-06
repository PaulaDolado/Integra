import { AlignJustify, Grip, Square, type LucideIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type NotaResumen = Database["public"]["Functions"]["mis_notas"]["Returns"][number];
export type Colaborador = Database["public"]["Functions"]["colaboradores_nota"]["Returns"][number];

export type Formato = "blanco" | "punteado" | "rayas";
export type Rol = "propietario" | "editor" | "lector";

export const FORMATOS: { valor: Formato; etiqueta: string; icono: LucideIcon }[] = [
  { valor: "blanco", etiqueta: "En blanco", icono: Square },
  { valor: "punteado", etiqueta: "Punteado", icono: Grip },
  { valor: "rayas", etiqueta: "Rayas", icono: AlignJustify },
];

export const esFormato = (valor: unknown): valor is Formato => FORMATOS.some((f) => f.valor === valor);

// Clase CSS del fondo de la hoja (src/components/documentos/editor-notas.css)
export const clasePapel = (formato: string) => `papel-nota papel-${esFormato(formato) ? formato : "blanco"}`;

export const ROLES: Record<Rol, string> = {
  propietario: "Propietario",
  editor: "Puede editar",
  lector: "Solo lectura",
};

export const puedeEditar = (rol: string | null | undefined) => rol === "propietario" || rol === "editor";

export const tituloNota = (titulo: string | null | undefined) => titulo?.trim() || "Sin título";

export const BUCKET_NOTAS = "notas";
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Color estable para cada persona (cursores y avatares de quien está en la nota)
const COLORES = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626"];

export function colorDePersona(id: string) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return COLORES[Math.abs(hash) % COLORES.length];
}

export const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Texto de la lista: «Mías», «Compartidas conmigo» o todas
export type FiltroNotas = "todas" | "mias" | "compartidas";

export function filtrarNotas(notas: NotaResumen[], filtro: FiltroNotas, busqueda: string) {
  const texto = busqueda.trim().toLowerCase();
  return notas.filter((n) => {
    if (filtro === "mias" && n.mi_rol !== "propietario") return false;
    if (filtro === "compartidas" && n.mi_rol === "propietario") return false;
    if (!texto) return true;
    return [n.titulo, n.extracto, n.propietario_nombre].join(" ").toLowerCase().includes(texto);
  });
}
