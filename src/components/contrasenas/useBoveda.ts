import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  abrirBoveda,
  cifrarEntrada,
  crearBoveda,
  descifrarEntrada,
  type Entrada,
  type ParametrosBoveda,
} from "@/components/contrasenas/cripto";
import type { EntradaDescifrada } from "./contrasenas";
import { ordenar } from "./lista";

// La bóveda se bloquea sola tras este tiempo sin actividad, y al salir de la página
const BLOQUEO_INACTIVIDAD_MS = 5 * 60 * 1000;

const leerParametros = async () =>
  await supabase.from("boveda_claves").select("sal, iteraciones, verificador").maybeSingle();

export type EstadoBoveda = "cargando" | "sin-boveda" | "bloqueada" | "abierta" | "error";

// Estado de la bóveda de la página de Contraseñas: carga, creación, desbloqueo,
// bloqueo (manual y por inactividad) y cambios en las entradas.
// También lleva los diálogos que dependen de la bóveda, porque al bloquear se cierran.
export function useBoveda() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [estado, setEstado] = useState<EstadoBoveda>("cargando");
  const [parametros, setParametros] = useState<ParametrosBoveda | null>(null);
  // La clave solo vive en memoria mientras la página está abierta y desbloqueada
  const [clave, setClave] = useState<CryptoKey | null>(null);
  const [entradas, setEntradas] = useState<EntradaDescifrada[]>([]);
  const [ilegibles, setIlegibles] = useState(0);
  const [reveladas, setReveladas] = useState<Set<string>>(new Set());

  const [editando, setEditando] = useState<EntradaDescifrada | "nueva" | null>(null);
  const [borrando, setBorrando] = useState<EntradaDescifrada | null>(null);
  const [cambiandoMaestra, setCambiandoMaestra] = useState(false);
  const [vaciando, setVaciando] = useState(false);

  // Se pone en hora al abrir la bóveda, en el efecto del bloqueo por inactividad
  const ultimaActividad = useRef(0);

  const aplicarParametros = useCallback(({ data, error }: Awaited<ReturnType<typeof leerParametros>>) => {
    if (error) {
      console.error("Error fetching bóveda:", error);
      setEstado("error");
      return;
    }
    setParametros(data);
    setEstado(data ? "bloqueada" : "sin-boveda");
  }, []);

  const cargarParametros = useCallback(async () => aplicarParametros(await leerParametros()), [aplicarParametros]);

  useEffect(() => {
    leerParametros().then(aplicarParametros);
  }, [aplicarParametros]);

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

  const alternarRevelada = (id: string) =>
    setReveladas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  return {
    estado,
    entradas,
    ilegibles,
    reveladas,
    editando,
    borrando,
    cambiandoMaestra,
    vaciando,
    setEditando,
    setBorrando,
    setCambiandoMaestra,
    setVaciando,
    cargarParametros,
    crear,
    desbloquear,
    bloquear,
    guardar,
    alternarFavorito,
    borrar,
    cambiarMaestra,
    vaciar,
    alternarRevelada,
  };
}
