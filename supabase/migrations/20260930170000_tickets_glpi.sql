-- Tickets al estilo GLPI: tipo, estados y prioridades nuevos, historial de
-- respuestas y soluciones, plantillas de solución y flujo de aprobación.
-- Tecnología (permiso "tickets.gestionar") ve y gestiona todos los tickets.

-- Estados y prioridades nuevos ----------------------------------------------
-- Se pasan de enum a texto validado: un enum no admite valores nuevos y usarlos
-- en la misma ejecución del SQL Editor

ALTER TABLE public.tickets ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN estado TYPE VARCHAR(20) USING (
  CASE estado::text
    WHEN 'abierto' THEN 'nuevo'
    WHEN 'en_progreso' THEN 'en_curso'
    ELSE estado::text
  END
);
ALTER TABLE public.tickets ALTER COLUMN estado SET DEFAULT 'nuevo';
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_estado_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_estado_check
  CHECK (estado IN ('nuevo', 'en_curso', 'en_espera', 'resuelto', 'cerrado'));

ALTER TABLE public.tickets ALTER COLUMN prioridad DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN prioridad TYPE VARCHAR(20) USING (
  CASE prioridad::text WHEN 'urgente' THEN 'primordial' ELSE prioridad::text END
);
ALTER TABLE public.tickets ALTER COLUMN prioridad SET DEFAULT 'media';
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_prioridad_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_prioridad_check
  CHECK (prioridad IN ('primordial', 'alta', 'media', 'baja'));

DROP TYPE IF EXISTS public.ticket_estado;
DROP TYPE IF EXISTS public.ticket_prioridad;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'incidencia'
    CHECK (tipo IN ('incidencia', 'peticion')),
  ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP WITH TIME ZONE;

-- Historial del ticket ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_seguimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  -- respuesta: mensaje; solucion: propuesta de solución; evento: cambio registrado
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('respuesta', 'solucion', 'evento')),
  contenido TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_seguimientos_ticket
  ON public.ticket_seguimientos(ticket_id, created_at);

-- Plantillas de solución (se gestionan desde el panel de Supabase)
CREATE TABLE IF NOT EXISTS public.plantillas_solucion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  contenido TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.plantillas_solucion (nombre, contenido, orden) VALUES
  ('Solicitud resuelta', E'Buenos días,\n\nSu solicitud ha sido resuelta.\n\nSi tiene alguna otra pregunta o inquietud, por favor responda a este mensaje.\n\nAtentamente,', 1),
  ('Incidencia solucionada', E'Buenos días,\n\nHemos solucionado la incidencia que nos comunicó. Por favor, compruebe que todo funciona correctamente.\n\nSi el problema persiste, responda a este mensaje y lo revisaremos.\n\nAtentamente,', 2),
  ('Petición completada', E'Buenos días,\n\nHemos completado su petición.\n\nSi necesita algo más, no dude en abrir un nuevo ticket.\n\nAtentamente,', 3),
  ('Cierre por falta de respuesta', E'Buenos días,\n\nAl no haber recibido respuesta, damos por resuelta su solicitud.\n\nSi todavía necesita ayuda, responda a este mensaje y la reabriremos.\n\nAtentamente,', 4)
ON CONFLICT (nombre) DO NOTHING;

-- Permisos ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Autor y asignado ven el ticket" ON public.tickets;
DROP POLICY IF EXISTS "Empleados abren tickets propios" ON public.tickets;
DROP POLICY IF EXISTS "Autor y asignado actualizan el ticket" ON public.tickets;
DROP POLICY IF EXISTS "El autor borra el ticket" ON public.tickets;

DROP POLICY IF EXISTS "Ven el ticket autor, asignado y soporte" ON public.tickets;
CREATE POLICY "Ven el ticket autor, asignado y soporte"
ON public.tickets FOR SELECT TO authenticated
USING (
  autor_id = public.mi_empleado_id()
  OR asignado_a_id = public.mi_empleado_id()
  OR public.tengo_permiso('tickets.gestionar')
);

DROP POLICY IF EXISTS "Empleados abren tickets nuevos" ON public.tickets;
CREATE POLICY "Empleados abren tickets nuevos"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id() AND estado = 'nuevo' AND asignado_a_id IS NULL);

DROP POLICY IF EXISTS "Soporte borra tickets" ON public.tickets;
CREATE POLICY "Soporte borra tickets"
ON public.tickets FOR DELETE TO authenticated
USING (public.tengo_permiso('tickets.gestionar'));

-- Los cambios pasan por las funciones de abajo, que aplican el flujo
REVOKE UPDATE ON public.tickets FROM anon, authenticated;

ALTER TABLE public.ticket_seguimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_solucion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Historial visible si el ticket es visible" ON public.ticket_seguimientos;
CREATE POLICY "Historial visible si el ticket es visible"
ON public.ticket_seguimientos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_seguimientos.ticket_id));

DROP POLICY IF EXISTS "Plantillas visibles para usuarios autenticados" ON public.plantillas_solucion;
CREATE POLICY "Plantillas visibles para usuarios autenticados"
ON public.plantillas_solucion FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.ticket_seguimientos;
CREATE POLICY "Exige doble factor si está activado"
ON public.ticket_seguimientos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.plantillas_solucion;
CREATE POLICY "Exige doble factor si está activado"
ON public.plantillas_solucion AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Funciones del flujo -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.etiqueta_ticket(valor TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE valor
    WHEN 'nuevo' THEN 'Nuevo'
    WHEN 'en_curso' THEN 'En curso (asignada)'
    WHEN 'en_espera' THEN 'En espera'
    WHEN 'resuelto' THEN 'Resuelto'
    WHEN 'cerrado' THEN 'Cerrado'
    WHEN 'primordial' THEN 'Primordial'
    WHEN 'alta' THEN 'Alta'
    WHEN 'media' THEN 'Media'
    WHEN 'baja' THEN 'Baja'
    WHEN 'incidencia' THEN 'Incidencia'
    WHEN 'peticion' THEN 'Petición'
    ELSE valor
  END;
$$;

-- Carga el ticket bloqueado y comprueba que el usuario participa en él
CREATE OR REPLACE FUNCTION public.ticket_para_accion(p_ticket UUID)
RETURNS public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE;
  yo UUID := public.mi_empleado_id();
BEGIN
  IF NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Verifica el doble factor para continuar' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = p_ticket FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El ticket no existe' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (t.autor_id = yo OR t.asignado_a_id = yo OR public.tengo_permiso('tickets.gestionar')) THEN
    RAISE EXCEPTION 'No tienes acceso a este ticket' USING ERRCODE = '42501';
  END IF;

  RETURN t;
END;
$$;

-- Responder: cualquiera que participe. Si responde el solicitante con el
-- ticket en espera o resuelto, vuelve a "en curso" (como en GLPI)
CREATE OR REPLACE FUNCTION public.responder_ticket(p_ticket UUID, p_contenido TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE := public.ticket_para_accion(p_ticket);
  yo UUID := public.mi_empleado_id();
  nuevo_estado TEXT := t.estado;
BEGIN
  IF coalesce(trim(p_contenido), '') = '' THEN
    RAISE EXCEPTION 'Escribe una respuesta' USING ERRCODE = '22023';
  END IF;
  IF t.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El ticket está cerrado' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
  VALUES (p_ticket, yo, 'respuesta', trim(p_contenido));

  IF t.autor_id = yo AND t.estado IN ('en_espera', 'resuelto') THEN
    nuevo_estado := CASE WHEN t.asignado_a_id IS NULL THEN 'nuevo' ELSE 'en_curso' END;
    UPDATE public.tickets SET estado = nuevo_estado, fecha_resolucion = NULL WHERE id = p_ticket;
    INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
    VALUES (p_ticket, yo, 'evento',
      'Estado: ' || public.etiqueta_ticket(t.estado) || ' → ' || public.etiqueta_ticket(nuevo_estado));
  END IF;
END;
$$;

-- Añadir una solución: soporte o técnico asignado. El ticket pasa a resuelto
CREATE OR REPLACE FUNCTION public.solucionar_ticket(p_ticket UUID, p_contenido TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE := public.ticket_para_accion(p_ticket);
  yo UUID := public.mi_empleado_id();
BEGIN
  IF NOT (public.tengo_permiso('tickets.gestionar') OR t.asignado_a_id = yo) THEN
    RAISE EXCEPTION 'Solo el técnico puede añadir una solución' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_contenido), '') = '' THEN
    RAISE EXCEPTION 'Escribe la solución' USING ERRCODE = '22023';
  END IF;
  IF t.estado IN ('resuelto', 'cerrado') THEN
    RAISE EXCEPTION 'El ticket ya está resuelto' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
  VALUES (p_ticket, yo, 'solucion', trim(p_contenido));

  UPDATE public.tickets
  SET estado = 'resuelto',
      fecha_resolucion = now(),
      -- Quien resuelve un ticket sin asignar se lo queda
      asignado_a_id = coalesce(asignado_a_id, yo)
  WHERE id = p_ticket;

  INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
  VALUES (p_ticket, yo, 'evento', 'Estado: ' || public.etiqueta_ticket(t.estado) || ' → Resuelto');
END;
$$;

-- El solicitante aprueba (cierra) o rechaza (reabre) la solución
CREATE OR REPLACE FUNCTION public.valorar_solucion(p_ticket UUID, p_aprobar BOOLEAN, p_comentario TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE := public.ticket_para_accion(p_ticket);
  yo UUID := public.mi_empleado_id();
BEGIN
  IF t.autor_id <> yo THEN
    RAISE EXCEPTION 'Solo el solicitante puede valorar la solución' USING ERRCODE = '42501';
  END IF;
  IF t.estado <> 'resuelto' THEN
    RAISE EXCEPTION 'El ticket no tiene una solución pendiente de valorar' USING ERRCODE = '55000';
  END IF;

  IF p_aprobar THEN
    UPDATE public.tickets SET estado = 'cerrado', fecha_cierre = now() WHERE id = p_ticket;
    INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
    VALUES (p_ticket, yo, 'evento', 'Solución aprobada. Estado: Resuelto → Cerrado');
  ELSE
    IF coalesce(trim(p_comentario), '') = '' THEN
      RAISE EXCEPTION 'Explica por qué rechazas la solución' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
    VALUES (p_ticket, yo, 'respuesta', trim(p_comentario));
    UPDATE public.tickets SET estado = 'en_curso', fecha_resolucion = NULL WHERE id = p_ticket;
    INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
    VALUES (p_ticket, yo, 'evento', 'Solución rechazada. Estado: Resuelto → En curso (asignada)');
  END IF;
END;
$$;

-- Soporte cambia tipo, prioridad, estado o técnico asignado
CREATE OR REPLACE FUNCTION public.actualizar_ticket(
  p_ticket UUID,
  p_tipo TEXT,
  p_prioridad TEXT,
  p_estado TEXT,
  p_asignado UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE := public.ticket_para_accion(p_ticket);
  yo UUID := public.mi_empleado_id();
  estado_final TEXT := coalesce(p_estado, t.estado);
  cambios TEXT[] := '{}';
BEGIN
  IF NOT public.tengo_permiso('tickets.gestionar') THEN
    RAISE EXCEPTION 'Solo el equipo de soporte puede modificar el ticket' USING ERRCODE = '42501';
  END IF;

  IF p_asignado IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = p_asignado AND activo) THEN
    RAISE EXCEPTION 'El técnico no existe o está de baja' USING ERRCODE = '22023';
  END IF;

  IF estado_final = 'resuelto' AND t.estado <> 'resuelto' THEN
    RAISE EXCEPTION 'Para resolver el ticket, añade una solución' USING ERRCODE = '22023';
  END IF;

  -- Al asignar un ticket nuevo pasa a "en curso (asignada)"; sin técnico no puede estar en curso
  IF p_asignado IS NOT NULL AND t.asignado_a_id IS NULL AND estado_final = 'nuevo' THEN
    estado_final := 'en_curso';
  ELSIF p_asignado IS NULL AND estado_final = 'en_curso' THEN
    estado_final := 'nuevo';
  END IF;

  IF p_tipo IS DISTINCT FROM t.tipo THEN
    cambios := cambios || ('Tipo: ' || public.etiqueta_ticket(t.tipo) || ' → ' || public.etiqueta_ticket(p_tipo));
  END IF;
  IF p_prioridad IS DISTINCT FROM t.prioridad THEN
    cambios := cambios || ('Prioridad: ' || public.etiqueta_ticket(t.prioridad) || ' → ' || public.etiqueta_ticket(p_prioridad));
  END IF;
  IF p_asignado IS DISTINCT FROM t.asignado_a_id THEN
    cambios := cambios || ('Asignado a: ' ||
      coalesce((SELECT concat_ws(' ', nombre, primer_apellido) FROM public.empleados WHERE id = p_asignado), 'nadie'));
  END IF;
  IF estado_final IS DISTINCT FROM t.estado THEN
    cambios := cambios || ('Estado: ' || public.etiqueta_ticket(t.estado) || ' → ' || public.etiqueta_ticket(estado_final));
  END IF;

  IF array_length(cambios, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.tickets SET
    tipo = p_tipo,
    prioridad = p_prioridad,
    asignado_a_id = p_asignado,
    estado = estado_final,
    fecha_cierre = CASE WHEN estado_final = 'cerrado' THEN coalesce(t.fecha_cierre, now()) ELSE NULL END,
    fecha_resolucion = CASE WHEN estado_final IN ('resuelto', 'cerrado') THEN t.fecha_resolucion ELSE NULL END
  WHERE id = p_ticket;

  INSERT INTO public.ticket_seguimientos (ticket_id, autor_id, tipo, contenido)
  VALUES (p_ticket, yo, 'evento', array_to_string(cambios, E'\n'));
END;
$$;

-- Técnicos a los que se puede asignar un ticket
CREATE OR REPLACE FUNCTION public.tecnicos_tickets()
RETURNS TABLE (id UUID, nombre TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, concat_ws(' ', e.nombre, e.primer_apellido)
  FROM public.empleados e
  WHERE e.activo
    AND public.tengo_permiso('tickets.gestionar')
    AND (
      e.es_admin
      OR EXISTS (
        SELECT 1 FROM public.departamento_permisos dp
        WHERE dp.departamento_id = e.departamento_id AND dp.permiso = 'tickets.gestionar'
      )
    )
  ORDER BY 2;
$$;

-- Nombres de solicitantes, técnicos y autores de los tickets visibles
CREATE OR REPLACE FUNCTION public.personas_tickets()
RETURNS TABLE (id UUID, nombre TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT e.id, concat_ws(' ', e.nombre, e.primer_apellido)
  FROM public.empleados e
  WHERE e.id IN (
    SELECT t.autor_id FROM public.tickets t
    WHERE t.autor_id = public.mi_empleado_id() OR t.asignado_a_id = public.mi_empleado_id() OR public.tengo_permiso('tickets.gestionar')
    UNION
    SELECT t.asignado_a_id FROM public.tickets t
    WHERE t.autor_id = public.mi_empleado_id() OR t.asignado_a_id = public.mi_empleado_id() OR public.tengo_permiso('tickets.gestionar')
    UNION
    SELECT s.autor_id FROM public.ticket_seguimientos s JOIN public.tickets t ON t.id = s.ticket_id
    WHERE t.autor_id = public.mi_empleado_id() OR t.asignado_a_id = public.mi_empleado_id() OR public.tengo_permiso('tickets.gestionar')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.ticket_para_accion(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.responder_ticket(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.solucionar_ticket(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.valorar_solucion(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_ticket(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tecnicos_tickets() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.personas_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_ticket(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solucionar_ticket(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valorar_solucion(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_ticket(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tecnicos_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personas_tickets() TO authenticated;

-- El historial se actualiza en tiempo real
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_seguimientos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_seguimientos;
  END IF;
END $$;
