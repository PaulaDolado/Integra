import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Fragment, type Node as NodoPM } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { VistaIndice } from "./VistaIndice";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    saltoPagina: {
      insertarSaltoPagina: () => ReturnType;
    };
    columnas: {
      insertarColumnas: (cuantas: number) => ReturnType;
      anadirColumna: () => ReturnType;
      quitarColumna: () => ReturnType;
    };
    indiceNota: {
      insertarIndice: () => ReturnType;
    };
  }
}

export const MAX_COLUMNAS = 4;

// Páginas -------------------------------------------------------------------------
// La nota es una hoja continua: las páginas las marcan los saltos de página.

const CLAVE_NUMERACION = new PluginKey("numeracion-paginas");

// Cada salto lleva el número de la página que cierra (data-pagina). El CSS solo
// lo muestra si la nota tiene activado «Numerar páginas».
function decorarSaltos(doc: NodoPM) {
  const decoraciones: Decoration[] = [];
  let pagina = 1;
  doc.descendants((nodo, pos) => {
    if (nodo.type.name === "saltoPagina") {
      decoraciones.push(Decoration.node(pos, pos + nodo.nodeSize, { "data-pagina": String(pagina) }));
      pagina++;
    }
    return true;
  });
  return DecorationSet.create(doc, decoraciones);
}

export const SaltoPagina = Node.create({
  name: "saltoPagina",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-salto-pagina]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-salto-pagina": "",
        class: "salto-pagina",
        role: "separator",
        "aria-label": "Salto de página",
      }),
    ];
  },

  addCommands() {
    return {
      insertarSaltoPagina:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name }, { type: "paragraph" }]).run(),
    };
  },

  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.editor.commands.insertarSaltoPagina() };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: CLAVE_NUMERACION,
        state: {
          init: (_, { doc }) => decorarSaltos(doc),
          apply: (tr, anterior) => (tr.docChanged ? decorarSaltos(tr.doc) : anterior),
        },
        props: {
          decorations(state) {
            return CLAVE_NUMERACION.getState(state);
          },
        },
      }),
    ];
  },
});

// Columnas de texto ---------------------------------------------------------------

export const Columna = Node.create({
  name: "columna",
  content: "block+",
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-columna]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-columna": "", class: "columna-nota" }), 0];
  },
});

// Profundidad de la columna que contiene la selección, o null
function profundidadColumna($pos: { depth: number; node: (d: number) => NodoPM }) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "columna") return d;
  }
  return null;
}

export const Columnas = Node.create({
  name: "columnas",
  group: "block",
  content: "columna{2,4}",
  isolating: true,

  parseHTML() {
    return [{ tag: "div[data-columnas]" }];
  },

  // El ancho se reparte en CSS según cuántas columnas haya: un atributo con el
  // número no serviría, porque el editor no repinta el contenedor al añadir una
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-columnas": "", class: "columnas-nota" }), 0];
  },

  addCommands() {
    return {
      insertarColumnas:
        (cuantas) =>
        ({ chain, state }) => {
          const n = Math.min(MAX_COLUMNAS, Math.max(2, Math.round(cuantas)));
          const desde = state.selection.from;
          return chain()
            .insertContent({
              type: this.name,
              content: Array.from({ length: n }, () => ({ type: "columna", content: [{ type: "paragraph" }] })),
            })
            // Se sigue escribiendo en la primera columna, no en la última
            .command(({ tr }) => {
              let destino: number | null = null;
              tr.doc.nodesBetween(Math.max(0, desde - 1), tr.doc.content.size, (nodo, pos) => {
                if (destino !== null) return false;
                if (nodo.type.name === "columna") destino = pos + 2;
                return true;
              });
              if (destino !== null) tr.setSelection(TextSelection.create(tr.doc, destino));
              return true;
            })
            .run();
        },

      // Una columna vacía a la derecha de la actual
      anadirColumna:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;
          const d = profundidadColumna($from);
          if (d === null || $from.node(d - 1).childCount >= MAX_COLUMNAS) return false;
          if (dispatch) {
            const { schema } = state;
            const nueva = schema.nodes.columna.create(null, schema.nodes.paragraph.create());
            const donde = $from.after(d);
            const tr = state.tr.insert(donde, nueva);
            // El cursor pasa a la columna nueva
            dispatch(tr.setSelection(TextSelection.create(tr.doc, donde + 2)).scrollIntoView());
          }
          return true;
        },

      // Quita la columna actual sin perder su texto: pasa a la columna de al lado.
      // Si solo queda una, el bloque de columnas se deshace.
      quitarColumna:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;
          const d = profundidadColumna($from);
          if (d === null) return false;
          if (!dispatch) return true;

          const bloque = $from.node(d - 1);
          const indice = $from.index(d - 1);
          const columnas: NodoPM[] = [];
          bloque.forEach((c) => columnas.push(c));
          const quitada = columnas[indice];
          columnas.splice(indice, 1);
          const vecina = Math.max(0, indice - 1);
          columnas[vecina] = columnas[vecina].copy(
            indice === 0 ? quitada.content.append(columnas[vecina].content) : columnas[vecina].content.append(quitada.content)
          );

          const inicio = $from.before(d - 1);
          const fin = $from.after(d - 1);
          const contenido =
            columnas.length === 1 ? columnas[0].content : Fragment.from(bloque.type.create(bloque.attrs, columnas));
          const tr = state.tr.replaceWith(inicio, fin, contenido);

          // El cursor queda al final del texto que se ha movido
          let finTexto = inicio;
          if (columnas.length === 1) {
            finTexto += columnas[0].content.size;
          } else {
            finTexto += 1;
            for (let i = 0; i <= vecina; i++) finTexto += columnas[i].nodeSize;
            finTexto -= 1;
          }
          dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(finTexto), -1)).scrollIntoView());
          return true;
        },
    };
  },
});

// Índice automático ---------------------------------------------------------------
// Solo guarda que aquí va el índice: sus entradas salen de los títulos de la
// nota en cada momento, así que nunca se queda desfasado.

export const IndiceNota = Node.create({
  name: "indiceNota",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-indice-nota]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-indice-nota": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaIndice);
  },

  addCommands() {
    return {
      insertarIndice:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});
