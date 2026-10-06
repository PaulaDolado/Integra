import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { supabase } from "@/integrations/supabase/client";
import {
  ESPERA_GUARDADO_MS,
  SincronizadorNota,
  UMBRAL_COMPACTAR,
  aBase64,
  deBase64,
  type EstadoSync,
} from "./sincronizacion";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() },
}));

const NOTA = "11111111-1111-4111-8111-111111111111";

// Supabase en memoria: la tabla de cambios, la nota y los canales de Realtime
interface Fila {
  id: number;
  nota_id: string;
  datos: string;
  sesion: string;
}

interface Canal {
  nombre: string;
  oyentes: { tipo: string; filtro: Record<string, string>; cb: (p: unknown) => void }[];
  estado?: (s: string) => void;
  on: (tipo: string, filtro: Record<string, string>, cb: (p: unknown) => void) => Canal;
  subscribe: (cb: (s: string) => void) => Canal;
  send: (m: { event: string; payload: unknown }) => Promise<string>;
}

function crearServidor() {
  const s = {
    cambios: [] as Fila[],
    nota: { estado: "", estado_hasta: 0 },
    siguienteId: 1,
    canales: [] as Canal[],
    // Si está activo, Realtime no avisa de los cambios (conexión caída)
    sinAvisos: false,
    // Respuesta forzada de guardar_cambios_nota
    errorGuardar: null as null | { code: string; message: string },
    llamadasGuardar: [] as Record<string, unknown>[],
    llamadasCompactar: [] as Record<string, unknown>[],
  };

  const avisar = (fila: Fila) => {
    if (s.sinAvisos) return;
    for (const canal of s.canales) {
      for (const o of canal.oyentes) {
        if (o.tipo === "postgres_changes" && o.filtro.table === "nota_cambios") o.cb({ new: { id: fila.id, sesion: fila.sesion } });
      }
    }
  };

  const insertar = (datos: string, sesion: string) => {
    const fila = { id: s.siguienteId++, nota_id: NOTA, datos, sesion };
    s.cambios.push(fila);
    avisar(fila);
    return fila;
  };

  vi.mocked(supabase.rpc).mockImplementation((async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "guardar_cambios_nota") {
      s.llamadasGuardar.push(args);
      if (s.errorGuardar) return { data: null, error: s.errorGuardar };
      return { data: insertar(String(args.p_datos), String(args.p_sesion)).id, error: null };
    }
    if (nombre === "compactar_nota") {
      s.llamadasCompactar.push(args);
      const enTramo = s.cambios.filter((c) => c.id > Number(args.p_base) && c.id <= Number(args.p_hasta));
      if (s.nota.estado_hasta !== args.p_base || enTramo.length !== args.p_cuantos) return { data: false, error: null };
      s.nota = { estado: String(args.p_estado), estado_hasta: Number(args.p_hasta) };
      s.cambios = s.cambios.filter((c) => !enTramo.includes(c));
      return { data: true, error: null };
    }
    return { data: null, error: { message: `RPC no simulada: ${nombre}` } };
  }) as never);

  vi.mocked(supabase.from).mockImplementation(((tabla: string) => {
    let filas: Fila[] = tabla === "nota_cambios" ? [...s.cambios] : [];
    let limite = Infinity;
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      gt: (_col: string, valor: number) => {
        filas = filas.filter((f) => f.id > valor);
        return consulta;
      },
      or: (texto: string) => {
        const gt = Number(/id\.gt\.(\d+)/.exec(texto)?.[1]);
        const sueltos = (/id\.in\.\(([^)]*)\)/.exec(texto)?.[1] ?? "").split(",").map(Number);
        filas = filas.filter((f) => f.id > gt || sueltos.includes(f.id));
        return consulta;
      },
      order: () => consulta,
      limit: (n: number) => {
        limite = n;
        return consulta;
      },
      maybeSingle: async () => ({ data: { ...s.nota }, error: null }),
      then: (ok: (r: unknown) => unknown) =>
        Promise.resolve({ data: filas.sort((a, b) => a.id - b.id).slice(0, limite).map(({ id, datos }) => ({ id, datos })), error: null }).then(ok),
    };
    return consulta;
  }) as never);

  vi.mocked(supabase.channel).mockImplementation(((nombre: string) => {
    const canal: Canal = {
      nombre,
      oyentes: [],
      on(tipo, filtro, cb) {
        canal.oyentes.push({ tipo, filtro, cb });
        return canal;
      },
      subscribe(cb) {
        canal.estado = cb;
        queueMicrotask(() => cb("SUBSCRIBED"));
        return canal;
      },
      async send({ event, payload }) {
        for (const otro of s.canales) {
          if (otro === canal || otro.nombre !== nombre) continue;
          for (const o of otro.oyentes) if (o.tipo === "broadcast" && o.filtro.event === event) o.cb({ payload });
        }
        return "ok";
      },
    };
    s.canales.push(canal);
    return canal;
  }) as never);

  vi.mocked(supabase.removeChannel).mockImplementation((async (canal: Canal) => {
    s.canales = s.canales.filter((c) => c !== canal);
    return "ok";
  }) as never);

  return { ...s, get estado() { return s; }, insertar };
}

// Una persona con la nota abierta
function abrir(puedeEditar = true) {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const estados: EstadoSync[] = [];
  const sync = new SincronizadorNota({
    notaId: NOTA,
    doc,
    awareness,
    puedeEditar,
    extracto: () => doc.getText("t").toString(),
    onEstado: (e) => estados.push(e),
  });
  return { doc, awareness, sync, estados, texto: () => doc.getText("t").toString() };
}

async function conectar(p: ReturnType<typeof abrir>, base = { estado: "", estado_hasta: 0 }) {
  await p.sync.cargar(base);
  p.sync.conectar();
  await vi.advanceTimersByTimeAsync(0);
}

// Deja pasar el tiempo de guardado y de traer cambios
const esperar = () => vi.advanceTimersByTimeAsync(ESPERA_GUARDADO_MS + 300);

describe("base64", () => {
  it("convierte ida y vuelta, también cambios grandes", () => {
    const grande = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(deBase64(aBase64(grande))).toEqual(grande);
    expect(deBase64(aBase64(new Uint8Array()))).toEqual(new Uint8Array());
  });
});

describe("SincronizadorNota", () => {
  let servidor: ReturnType<typeof crearServidor>;
  const abiertas: ReturnType<typeof abrir>[] = [];
  const persona = (puedeEditar = true) => {
    const p = abrir(puedeEditar);
    abiertas.push(p);
    return p;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    servidor = crearServidor();
  });

  afterEach(async () => {
    for (const p of abiertas.splice(0)) {
      await p.sync.destruir();
      p.awareness.destroy();
    }
    vi.useRealTimers();
  });

  it("lo que escribe una persona le llega a la otra", async () => {
    const ana = persona();
    const luis = persona();
    await conectar(ana);
    await conectar(luis);

    ana.doc.getText("t").insert(0, "Hola");
    await esperar();
    expect(luis.texto()).toBe("Hola");

    luis.doc.getText("t").insert(4, ", Ana");
    await esperar();
    expect(ana.texto()).toBe("Hola, Ana");
    expect(ana.estados.at(-1)).toBe("guardado");
  });

  it("junta las pulsaciones seguidas en un solo guardado con el extracto", async () => {
    const ana = persona();
    await conectar(ana);

    for (const letra of "notas") ana.doc.getText("t").insert(ana.texto().length, letra);
    await esperar();

    expect(servidor.estado.llamadasGuardar).toHaveLength(1);
    expect(servidor.estado.llamadasGuardar[0]).toMatchObject({ p_nota: NOTA, p_extracto: "notas", p_sesion: ana.sync.sesion });
    const copia = new Y.Doc();
    Y.applyUpdate(copia, deBase64(String(servidor.estado.llamadasGuardar[0].p_datos)));
    expect(copia.getText("t").toString()).toBe("notas");
  });

  it("quien solo puede leer nunca guarda nada", async () => {
    const luis = persona(false);
    await conectar(luis);

    luis.doc.getText("t").insert(0, "no debería guardarse");
    await esperar();

    expect(servidor.estado.llamadasGuardar).toHaveLength(0);
  });

  it("no vuelve a pedir sus propios cambios", async () => {
    const ana = persona();
    await conectar(ana);
    const peticiones = vi.mocked(supabase.from).mock.calls.length;

    ana.doc.getText("t").insert(0, "propio");
    await esperar();

    expect(vi.mocked(supabase.from).mock.calls.length).toBe(peticiones);
  });

  it("al reconectar trae lo que se perdió mientras no había conexión", async () => {
    const ana = persona();
    const luis = persona();
    await conectar(ana);
    await conectar(luis);

    servidor.estado.sinAvisos = true;
    ana.doc.getText("t").insert(0, "sin aviso");
    await esperar();
    expect(luis.texto()).toBe("");

    servidor.estado.sinAvisos = false;
    const canalLuis = servidor.estado.canales.find((c) => c.nombre.endsWith(luis.sync.sesion))!;
    canalLuis.estado!("CHANNEL_ERROR");
    expect(luis.estados.at(-1)).toBe("sin-conexion");
    canalLuis.estado!("SUBSCRIBED");
    await esperar();

    expect(luis.texto()).toBe("sin aviso");
  });

  it("pide aparte un cambio que se guardó tarde con un id menor", async () => {
    const luis = persona();
    await conectar(luis);

    // Dos cambios de otra persona: el 2 llega primero y el 1, después
    const otro = new Y.Doc();
    const cambios: Uint8Array[] = [];
    otro.on("update", (u: Uint8Array) => cambios.push(u));
    otro.getText("t").insert(0, "uno ");
    otro.getText("t").insert(4, "dos");
    servidor.estado.siguienteId = 2;
    servidor.insertar(aBase64(cambios[1]), "otra-sesion");
    await esperar();
    servidor.estado.siguienteId = 1;
    servidor.insertar(aBase64(cambios[0]), "otra-sesion");
    await esperar();

    expect(luis.texto()).toBe("uno dos");
  });

  it("al abrir una nota con muchos cambios sueltos los compacta sin perder nada", async () => {
    const autor = new Y.Doc();
    autor.on("update", (u: Uint8Array) => servidor.insertar(aBase64(u), "antigua"));
    for (let i = 0; i < UMBRAL_COMPACTAR; i++) autor.getText("t").insert(i, "x");

    const ana = persona();
    await conectar(ana);
    await vi.advanceTimersByTimeAsync(0);

    expect(ana.texto()).toBe("x".repeat(UMBRAL_COMPACTAR));
    expect(servidor.estado.llamadasCompactar).toHaveLength(1);
    expect(servidor.estado.llamadasCompactar[0]).toMatchObject({ p_base: 0, p_hasta: UMBRAL_COMPACTAR, p_cuantos: UMBRAL_COMPACTAR });
    expect(servidor.estado.cambios).toHaveLength(0);

    // Quien abre después solo con el estado compactado ve lo mismo
    const luis = persona();
    await conectar(luis, { ...servidor.estado.nota });
    expect(luis.texto()).toBe("x".repeat(UMBRAL_COMPACTAR));
  });

  it("si ya no tiene permiso, deja de intentar guardar y lo avisa", async () => {
    const ana = persona();
    await conectar(ana);
    servidor.estado.errorGuardar = { code: "42501", message: "Solo puedes leer esta nota" };

    ana.doc.getText("t").insert(0, "tarde");
    await esperar();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(ana.estados.at(-1)).toBe("sin-acceso");
    expect(servidor.estado.llamadasGuardar).toHaveLength(1);
    expect(ana.sync.hayPendientes).toBe(true);
  });

  it("si falla la red, reintenta hasta guardar", async () => {
    const ana = persona();
    await conectar(ana);
    servidor.estado.errorGuardar = { code: "", message: "Failed to fetch" };

    ana.doc.getText("t").insert(0, "reintento");
    await esperar();
    expect(ana.estados.at(-1)).toBe("error");

    servidor.estado.errorGuardar = null;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ana.estados.at(-1)).toBe("guardado");
    expect(servidor.estado.cambios).toHaveLength(1);
  });

  it("los cursores de cada persona llegan a las demás y se quitan al salir", async () => {
    const ana = persona();
    const luis = persona();
    await conectar(ana);
    await conectar(luis);

    ana.awareness.setLocalStateField("user", { id: "e-ana", name: "Ana" });
    await esperar();
    const deAna = () => [...luis.awareness.getStates().values()].some((e) => e.user?.id === "e-ana");
    expect(deAna()).toBe(true);

    await ana.sync.destruir();
    expect(deAna()).toBe(false);
  });
});
