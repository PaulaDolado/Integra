export const TIPOS_AUSENCIA = [
  { value: "vacaciones", label: "Vacaciones" },
  { value: "compensacion_dias_trabajados", label: "Compensación de días trabajados" },
  { value: "asunto_familiar", label: "Asunto familiar" },
  { value: "asunto_personal", label: "Asunto personal" },
  { value: "permisos", label: "Permisos" },
  { value: "teletrabajo", label: "Teletrabajo" },
  { value: "visita_medica", label: "Visita médica" },
  { value: "cuidado_hijos", label: "Cuidado de hijos" },
];

// Razones específicas por tipo de ausencia; se irán añadiendo para el resto de tipos
export const RAZONES_ESPECIFICAS: Record<string, { value: string; label: string }[]> = {
  compensacion_dias_trabajados: [
    { value: "descanso_horas_extras", label: "Descanso por horas extras" },
    { value: "descanso_festivo_trabajado", label: "Descanso por festivo trabajado" },
  ],
};

export const getTipoLabel = (value: string) =>
  TIPOS_AUSENCIA.find((t) => t.value === value)?.label ?? value;

export const getRazonLabel = (tipo: string, value: string) =>
  RAZONES_ESPECIFICAS[tipo]?.find((r) => r.value === value)?.label ?? value;

// Días naturales entre dos fechas, ambas incluidas
export const calcularDias = (inicio: string, fin: string) => {
  const diff = Math.abs(new Date(fin).getTime() - new Date(inicio).getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};
