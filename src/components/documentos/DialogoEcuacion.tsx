import { useRef, useState } from "react";
import katex from "katex";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TipoEcuacion = "inline" | "bloque";

// Atajos para no tener que recordar la sintaxis de LaTeX
const PLANTILLAS = [
  { etiqueta: "Fracción", latex: "\\frac{a}{b}" },
  { etiqueta: "Potencia", latex: "x^{2}" },
  { etiqueta: "Subíndice", latex: "x_{i}" },
  { etiqueta: "Raíz", latex: "\\sqrt{x}" },
  { etiqueta: "Suma", latex: "\\sum_{i=1}^{n} x_i" },
  { etiqueta: "Integral", latex: "\\int_{a}^{b} f(x)\\,dx" },
  { etiqueta: "Límite", latex: "\\lim_{x \\to \\infty} f(x)" },
  { etiqueta: "Matriz", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { etiqueta: "α β π", latex: "\\alpha \\beta \\pi" },
  { etiqueta: "≤ ≥ ≠", latex: "\\leq \\geq \\neq" },
];

// Vista previa con KaTeX. Sin `trust`, KaTeX escapa todo: no admite HTML ni enlaces.
function vistaPrevia(latex: string, bloque: boolean) {
  return katex.renderToString(latex || "\\;", { throwOnError: false, displayMode: bloque, trust: false, strict: "ignore" });
}

interface DialogoEcuacionProps {
  open: boolean;
  latexInicial: string;
  tipoInicial: TipoEcuacion;
  // Al editar una ecuación existente no se cambia de tipo
  editando: boolean;
  onCancel: () => void;
  // Al cerrarse, el foco vuelve al editor (y no al botón de la barra)
  onCerrado?: () => void;
  onGuardar: (latex: string, tipo: TipoEcuacion) => void;
  onBorrar: () => void;
}

export function DialogoEcuacion({ open, onCerrado, latexInicial, tipoInicial, editando, onCancel, onGuardar, onBorrar }: DialogoEcuacionProps) {
  const [latex, setLatex] = useState("");
  const [tipo, setTipo] = useState<TipoEcuacion>("inline");
  const campo = useRef<HTMLTextAreaElement>(null);

  const [abierto, setAbierto] = useState(false);
  if (open !== abierto) {
    setAbierto(open);
    if (open) {
      setLatex(latexInicial);
      setTipo(tipoInicial);
    }
  }

  // Inserta la plantilla donde está el cursor del campo
  const insertar = (fragmento: string) => {
    const el = campo.current;
    const inicio = el?.selectionStart ?? latex.length;
    const fin = el?.selectionEnd ?? latex.length;
    const nuevo = `${latex.slice(0, inicio)}${fragmento}${latex.slice(fin)}`;
    setLatex(nuevo);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + fragmento.length, inicio + fragmento.length);
    });
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (latex.trim()) onGuardar(latex.trim(), tipo);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(e) => {
          if (!onCerrado) return;
          e.preventDefault();
          onCerrado();
        }}
      >
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar ecuación" : "Insertar ecuación"}</DialogTitle>
            <DialogDescription>
              Escríbela en LaTeX. Atajo en el texto: <code>{"$$x^2$$"}</code> en la línea y <code>{"$$$x^2$$$"}</code> en su propia línea.
            </DialogDescription>
          </DialogHeader>

          {!editando && (
            <ToggleGroup
              type="single"
              value={tipo}
              onValueChange={(v) => v && setTipo(v as TipoEcuacion)}
              className="justify-start"
              aria-label="Tipo de ecuación"
            >
              <ToggleGroupItem value="inline" size="sm" className="px-3">
                En la línea
              </ToggleGroupItem>
              <ToggleGroupItem value="bloque" size="sm" className="px-3">
                En su propia línea
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Plantillas">
            {PLANTILLAS.map((p) => (
              <Button key={p.etiqueta} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => insertar(p.latex)}>
                {p.etiqueta}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ecuacion-latex">LaTeX</Label>
            <Textarea
              id="ecuacion-latex"
              ref={campo}
              rows={3}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className="font-mono text-sm"
              placeholder="E = mc^2"
              autoFocus
              spellCheck={false}
            />
          </div>

          <div
            className="min-h-16 overflow-x-auto rounded-md border border-border bg-muted/40 px-4 py-3 text-center"
            aria-label="Vista previa"
            role="img"
            // KaTeX escapa el texto (sin trust): no puede colar HTML
            dangerouslySetInnerHTML={{ __html: vistaPrevia(latex, tipo === "bloque") }}
          />

          <DialogFooter className="gap-2 sm:justify-between">
            {editando ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={onBorrar}>
                Quitar ecuación
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!latex.trim()}>
                {editando ? "Guardar" : "Insertar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
