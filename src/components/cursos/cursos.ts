import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

export type Curso = Database["public"]["Tables"]["cursos"]["Row"];
export type Inscripcion = Database["public"]["Tables"]["inscripciones_curso"]["Row"];
export type Modalidad = "presencial" | "online";
export type EstadoInscripcion = "pendiente" | "aprobada" | "rechazada" | "cancelada";

export const MODALIDADES: Record<Modalidad, string> = {
  presencial: "Presencial",
  online: "Online",
};

export const ESTADOS_INSCRIPCION: Record<EstadoInscripcion, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

// En qué punto está un curso para quien quiere apuntarse
export type FaseCurso = "abierto" | "plazo_cerrado" | "en_curso" | "terminado" | "cancelado";

// Las fechas del curso son días (AAAA-MM-DD); `hoy` también, para comparar sin horas
export function faseCurso(
  curso: Pick<Curso, "fecha_inicio" | "fecha_fin" | "plazo_inscripcion" | "cancelado">,
  hoy: string
): FaseCurso {
  if (curso.cancelado) return "cancelado";
  if (hoy > curso.fecha_fin) return "terminado";
  if (hoy >= curso.fecha_inicio) return "en_curso";
  if (curso.plazo_inscripcion && hoy > curso.plazo_inscripcion) return "plazo_cerrado";
  return "abierto";
}

export const FASES: Record<FaseCurso, string> = {
  abierto: "Inscripción abierta",
  plazo_cerrado: "Plazo cerrado",
  en_curso: "En curso",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

// Solicitudes que todavía cuentan (las rechazadas y canceladas no ocupan nada)
export const inscripcionActiva = (estado: string | null | undefined) => estado === "pendiente" || estado === "aprobada";

// Se puede pedir plaza si el curso está abierto y no hay ya una solicitud activa
export const puedeSolicitar = (fase: FaseCurso, estado: string | null | undefined) =>
  fase === "abierto" && (!estado || estado === "cancelada");

// Se puede cancelar la propia solicitud hasta que empieza el curso
export const puedeCancelar = (fase: FaseCurso, estado: string | null | undefined) =>
  (fase === "abierto" || fase === "plazo_cerrado") && inscripcionActiva(estado);

// parseISO lee las fechas sin hora en hora local; new Date() las leería en UTC
const dia = (fecha: string) => format(parseISO(fecha), "d MMM yyyy", { locale: es });

export const formatFechas = (inicio: string, fin: string) => (inicio === fin ? dia(inicio) : `${dia(inicio)} – ${dia(fin)}`);

export const formatFecha = dia;

export const formatHoras = (horas: number | null) =>
  horas == null ? null : `${horas.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;

export const hoyIso = () => format(new Date(), "yyyy-MM-dd");

// Solo enlaces web: evita javascript: y similares en el href
export const esEnlaceValido = (enlace: string) => {
  try {
    return ["http:", "https:"].includes(new URL(enlace).protocol);
  } catch {
    return false;
  }
};

// Formulario de alta y edición (campos de texto tal cual los escribe el usuario)
export interface FormCurso {
  titulo: string;
  descripcion: string;
  modalidad: Modalidad;
  lugar: string;
  enlace: string;
  fecha_inicio: string;
  fecha_fin: string;
  horas: string;
  certificado: boolean;
  plazo_inscripcion: string;
}

// Las horas admiten coma decimal: «7,5»
export const leerHoras = (horas: string) => (horas.trim() ? Number(horas.trim().replace(",", ".")) : null);

// Primer problema del formulario, o null si se puede guardar. Repite las
// comprobaciones de la base de datos para avisar antes de enviar.
export function validarCurso(form: FormCurso): string | null {
  if (!form.titulo.trim()) return "El título es obligatorio";
  if (!form.fecha_inicio || !form.fecha_fin) return "Indica las fechas del curso";
  if (form.fecha_fin < form.fecha_inicio) return "La fecha de fin no puede ser anterior a la de inicio";
  if (form.plazo_inscripcion && form.plazo_inscripcion >= form.fecha_inicio) {
    return "El plazo de inscripción tiene que terminar antes de que empiece el curso";
  }
  const horas = leerHoras(form.horas);
  if (horas !== null && !(horas > 0)) return "Las horas tienen que ser un número mayor que 0";
  if (form.modalidad === "online" && form.enlace.trim() && !esEnlaceValido(form.enlace.trim())) {
    return "El enlace tiene que empezar por https://";
  }
  return null;
}
