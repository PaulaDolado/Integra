import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useAvisarError } from "@/hooks/useAvisarError";
import { colleagueName, colleagueRole, type Colleague } from "@/components/chat/chat-utils";
import { AvatarPersona } from "./AvatarPersona";
import { ROLES, type Rol } from "./notas";

type RolColaborador = Exclude<Rol, "propietario">;

interface DialogoCompartirProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaId: string;
  titulo: string;
  esPropietario: boolean;
}

export function DialogoCompartir({ open, onOpenChange, notaId, titulo, esPropietario }: DialogoCompartirProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [rolNuevo, setRolNuevo] = useState<RolColaborador>("editor");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const claveColaboradores = ["notas", "colaboradores", notaId];
  const { data: colaboradores = [], isLoading, error } = useQuery({
    queryKey: claveColaboradores,
    queryFn: async () => comprobar(await supabase.rpc("colaboradores_nota", { p_nota: notaId })) ?? [],
    enabled: open,
  });
  useAvisarError(error, "No se pudo cargar con quién está compartida la nota");

  const { data: directorio = [] } = useQuery({
    queryKey: ["directorio-empleados"],
    queryFn: async () => comprobar(await supabase.rpc("directorio_empleados")) ?? [],
    enabled: open && esPropietario,
  });

  const conAcceso = new Set(colaboradores.map((c) => c.empleado_id));
  const texto = busqueda.trim().toLowerCase();
  const candidatos: Colleague[] = texto
    ? directorio
        .filter((p) => !conAcceso.has(p.id))
        .filter((p) => [colleagueName(p), p.segundo_apellido, p.cargo, p.departamento].join(" ").toLowerCase().includes(texto))
        .slice(0, 6)
    : [];

  const ejecutar = async (clave: string, accion: () => PromiseLike<{ error: { message: string } | null }>, exito?: string) => {
    setOcupado(clave);
    const { error } = await accion();
    setOcupado(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (exito) toast({ title: exito });
    queryClient.invalidateQueries({ queryKey: claveColaboradores });
    queryClient.invalidateQueries({ queryKey: ["notas", "lista"] });
  };

  const compartir = (persona: Colleague) =>
    ejecutar(
      persona.id,
      () => supabase.rpc("compartir_nota", { p_nota: notaId, p_empleado: persona.id, p_rol: rolNuevo }),
      `Compartida con ${colleagueName(persona)}`
    ).then(() => setBusqueda(""));

  const cambiarRol = (empleadoId: string, rol: RolColaborador) =>
    ejecutar(empleadoId, () => supabase.rpc("compartir_nota", { p_nota: notaId, p_empleado: empleadoId, p_rol: rol }));

  const quitar = (empleadoId: string) =>
    ejecutar(empleadoId, () => supabase.rpc("quitar_colaborador_nota", { p_nota: notaId, p_empleado: empleadoId }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartir «{titulo}»</DialogTitle>
          <DialogDescription>
            {esPropietario
              ? "Las personas con acceso ven los cambios al momento. Quien puede editar escribe a la vez que tú."
              : "Solo quien creó la nota puede compartirla o cambiar los permisos."}
          </DialogDescription>
        </DialogHeader>

        {esPropietario && (
          <div className="space-y-2">
            <Label htmlFor="compartir-buscar">Añadir personas</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="compartir-buscar"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre, cargo o departamento"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              <Select value={rolNuevo} onValueChange={(v) => setRolNuevo(v as RolColaborador)}>
                <SelectTrigger className="w-40" aria-label="Permiso de las personas que añadas">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">{ROLES.editor}</SelectItem>
                  <SelectItem value="lector">{ROLES.lector}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {texto && (
              <ul className="divide-y divide-border rounded-md border border-border" aria-label="Resultados">
                {candidatos.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No hay nadie más con ese nombre</li>
                ) : (
                  candidatos.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <AvatarPersona id={p.id} nombre={colleagueName(p)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{colleagueName(p)}</p>
                        {colleagueRole(p) && <p className="truncate text-xs text-muted-foreground">{colleagueRole(p)}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => compartir(p)} disabled={ocupado !== null}>
                        {ocupado === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        Añadir
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Con acceso</h3>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando" />
            </div>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {colaboradores.map((c) => {
                const nombre = `${c.nombre} ${c.primer_apellido}`;
                return (
                  <li key={c.empleado_id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                    <AvatarPersona id={c.empleado_id} nombre={nombre} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.cargo, c.departamento].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {c.rol === "propietario" || !esPropietario ? (
                      <span className="text-xs text-muted-foreground">{ROLES[c.rol as Rol] ?? c.rol}</span>
                    ) : (
                      <>
                        <Select value={c.rol} onValueChange={(v) => cambiarRol(c.empleado_id, v as RolColaborador)} disabled={ocupado !== null}>
                          <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Permiso de ${nombre}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="editor">{ROLES.editor}</SelectItem>
                            <SelectItem value="lector">{ROLES.lector}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => quitar(c.empleado_id)}
                          disabled={ocupado !== null}
                          aria-label={`Quitar el acceso a ${nombre}`}
                          title="Quitar el acceso"
                        >
                          {ocupado === c.empleado_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
