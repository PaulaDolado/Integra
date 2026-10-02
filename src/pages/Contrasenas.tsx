import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  abrirBoveda,
  cifrarEntrada,
  crearBoveda,
  descifrarEntrada,
  type Entrada,
  type ParametrosBoveda,
} from "@/components/contrasenas/cripto";
import { analizarSalud, dominio, urlAbrible, type EntradaDescifrada } from "@/components/contrasenas/contrasenas";
import { CrearBoveda, DesbloquearBoveda } from "@/components/contrasenas/AccesoBoveda";
import { EntradaDialog } from "@/components/contrasenas/EntradaDialog";
import { CambiarMaestraDialog } from "@/components/contrasenas/CambiarMaestraDialog";
import { Generador } from "@/components/contrasenas/Generador";

// La bóveda se bloquea sola tras este tiempo sin actividad, y al salir de la página
const BLOQUEO_INACTIVIDAD_MS = 5 * 60 * 1000;
// Lo copiado se borra del portapapeles pasado este tiempo
const BORRADO_PORTAPAPELES_MS = 30 * 1000;

type Estado = "cargando" | "sin-boveda" | "bloqueada" | "abierta" | "error";
type Filtro = "todas" | "favoritas" | "debiles" | "repetidas";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "favoritas", etiqueta: "Favoritas" },
  { valor: "debiles", etiqueta: "Débiles" },
  { valor: "repetidas", etiqueta: "Repetidas" },
];

const COLORES_AVATAR = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
];

function colorAvatar(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_AVATAR[h % COLORES_AVATAR.length];
}

const ordenar = (lista: EntradaDescifrada[]) =>
  [...lista].sort((a, b) => Number(b.favorito) - Number(a.favorito) || a.nombre.localeCompare(b.nombre, "es"));

export default function Contrasenas() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [estado, setEstado] = useState<Estado>("cargando");
  const [parametros, setParametros] = useState<ParametrosBoveda | null>(null);
  // La clave solo vive en memoria mientras la página está abierta y desbloqueada
  const [clave, setClave] = useState<CryptoKey | null>(null);
  const [entradas, setEntradas] = useState<EntradaDescifrada[]>([]);
  const [ilegibles, setIlegibles] = useState(0);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());

  const [editando, setEditando] = useState<EntradaDescifrada | "nueva" | null>(null);
  const [borrando, setBorrando] = useState<EntradaDescifrada | null>(null);
  const [cambiandoMaestra, setCambiandoMaestra] = useState(false);
  const [generador, setGenerador] = useState(false);
  const [vaciando, setVaciando] = useState(false);

  const temporizadorPortapapeles = useRef<number>();
  const ultimaActividad = useRef(Date.now());

  const cargarParametros = useCallback(async () => {
    const { data, error } = await supabase.from("boveda_claves").select("sal, iteraciones, verificador").maybeSingle();
    if (error) {
      console.error("Error fetching bóveda:", error);
      setEstado("error");
      return;
    }
    setParametros(data);
    setEstado(data ? "bloqueada" : "sin-boveda");
  }, []);

  useEffect(() => {
    cargarParametros();
  }, [cargarParametros]);

  const bloquear = useCallback(() => {
    setClave(null);
    setEntradas([]);
    setReveladas(new Set());
    setEditando(null);
    setBorrando(null);
    setCambiandoMaestra(false);
    setEstado("bloqueada");
  }, []);

  // Bloqueo automático por inactividad
  useEffect(() => {
    if (estado !== "abierta") return;
    ultimaActividad.current = Date.now();
    const actividad = () => (ultimaActividad.current = Date.now());
    const eventos = ["pointerdown", "keydown", "mousemove", "scroll"] as const;
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }));
    const intervalo = window.setInterval(() => {
      if (Date.now() - ultimaActividad.current >= BLOQUEO_INACTIVIDAD_MS) {
        bloquear();
        toast({ title: "Bóveda bloqueada", description: "Se ha bloqueado por inactividad." });
      }
    }, 10_000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, actividad));
      window.clearInterval(intervalo);
    };
  }, [estado, bloquear, toast]);

  const cargarEntradas = async (k: CryptoKey) => {
    const { data, error } = await supabase.from("boveda_entradas").select("id, datos, updated_at").order("created_at");
    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar tus contraseñas", variant: "destructive" });
      return false;
    }
    const resultados = await Promise.allSettled(
      (data ?? []).map(async (fila) => ({ ...(await descifrarEntrada(k, fila.datos)), id: fila.id, updated_at: fila.updated_at }))
    );
    setEntradas(ordenar(resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))));
    setIlegibles(resultados.filter((r) => r.status === "rejected").length);
    return true;
  };

  const crear = async (maestra: string) => {
    const { clave: k, parametros: p } = await crearBoveda(maestra);
    const { error } = await supabase.from("boveda_claves").insert(p);
    if (error) {
      toast({ title: "Error", description: "No se pudo crear la bóveda", variant: "destructive" });
      return;
    }
    setParametros(p);
    setClave(k);
    setEntradas([]);
    setIlegibles(0);
    setEstado("abierta");
    toast({ title: "Bóveda creada", description: "Ya puedes guardar tus contraseñas." });
  };

  const desbloquear = async (maestra: string) => {
    if (!parametros) return false;
    const k = await abrirBoveda(maestra, parametros);
    if (!k) return false;
    if (await cargarEntradas(k)) {
      setClave(k);
      setEstado("abierta");
    }
    return true;
  };

  const guardar = async (entrada: Entrada) => {
    if (!clave) return false;
    const datos = await cifrarEntrada(clave, entrada);
    const existente = editando !== "nueva" ? editando : null;

    const { data, error } = existente
      ? await supabase.from("boveda_entradas").update({ datos }).eq("id", existente.id).select("id, updated_at").single()
      : await supabase.from("boveda_entradas").insert({ datos }).select("id, updated_at").single();
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo guardar la contraseña", variant: "destructive" });
      return false;
    }
    const guardada: EntradaDescifrada = { ...entrada, id: data.id, updated_at: data.updated_at };
    setEntradas((lista) => ordenar([...lista.filter((e) => e.id !== guardada.id), guardada]));
    setEditando(null);
    toast({ title: existente ? "Contraseña actualizada" : "Contraseña guardada" });
    return true;
  };

  const alternarFavorito = async (entrada: EntradaDescifrada) => {
    if (!clave) return;
    const { id, updated_at: _, ...datosEntrada } = entrada;
    const cambiada = { ...datosEntrada, favorito: !entrada.favorito };
    const { error } = await supabase.from("boveda_entradas").update({ datos: await cifrarEntrada(clave, cambiada) }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
      return;
    }
    setEntradas((lista) => ordenar(lista.map((e) => (e.id === id ? { ...e, favorito: cambiada.favorito } : e))));
  };

  const borrar = async () => {
    if (!borrando) return;
    const { error } = await supabase.from("boveda_entradas").delete().eq("id", borrando.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
      return;
    }
    setEntradas((lista) => lista.filter((e) => e.id !== borrando.id));
    setBorrando(null);
    toast({ title: "Contraseña eliminada" });
  };

  const cambiarMaestra = async (actual: string, nueva: string) => {
    if (!parametros) return "La bóveda no está cargada";
    if (!(await abrirBoveda(actual, parametros))) return "La contraseña maestra actual no es correcta";
    if (ilegibles > 0) return "Hay entradas que no se pueden descifrar; no se puede cambiar la clave sin perderlas";

    const { clave: k, parametros: p } = await crearBoveda(nueva);
    const cifradas = await Promise.all(
      entradas.map(async ({ id, updated_at: _, ...e }) => ({ id, datos: await cifrarEntrada(k, e) }))
    );
    const { error } = await supabase.rpc("cambiar_clave_maestra", {
      p_sal: p.sal,
      p_iteraciones: p.iteraciones,
      p_verificador: p.verificador,
      p_entradas: cifradas,
    });
    if (error) return error.message;

    setParametros(p);
    setClave(k);
    setCambiandoMaestra(false);
    toast({ title: "Contraseña maestra cambiada", description: "Todas tus contraseñas se han cifrado con la nueva clave." });
    return null;
  };

  const vaciar = async () => {
    if (!user) return;
    // Las entradas se borran en cascada con la bóveda
    const { error } = await supabase.from("boveda_claves").delete().eq("user_id", user.id);
    setVaciando(false);
    if (error) {
      toast({ title: "Error", description: "No se pudo vaciar la bóveda", variant: "destructive" });
      return;
    }
    bloquear();
    setParametros(null);
    setEstado("sin-boveda");
    toast({ title: "Bóveda vaciada", description: "Crea una nueva contraseña maestra para empezar de nuevo." });
  };

  const copiar = async (texto: string, que: "usuario" | "contrasena") => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
      return;
    }
    if (que === "usuario") {
      toast({ title: "Usuario copiado" });
      return;
    }
    window.clearTimeout(temporizadorPortapapeles.current);
    temporizadorPortapapeles.current = window.setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => undefined);
    }, BORRADO_PORTAPAPELES_MS);
    toast({ title: "Contraseña copiada", description: "Se borrará del portapapeles en 30 segundos." });
  };

  const alternarRevelada = (id: string) =>
    setReveladas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const salud = useMemo(() => analizarSalud(entradas), [entradas]);

  const texto = busqueda.trim().toLowerCase();
  const mostradas = entradas.filter((e) => {
    if (filtro === "favoritas" && !e.favorito) return false;
    if (filtro === "debiles" && !salud.debiles.has(e.id)) return false;
    if (filtro === "repetidas" && !salud.repetidas.has(e.id)) return false;
    return !texto || [e.nombre, e.usuario, e.url, e.notas].some((c) => c.toLowerCase().includes(texto));
  });

  const cabecera = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
        <KeyRound className="w-6 h-6 text-primary" />
        Contraseñas
      </h1>
      <p className="text-muted-foreground mt-1">Tu bóveda personal, cifrada de extremo a extremo. Solo tú puedes leerla.</p>
    </div>
  );

  if (estado === "cargando") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="p-6 space-y-6">
        {cabecera}
        <Card>
          <CardContent className="py-16 text-center">
            <TriangleAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No se pudo cargar la bóveda</p>
            <Button variant="outline" className="mt-4" onClick={cargarParametros}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estado !== "abierta") {
    return (
      <div className="p-6 space-y-6">
        {cabecera}
        <div className="py-4">
          {estado === "sin-boveda" ? (
            <CrearBoveda onCrear={crear} />
          ) : (
            <DesbloquearBoveda onDesbloquear={desbloquear} onOlvidada={() => setVaciando(true)} />
          )}
        </div>
        <AlertDialog open={vaciando} onOpenChange={setVaciando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Vaciar la bóveda?</AlertDialogTitle>
              <AlertDialogDescription>
                La contraseña maestra no se puede recuperar: tus contraseñas están cifradas con ella y nadie más tiene la
                clave. La única opción es borrar la bóveda con todo su contenido y crear una nueva. Esto no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={vaciar}>
                Vaciar la bóveda
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const metricas: { etiqueta: string; valor: string; filtro?: Filtro; aviso?: boolean }[] = [
    { etiqueta: "Contraseñas", valor: String(entradas.length), filtro: "todas" },
    { etiqueta: "Salud", valor: salud.puntuacion === null ? "—" : `${salud.puntuacion}%` },
    { etiqueta: "Débiles", valor: String(salud.debiles.size), filtro: "debiles", aviso: salud.debiles.size > 0 },
    { etiqueta: "Repetidas", valor: String(salud.repetidas.size), filtro: "repetidas", aviso: salud.repetidas.size > 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {cabecera}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setGenerador(true)}>
            <Sparkles className="w-4 h-4" />
            Generador
          </Button>
          <Button variant="outline" className="gap-2" onClick={bloquear}>
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
              <DropdownMenuItem onClick={() => setCambiandoMaestra(true)}>
                <KeyRound className="w-4 h-4 mr-2" />
                Cambiar contraseña maestra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="gap-2" onClick={() => setEditando("nueva")}>
            <Plus className="w-4 h-4" />
            Nueva contraseña
          </Button>
        </div>
      </div>

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
              onClick={() => setFiltro(m.filtro!)}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Filtrar contraseñas">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              role="tab"
              aria-selected={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
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
          <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        {entradas.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-primary" />
            <p className="font-medium">Tu bóveda está vacía</p>
            <p className="text-sm text-muted-foreground mb-4">Guarda aquí las contraseñas de tus herramientas de trabajo.</p>
            <Button className="gap-2" onClick={() => setEditando("nueva")}>
              <Plus className="w-4 h-4" />
              Añadir la primera
            </Button>
          </div>
        ) : mostradas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No hay contraseñas que coincidan</div>
        ) : (
          <ul className="divide-y">
            {mostradas.map((e) => {
              const enlace = e.url ? urlAbrible(e.url) : null;
              const revelada = reveladas.has(e.id);
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
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
                      <button
                        type="button"
                        className="truncate font-medium hover:underline underline-offset-4"
                        onClick={() => setEditando(e)}
                      >
                        {e.nombre}
                      </button>
                      {e.favorito && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorita" />}
                      {salud.debiles.has(e.id) && (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                          Débil
                        </Badge>
                      )}
                      {salud.repetidas.has(e.id) && (
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
                        onClick={() => copiar(e.usuario, "usuario")}
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
                        onClick={() => copiar(e.contrasena, "contrasena")}
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
                      onClick={() => alternarRevelada(e.id)}
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
                        <DropdownMenuItem onClick={() => setEditando(e)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {e.usuario && (
                          <DropdownMenuItem className="sm:hidden" onClick={() => copiar(e.usuario, "usuario")}>
                            <User className="w-4 h-4 mr-2" />
                            Copiar usuario
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="sm:hidden" onClick={() => alternarRevelada(e.id)}>
                          {revelada ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                          {revelada ? "Ocultar contraseña" : "Mostrar contraseña"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => alternarFavorito(e)}>
                          <Star className="w-4 h-4 mr-2" />
                          {e.favorito ? "Quitar de favoritos" : "Añadir a favoritos"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setBorrando(e)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <EntradaDialog
        open={editando !== null}
        entrada={editando === "nueva" ? null : editando}
        onCancel={() => setEditando(null)}
        onGuardar={guardar}
      />

      <CambiarMaestraDialog open={cambiandoMaestra} onCancel={() => setCambiandoMaestra(false)} onCambiar={cambiarMaestra} />

      <Dialog open={generador} onOpenChange={setGenerador}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generador de contraseñas</DialogTitle>
            <DialogDescription>Contraseñas aleatorias generadas en tu navegador.</DialogDescription>
          </DialogHeader>
          <Generador onCopiar={(c) => copiar(c, "contrasena")} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={borrando !== null} onOpenChange={(v) => !v && setBorrando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{borrando?.nombre}»?</AlertDialogTitle>
            <AlertDialogDescription>La contraseña se borrará de tu bóveda. Esto no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={borrar}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
