-- Bandeja de ausencias: los departamentos con el permiso "ausencias.aprobar"
-- (RRHH y Dirección General) revisan las solicitudes de todos los empleados.

-- Registro de la revisión
ALTER TABLE public.solicitudes_vacacion
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS comentario_revision TEXT;

-- Los revisores leen todas las solicitudes (también para recibirlas en tiempo real)
DROP POLICY IF EXISTS "Revisores de ausencias ven todas las solicitudes" ON public.solicitudes_vacacion;
CREATE POLICY "Revisores de ausencias ven todas las solicitudes"
ON public.solicitudes_vacacion FOR SELECT TO authenticated
USING (public.tengo_permiso('ausencias.aprobar'));

-- Los revisores pueden abrir los justificantes de cualquier solicitud
DROP POLICY IF EXISTS "Revisores de ausencias ven los justificantes" ON storage.objects;
CREATE POLICY "Revisores de ausencias ven los justificantes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'justificantes' AND public.tengo_permiso('ausencias.aprobar'));

-- Solicitudes de todos los empleados, con su nombre y departamento.
-- Devuelve vacío si el usuario no tiene el permiso.
CREATE OR REPLACE FUNCTION public.bandeja_ausencias()
RETURNS TABLE (
  id UUID,
  empleado_id UUID,
  empleado_nombre TEXT,
  departamento VARCHAR,
  tipo_ausencia VARCHAR,
  razon_especifica VARCHAR,
  fecha_inicio DATE,
  fecha_fin DATE,
  motivo TEXT,
  justificante_path TEXT,
  estado public.vacacion_estado,
  created_at TIMESTAMP WITH TIME ZONE,
  revisado_por_nombre TEXT,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  comentario_revision TEXT,
  es_mia BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id,
    s.empleado_id,
    concat_ws(' ', e.nombre, e.primer_apellido, e.segundo_apellido),
    d.nombre,
    s.tipo_ausencia,
    s.razon_especifica,
    s.fecha_inicio,
    s.fecha_fin,
    s.motivo,
    s.justificante_path,
    s.estado,
    s.created_at,
    concat_ws(' ', r.nombre, r.primer_apellido),
    s.fecha_revision,
    s.comentario_revision,
    s.empleado_id = public.mi_empleado_id()
  FROM public.solicitudes_vacacion s
  JOIN public.empleados e ON e.id = s.empleado_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  LEFT JOIN public.empleados r ON r.id = s.revisado_por
  WHERE public.tengo_permiso('ausencias.aprobar')
    AND public.cumple_doble_factor()
  ORDER BY (s.estado = 'pendiente') DESC, s.fecha_inicio ASC, s.created_at ASC;
$$;

-- Aprueba o rechaza una solicitud pendiente. Nadie revisa las suyas.
CREATE OR REPLACE FUNCTION public.revisar_ausencia(
  solicitud_id UUID,
  decision public.vacacion_estado,
  comentario TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  revisor UUID := public.mi_empleado_id();
  solicitante UUID;
  estado_actual public.vacacion_estado;
BEGIN
  IF NOT public.tengo_permiso('ausencias.aprobar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para revisar ausencias' USING ERRCODE = '42501';
  END IF;

  IF decision NOT IN ('aprobada', 'rechazada') THEN
    RAISE EXCEPTION 'La decisión debe ser aprobada o rechazada' USING ERRCODE = '22023';
  END IF;

  SELECT empleado_id, estado INTO solicitante, estado_actual
  FROM public.solicitudes_vacacion
  WHERE id = solicitud_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe' USING ERRCODE = 'P0002';
  END IF;

  IF solicitante = revisor THEN
    RAISE EXCEPTION 'No puedes revisar tus propias solicitudes' USING ERRCODE = '42501';
  END IF;

  IF estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya ha sido revisada' USING ERRCODE = '55000';
  END IF;

  UPDATE public.solicitudes_vacacion
  SET estado = decision,
      revisado_por = revisor,
      fecha_revision = now(),
      comentario_revision = nullif(trim(comentario), '')
  WHERE id = solicitud_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bandeja_ausencias() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revisar_ausencia(UUID, public.vacacion_estado, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bandeja_ausencias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_ausencia(UUID, public.vacacion_estado, TEXT) TO authenticated;

-- La bandeja y el historial del empleado se actualizan en tiempo real
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'solicitudes_vacacion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_vacacion;
  END IF;
END $$;

ALTER TABLE public.solicitudes_vacacion REPLICA IDENTITY FULL;
