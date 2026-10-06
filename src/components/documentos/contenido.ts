import * as Y from "yjs";
import type { Node as NodoPM } from "@tiptap/pm/model";

// Campo del documento Yjs donde vive el contenido del editor (el de Tiptap por defecto)
export const CAMPO_CONTENIDO = "default";

// Texto plano del documento Yjs, para el extracto de la lista de notas. Los
// bloques se separan con un espacio; las ecuaciones y marcadores no cuentan.
export function textoDeDocumento(doc: Y.Doc, maximo = 300) {
  const partes: string[] = [];
  let longitud = 0;

  const recorrer = (nodo: Y.XmlElement | Y.XmlFragment | Y.XmlText) => {
    if (longitud >= maximo) return;
    if (nodo instanceof Y.XmlText) {
      const texto = (nodo.toDelta() as { insert: unknown }[])
        .map((d) => (typeof d.insert === "string" ? d.insert : ""))
        .join("");
      if (texto) {
        partes.push(texto);
        longitud += texto.length + 1;
      }
      return;
    }
    for (const hijo of nodo.toArray()) {
      if (hijo instanceof Y.XmlElement || hijo instanceof Y.XmlText) recorrer(hijo);
    }
  };

  recorrer(doc.getXmlFragment(CAMPO_CONTENIDO));
  return partes.join(" ").replace(/\s+/g, " ").trim().slice(0, maximo);
}

// Enlaces: solo web, correo, teléfono o un marcador de la propia nota. Nunca
// javascript:, data: ni similares.
const PREFIJO_MARCADOR = "#marcador-";

export function enlaceSeguro(url: string) {
  const texto = url.trim();
  if (texto.startsWith(PREFIJO_MARCADOR)) return /^#marcador-[\w-]+$/.test(texto);
  try {
    const { protocol } = new URL(texto);
    return ["http:", "https:", "mailto:", "tel:"].includes(protocol);
  } catch {
    return false;
  }
}

// Completa lo que escribe la gente: «integra.com» → «https://integra.com»
export function normalizarEnlace(url: string) {
  const texto = url.trim();
  if (!texto || texto.startsWith("#")) return texto;
  if (/^[a-z][a-z\d+.-]*:/i.test(texto)) return texto;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) return `mailto:${texto}`;
  return `https://${texto}`;
}

export const enlaceAMarcador = (id: string) => `${PREFIJO_MARCADOR}${id}`;
export const marcadorDeEnlace = (href: string) => (href.startsWith(PREFIJO_MARCADOR) ? href.slice(PREFIJO_MARCADOR.length) : null);

export const nuevoIdMarcador = () => crypto.randomUUID().slice(0, 8);

// Páginas: la nota es una hoja continua y las páginas las marcan los saltos de página

// Número de página (desde 1) en el que está una posición del documento
export function paginaDe(doc: NodoPM, pos: number) {
  let pagina = 1;
  doc.nodesBetween(0, Math.min(pos, doc.content.size), (nodo, inicio) => {
    if (nodo.type.name === "saltoPagina" && inicio < pos) pagina++;
    return true;
  });
  return pagina;
}

export function contarPaginas(doc: NodoPM) {
  let paginas = 1;
  doc.descendants((nodo) => {
    if (nodo.type.name === "saltoPagina") paginas++;
    return true;
  });
  return paginas;
}

export interface EntradaIndice {
  tipo: "marcador" | "titulo";
  id: string;
  texto: string;
  nivel: number;
  pos: number;
}

// Marcadores y títulos de la nota, en el orden en que aparecen
export function indiceDeNota(doc: NodoPM): EntradaIndice[] {
  const entradas: EntradaIndice[] = [];
  doc.descendants((nodo, pos) => {
    if (nodo.type.name === "marcador") {
      entradas.push({ tipo: "marcador", id: String(nodo.attrs.id), texto: String(nodo.attrs.nombre || "Marcador"), nivel: 0, pos });
    } else if (nodo.type.name === "heading" && nodo.textContent.trim()) {
      entradas.push({ tipo: "titulo", id: `t-${pos}`, texto: nodo.textContent.trim(), nivel: Number(nodo.attrs.level) || 1, pos });
    }
    return true;
  });
  return entradas;
}
