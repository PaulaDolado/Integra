import { Link } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, LogOut, MoreHorizontal, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clasePapel, tituloNota, type NotaResumen } from "./notas";
import "./papel-notas.css";

interface TarjetaNotaProps {
  nota: NotaResumen;
  onEliminar: (nota: NotaResumen) => void;
  onSalir: (nota: NotaResumen) => void;
}

const haceCuanto = (fecha: string) => formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });

// Una nota de la lista: la hoja en miniatura, con su título y sus primeras líneas
export function TarjetaNota({ nota, onEliminar, onSalir }: TarjetaNotaProps) {
  const titulo = tituloNota(nota.titulo);
  const propia = nota.mi_rol === "propietario";
  const compartida = nota.colaboradores > 0 || !propia;

  return (
    <li className="group relative">
      <Link
        to={`/documentos/${nota.id}`}
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div
          className={cn(
            clasePapel(nota.formato),
            "papel-miniatura aspect-[210/297] overflow-hidden rounded-md border border-border p-4 shadow-sm transition-[box-shadow,transform] duration-150 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transform-none"
          )}
          aria-hidden="true"
        >
          {nota.titulo.trim() && <p className="mb-1 line-clamp-2 text-[11px] font-semibold leading-3">{nota.titulo}</p>}
          <p className="line-clamp-[12] text-[9px] leading-3 text-muted-foreground">{nota.extracto}</p>
        </div>
        <div className="mt-2 space-y-0.5 px-0.5">
          <h2 className="truncate text-sm font-medium text-foreground">{titulo}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {compartida && (
              <Users
                className="h-3 w-3 shrink-0"
                aria-label={propia ? `Compartida con ${nota.colaboradores}` : "Compartida contigo"}
              />
            )}
            {nota.mi_rol === "lector" && <Eye className="h-3 w-3 shrink-0" aria-label="Solo lectura" />}
            <span className="truncate">
              {propia ? "Tuya" : nota.propietario_nombre} · {haceCuanto(nota.updated_at)}
            </span>
          </p>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Más opciones de ${titulo}`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-xs transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {propia ? (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onEliminar(nota)}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Eliminar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onSalir(nota)}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Dejar de colaborar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
