import { cn } from "@/lib/utils";
import { colorDePersona, iniciales } from "./notas";

interface AvatarPersonaProps {
  id: string;
  nombre: string;
  // Color del cursor de la persona; si no, uno fijo a partir de su id
  color?: string;
  className?: string;
  // Solo decorativo cuando el nombre ya se lee al lado
  decorativo?: boolean;
}

export function AvatarPersona({ id, nombre, color, className, decorativo = true }: AvatarPersonaProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className
      )}
      style={{ backgroundColor: color ?? colorDePersona(id) }}
      {...(decorativo ? { "aria-hidden": true } : { role: "img", "aria-label": nombre, title: nombre })}
    >
      {iniciales(nombre)}
    </span>
  );
}
