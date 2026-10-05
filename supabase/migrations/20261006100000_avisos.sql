-- Avisos dentro de la app (la campana de la cabecera).
-- Unos triggers crean un aviso para cada persona afectada cuando revisan su
-- ausencia o su cambio de turno, cuando le responden en un ticket o cuando se
-- publica un comunicado. Llegan al momento por Realtime.
-- Es independiente de la cola de Teams y Google Chat (public.notificaciones):
-- aquellos triggers siguen igual y estos se añaden a su lado.
-- Necesita las funciones nombre_empleado() y rango_fechas() de la migración
-- 20261002120000_notificaciones_chat.sql.

-- Tabla ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  -- De qué módulo viene (decide el icono en la app)
  tipo VARCHAR(20) NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL DEFAULT '',
  -- Ruta de la app a la que lleva el aviso, p. ej. /tickets/<id>
  enlace TEXT,
  leido_en TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos DROP CONSTRAINT IF EXISTS avisos_tipo_check;
ALTER TABLE public.avisos ADD CONSTRAINT avisos_tipo_check
  CHECK (tipo IN ('ausencia', 'turno', 'ticket', 'comunicado'));

-- Solo rutas internas: el enlace nunca saca de la app
ALTER TABLE public.avisos DROP CONSTRAINT IF EXISTS avisos_enlace_check;
ALTER TABLE public.avisos ADD CONSTRAINT avisos_enlace_check
  CHECK (enlace IS NULL OR (enlace LIKE '/%' AND enlace NOT LIKE '//%'));

-- La campana pide los últimos avisos de una persona y cuántos no ha leído
CREATE INDEX IF NOT EXISTS idx_avisos_empleado
  ON public.avisos (empleado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avisos_sin_leer
  ON public.avisos (empleado_id) WHERE leido_en IS NULL;

-- Permisos ---------------------------------------------------------------------------
-- Cada empleado ve sus avisos y solo puede marcarlos como leídos. Nadie los crea
-- ni los borra desde la app: los crean los triggers (SECURITY DEFINER).

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.avisos FROM anon, authenticated;
GRANT SELECT ON public.avisos TO authenticated;
GRANT UPDATE (leido_en) ON public.avisos TO authenticated;

DROP POLICY IF EXISTS "Empleados ven sus avisos" ON public.avisos;
CREATE POLICY "Empleados ven sus avisos"
ON public.avisos FOR SELECT TO authenticated
USING (empleado_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Empleados marcan sus avisos como leídos" ON public.avisos;
CREATE POLICY "Empleados marcan sus avisos como leídos"
ON public.avisos FOR UPDATE TO authenticated
USING (empleado_id = public.mi_empleado_id())
WITH CHECK (empleado_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.avisos;
CREATE POLICY "Exige doble factor si está activado"
ON public.avisos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Marcar como leídos: unos avisos concretos o, sin ids, todos los míos.
-- Devuelve cuántos ha marcado. Se ejecuta con los permisos del usuario (RLS).
CREATE OR REPLACE FUNCTION public.marcar_avisos_leidos(p_ids UUID[] DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql VOLATILE SET search_path = public
AS $$
  WITH marcados AS (
    UPDATE public.avisos
    SET leido_en = now()
    WHERE empleado_id = public.mi_empleado_id()
      AND leido_en IS NULL
      AND (p_ids IS NULL OR id = ANY (p_ids))
    RETURNING 1
  )
  SELECT count(*)::integer FROM marcados;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_avisos_leidos(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_avisos_leidos(UUID[]) TO authenticated;

-- Crear avisos -----------------------------------------------------------------------

-- Aviso a un empleado. No se avisa a nadie de lo que ha hecho él mismo, ni a
-- quien está de baja. Un fallo aquí nunca impide la operación que lo provoca.
CREATE OR REPLACE FUNCTION public.crear_aviso(
  p_empleado UUID,
  p_tipo TEXT,
  p_titulo TEXT,
  p_cuerpo TEXT,
  p_enlace TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_empleado IS NULL OR p_empleado IS NOT DISTINCT FROM public.mi_empleado_id() THEN
    RETURN;
  END IF;

  INSERT INTO public.avisos (empleado_id, tipo, titulo, cuerpo, enlace)
  SELECT e.id, p_tipo, left(p_titulo, 200), left(coalesce(p_cuerpo, ''), 500), p_enlace
  FROM public.empleados e
  WHERE e.id = p_empleado AND e.activo;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo crear el aviso de %: %', p_tipo, SQLERRM;
END;
$$;

-- Ausencias: a quien la pidió, cuando la aprueban o la rechazan.
-- Como en Teams, sin el tipo ni el motivo.
CREATE OR REPLACE FUNCTION public.avisar_ausencia()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.estado = 'pendiente' AND NEW.estado IN ('aprobada', 'rechazada') THEN
    PERFORM public.crear_aviso(
      NEW.empleado_id, 'ausencia',
      CASE WHEN NEW.estado = 'aprobada' THEN 'Ausencia aprobada' ELSE 'Ausencia rechazada' END,
      'Tu ausencia ' || public.rango_fechas(NEW.fecha_inicio, NEW.fecha_fin) || ' ha sido '
        || CASE WHEN NEW.estado = 'aprobada' THEN 'aprobada' ELSE 'rechazada' END || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.comentario_revision), ''), ''),
      '/vacaciones');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.solicitudes_vacacion;
CREATE TRIGGER avisar
AFTER UPDATE OF estado ON public.solicitudes_vacacion
FOR EACH ROW EXECUTE FUNCTION public.avisar_ausencia();

-- Cambios de turno: al compañero cuando le proponen un intercambio o se cancela;
-- al solicitante cuando el compañero responde; a los dos cuando se revisa.
CREATE OR REPLACE FUNCTION public.avisar_turno()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  anterior TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END;
  fecha TEXT := to_char(NEW.fecha, 'DD/MM/YYYY');
  aprobada BOOLEAN := NEW.estado = 'aprobada';
BEGIN
  IF anterior IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NULL;
  END IF;

  IF NEW.estado = 'pendiente_companero' THEN
    PERFORM public.crear_aviso(
      NEW.companero_id, 'turno',
      'Propuesta de intercambio de turno',
      public.nombre_empleado(NEW.solicitante_id) || ' te propone intercambiar el turno del ' || fecha || '.',
      '/cambio-turno');

  ELSIF anterior = 'pendiente_companero' AND NEW.estado = 'pendiente' THEN
    PERFORM public.crear_aviso(
      NEW.solicitante_id, 'turno',
      'Intercambio de turno aceptado',
      public.nombre_empleado(NEW.companero_id) || ' ha aceptado intercambiar el turno del ' || fecha
        || '. Queda pendiente de aprobación.',
      '/cambio-turno');

  ELSIF anterior = 'pendiente_companero' AND NEW.estado = 'rechazada' THEN
    PERFORM public.crear_aviso(
      NEW.solicitante_id, 'turno',
      'Intercambio de turno rechazado',
      public.nombre_empleado(NEW.companero_id) || ' no ha aceptado intercambiar el turno del ' || fecha || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.respuesta_companero), ''), ''),
      '/cambio-turno');

  ELSIF anterior = 'pendiente' AND NEW.estado IN ('aprobada', 'rechazada') THEN
    PERFORM public.crear_aviso(
      NEW.solicitante_id, 'turno',
      CASE WHEN aprobada THEN 'Cambio de turno aprobado' ELSE 'Cambio de turno rechazado' END,
      'Tu cambio de turno del ' || fecha || ' ha sido '
        || CASE WHEN aprobada THEN 'aprobado' ELSE 'rechazado' END || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.comentario_revision), ''), ''),
      '/cambio-turno');
    PERFORM public.crear_aviso(
      NEW.companero_id, 'turno',
      CASE WHEN aprobada THEN 'Intercambio de turno aprobado' ELSE 'Intercambio de turno rechazado' END,
      'El intercambio de turno con ' || public.nombre_empleado(NEW.solicitante_id) || ' del ' || fecha || ' ha sido '
        || CASE WHEN aprobada THEN 'aprobado' ELSE 'rechazado' END || '.',
      '/cambio-turno');

  ELSIF NEW.estado = 'cancelada' AND anterior IN ('pendiente_companero', 'pendiente') THEN
    PERFORM public.crear_aviso(
      NEW.companero_id, 'turno',
      'Intercambio de turno cancelado',
      public.nombre_empleado(NEW.solicitante_id) || ' ha cancelado el intercambio de turno del ' || fecha || '.',
      '/cambio-turno');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.solicitudes_turno;
CREATE TRIGGER avisar
AFTER INSERT OR UPDATE OF estado ON public.solicitudes_turno
FOR EACH ROW EXECUTE FUNCTION public.avisar_turno();

-- Tickets: respuestas y soluciones. Al solicitante, si escribe otra persona; al
-- técnico asignado, si escribe otra persona (normalmente el solicitante).
CREATE OR REPLACE FUNCTION public.avisar_seguimiento_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t public.tickets%ROWTYPE;
  quien TEXT;
  extracto TEXT;
  es_solucion BOOLEAN := NEW.tipo = 'solucion';
BEGIN
  IF NEW.tipo NOT IN ('respuesta', 'solucion') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  quien := public.nombre_empleado(NEW.autor_id);
  extracto := left(regexp_replace(trim(NEW.contenido), '\s+', ' ', 'g'), 160);

  IF NEW.autor_id IS DISTINCT FROM t.autor_id THEN
    PERFORM public.crear_aviso(
      t.autor_id, 'ticket',
      CASE WHEN es_solucion THEN 'Tu ticket tiene una solución' ELSE 'Nueva respuesta en tu ticket' END,
      t.titulo || ': ' || quien
        || CASE WHEN es_solucion THEN ' ha propuesto una solución. Revísala y valórala.'
                ELSE ' ha respondido «' || extracto || '»' END,
      '/tickets/' || t.id);
  END IF;

  IF t.asignado_a_id IS DISTINCT FROM NEW.autor_id AND t.asignado_a_id IS DISTINCT FROM t.autor_id THEN
    PERFORM public.crear_aviso(
      t.asignado_a_id, 'ticket',
      CASE WHEN es_solucion THEN 'Solución en un ticket asignado' ELSE 'Nueva respuesta en un ticket asignado' END,
      t.titulo || ': ' || quien
        || CASE WHEN es_solucion THEN ' ha añadido una solución.'
                ELSE ' ha respondido «' || extracto || '»' END,
      '/tickets/' || t.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.ticket_seguimientos;
CREATE TRIGGER avisar
AFTER INSERT ON public.ticket_seguimientos
FOR EACH ROW EXECUTE FUNCTION public.avisar_seguimiento_ticket();

-- Tickets: cambios de estado y asignación.
-- El paso a «resuelto» no se avisa aquí: ya lo avisa la solución.
CREATE OR REPLACE FUNCTION public.avisar_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.asignado_a_id IS NOT NULL AND NEW.asignado_a_id IS DISTINCT FROM OLD.asignado_a_id THEN
    PERFORM public.crear_aviso(
      NEW.asignado_a_id, 'ticket',
      'Te han asignado un ticket',
      NEW.titulo || ' (prioridad ' || lower(public.etiqueta_ticket(NEW.prioridad)) || ').',
      '/tickets/' || NEW.id);
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado <> 'resuelto' THEN
    PERFORM public.crear_aviso(
      NEW.autor_id, 'ticket',
      CASE NEW.estado
        WHEN 'en_curso' THEN 'Tu ticket está en curso'
        WHEN 'en_espera' THEN 'Tu ticket está en espera'
        WHEN 'cerrado' THEN 'Tu ticket se ha cerrado'
        ELSE 'Tu ticket ha cambiado de estado'
      END,
      NEW.titulo || ': ' || public.etiqueta_ticket(OLD.estado) || ' → ' || public.etiqueta_ticket(NEW.estado) || '.',
      '/tickets/' || NEW.id);

    -- El solicitante aprueba la solución: se avisa al técnico
    IF OLD.estado = 'resuelto' AND NEW.estado = 'cerrado'
       AND NEW.autor_id IS NOT DISTINCT FROM public.mi_empleado_id() THEN
      PERFORM public.crear_aviso(
        NEW.asignado_a_id, 'ticket',
        'Solución aprobada',
        public.nombre_empleado(NEW.autor_id) || ' ha aprobado la solución de «' || NEW.titulo || '». El ticket queda cerrado.',
        '/tickets/' || NEW.id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.tickets;
CREATE TRIGGER avisar
AFTER UPDATE OF asignado_a_id, estado ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.avisar_ticket();

-- Comunicados: un aviso para cada empleado activo con acceso a la app, salvo
-- quien lo publica. Una fila por persona (unos cientos por comunicado).
CREATE OR REPLACE FUNCTION public.avisar_comunicado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
BEGIN
  INSERT INTO public.avisos (empleado_id, tipo, titulo, cuerpo, enlace)
  SELECT e.id, 'comunicado',
    'Nuevo comunicado de ' || CASE NEW.area WHEN 'rrhh' THEN 'Recursos Humanos' WHEN 'marketing' THEN 'Marketing' ELSE NEW.area END,
    left(NEW.titulo, 500),
    '/noticias'
  FROM public.empleados e
  WHERE e.activo
    AND e.user_id IS NOT NULL
    AND e.id IS DISTINCT FROM NEW.autor_id
    AND e.id IS DISTINCT FROM yo;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudieron crear los avisos del comunicado: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.anuncios;
CREATE TRIGGER avisar
AFTER INSERT ON public.anuncios
FOR EACH ROW EXECUTE FUNCTION public.avisar_comunicado();

-- Limpieza ---------------------------------------------------------------------------

-- Los avisos leídos se borran a los 90 días; los no leídos, al año
CREATE OR REPLACE FUNCTION public.limpiar_avisos()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  borrados INTEGER;
BEGIN
  DELETE FROM public.avisos
  WHERE (leido_en IS NOT NULL AND leido_en < now() - interval '90 days')
     OR created_at < now() - interval '1 year';
  GET DIAGNOSTICS borrados = ROW_COUNT;
  RETURN borrados;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crear_aviso(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_ausencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_turno() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_seguimiento_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_comunicado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.limpiar_avisos() FROM PUBLIC, anon, authenticated;

-- Todas las noches con pg_cron (la activa la migración de Teams y Google Chat).
-- Sin pg_cron no falla: basta con ejecutar SELECT public.limpiar_avisos() a mano.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('avisos-limpieza', '45 3 * * *', 'SELECT public.limpiar_avisos()');
  ELSE
    RAISE NOTICE 'pg_cron no está activado: los avisos antiguos no se borrarán solos';
  END IF;
END $$;

-- Tiempo real ------------------------------------------------------------------------

-- Cada usuario solo recibe sus avisos: Realtime aplica las políticas de arriba
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'avisos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos;
  END IF;
END $$;
