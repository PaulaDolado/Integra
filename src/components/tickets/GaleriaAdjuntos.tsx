import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Adjunto } from "./adjuntos";

interface GaleriaAdjuntosProps {
  adjuntos: Adjunto[];
  urls: Map<string, string>;
}

// Miniaturas de las imágenes de un mensaje; al pulsar se ven a tamaño completo
export function GaleriaAdjuntos({ adjuntos, urls }: GaleriaAdjuntosProps) {
  const [abierta, setAbierta] = useState<Adjunto | null>(null);
  if (adjuntos.length === 0) return null;

  const urlAbierta = abierta ? urls.get(abierta.path) : undefined;

  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2">
        {adjuntos.map((a) => {
          const url = urls.get(a.path);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setAbierta(a)}
                disabled={!url}
                className="block overflow-hidden rounded-lg border bg-muted transition-[transform,box-shadow] duration-150 ease-out enabled:hover:shadow-md enabled:active:scale-[0.97] disabled:cursor-not-allowed"
                aria-label={url ? `Ver ${a.nombre}` : `No se pudo cargar ${a.nombre}`}
                title={url ? undefined : "No se pudo cargar la imagen"}
              >
                {url ? (
                  <img src={url} alt={a.nombre} loading="lazy" className="h-24 w-24 object-cover" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!abierta} onOpenChange={(open) => !open && setAbierta(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-3">
          <DialogTitle className="sr-only">{abierta?.nombre}</DialogTitle>
          <DialogDescription className="sr-only">Imagen adjunta al ticket</DialogDescription>
          {urlAbierta && (
            <div className="space-y-3">
              <img src={urlAbierta} alt={abierta?.nombre} className="max-h-[75vh] w-full rounded-lg object-contain" />
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="truncate text-sm text-muted-foreground">{abierta?.nombre}</span>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={urlAbierta} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Abrir original
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
