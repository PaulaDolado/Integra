import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  FileX,
  Loader2,
  LogOut,
  MoreHorizontal,
  PanelRight,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { cn } from "@/lib/utils";
import { EditorNota } from "@/components/documentos/EditorNota";
import { DialogoCompartir } from "@/components/documentos/DialogoCompartir";
import { AvatarPersona } from "@/components/documentos/AvatarPersona";
import { eliminarNota, salirDeNota } from "@/components/documentos/acciones";
import { useMetaNota, useNotaColaborativa, usePresentes } from "@/components/documentos/useNotaColaborativa";
import { colorDePersona, FORMATOS, puedeEditar, ROLES, tituloNota, type Formato } from "@/components/documentos/notas";
import type { EstadoSync } from "@/components/documentos/sincronizacion";

const ESTADOS: Record<EstadoSync, { texto: string; icono: typeof Check; clase: string }> = {
  guardado: { texto: "Guardado", icono: Check, clase: "text-muted-foreground" },
  guardando: { texto: "Guardando…", icono: Loader2, clase: "text-muted-foreground" },
  "sin-conexion": { texto: "Sin conexión: se guardará al volver", icono: CloudOff, clase: "text-warning" },
  error: { texto: "No se ha podido guardar, reintentando…", icono: TriangleAlert, clase: "text-destructive" },
  "sin-acceso": { texto: "Ya no puedes editar esta nota", icono: TriangleAlert, clase: "text-destructive" },
};

const MAX_AVATARES = 4;

export default function NotaDetalle() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, getDisplayName } = useEmployeeProfile();
  const { empleadoId } = useMiEmpleadoId();

  const { data: meta, isLoading: cargandoMeta, error: errorMeta } = useMetaNota(id);
  useAvisarError(errorMeta, "No se pudo abrir la nota");
  const rol = meta?.rol;
  const editable = rol ? puedeEditar(rol) : undefined;
  const { sesion, estado, error: errorNota } = useNotaColaborativa(id, editable);
  useAvisarError(errorNota, "No se pudo cargar el contenido de la nota");
  const presentes = usePresentes(sesion?.awareness ?? null);

  const [compartirAbierto, setCompartirAbierto] = useState(false);
  const [mostrarIndice, setMostrarIndice] = useState(true);
  const [confirmar, setConfirmar] = useState<"eliminar" | "salir" | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Título: se edita en local y se guarda al dejar de escribir. Lo que cambien
  // los demás solo se pinta si no lo estás editando tú.
  const [titulo, setTitulo] = useState("");
  const [tituloServidor, setTituloServidor] = useState<string | null>(null);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const temporizadorTitulo = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (meta && meta.titulo !== tituloServidor) {
    setTituloServidor(meta.titulo);
    if (!editandoTitulo) setTitulo(meta.titulo);
  }

  useEffect(
    () => () => {
      if (temporizadorTitulo.current) clearTimeout(temporizadorTitulo.current);
    },
    []
  );

  // Queda en «Abierto recientemente» del dashboard. Solo cuando se sabe que
  // la nota existe y el usuario la ve.
  const notaAbierta = meta?.id;
  useEffect(() => {
    if (!notaAbierta) return;
    void supabase.rpc("registrar_apertura_nota", { p_nota: notaAbierta }).then(({ error }) => {
      if (error) console.error("Error registering note opening:", error);
      else void queryClient.invalidateQueries({ queryKey: ["notas", "recientes"] });
    });
  }, [notaAbierta, queryClient]);

  const guardarTitulo = async (valor: string) => {
    const { error } = await supabase.rpc("actualizar_nota", { p_nota: id, p_titulo: valor });
    if (error) toast({ title: "Error", description: "No se pudo guardar el título", variant: "destructive" });
  };

  const cambiarTitulo = (valor: string) => {
    setTitulo(valor);
    if (temporizadorTitulo.current) clearTimeout(temporizadorTitulo.current);
    temporizadorTitulo.current = setTimeout(() => void guardarTitulo(valor), 700);
  };

  const cambiarFormato = async (formato: Formato) => {
    const clave = ["notas", "meta", id];
    const anterior = meta;
    // Se ve al momento; si falla, vuelve atrás
    queryClient.setQueryData(clave, meta ? { ...meta, formato } : meta);
    const { error } = await supabase.rpc("actualizar_nota", { p_nota: id, p_formato: formato });
    if (error) {
      queryClient.setQueryData(clave, anterior);
      toast({ title: "Error", description: "No se pudo cambiar el formato de la hoja", variant: "destructive" });
    }
  };

  const ejecutarConfirmacion = async () => {
    setProcesando(true);
    try {
      if (confirmar === "eliminar") await eliminarNota(id);
      else if (empleadoId) await salirDeNota(id, empleadoId);
      queryClient.invalidateQueries({ queryKey: ["notas", "lista"] });
      toast({ title: confirmar === "eliminar" ? "Nota eliminada" : "Ya no colaboras en la nota" });
      navigate("/documentos");
    } catch (e) {
      console.error("Error en la nota", e);
      toast({ title: "Error", description: "No se pudo completar la acción", variant: "destructive" });
      setProcesando(false);
    }
  };

  if (cargandoMeta) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Cargando" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-6 py-24 text-center">
        <FileX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold">No puedes abrir esta nota</h1>
        <p className="text-sm text-muted-foreground">No existe o ya no está compartida contigo.</p>
        <Button asChild variant="outline">
          <Link to="/documentos">Volver a Gestión Documental</Link>
        </Button>
      </div>
    );
  }

  const esPropietario = rol === "propietario";
  const nombreMostrado = tituloNota(titulo);
  const Estado = ESTADOS[estado];
  // Nombre y color del cursor. Nunca bloquea el editor: si el perfil no llega,
  // se usa el nombre de la cuenta
  const idPersona = empleadoId ?? profile?.id ?? "anonimo";
  const usuario = { id: idPersona, name: getDisplayName(), color: colorDePersona(idPersona) };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/documentos" aria-label="Volver a Gestión Documental" title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          {editable ? (
            <>
              <h1 className="sr-only">{nombreMostrado}</h1>
              <input
                value={titulo}
                onChange={(e) => cambiarTitulo(e.target.value)}
                onFocus={() => setEditandoTitulo(true)}
                onBlur={() => setEditandoTitulo(false)}
                placeholder="Sin título"
                aria-label="Título de la nota"
                maxLength={200}
                className="w-full truncate rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </>
          ) : (
            <h1 className="truncate px-1 text-lg font-semibold text-foreground">{nombreMostrado}</h1>
          )}
          <p className={cn("flex items-center gap-1.5 px-1 text-xs", Estado.clase)} role="status">
            {rol === "lector" ? (
              <>
                <Eye className="h-3 w-3" aria-hidden="true" />
                {ROLES.lector}
              </>
            ) : (
              <>
                <Estado.icono className={cn("h-3 w-3", estado === "guardando" && "animate-spin")} aria-hidden="true" />
                {Estado.texto}
              </>
            )}
          </p>
        </div>

        {presentes.length > 0 && (
          <div className="flex items-center" aria-label={`También en la nota: ${presentes.map((p) => p.nombre).join(", ")}`} role="group">
            {presentes.slice(0, MAX_AVATARES).map((p) => (
              <AvatarPersona key={p.id} id={p.id} nombre={p.nombre} color={p.color} className="-ml-1.5 ring-2 ring-background first:ml-0" decorativo={false} />
            ))}
            {presentes.length > MAX_AVATARES && (
              <span className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                +{presentes.length - MAX_AVATARES}
              </span>
            )}
          </div>
        )}

        {editable && (
          <ToggleGroup
            type="single"
            value={meta.formato}
            onValueChange={(v) => v && void cambiarFormato(v as Formato)}
            aria-label="Formato de la hoja"
            className="rounded-md border border-border p-0.5"
          >
            {FORMATOS.map((f) => (
              <ToggleGroupItem key={f.valor} value={f.valor} size="sm" className="h-7 w-7 p-0" aria-label={f.etiqueta} title={f.etiqueta}>
                <f.icono className="h-4 w-4" aria-hidden="true" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="hidden xl:inline-flex"
          onClick={() => setMostrarIndice((v) => !v)}
          aria-pressed={mostrarIndice}
          aria-label="Panel de marcadores e índice"
          title="Marcadores e índice"
        >
          <PanelRight className="h-4 w-4" />
        </Button>

        <Button variant={esPropietario ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setCompartirAbierto(true)}>
          <Share2 className="h-4 w-4" />
          {esPropietario ? "Compartir" : "Personas"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Más opciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {esPropietario ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmar("eliminar")}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Eliminar nota
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConfirmar("salir")}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Dejar de colaborar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {sesion && editable !== undefined ? (
        <EditorNota
          notaId={id}
          sesion={sesion}
          editable={editable && estado !== "sin-acceso"}
          formato={meta.formato}
          usuario={usuario}
          mostrarIndice={mostrarIndice}
        />
      ) : errorNota ? (
        <p className="p-12 text-center text-sm text-muted-foreground">No se ha podido cargar el contenido de la nota.</p>
      ) : (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Cargando la nota" />
        </div>
      )}

      <DialogoCompartir
        open={compartirAbierto}
        onOpenChange={setCompartirAbierto}
        notaId={id}
        titulo={nombreMostrado}
        esPropietario={esPropietario}
      />

      <AlertDialog open={confirmar !== null} onOpenChange={(open) => !open && !procesando && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar === "eliminar" ? "¿Eliminar la nota?" : "¿Dejar de colaborar?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "eliminar"
                ? `«${nombreMostrado}» y sus imágenes se borrarán para todas las personas con las que la compartes. No se puede deshacer.`
                : `Dejarás de ver «${nombreMostrado}». Su propietario puede volver a compartirla contigo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void ejecutarConfirmacion();
              }}
              disabled={procesando}
              className={confirmar === "eliminar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmar === "eliminar" ? "Eliminar" : "Dejar de colaborar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
