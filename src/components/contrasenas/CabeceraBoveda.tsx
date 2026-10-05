import { KeyRound, Lock, MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CabeceraBoveda() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
        <KeyRound className="w-6 h-6 text-primary" />
        Contraseñas
      </h1>
      <p className="text-muted-foreground mt-1">Tu bóveda personal, cifrada de extremo a extremo. Solo tú puedes leerla.</p>
    </div>
  );
}

interface AccionesBovedaProps {
  onGenerador: () => void;
  onBloquear: () => void;
  onCambiarMaestra: () => void;
  onNueva: () => void;
}

// Botones de la cabecera con la bóveda abierta
export function AccionesBoveda({ onGenerador, onBloquear, onCambiarMaestra, onNueva }: AccionesBovedaProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="gap-2" onClick={onGenerador}>
        <Sparkles className="w-4 h-4" />
        Generador
      </Button>
      <Button variant="outline" className="gap-2" onClick={onBloquear}>
        <Lock className="w-4 h-4" />
        Bloquear
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Más opciones">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCambiarMaestra}>
            <KeyRound className="w-4 h-4 mr-2" />
            Cambiar contraseña maestra
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button className="gap-2" onClick={onNueva}>
        <Plus className="w-4 h-4" />
        Nueva contraseña
      </Button>
    </div>
  );
}
