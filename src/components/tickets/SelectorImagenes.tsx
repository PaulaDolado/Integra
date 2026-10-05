import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MAX_IMAGENES, TIPOS_IMAGEN, validarImagenes } from "./adjuntos";

interface SelectorImagenesProps {
  archivos: File[];
  onChange: (archivos: File[]) => void;
  disabled?: boolean;
}

// Botón para adjuntar imágenes con miniaturas de las que se van a enviar
export function SelectorImagenes({ archivos, onChange, disabled }: SelectorImagenesProps) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => archivos.map((a) => URL.createObjectURL(a)), [archivos]);

  // Libera las URLs temporales de las miniaturas
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const añadir = (lista: FileList | null) => {
    if (!lista) return;
    const { validas, errores } = validarImagenes(Array.from(lista), archivos);
    if (errores.length > 0) toast({ title: "Algunas imágenes no se han añadido", description: errores.join(". "), variant: "destructive" });
    if (validas.length > 0) onChange([...archivos, ...validas]);
  };

  return (
    <div className="space-y-2">
      {archivos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {archivos.map((archivo, i) => (
            <li key={`${archivo.name}-${i}`} className="group relative">
              <img
                src={previews[i]}
                alt={archivo.name}
                className="h-16 w-16 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(archivos.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform duration-150 ease-out active:scale-90"
                aria-label={`Quitar ${archivo.name}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 px-2 text-muted-foreground"
        onClick={() => input.current?.click()}
        disabled={disabled || archivos.length >= MAX_IMAGENES}
      >
        <ImagePlus className="w-4 h-4" />
        Adjuntar imágenes
        <span className="text-xs font-normal">(o pégalas con Ctrl+V)</span>
      </Button>
      <input
        ref={input}
        type="file"
        accept={TIPOS_IMAGEN.join(",")}
        multiple
        className="hidden"
        aria-label="Elegir imágenes"
        onChange={(e) => {
          añadir(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
