import { cn } from "@/lib/utils";
import { ETIQUETAS_FUERZA, fuerzaContrasena } from "./contrasenas";

const COLORES = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
const TEXTOS = [
  "text-red-600 dark:text-red-400",
  "text-orange-600 dark:text-orange-400",
  "text-amber-600 dark:text-amber-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-emerald-700 dark:text-emerald-400",
];

export function IndicadorFuerza({ contrasena, className }: { contrasena: string; className?: string }) {
  if (!contrasena) return null;
  const fuerza = fuerzaContrasena(contrasena);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", i <= fuerza && COLORES[fuerza])} />
        ))}
      </div>
      <span className={cn("text-xs font-medium whitespace-nowrap", TEXTOS[fuerza])}>{ETIQUETAS_FUERZA[fuerza]}</span>
    </div>
  );
}
