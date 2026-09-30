-- Solicitudes de cambio de turno.
-- Flujo: el empleado pide el cambio (opcionalmente intercambiándolo con un
-- compañero, que debe aceptarlo) y RRHH o Dirección lo aprueban o rechazan.

-- Permiso para aprobar --------------------------------------------------------

INSERT INTO public.permisos (codigo, descripcion) VALUES
  ('turnos.aprobar', 'Aprobar o rechazar solicitudes de cambio de turno')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.departamento_permisos (departamento_id, permiso)
SELECT d.id, 'turnos.aprobar'
FROM public.departamentos d
WHERE d.nombre IN ('Recursos Humanos', 'Dirección General')
ON CONFLICT DO NOTHING;

-- Catálogo de turnos (se gestiona desde el panel de Supabase) ------------------

CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.turnos (nombre, hora_inicio, hora_fin, orden) VALUES
  ('Mañana', '06:00', '14:00', 1),
  ('Tarde', '14:00', '22:00', 2),
  ('Noche', '22:00', '06:00', 3),
  ('Partido', '09:00', '18:00', 4)
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Turnos visibles para usuarios autenticados" ON public.turnos;
CREATE POLICY "Turnos visibles para usuarios autenticados"
ON public.turnos FOR SELECT TO authenticated
USING (true);

-- Solicitudes ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.solicitudes_turno (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitante_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  turno_actual_id UUID NOT NULL REFERENCES public.turnos(id),
  turno_solicitado_id UUID NOT NULL REFERENCES public.turnos(id),
  -- Si hay compañero, es un intercambio: él pasa al turno actual del solicitante
  companero_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(25) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente_companero', 'pendiente', 'aprobada', 'rechazada', 'cancelada')),
  respuesta_companero TEXT,
  fecha_respuesta_companero TIMESTAMP WITH TIME ZONE,
  revisado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  comentario_revision TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (turno_actual_id <> turno_solicitado_id),
  CHECK (companero_id IS NULL OR companero_id <> solicitante_id)
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_turno_solicitante ON public.solicitudes_turno(solicitante_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_turno_companero ON public.solicitudes_turno(companero_id);

DROP TRIGGER IF EXISTS update_solicitudes_turno_updated_at ON public.solicitudes_turno;
CREATE TRIGGER update_solicitudes_turno_updated_at
BEFORE UPDATE ON public.solicitudes_turno
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.solicitudes_turno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ven la solicitud el solicitante, el compañero y los revisores" ON public.solicitudes_turno;
CREATE POLICY "Ven la solicitud el solicitante, el compañero y los revisores"
ON public.solicitudes_turno FOR SELECT TO authenticated
USING (
  solicitante_id = public.mi_empleado_id()
  OR companero_id = public.mi_empleado_id()
  OR public.tengo_permiso('turnos.aprobar')
);

-- Todos los cambios pasan por las funciones de abajo
REVOKE INSERT, UPDATE, DELETE ON public.solicitudes_turno FROM anon, authenticated;

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.turnos;
CREATE POLICY "Exige doble factor si está activado"
ON public.turnos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.solicitudes_turno;
CREATE POLICY "Exige doble factor si está activado"
ON public.solicitudes_turno AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Funciones del flujo -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crear_solicitud_turno(
  p_fecha DATE,
  p_turno_actual UUID,
  p_turno_solicitado UUID,
  p_companero UUID,
  p_motivo TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  nueva UUID;
BEGIN
  IF yo IS NULL OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Tu usuario no tiene un perfil de empleado' USING ERRCODE = '42501';
  END IF;
  IF p_fecha < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha del cambio no puede ser anterior a hoy' USING ERRCODE = '22023';
  END IF;
  IF p_turno_actual = p_turno_solicitado THEN
    RAISE EXCEPTION 'El turno solicitado debe ser distinto del actual' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Explica el motivo del cambio' USING ERRCODE = '22023';
  END IF;
  IF p_companero IS NOT NULL THEN
    IF p_companero = yo THEN
      RAISE EXCEPTION 'No puedes intercambiar el turno contigo mismo' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = p_companero AND activo) THEN
      RAISE EXCEPTION 'El compañero no existe o está de baja' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.solicitudes_turno
    WHERE solicitante_id = yo AND fecha = p_fecha AND estado IN ('pendiente_companero', 'pendiente')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente para ese día' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.solicitudes_turno (solicitante_id, fecha, turno_actual_id, turno_solicitado_id, companero_id, motivo, estado)
  VALUES (
    yo, p_fecha, p_turno_actual, p_turno_solicitado, p_companero, trim(p_motivo),
    CASE WHEN p_companero IS NULL THEN 'pendiente' ELSE 'pendiente_companero' END
  )
  RETURNING id INTO nueva;
  RETURN nueva;
END;
$$;

-- El compañero acepta o rechaza el intercambio
CREATE OR REPLACE FUNCTION public.responder_intercambio_turno(p_solicitud UUID, p_aceptar BOOLEAN, p_comentario TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.solicitudes_turno%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.solicitudes_turno WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND OR s.companero_id IS DISTINCT FROM public.mi_empleado_id() OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Esta solicitud no está dirigida a ti' USING ERRCODE = '42501';
  END IF;
  IF s.estado <> 'pendiente_companero' THEN
    RAISE EXCEPTION 'La solicitud ya no espera tu respuesta' USING ERRCODE = '55000';
  END IF;

  UPDATE public.solicitudes_turno SET
    estado = CASE WHEN p_aceptar THEN 'pendiente' ELSE 'rechazada' END,
    respuesta_companero = nullif(trim(p_comentario), ''),
    fecha_respuesta_companero = now()
  WHERE id = p_solicitud;
END;
$$;

-- El solicitante cancela mientras esté pendiente
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_turno(p_solicitud UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.solicitudes_turno%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.solicitudes_turno WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND OR s.solicitante_id IS DISTINCT FROM public.mi_empleado_id() OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Solo el solicitante puede cancelar la solicitud' USING ERRCODE = '42501';
  END IF;
  IF s.estado NOT IN ('pendiente_companero', 'pendiente') THEN
    RAISE EXCEPTION 'La solicitud ya no se puede cancelar' USING ERRCODE = '55000';
  END IF;
  UPDATE public.solicitudes_turno SET estado = 'cancelada' WHERE id = p_solicitud;
END;
$$;

-- RRHH o Dirección aprueban o rechazan. Nadie revisa un cambio en el que participa
CREATE OR REPLACE FUNCTION public.revisar_solicitud_turno(p_solicitud UUID, p_aprobar BOOLEAN, p_comentario TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.solicitudes_turno%ROWTYPE;
  yo UUID := public.mi_empleado_id();
BEGIN
  IF NOT public.tengo_permiso('turnos.aprobar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para revisar cambios de turno' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.solicitudes_turno WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe' USING ERRCODE = 'P0002';
  END IF;
  IF yo IN (s.solicitante_id, s.companero_id) THEN
    RAISE EXCEPTION 'No puedes revisar un cambio de turno en el que participas' USING ERRCODE = '42501';
  END IF;
  IF s.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud no está pendiente de aprobación' USING ERRCODE = '55000';
  END IF;
  IF NOT p_aprobar AND length(trim(coalesce(p_comentario, ''))) = 0 THEN
    RAISE EXCEPTION 'Indica el motivo del rechazo' USING ERRCODE = '22023';
  END IF;

  UPDATE public.solicitudes_turno SET
    estado = CASE WHEN p_aprobar THEN 'aprobada' ELSE 'rechazada' END,
    revisado_por = yo,
    fecha_revision = now(),
    comentario_revision = nullif(trim(p_comentario), '')
  WHERE id = p_solicitud;
END;
$$;

-- Solicitudes visibles con los nombres de las personas y los turnos
CREATE OR REPLACE FUNCTION public.solicitudes_turno_detalle()
RETURNS TABLE (
  id UUID,
  fecha DATE,
  estado VARCHAR,
  motivo TEXT,
  solicitante_id UUID,
  solicitante TEXT,
  departamento VARCHAR,
  companero_id UUID,
  companero TEXT,
  turno_actual TEXT,
  turno_solicitado TEXT,
  respuesta_companero TEXT,
  fecha_respuesta_companero TIMESTAMP WITH TIME ZONE,
  revisor TEXT,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  comentario_revision TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id, s.fecha, s.estado, s.motivo,
    s.solicitante_id, concat_ws(' ', sol.nombre, sol.primer_apellido), d.nombre,
    s.companero_id, concat_ws(' ', com.nombre, com.primer_apellido),
    ta.nombre || ' (' || to_char(ta.hora_inicio, 'HH24:MI') || '–' || to_char(ta.hora_fin, 'HH24:MI') || ')',
    ts.nombre || ' (' || to_char(ts.hora_inicio, 'HH24:MI') || '–' || to_char(ts.hora_fin, 'HH24:MI') || ')',
    s.respuesta_companero, s.fecha_respuesta_companero,
    concat_ws(' ', rev.nombre, rev.primer_apellido), s.fecha_revision, s.comentario_revision,
    s.created_at
  FROM public.solicitudes_turno s
  JOIN public.empleados sol ON sol.id = s.solicitante_id
  LEFT JOIN public.departamentos d ON d.id = sol.departamento_id
  LEFT JOIN public.empleados com ON com.id = s.companero_id
  LEFT JOIN public.empleados rev ON rev.id = s.revisado_por
  JOIN public.turnos ta ON ta.id = s.turno_actual_id
  JOIN public.turnos ts ON ts.id = s.turno_solicitado_id
  WHERE public.cumple_doble_factor()
    AND (
      s.solicitante_id = public.mi_empleado_id()
      OR s.companero_id = public.mi_empleado_id()
      OR public.tengo_permiso('turnos.aprobar')
    )
  ORDER BY (s.estado IN ('pendiente_companero', 'pendiente')) DESC, s.fecha ASC, s.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.crear_solicitud_turno(DATE, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.responder_intercambio_turno(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_solicitud_turno(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revisar_solicitud_turno(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.solicitudes_turno_detalle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_solicitud_turno(DATE, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_intercambio_turno(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitud_turno(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_solicitud_turno(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitudes_turno_detalle() TO authenticated;

-- Tiempo real para el solicitante, el compañero y los revisores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'solicitudes_turno'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_turno;
  END IF;
END $$;

ALTER TABLE public.solicitudes_turno REPLICA IDENTITY FULL;
