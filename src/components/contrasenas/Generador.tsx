import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  LONGITUD_MAXIMA,
  LONGITUD_MINIMA,
  OPCIONES_POR_DEFECTO,
  generarContrasena,
  type OpcionesGenerador,
} from "./contrasenas";
import { IndicadorFuerza } from "./IndicadorFuerza";

const TIPOS: { clave: Exclude<keyof OpcionesGenerador, "longitud">; etiqueta: string }[] = [
  { clave: "mayusculas", etiqueta: "Mayúsculas (A-Z)" },
  { clave: "minusculas", etiqueta: "Minúsculas (a-z)" },
  { clave: "numeros", etiqueta: "Números (0-9)" },
  { clave: "simbolos", etiqueta: "Símbolos (!@#…)" },
];

interface GeneradorProps {
  // Si se indica, aparece el botón «Usar esta contraseña»
  onUsar?: (contrasena: string) => void;
  onCopiar?: (contrasena: string) => void;
}

export function Generador({ onUsar, onCopiar }: GeneradorProps) {
  const [opciones, setOpciones] = useState<OpcionesGenerador>(OPCIONES_POR_DEFECTO);
  const [contrasena, setContrasena] = useState(() => generarContrasena(OPCIONES_POR_DEFECTO));

  // Cada cambio de opciones genera una contraseña nueva con ellas
  const cambiarOpciones = (nuevas: OpcionesGenerador) => {
    setOpciones(nuevas);
    setContrasena(generarContrasena(nuevas));
  };

  const activos = TIPOS.filter((t) => opciones[t.clave]).length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 pl-3">
          <code className="flex-1 break-all font-mono text-sm" data-testid="contrasena-generada">
            {contrasena}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Generar otra"
            onClick={() => setContrasena(generarContrasena(opciones))}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onCopiar && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Copiar contraseña generada" onClick={() => onCopiar(contrasena)}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <IndicadorFuerza contrasena={contrasena} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Longitud</Label>
          <span className="text-sm font-medium tabular-nums">{opciones.longitud}</span>
        </div>
        <Slider
          min={LONGITUD_MINIMA}
          max={LONGITUD_MAXIMA}
          step={1}
          value={[opciones.longitud]}
          onValueChange={([longitud]) => cambiarOpciones({ ...opciones, longitud })}
          aria-label="Longitud"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TIPOS.map((t) => (
          <div key={t.clave} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <Label htmlFor={`gen-${t.clave}`} className="font-normal">
              {t.etiqueta}
            </Label>
            <Switch
              id={`gen-${t.clave}`}
              checked={opciones[t.clave]}
              // Siempre tiene que quedar al menos un tipo de carácter
              disabled={opciones[t.clave] && activos === 1}
              onCheckedChange={(v) => cambiarOpciones({ ...opciones, [t.clave]: v })}
            />
          </div>
        ))}
      </div>

      {onUsar && (
        <Button type="button" className="w-full gap-2" onClick={() => onUsar(contrasena)}>
          <Check className="h-4 w-4" />
          Usar esta contraseña
        </Button>
      )}
    </div>
  );
}
