import { format, isToday } from "date-fns";

export interface Fichaje {
  id: string;
  empleado_id: string;
  tipo: string;
  fecha_hora: string;
}

export interface Tramo {
  entrada: Date | null;
  salida: Date | null;
  // Minutos del tramo; null si le falta la entrada o la salida
  minutos: number | null;
  enCurso: boolean;
}

export interface Dia {
  fecha: string; // yyyy-MM-dd
  tramos: Tramo[];
  minutos: number;
  incidencias: number;
}

export interface ResumenEmpleado {
  dias: Dia[];
  minutos: number;
  diasTrabajados: number;
  incidencias: number;
  // Hora de entrada si ahora mismo está trabajando
  trabajandoDesde: Date | null;
  ultimoFichaje: Date | null;
}

const minutosEntre = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));

// Empareja cada entrada con la siguiente salida del mismo día. Una entrada sin
// salida o una salida sin entrada cuentan como incidencia, salvo la entrada de
// hoy que sigue abierta (el empleado está trabajando).
export function resumirFichajes(fichajes: Fichaje[]): ResumenEmpleado {
  const ordenados = [...fichajes].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
  const porDia = new Map<string, Tramo[]>();
  const añadir = (fecha: Date, tramo: Tramo) => {
    const clave = format(fecha, "yyyy-MM-dd");
    porDia.set(clave, [...(porDia.get(clave) ?? []), tramo]);
  };

  let abierta: Date | null = null;
  for (const f of ordenados) {
    const momento = new Date(f.fecha_hora);
    const mismoDia = abierta && format(abierta, "yyyy-MM-dd") === format(momento, "yyyy-MM-dd");

    if (f.tipo === "entrada") {
      if (abierta) añadir(abierta, { entrada: abierta, salida: null, minutos: null, enCurso: false });
      abierta = momento;
    } else if (abierta && mismoDia) {
      añadir(abierta, { entrada: abierta, salida: momento, minutos: minutosEntre(abierta, momento), enCurso: false });
      abierta = null;
    } else {
      if (abierta) añadir(abierta, { entrada: abierta, salida: null, minutos: null, enCurso: false });
      añadir(momento, { entrada: null, salida: momento, minutos: null, enCurso: false });
      abierta = null;
    }
  }

  let trabajandoDesde: Date | null = null;
  if (abierta) {
    const enCurso = isToday(abierta);
    if (enCurso) trabajandoDesde = abierta;
    añadir(abierta, { entrada: abierta, salida: null, minutos: null, enCurso });
  }

  const dias: Dia[] = [...porDia.entries()]
    .map(([fecha, tramos]) => ({
      fecha,
      tramos,
      minutos: tramos.reduce((total, t) => total + (t.minutos ?? 0), 0),
      incidencias: tramos.filter((t) => t.minutos === null && !t.enCurso).length,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    dias,
    minutos: dias.reduce((total, d) => total + d.minutos, 0),
    diasTrabajados: dias.filter((d) => d.tramos.some((t) => t.entrada)).length,
    incidencias: dias.reduce((total, d) => total + d.incidencias, 0),
    trabajandoDesde,
    ultimoFichaje: ordenados.length ? new Date(ordenados[ordenados.length - 1].fecha_hora) : null,
  };
}

export const formatHoras = (minutos: number) => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h} h ${m.toString().padStart(2, "0")} min`;
};

// CSV para Excel en español: separador ";" y BOM para que respete las tildes
export function descargarCsv(nombreArchivo: string, filas: (string | number)[][]) {
  const escapar = (valor: string | number) => {
    const texto = String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = "﻿" + filas.map((fila) => fila.map(escapar).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
