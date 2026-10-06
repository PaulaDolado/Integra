import type { JSONContent } from "@tiptap/core";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const texto = (contenido: string, estilo?: Record<string, string>, negrita = false): JSONContent => ({
  type: "text",
  text: contenido,
  marks: [...(negrita ? [{ type: "bold" }] : []), ...(estilo ? [{ type: "textStyle", attrs: estilo }] : [])],
});

const centrado = (contenido?: JSONContent): JSONContent => ({
  type: "paragraph",
  attrs: { textAlign: "center" },
  ...(contenido ? { content: [contenido] } : {}),
});

const vacios = (cuantos: number) => Array.from({ length: cuantos }, () => centrado());

// Portada: título grande, subtítulo, autor y fecha, y un salto de página.
// El título es un párrafo y no un título, para que no salga en el índice.
export function plantillaPortada({ autor, fecha = new Date() }: { autor: string; fecha?: Date }): JSONContent[] {
  return [
    ...vacios(6),
    centrado(texto("Título del documento", { fontSize: "40px" }, true)),
    centrado(texto("Subtítulo o descripción", { fontSize: "20px", color: "#6b7280" })),
    ...vacios(10),
    centrado(texto(autor, { fontSize: "18px" })),
    centrado(texto(format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es }), { color: "#6b7280" })),
    { type: "saltoPagina" },
  ];
}

// Índice automático en su propia página
export function plantillaIndice(): JSONContent[] {
  return [{ type: "indiceNota" }, { type: "saltoPagina" }];
}
