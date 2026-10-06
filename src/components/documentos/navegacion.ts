import type { Editor } from "@tiptap/react";
import { indiceDeNota } from "./contenido";

// Lleva el cursor a una posición de la nota y la muestra en pantalla
export function irAPosicion(editor: Editor, pos: number) {
  const nodo = editor.state.doc.nodeAt(pos);
  // En un título, el cursor al principio; un marcador se selecciona entero
  if (nodo?.isTextblock) editor.chain().focus().setTextSelection(pos + 1).run();
  else editor.chain().focus().setNodeSelection(pos).run();
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function irAMarcador(editor: Editor, id: string) {
  const entrada = indiceDeNota(editor.state.doc).find((e) => e.tipo === "marcador" && e.id === id);
  if (entrada) irAPosicion(editor, entrada.pos);
  return !!entrada;
}
