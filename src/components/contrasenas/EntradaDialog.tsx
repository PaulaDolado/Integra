import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Entrada } from "./cripto";
import { Generador } from "./Generador";
import { IndicadorFuerza } from "./IndicadorFuerza";

const VACIA: Entrada = { nombre: "", url: "", usuario: "", contrasena: "", notas: "", favorito: false };

interface EntradaDialogProps {
  open: boolean;
  // null para crear una entrada nueva
  entrada: Entrada | null;
  onCancel: () => void;
  onGuardar: (entrada: Entrada) => Promise<boolean>;
}

export function EntradaDialog({ open, entrada, onCancel, onGuardar }: EntradaDialogProps) {
  const [form, setForm] = useState<Entrada>(VACIA);
  const [visible, setVisible] = useState(false);
  const [generador, setGenerador] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(entrada ?? VACIA);
      setVisible(false);
      setGenerador(false);
    }
  }, [open, entrada]);

  const cambiar = <K extends keyof Entrada>(campo: K, valor: Entrada[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ ...form, nombre: form.nombre.trim(), url: form.url.trim(), usuario: form.usuario.trim() });
    setGuardando(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{entrada ? "Editar contraseña" : "Nueva contraseña"}</DialogTitle>
            <DialogDescription>Se cifra en tu navegador antes de guardarse.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entrada-nombre">Nombre *</Label>
              <Input
                id="entrada-nombre"
                placeholder="Correo del trabajo"
                value={form.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entrada-url">Web</Label>
              <Input
                id="entrada-url"
                placeholder="outlook.office.com"
                value={form.url}
                onChange={(e) => cambiar("url", e.target.value)}
                maxLength={500}
                inputMode="url"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrada-usuario">Usuario o email</Label>
            <Input
              id="entrada-usuario"
              value={form.usuario}
              onChange={(e) => cambiar("usuario", e.target.value)}
              maxLength={200}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrada-contrasena">Contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="entrada-contrasena"
                  type={visible ? "text" : "password"}
                  className="pr-10 font-mono"
                  value={form.contrasena}
                  onChange={(e) => cambiar("contrasena", e.target.value)}
                  maxLength={500}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
                  aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Popover open={generador} onOpenChange={setGenerador}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generar
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-88 max-w-[calc(100vw-2rem)]">
                  <Generador
                    onUsar={(c) => {
                      cambiar("contrasena", c);
                      setVisible(true);
                      setGenerador(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <IndicadorFuerza contrasena={form.contrasena} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrada-notas">Notas</Label>
            <Textarea
              id="entrada-notas"
              rows={3}
              value={form.notas}
              onChange={(e) => cambiar("notas", e.target.value)}
              maxLength={2000}
            />
          </div>

          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            aria-pressed={form.favorito}
            onClick={() => cambiar("favorito", !form.favorito)}
          >
            <Star className={cn("h-4 w-4", form.favorito && "fill-amber-400 text-amber-400")} />
            {form.favorito ? "En favoritos" : "Añadir a favoritos"}
          </button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !form.nombre.trim()}>
              {guardando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
