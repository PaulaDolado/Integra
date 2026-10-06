import { NodeViewWrapper, useEditorState, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { indiceDeNota, paginaDe } from "./contenido";
import { irAPosicion } from "./navegacion";

// Índice dentro de la nota: los títulos, con su página. Se actualiza solo.
export function VistaIndice({ editor, selected }: NodeViewProps) {
  const entradas = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      indiceDeNota(ed.state.doc)
        .filter((e) => e.tipo === "titulo")
        .map((e) => ({ ...e, pagina: paginaDe(ed.state.doc, e.pos) })),
  });

  return (
    <NodeViewWrapper
      as="nav"
      aria-label="Índice"
      className={cn("indice-nota", selected && editor.isEditable && "ring-2 ring-primary ring-offset-2 rounded-md")}
      contentEditable={false}
    >
      <p className="indice-nota-titulo">Índice</p>
      {entradas.length === 0 ? (
        <p className="indice-nota-vacio">Añade títulos a la nota y aparecerán aquí.</p>
      ) : (
        <ol className="indice-nota-lista">
          {entradas.map((e) => (
            <li key={`${e.pos}-${e.texto}`} className={`indice-nivel-${e.nivel}`}>
              <button type="button" onClick={() => irAPosicion(editor, e.pos)}>
                <span className="indice-texto">{e.texto}</span>
                <span className="indice-relleno" aria-hidden="true" />
                <span className="indice-pagina">
                  <span className="sr-only">página </span>
                  {e.pagina}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  );
}
