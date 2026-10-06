import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bookmark, Heading } from "lucide-react";
import { cn } from "@/lib/utils";
import { indiceDeNota } from "./contenido";
import { irAPosicion } from "./navegacion";

// Marcadores y títulos de la nota, para saltar a ellos
export function PanelIndice({ editor }: { editor: Editor }) {
  const indice = useEditorState({ editor, selector: ({ editor: ed }) => indiceDeNota(ed.state.doc) });
  const marcadores = indice.filter((e) => e.tipo === "marcador");
  const titulos = indice.filter((e) => e.tipo === "titulo");

  const lista = (entradas: typeof indice, vacio: string) =>
    entradas.length === 0 ? (
      <p className="px-2 text-xs text-muted-foreground">{vacio}</p>
    ) : (
      <ul className="space-y-0.5">
        {entradas.map((e) => (
          <li key={`${e.tipo}-${e.id}-${e.pos}`}>
            <button
              type="button"
              onClick={() => irAPosicion(editor, e.pos)}
              className={cn(
                "flex w-full items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                e.tipo === "titulo" && e.nivel === 2 && "pl-5",
                e.tipo === "titulo" && e.nivel === 3 && "pl-8"
              )}
            >
              {e.tipo === "marcador" ? (
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Heading className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{e.texto}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <nav aria-label="Índice de la nota" className="space-y-5">
      <section className="space-y-2">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marcadores</h2>
        {lista(marcadores, "Añade marcadores con el botón del marcapáginas.")}
      </section>
      <section className="space-y-2">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Índice</h2>
        {lista(titulos, "Los títulos de la nota aparecerán aquí.")}
      </section>
    </nav>
  );
}
