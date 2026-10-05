import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Salud } from "./contrasenas";
import type { Filtro } from "./lista";

interface ResumenSaludProps {
  total: number;
  salud: Salud;
  ilegibles: number;
  filtro: Filtro;
  onFiltrar: (filtro: Filtro) => void;
}

// Métricas de la bóveda (las que tienen filtro sirven para filtrar la lista)
// y aviso de las entradas que no se han podido descifrar
export function ResumenSalud({ total, salud, ilegibles, filtro, onFiltrar }: ResumenSaludProps) {
  const metricas: { etiqueta: string; valor: string; filtro?: Filtro; aviso?: boolean }[] = [
    { etiqueta: "Contraseñas", valor: String(total), filtro: "todas" },
    { etiqueta: "Salud", valor: salud.puntuacion === null ? "—" : `${salud.puntuacion}%` },
    { etiqueta: "Débiles", valor: String(salud.debiles.size), filtro: "debiles", aviso: salud.debiles.size > 0 },
    { etiqueta: "Repetidas", valor: String(salud.repetidas.size), filtro: "repetidas", aviso: salud.repetidas.size > 0 },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricas.map((m) => {
          const contenido = (
            <>
              <p className="text-sm text-muted-foreground">{m.etiqueta}</p>
              <p className={cn("text-2xl font-semibold tabular-nums", m.aviso && "text-amber-600 dark:text-amber-400")}>{m.valor}</p>
            </>
          );
          return m.filtro ? (
            <button
              key={m.etiqueta}
              type="button"
              onClick={() => onFiltrar(m.filtro!)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/50",
                filtro === m.filtro && m.filtro !== "todas" && "border-primary"
              )}
            >
              {contenido}
            </button>
          ) : (
            <div key={m.etiqueta} className="rounded-xl border bg-card p-4 shadow-xs">
              {contenido}
            </div>
          );
        })}
      </div>

      {ilegibles > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            {ilegibles === 1 ? "Hay 1 entrada que no se puede descifrar" : `Hay ${ilegibles} entradas que no se pueden descifrar`}.
            Puede que se guardara con otra contraseña maestra.
          </p>
        </div>
      )}
    </>
  );
}
