import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { enlaceAMarcador, enlaceSeguro, normalizarEnlace, type EntradaIndice } from "./contenido";

interface DialogoEnlaceProps {
  open: boolean;
  // Enlace que ya tiene la selección (para cambiarlo o quitarlo)
  hrefInicial: string;
  // Sin texto seleccionado hay que escribir el texto del enlace
  pedirTexto: boolean;
  marcadores: EntradaIndice[];
  onCancel: () => void;
  // Al cerrarse, el foco vuelve al editor (y no al botón de la barra)
  onCerrado?: () => void;
  onGuardar: (href: string, texto: string) => void;
  onQuitar: () => void;
}

export function DialogoEnlace({ open, onCerrado, hrefInicial, pedirTexto, marcadores, onCancel, onGuardar, onQuitar }: DialogoEnlaceProps) {
  const [url, setUrl] = useState("");
  const [texto, setTexto] = useState("");

  // Al abrirse, empieza con el enlace actual
  const [abierto, setAbierto] = useState(false);
  if (open !== abierto) {
    setAbierto(open);
    if (open) {
      setUrl(hrefInicial);
      setTexto("");
    }
  }

  const href = normalizarEnlace(url);
  const valido = enlaceSeguro(href) && (!pedirTexto || texto.trim().length > 0);
  const marcadorElegido = (id: string) => href === enlaceAMarcador(id);

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (valido) onGuardar(href, texto.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(e) => {
          if (!onCerrado) return;
          e.preventDefault();
          onCerrado();
        }}
      >
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{hrefInicial ? "Editar enlace" : "Insertar enlace"}</DialogTitle>
            <DialogDescription>Una dirección web, un correo o un marcador de esta nota.</DialogDescription>
          </DialogHeader>

          {pedirTexto && (
            <div className="space-y-2">
              <Label htmlFor="enlace-texto">Texto</Label>
              <Input id="enlace-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={200} autoFocus />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="enlace-url">Dirección</Label>
            <Input
              id="enlace-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… o correo@empresa.com"
              autoFocus={!pedirTexto}
              aria-invalid={url.trim() !== "" && !enlaceSeguro(href)}
            />
            {url.trim() !== "" && !enlaceSeguro(href) && (
              <p className="text-xs text-destructive">Solo se admiten enlaces web (http o https), de correo o de teléfono.</p>
            )}
          </div>

          {marcadores.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">O un marcador de la nota</legend>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {marcadores.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setUrl(enlaceAMarcador(m.id))}
                    aria-pressed={marcadorElegido(m.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted",
                      marcadorElegido(m.id) && "border-primary bg-accent text-accent-foreground"
                    )}
                  >
                    <Bookmark className="h-3 w-3" aria-hidden="true" />
                    {m.texto}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {hrefInicial ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={onQuitar}>
                Quitar enlace
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valido}>
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
