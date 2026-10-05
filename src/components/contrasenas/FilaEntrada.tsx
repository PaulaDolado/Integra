import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, ExternalLink, Eye, EyeOff, MoreHorizontal, Pencil, Star, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { dominio, urlAbrible, type EntradaDescifrada } from "./contrasenas";
import { colorAvatar } from "./lista";
import type { QueCopiar } from "./usePortapapeles";

interface FilaEntradaProps {
  entrada: EntradaDescifrada;
  revelada: boolean;
  debil: boolean;
  repetida: boolean;
  onEditar: () => void;
  onCopiar: (texto: string, que: QueCopiar) => void;
  onAlternarRevelada: () => void;
  onAlternarFavorito: () => void;
  onBorrar: () => void;
}

export function FilaEntrada({
  entrada: e,
  revelada,
  debil,
  repetida,
  onEditar,
  onCopiar,
  onAlternarRevelada,
  onAlternarFavorito,
  onBorrar,
}: FilaEntradaProps) {
  const enlace = e.url ? urlAbrible(e.url) : null;
  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold uppercase",
          colorAvatar(e.nombre)
        )}
        aria-hidden
      >
        {(e.nombre.trim()[0] ?? "?").toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" className="truncate font-medium hover:underline underline-offset-4" onClick={onEditar}>
            {e.nombre}
          </button>
          {e.favorito && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorita" />}
          {debil && (
            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
              Débil
            </Badge>
          )}
          {repetida && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400">
              Repetida
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {[e.usuario, e.url && dominio(e.url)].filter(Boolean).join(" · ") || "Sin usuario"}
        </p>
        {revelada && (
          <p className="mt-1 break-all font-mono text-sm" data-testid="contrasena-revelada">
            {e.contrasena || "(sin contraseña)"}
          </p>
        )}
      </div>

      <p className="hidden shrink-0 text-xs text-muted-foreground xl:block">
        {format(new Date(e.updated_at), "d MMM yyyy", { locale: es })}
      </p>

      <div className="flex shrink-0 items-center gap-0.5">
        {e.usuario && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 sm:inline-flex"
            aria-label={`Copiar usuario de ${e.nombre}`}
            title="Copiar usuario"
            onClick={() => onCopiar(e.usuario, "usuario")}
          >
            <User className="h-4 w-4" />
          </Button>
        )}
        {e.contrasena && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Copiar contraseña de ${e.nombre}`}
            title="Copiar contraseña"
            onClick={() => onCopiar(e.contrasena, "contrasena")}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 sm:inline-flex"
          aria-label={revelada ? `Ocultar contraseña de ${e.nombre}` : `Mostrar contraseña de ${e.nombre}`}
          title={revelada ? "Ocultar" : "Mostrar"}
          onClick={onAlternarRevelada}
        >
          {revelada ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        {enlace && (
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 sm:inline-flex" asChild>
            <a href={enlace} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${dominio(e.url)}`} title="Abrir la web">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Opciones de ${e.nombre}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditar}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            {e.usuario && (
              <DropdownMenuItem className="sm:hidden" onClick={() => onCopiar(e.usuario, "usuario")}>
                <User className="w-4 h-4 mr-2" />
                Copiar usuario
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="sm:hidden" onClick={onAlternarRevelada}>
              {revelada ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {revelada ? "Ocultar contraseña" : "Mostrar contraseña"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAlternarFavorito}>
              <Star className="w-4 h-4 mr-2" />
              {e.favorito ? "Quitar de favoritos" : "Añadir a favoritos"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onBorrar}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
