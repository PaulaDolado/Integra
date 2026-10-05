import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FILTROS, type Filtro } from "./lista";

interface BarraFiltrosProps {
  filtro: Filtro;
  onFiltro: (filtro: Filtro) => void;
  busqueda: string;
  onBusqueda: (busqueda: string) => void;
}

export function BarraFiltros({ filtro, onFiltro, busqueda, onBusqueda }: BarraFiltrosProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Filtrar contraseñas">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="tab"
            aria-selected={filtro === f.valor}
            onClick={() => onFiltro(f.valor)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
              filtro === f.valor ? "bg-background text-foreground shadow-xs" : "hover:text-foreground"
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>
      <div className="relative sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={(e) => onBusqueda(e.target.value)} />
      </div>
    </div>
  );
}
