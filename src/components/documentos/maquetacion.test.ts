import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Columna, Columnas, IndiceNota, MAX_COLUMNAS, SaltoPagina } from "./maquetacion";
import { contarPaginas, indiceDeNota, paginaDe } from "./contenido";
import { plantillaIndice, plantillaPortada } from "./plantillas";
import { cambiarAjuste, leerAjustes } from "./ajustes";

// Editor sin React: el índice se pinta con un div vacío
const IndiceSinReact = IndiceNota.extend({
  addNodeView: () => () => ({ dom: document.createElement("div") }),
});

let editor: Editor;
const crear = (content: JSONContent | string = "<p></p>") => {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      SaltoPagina,
      Columnas,
      Columna,
      IndiceSinReact,
    ],
    content,
  });
  return editor;
};

afterEach(() => editor?.destroy());

// Texto de cada columna del primer bloque de columnas
function textosColumnas(ed: Editor) {
  const textos: string[] = [];
  ed.state.doc.descendants((n) => {
    if (n.type.name === "columna") textos.push(n.textContent);
    return n.type.name !== "columna";
  });
  return textos;
}

const enColumna = (ed: Editor) => ed.isActive("columna");

describe("columnas", () => {
  it("inserta el número de columnas pedido y deja el cursor en la primera", () => {
    const ed = crear();
    ed.commands.insertarColumnas(3);
    expect(textosColumnas(ed)).toEqual(["", "", ""]);

    ed.commands.insertContent("Primera");
    expect(textosColumnas(ed)).toEqual(["Primera", "", ""]);
  });

  it("limita entre 2 y 4 columnas", () => {
    const ed = crear();
    ed.commands.insertarColumnas(9);
    expect(textosColumnas(ed)).toHaveLength(MAX_COLUMNAS);

    const otro = crear();
    otro.commands.insertarColumnas(1);
    expect(textosColumnas(otro)).toHaveLength(2);
  });

  it("añade una columna a la derecha de la actual y lleva el cursor a ella", () => {
    const ed = crear();
    ed.commands.insertarColumnas(2);
    ed.commands.insertContent("A");
    ed.commands.anadirColumna();
    ed.commands.insertContent("nueva");

    expect(textosColumnas(ed)).toEqual(["A", "nueva", ""]);
  });

  it("no deja pasar de 4 columnas", () => {
    const ed = crear();
    ed.commands.insertarColumnas(4);
    expect(ed.can().anadirColumna()).toBe(false);
  });

  it("al quitar una columna, su texto pasa a la de al lado", () => {
    const ed = crear();
    ed.commands.insertarColumnas(3);
    ed.commands.insertContent("uno");
    ed.commands.anadirColumna();
    ed.commands.insertContent("dos");
    expect(textosColumnas(ed)).toEqual(["uno", "dos", "", ""]);

    ed.commands.quitarColumna();
    expect(textosColumnas(ed)).toEqual(["unodos", "", ""]);
  });

  it("con dos columnas, quitar una deshace el bloque sin perder texto", () => {
    const ed = crear();
    ed.commands.insertarColumnas(2);
    ed.commands.insertContent("izquierda");
    ed.commands.anadirColumna();
    ed.commands.insertContent("medio");
    ed.commands.quitarColumna();
    ed.commands.quitarColumna();
    ed.commands.quitarColumna();

    expect(textosColumnas(ed)).toEqual([]);
    // Cada columna deja sus párrafos, en orden
    expect(ed.getText()).toMatch(/izquierda\s+medio/);
    expect(enColumna(ed)).toBe(false);
  });

  it("fuera de unas columnas no se puede añadir ni quitar columna", () => {
    const ed = crear("<p>texto</p>");
    expect(ed.can().anadirColumna()).toBe(false);
    expect(ed.can().quitarColumna()).toBe(false);
  });
});

describe("páginas", () => {
  const conSaltos = () =>
    crear({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "uno" }] },
        { type: "saltoPagina" },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Capítulo" }] },
        { type: "saltoPagina" },
        { type: "paragraph", content: [{ type: "text", text: "tres" }] },
      ],
    });

  it("cuenta las páginas y sabe en cuál está cada título", () => {
    const ed = conSaltos();
    expect(contarPaginas(ed.state.doc)).toBe(3);
    const titulo = indiceDeNota(ed.state.doc).find((e) => e.texto === "Capítulo")!;
    expect(paginaDe(ed.state.doc, titulo.pos)).toBe(2);
    expect(paginaDe(ed.state.doc, 0)).toBe(1);
  });

  it("cada salto lleva el número de la página que cierra, también al añadir otro", () => {
    const ed = conSaltos();
    const numeros = () => [...ed.view.dom.querySelectorAll<HTMLElement>(".salto-pagina")].map((s) => s.dataset.pagina);
    expect(numeros()).toEqual(["1", "2"]);

    ed.commands.setTextSelection(1);
    ed.commands.insertarSaltoPagina();
    expect(numeros()).toEqual(["1", "2", "3"]);
  });
});

describe("plantillas", () => {
  it("la portada lleva título, autor y fecha, y termina con un salto de página", () => {
    const ed = crear();
    ed.commands.insertContentAt(0, plantillaPortada({ autor: "Ana López", fecha: new Date(2026, 9, 6) }));

    const texto = ed.getText();
    expect(texto).toContain("Título del documento");
    expect(texto).toContain("Ana López");
    expect(texto).toContain("6 de octubre de 2026");
    expect(contarPaginas(ed.state.doc)).toBe(2);
    // El título de la portada no aparece en el índice
    expect(indiceDeNota(ed.state.doc)).toEqual([]);
  });

  it("el índice va en su propia página", () => {
    const ed = crear("<h2>Introducción</h2>");
    ed.commands.insertContentAt(0, plantillaIndice());

    expect(ed.state.doc.firstChild?.type.name).toBe("indiceNota");
    expect(contarPaginas(ed.state.doc)).toBe(2);
    const titulo = indiceDeNota(ed.state.doc)[0];
    expect(paginaDe(ed.state.doc, titulo.pos)).toBe(2);
  });
});

describe("fuente y tamaño", () => {
  it("se aplican al texto seleccionado", () => {
    const ed = crear("<p>hola</p>");
    ed.chain().selectAll().setFontFamily("Georgia, serif").setFontSize("24px").run();

    expect(ed.getHTML()).toContain("font-family: Georgia, serif");
    expect(ed.getHTML()).toContain("font-size: 24px");
  });
});

describe("ajustes de la nota", () => {
  it("«Numerar páginas» se guarda en el documento y llega a quien colabora", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));

    expect(leerAjustes(b).numerarPaginas).toBe(false);
    cambiarAjuste(a, "numerarPaginas", true);
    expect(leerAjustes(b).numerarPaginas).toBe(true);
  });
});
