import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { Node as NodoPM } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { VistaImagen } from "./VistaImagen";
import { CAMPO_CONTENIDO, enlaceSeguro, nuevoIdMarcador } from "./contenido";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imagenNota: {
      insertarImagenNota: (atributos: { ruta: string; alt?: string }) => ReturnType;
    };
    marcador: {
      insertarMarcador: (nombre: string) => ReturnType;
    };
  }
}

// Imagen guardada en el bucket privado "notas". Solo se guarda la ruta: las
// imágenes externas pegadas desde otra web no se admiten (no hay ruta).
export const ImagenNota = Node.create({
  name: "imagenNota",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      ruta: { default: null, parseHTML: (el) => el.getAttribute("data-ruta") },
      alt: { default: "", parseHTML: (el) => el.getAttribute("alt") ?? "" },
      ancho: { default: 100, parseHTML: (el) => Number(el.getAttribute("data-ancho")) || 100 },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-ruta]" }];
  },

  renderHTML({ node }) {
    return ["img", { "data-ruta": node.attrs.ruta, alt: node.attrs.alt, "data-ancho": node.attrs.ancho }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaImagen);
  },

  addCommands() {
    return {
      insertarImagenNota:
        (atributos) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: atributos }),
    };
  },
});

// Marcador de página: un punto con nombre dentro del texto. Aparece en el panel
// de marcadores y se puede enlazar desde cualquier parte de la nota.
export const Marcador = Node.create({
  name: "marcador",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      // Se pintan a mano en renderHTML (data-marcador, data-nombre)
      id: { default: null, parseHTML: (el) => el.getAttribute("data-marcador"), renderHTML: () => ({}) },
      nombre: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-nombre") ?? el.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-marcador]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-marcador": node.attrs.id,
        "data-nombre": node.attrs.nombre,
        id: `marcador-${node.attrs.id}`,
        class: "marcador-nota",
        title: `Marcador: ${node.attrs.nombre}`,
      }),
      String(node.attrs.nombre || "Marcador"),
    ];
  },

  renderText({ node }) {
    return `[${node.attrs.nombre}]`;
  },

  addCommands() {
    return {
      insertarMarcador:
        (nombre) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { id: nuevoIdMarcador(), nombre: nombre.trim().slice(0, 80) } }),
    };
  },
});

export interface UsuarioCursor {
  id: string;
  name: string;
  color: string;
}

interface OpcionesExtensiones {
  doc: Y.Doc;
  awareness: Awareness;
  usuario: UsuarioCursor;
  // Al pulsar una ecuación (para editarla)
  onEcuacion: (nodo: NodoPM, pos: number, tipo: "inline" | "bloque") => void;
}

// Etiqueta con el nombre sobre el cursor de cada persona
function pintarCursor(usuario: Record<string, unknown>) {
  const color = typeof usuario.color === "string" ? usuario.color : "#2563eb";
  const cursor = document.createElement("span");
  cursor.classList.add("cursor-colaborador");
  cursor.style.borderColor = color;
  const etiqueta = document.createElement("span");
  etiqueta.classList.add("cursor-colaborador-nombre");
  etiqueta.style.backgroundColor = color;
  etiqueta.textContent = typeof usuario.name === "string" ? usuario.name : "Alguien";
  cursor.append(etiqueta);
  return cursor;
}

export function crearExtensiones({ doc, awareness, usuario, onEcuacion }: OpcionesExtensiones): Extensions {
  return [
    StarterKit.configure({
      // El historial lo lleva Yjs: deshacer solo deshace lo propio, no lo de los demás
      undoRedo: false,
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["mailto", "tel"],
        isAllowedUri: (url) => enlaceSeguro(url),
        shouldAutoLink: (url) => enlaceSeguro(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    Collaboration.configure({ document: doc, field: CAMPO_CONTENIDO }),
    CollaborationCaret.configure({
      provider: { awareness },
      user: usuario,
      render: pintarCursor,
    }),
    Placeholder.configure({ placeholder: "Empieza a escribir…" }),
    CharacterCount,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: { checkboxLabel: (nodo) => `Tarea hecha: ${nodo.textContent || "tarea vacía"}` },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Mathematics.configure({
      katexOptions: { throwOnError: false, trust: false, strict: "ignore" },
      inlineOptions: { onClick: (nodo, pos) => onEcuacion(nodo, pos, "inline") },
      blockOptions: { onClick: (nodo, pos) => onEcuacion(nodo, pos, "bloque") },
    }),
    ImagenNota,
    Marcador,
  ];
}
