import { Badge } from "@/components/ui/badge";
import { ESTADOS_INSCRIPCION, FASES, type EstadoInscripcion, type FaseCurso } from "./cursos";

const CLASES_ESTADO: Record<EstadoInscripcion, string> = {
  pendiente: "bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900",
  aprobada: "bg-green-50 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  rechazada: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  cancelada: "text-muted-foreground",
};

export function EstadoInscripcionBadge({ estado }: { estado: string }) {
  const conocido = estado in ESTADOS_INSCRIPCION ? (estado as EstadoInscripcion) : null;
  return (
    <Badge variant="outline" className={conocido ? CLASES_ESTADO[conocido] : undefined}>
      {conocido ? ESTADOS_INSCRIPCION[conocido] : estado}
    </Badge>
  );
}

const CLASES_FASE: Record<FaseCurso, string> = {
  abierto: "bg-primary/10 text-primary border-primary/30",
  plazo_cerrado: "text-muted-foreground",
  en_curso: "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  terminado: "text-muted-foreground",
  cancelado: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

export function FaseCursoBadge({ fase }: { fase: FaseCurso }) {
  return (
    <Badge variant="outline" className={CLASES_FASE[fase]}>
      {FASES[fase]}
    </Badge>
  );
}
