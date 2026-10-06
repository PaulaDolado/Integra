import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Sincroniza el documento Yjs de una nota con Supabase.
//
// · Los cambios propios se juntan durante un momento y se guardan con
//   guardar_cambios_nota(): una fila de nota_cambios por cada guardado.
// · Los cambios de los demás llegan como aviso por Realtime (postgres_changes,
//   que respeta RLS) y se piden a la tabla. El aviso solo sirve de timbre: si se
//   pierde alguno o llega sin datos, la siguiente petición los trae igual.
// · Los cambios Yjs se pueden aplicar en cualquier orden y repetidos, así que
//   pedir de más nunca estropea el documento.
// · Los cursores (awareness) van por un canal privado de broadcast, "nota:<id>".

export type EstadoSync = "guardado" | "guardando" | "sin-conexion" | "error" | "sin-acceso";

// Lo que devuelve abrir_nota(): el estado compactado y hasta qué cambio llega
export interface BaseNota {
  estado: string;
  estado_hasta: number;
}

export const ESPERA_GUARDADO_MS = 400;
const ESPERA_TRAER_MS = 120;
const ESPERA_CURSORES_MS = 80;
const PAGINA = 500;
// Al abrir una nota con tantos cambios sueltos, un editor los compacta
export const UMBRAL_COMPACTAR = 100;

// Origen de las transacciones que vienen del servidor: no se vuelven a guardar
export const ORIGEN_REMOTO = Symbol("nota-remoto");

export function aBase64(bytes: Uint8Array) {
  let texto = "";
  // Por trozos: String.fromCharCode con millones de argumentos desborda la pila
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

export function deBase64(texto: string) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

interface Fila {
  id: number;
  datos: string;
}

// Pide los cambios con id > desde (y los ids sueltos indicados), en orden y por páginas
export async function pedirCambios(notaId: string, desde: number, sueltos: number[] = []): Promise<Fila[]> {
  const filas: Fila[] = [];
  let ultimo = desde;
  let extra = sueltos;
  for (;;) {
    let consulta = supabase.from("nota_cambios").select("id, datos").eq("nota_id", notaId);
    consulta = extra.length > 0 ? consulta.or(`id.gt.${ultimo},id.in.(${extra.join(",")})`) : consulta.gt("id", ultimo);
    const { data, error } = await consulta.order("id", { ascending: true }).limit(PAGINA);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
    ultimo = Math.max(ultimo, data[data.length - 1].id);
    extra = [];
  }
}

interface Opciones {
  notaId: string;
  doc: Y.Doc;
  awareness: Awareness;
  puedeEditar: boolean;
  // Primeras líneas en texto plano, para la lista de notas
  extracto?: () => string;
  onEstado?: (estado: EstadoSync) => void;
}

export class SincronizadorNota {
  readonly sesion = crypto.randomUUID();
  private readonly notaId: string;
  private readonly doc: Y.Doc;
  private readonly awareness: Awareness;
  private readonly puedeEditar: boolean;
  private readonly extracto?: () => string;
  private readonly onEstado?: (estado: EstadoSync) => void;

  private ultimoId = 0;
  private readonly vistos = new Set<number>();
  private readonly porTraer = new Set<number>();
  private pendientes: Uint8Array[] = [];
  private guardando = false;
  private reintentos = 0;
  private temporizadorGuardar: ReturnType<typeof setTimeout> | null = null;
  private temporizadorTraer: ReturnType<typeof setTimeout> | null = null;
  private temporizadorCursores: ReturnType<typeof setTimeout> | null = null;
  private trayendo: Promise<void> | null = null;
  private otraVez = false;
  private conectado = false;
  private sinAcceso = false;
  private destruido = false;
  private canalCambios: RealtimeChannel | null = null;
  private canalCursores: RealtimeChannel | null = null;
  private estado: EstadoSync = "guardado";

  constructor(opciones: Opciones) {
    this.notaId = opciones.notaId;
    this.doc = opciones.doc;
    this.awareness = opciones.awareness;
    this.puedeEditar = opciones.puedeEditar;
    this.extracto = opciones.extracto;
    this.onEstado = opciones.onEstado;
  }

  get estadoActual() {
    return this.estado;
  }

  // Hay cambios propios que todavía no están en el servidor
  get hayPendientes() {
    return this.pendientes.length > 0 || this.guardando;
  }

  // Carga el estado y los cambios guardados. Si hay muchos cambios sueltos y se
  // puede editar, los compacta. Devuelve cuántos cambios sueltos había.
  async cargar(base: BaseNota) {
    if (base.estado) Y.applyUpdate(this.doc, deBase64(base.estado), ORIGEN_REMOTO);
    this.ultimoId = base.estado_hasta;

    const filas = await pedirCambios(this.notaId, base.estado_hasta);
    this.aplicar(filas);

    if (this.puedeEditar && filas.length >= UMBRAL_COMPACTAR) {
      void this.compactar(base, filas);
    }
    return filas.length;
  }

  // Empieza a guardar los cambios propios y a escuchar los de los demás
  conectar() {
    this.doc.on("update", this.alCambiarDoc);
    this.awareness.on("update", this.alCambiarCursores);

    this.canalCambios = supabase
      .channel(`nota-cambios:${this.notaId}:${this.sesion}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nota_cambios", filter: `nota_id=eq.${this.notaId}` },
        (payload) => this.alAvisar(payload.new as { id?: number; sesion?: string })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Al conectar (o reconectar) se piden los cambios que hayan podido
          // escaparse: los de entre la carga y la suscripción, o los de la desconexión
          this.conectado = true;
          if (this.estado === "sin-conexion") this.cambiarEstado(this.hayPendientes ? "guardando" : "guardado");
          void this.ponerseAlDia();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (this.destruido) return;
          this.conectado = false;
          this.cambiarEstado("sin-conexion");
        }
      });

    this.canalCursores = supabase
      .channel(`nota:${this.notaId}`, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "cursores" }, ({ payload }) => {
        if (typeof payload?.datos !== "string") return;
        try {
          applyAwarenessUpdate(this.awareness, deBase64(payload.datos), ORIGEN_REMOTO);
        } catch {
          // Un mensaje mal formado no debe romper el editor
        }
      })
      // Quien entra pide los cursores de los que ya estaban
      .on("broadcast", { event: "hola" }, () => this.enviarCursores())
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && this.canalCursores) {
          this.enviarCursores();
          void this.canalCursores.send({ type: "broadcast", event: "hola", payload: {} });
        }
      });
  }

  // Guarda lo pendiente y se desconecta
  async destruir() {
    if (this.destruido) return;
    this.destruido = true;
    this.doc.off("update", this.alCambiarDoc);
    this.awareness.off("update", this.alCambiarCursores);
    for (const t of [this.temporizadorGuardar, this.temporizadorTraer, this.temporizadorCursores]) {
      if (t) clearTimeout(t);
    }
    // Los demás dejan de ver el cursor al momento, sin esperar a que caduque
    if (this.canalCursores) {
      removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
      const datos = aBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
      void this.canalCursores.send({ type: "broadcast", event: "cursores", payload: { datos } });
    }
    const canales = [this.canalCambios, this.canalCursores].filter((c): c is RealtimeChannel => !!c);
    await this.guardarAhora();
    for (const canal of canales) void supabase.removeChannel(canal);
  }

  // Guarda ya lo pendiente, sin esperar (al salir de la nota)
  async guardarAhora() {
    if (this.temporizadorGuardar) {
      clearTimeout(this.temporizadorGuardar);
      this.temporizadorGuardar = null;
    }
    await this.guardar();
  }

  private cambiarEstado(estado: EstadoSync) {
    if (this.sinAcceso || this.estado === estado) return;
    this.estado = estado;
    this.onEstado?.(estado);
  }

  private aplicar(filas: Fila[]) {
    const nuevas = filas.filter((f) => !this.vistos.has(f.id));
    if (nuevas.length === 0) return;
    // Se aplican juntas: una sola transacción, un solo repintado del editor
    const cambios = nuevas.map((f) => deBase64(f.datos));
    Y.applyUpdate(this.doc, cambios.length === 1 ? cambios[0] : Y.mergeUpdates(cambios), ORIGEN_REMOTO);
    for (const f of nuevas) {
      this.vistos.add(f.id);
      this.ultimoId = Math.max(this.ultimoId, f.id);
    }
  }

  // Cambios propios ------------------------------------------------------------------

  private alCambiarDoc = (cambio: Uint8Array, origen: unknown) => {
    if (origen === ORIGEN_REMOTO || !this.puedeEditar || this.sinAcceso) return;
    this.pendientes.push(cambio);
    this.cambiarEstado("guardando");
    if (!this.temporizadorGuardar) {
      this.temporizadorGuardar = setTimeout(() => {
        this.temporizadorGuardar = null;
        void this.guardar();
      }, ESPERA_GUARDADO_MS);
    }
  };

  private async guardar(): Promise<void> {
    if (this.guardando || this.pendientes.length === 0 || this.sinAcceso) return;
    const lote = this.pendientes;
    this.pendientes = [];
    this.guardando = true;

    let extracto: string | undefined;
    try {
      extracto = this.extracto?.().slice(0, 300);
    } catch {
      extracto = undefined;
    }

    const { data, error } = await supabase.rpc("guardar_cambios_nota", {
      p_nota: this.notaId,
      p_datos: aBase64(lote.length === 1 ? lote[0] : Y.mergeUpdates(lote)),
      p_sesion: this.sesion,
      ...(extracto !== undefined ? { p_extracto: extracto } : {}),
    });
    this.guardando = false;

    if (error) {
      // Se conservan para el siguiente intento, delante de los que hayan llegado
      this.pendientes = [...lote, ...this.pendientes];
      if ((error as { code?: string }).code === "42501") {
        // Ya no puede editar (le han quitado el acceso o el permiso)
        this.cambiarEstado("sin-acceso");
        this.sinAcceso = true;
        return;
      }
      this.cambiarEstado(this.conectado ? "error" : "sin-conexion");
      if (this.destruido) return;
      const espera = Math.min(30_000, 1000 * 2 ** this.reintentos++);
      this.temporizadorGuardar = setTimeout(() => {
        this.temporizadorGuardar = null;
        void this.guardar();
      }, espera);
      return;
    }

    this.reintentos = 0;
    if (typeof data === "number") this.vistos.add(data);
    if (this.pendientes.length > 0) {
      await this.guardar();
    } else {
      this.cambiarEstado("guardado");
    }
  }

  // Cambios de los demás ---------------------------------------------------------------

  private alAvisar(fila: { id?: number; sesion?: string }) {
    if (fila.sesion === this.sesion) return;
    if (typeof fila.id === "number") {
      if (this.vistos.has(fila.id)) return;
      // Un cambio con id menor que el último visto se guardó más tarde: se pide aparte
      if (fila.id <= this.ultimoId) this.porTraer.add(fila.id);
    }
    if (this.temporizadorTraer) return;
    this.temporizadorTraer = setTimeout(() => {
      this.temporizadorTraer = null;
      void this.traer();
    }, ESPERA_TRAER_MS);
  }

  private traer(): Promise<void> {
    if (this.trayendo) {
      this.otraVez = true;
      return this.trayendo;
    }
    this.trayendo = (async () => {
      do {
        this.otraVez = false;
        const sueltos = [...this.porTraer];
        this.porTraer.clear();
        try {
          this.aplicar(await pedirCambios(this.notaId, this.ultimoId, sueltos));
        } catch (error) {
          console.error("No se pudieron traer los cambios de la nota", error);
          for (const id of sueltos) this.porTraer.add(id);
          return;
        }
      } while (this.otraVez && !this.destruido);
    })().finally(() => {
      this.trayendo = null;
    });
    return this.trayendo;
  }

  // Tras una desconexión: si alguien compactó cambios que no llegamos a ver, se
  // aplica el estado compactado entero (Yjs ignora lo que ya teníamos)
  private async ponerseAlDia() {
    // Primero solo el número: el estado puede pesar y casi nunca hace falta
    const { data } = await supabase.from("notas").select("estado_hasta").eq("id", this.notaId).maybeSingle();
    if (data && data.estado_hasta > this.ultimoId) {
      const { data: nota } = await supabase.from("notas").select("estado, estado_hasta").eq("id", this.notaId).maybeSingle();
      if (nota?.estado) {
        Y.applyUpdate(this.doc, deBase64(nota.estado), ORIGEN_REMOTO);
        this.ultimoId = Math.max(this.ultimoId, nota.estado_hasta);
      }
    }
    await this.traer();
  }

  private async compactar(base: BaseNota, filas: Fila[]) {
    const partes = filas.map((f) => deBase64(f.datos));
    if (base.estado) partes.unshift(deBase64(base.estado));
    const { error } = await supabase.rpc("compactar_nota", {
      p_nota: this.notaId,
      p_estado: aBase64(Y.mergeUpdates(partes)),
      p_base: base.estado_hasta,
      p_hasta: filas[filas.length - 1].id,
      p_cuantos: filas.length,
    });
    // No es grave: se volverá a intentar la próxima vez que alguien abra la nota
    if (error) console.error("No se pudo compactar la nota", error);
  }

  // Cursores ---------------------------------------------------------------------------

  // Cada uno solo envía su propio cursor, y como mucho cada 80 ms
  private alCambiarCursores = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origen: unknown
  ) => {
    if (origen === ORIGEN_REMOTO) return;
    const propio = this.doc.clientID;
    if (![...added, ...updated, ...removed].includes(propio)) return;
    if (this.temporizadorCursores) return;
    this.temporizadorCursores = setTimeout(() => {
      this.temporizadorCursores = null;
      this.enviarCursores();
    }, ESPERA_CURSORES_MS);
  };

  private enviarCursores() {
    if (!this.canalCursores || this.destruido || !this.awareness.getLocalState()) return;
    const datos = aBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    void this.canalCursores.send({ type: "broadcast", event: "cursores", payload: { datos } });
  }
}
