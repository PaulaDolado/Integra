import { cn } from "@/lib/utils";
import { getEstado, getPrioridad, getTipo } from "./ticket-config";

type Clase = "estado" | "prioridad" | "tipo";

const resolver = { estado: getEstado, prioridad: getPrioridad, tipo: getTipo };

export function TicketBadge({ clase, valor, className }: { clase: Clase; valor: string; className?: string }) {
  const opcion = resolver[clase](valor);
  const Icon = opcion.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium",
        opcion.badge,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {opcion.label}
    </span>
  );
}
