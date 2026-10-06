import { useQuery } from "@tanstack/react-query";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageOff, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { urlImagenNota } from "./imagenes";

const ANCHOS = [
  { valor: 33, etiqueta: "Pequeña" },
  { valor: 50, etiqueta: "Mediana" },
  { valor: 100, etiqueta: "Ancho completo" },
];

// Imagen dentro de la nota. El documento solo guarda la ruta del bucket privado;
// la URL firmada se pide al pintarla y caduca en 1 hora.
export function VistaImagen({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const ruta = typeof node.attrs.ruta === "string" ? node.attrs.ruta : null;
  const ancho = Number(node.attrs.ancho) || 100;
  const { data: url, isError } = useQuery({
    queryKey: ["notas-imagen", ruta],
    queryFn: () => urlImagenNota(ruta!),
    enabled: !!ruta,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="imagen-nota my-3" data-drag-handle="">
      <figure
        className={cn("relative mx-auto", selected && editable && "ring-2 ring-primary ring-offset-2 rounded-md")}
        style={{ width: `${ancho}%` }}
      >
        {url ? (
          <img src={url} alt={String(node.attrs.alt ?? "")} className="block w-full rounded-md" draggable={false} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
            {isError || !ruta ? (
              <span className="flex items-center gap-2 text-sm">
                <ImageOff className="h-4 w-4" aria-hidden="true" />
                No se ha podido cargar la imagen
              </span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando imagen" />
            )}
          </div>
        )}
        {selected && editable && (
          <div
            className="absolute right-2 top-2 flex gap-1 rounded-md border border-border bg-popover p-1 shadow-md"
            contentEditable={false}
          >
            {ANCHOS.map((a) => (
              <button
                key={a.valor}
                type="button"
                onClick={() => updateAttributes({ ancho: a.valor })}
                aria-pressed={ancho === a.valor}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium hover:bg-muted",
                  ancho === a.valor && "bg-accent text-accent-foreground"
                )}
              >
                {a.etiqueta}
              </button>
            ))}
            <button
              type="button"
              onClick={deleteNode}
              aria-label="Quitar la imagen"
              className="rounded px-2 py-1 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </figure>
    </NodeViewWrapper>
  );
}
