-- Avisos a Teams o Google Chat.
-- Los triggers de ausencias, turnos, tickets y comunicados dejan cada aviso en
-- la cola public.notificaciones. La Edge Function «notificar» la vacía y hace
-- el POST a los webhooks. Si un webhook falla, el aviso se reintenta hasta 5
-- veces cada 5 minutos con pg_cron.
--
-- Configuración (una sola vez), en el SQL Editor:
--   SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notificar', 'notificaciones_url');
--   SELECT vault.create_secret('<el mismo valor que NOTIFICACIONES_SECRETO>', 'notificaciones_secreto');
-- Mientras no existan esos secretos, los avisos se quedan en la cola sin enviarse.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cola de avisos ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento VARCHAR(40) NOT NULL,
  -- Aviso a un canal (rrhh, tecnologia, general…) o a una persona, nunca ambos
  canal VARCHAR(40),
  destinatario_email TEXT,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  -- Ruta de la app para el botón «Abrir en Integra», p. ej. /tickets/<id>
  ruta TEXT,
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviando', 'enviada', 'error', 'omitida')),
  intentos INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultimo_intento TIMESTAMP WITH TIME ZONE,
  enviada_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT canal_o_persona CHECK ((canal IS NULL) <> (destinatario_email IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_por_enviar
ON public.notificaciones (created_at) WHERE estado IN ('pendiente', 'enviando', 'error');

-- Sin políticas: la plantilla no puede leer ni escribir la cola. Solo los
-- triggers (SECURITY DEFINER) y la Edge Function (service_role) acceden.
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- true si el aviso está pendiente o le toca reintentarse
CREATE OR REPLACE FUNCTION public.notificacion_por_enviar(p_estado TEXT, p_intentos INTEGER, p_ultimo_intento TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT p_estado = 'pendiente'
    OR (p_estado = 'error' AND p_intentos < 5 AND p_ultimo_intento < now() - interval '4 minutes')
    -- La función se cortó a medio envío
    OR (p_estado = 'enviando' AND p_intentos < 5 AND p_ultimo_intento < now() - interval '10 minutes');
$$;

-- Llamada a la Edge Function ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lanzar_envio_notificaciones()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  url TEXT;
  secreto TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE public.notificacion_por_enviar(n.estado, n.intentos, n.ultimo_intento)
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO url FROM vault.decrypted_secrets WHERE name = 'notificaciones_url';
  SELECT decrypted_secret INTO secreto FROM vault.decrypted_secrets WHERE name = 'notificaciones_secreto';
  IF url IS NULL OR secreto IS NULL THEN
    RETURN;
  END IF;

  -- pg_net es asíncrono: no bloquea la transacción que ha creado el aviso
  PERFORM net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integra-secreto', secreto),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_lanzar_envio_notificaciones()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.lanzar_envio_notificaciones();
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- El aviso queda en la cola y lo enviará la tarea de reintentos
  RAISE WARNING 'No se pudo llamar a la función de avisos: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lanzar_envio ON public.notificaciones;
CREATE TRIGGER lanzar_envio
AFTER INSERT ON public.notificaciones
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_lanzar_envio_notificaciones();

-- La Edge Function se queda con un lote de avisos. SKIP LOCKED evita que dos
-- ejecuciones a la vez envíen el mismo aviso dos veces.
CREATE OR REPLACE FUNCTION public.reclamar_notificaciones(p_limite INTEGER DEFAULT 20)
RETURNS SETOF public.notificaciones
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.notificaciones n
  SET estado = 'enviando', intentos = n.intentos + 1, ultimo_intento = now()
  WHERE n.id IN (
    SELECT id FROM public.notificaciones
    WHERE public.notificacion_por_enviar(estado, intentos, ultimo_intento)
    ORDER BY created_at
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  )
  RETURNING n.*;
$$;

-- Encolar avisos ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nombre_empleado(p_empleado UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT concat_ws(' ', nombre, primer_apellido) FROM public.empleados WHERE id = p_empleado),
    'Un empleado'
  );
$$;

CREATE OR REPLACE FUNCTION public.rango_fechas(p_inicio DATE, p_fin DATE)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN p_inicio = p_fin THEN 'el ' || to_char(p_inicio, 'DD/MM/YYYY')
              ELSE 'del ' || to_char(p_inicio, 'DD/MM/YYYY') || ' al ' || to_char(p_fin, 'DD/MM/YYYY') END;
$$;

-- Aviso a un canal (p_canal) o a un empleado (p_destinatario). A una persona no
-- se le avisa de lo que ha hecho ella misma, ni si está de baja en la empresa.
-- Un fallo aquí nunca impide la operación que lo provoca (crear el ticket,
-- aprobar la ausencia…): solo se pierde el aviso y queda en el log.
CREATE OR REPLACE FUNCTION public.encolar_notificacion(
  p_evento TEXT,
  p_canal TEXT,
  p_destinatario UUID,
  p_titulo TEXT,
  p_texto TEXT,
  p_ruta TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  email TEXT;
BEGIN
  IF p_destinatario IS NOT NULL THEN
    IF p_destinatario = public.mi_empleado_id() THEN
      RETURN;
    END IF;
    SELECT correo_electronico INTO email FROM public.empleados WHERE id = p_destinatario AND activo;
    IF email IS NULL THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.notificaciones (evento, canal, destinatario_email, titulo, texto, ruta)
  VALUES (p_evento, CASE WHEN p_destinatario IS NULL THEN p_canal END, email,
          left(p_titulo, 200), left(p_texto, 1000), p_ruta);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo encolar el aviso %: %', p_evento, SQLERRM;
END;
$$;

-- Ausencias. El tipo y el motivo no se envían: pueden ser datos de salud.

CREATE OR REPLACE FUNCTION public.notificar_ausencia()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.estado = 'pendiente' THEN
    PERFORM public.encolar_notificacion(
      'ausencia.solicitada', 'rrhh', NULL,
      'Nueva solicitud de ausencia',
      public.nombre_empleado(NEW.empleado_id) || ' ha pedido una ausencia ' || public.rango_fechas(NEW.fecha_inicio, NEW.fecha_fin) || '.',
      '/bandeja-ausencias');
  ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'pendiente' AND NEW.estado IN ('aprobada', 'rechazada') THEN
    PERFORM public.encolar_notificacion(
      'ausencia.revisada', NULL, NEW.empleado_id,
      CASE WHEN NEW.estado = 'aprobada' THEN 'Ausencia aprobada' ELSE 'Ausencia rechazada' END,
      'Tu ausencia ' || public.rango_fechas(NEW.fecha_inicio, NEW.fecha_fin) || ' ha sido '
        || CASE WHEN NEW.estado = 'aprobada' THEN 'aprobada' ELSE 'rechazada' END || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.comentario_revision), ''), ''),
      '/vacaciones');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notificar ON public.solicitudes_vacacion;
CREATE TRIGGER notificar
AFTER INSERT OR UPDATE OF estado ON public.solicitudes_vacacion
FOR EACH ROW EXECUTE FUNCTION public.notificar_ausencia();

-- Cambios de turno

CREATE OR REPLACE FUNCTION public.notificar_turno()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  anterior TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END;
  fecha TEXT := to_char(NEW.fecha, 'DD/MM/YYYY');
BEGIN
  IF anterior IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NULL;
  END IF;

  IF NEW.estado = 'pendiente_companero' THEN
    PERFORM public.encolar_notificacion(
      'turno.propuesta', NULL, NEW.companero_id,
      'Propuesta de intercambio de turno',
      public.nombre_empleado(NEW.solicitante_id) || ' te propone intercambiar el turno del ' || fecha || '.',
      '/cambio-turno');
  ELSIF NEW.estado = 'pendiente' THEN
    PERFORM public.encolar_notificacion(
      'turno.pendiente', 'rrhh', NULL,
      'Cambio de turno pendiente de aprobación',
      public.nombre_empleado(NEW.solicitante_id) || ' pide un cambio de turno para el ' || fecha || '.',
      '/bandeja-turnos');
  ELSIF NEW.estado = 'rechazada' AND anterior = 'pendiente_companero' THEN
    PERFORM public.encolar_notificacion(
      'turno.revisado', NULL, NEW.solicitante_id,
      'Intercambio de turno rechazado',
      public.nombre_empleado(NEW.companero_id) || ' no ha aceptado intercambiar el turno del ' || fecha || '.',
      '/cambio-turno');
  ELSIF NEW.estado IN ('aprobada', 'rechazada') THEN
    PERFORM public.encolar_notificacion(
      'turno.revisado', NULL, NEW.solicitante_id,
      CASE WHEN NEW.estado = 'aprobada' THEN 'Cambio de turno aprobado' ELSE 'Cambio de turno rechazado' END,
      'Tu cambio de turno del ' || fecha || ' ha sido '
        || CASE WHEN NEW.estado = 'aprobada' THEN 'aprobado' ELSE 'rechazado' END || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.comentario_revision), ''), ''),
      '/cambio-turno');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notificar ON public.solicitudes_turno;
CREATE TRIGGER notificar
AFTER INSERT OR UPDATE OF estado ON public.solicitudes_turno
FOR EACH ROW EXECUTE FUNCTION public.notificar_turno();

-- Tickets

CREATE OR REPLACE FUNCTION public.notificar_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.encolar_notificacion(
      'ticket.nuevo', 'tecnologia', NULL,
      'Nuevo ticket: ' || NEW.titulo,
      public.nombre_empleado(NEW.autor_id) || ' ha abierto '
        || CASE WHEN NEW.tipo = 'incidencia' THEN 'una incidencia' ELSE 'una petición' END
        || ' con prioridad ' || NEW.prioridad || '.',
      '/tickets/' || NEW.id);
    RETURN NULL;
  END IF;

  IF NEW.asignado_a_id IS NOT NULL AND NEW.asignado_a_id IS DISTINCT FROM OLD.asignado_a_id THEN
    PERFORM public.encolar_notificacion(
      'ticket.asignado', NULL, NEW.asignado_a_id,
      'Te han asignado un ticket',
      NEW.titulo || ' (prioridad ' || NEW.prioridad || ')',
      '/tickets/' || NEW.id);
  END IF;

  IF NEW.estado = 'resuelto' AND OLD.estado IS DISTINCT FROM 'resuelto' THEN
    PERFORM public.encolar_notificacion(
      'ticket.resuelto', NULL, NEW.autor_id,
      'Tu ticket tiene una solución',
      NEW.titulo || '. Revisa la solución y valórala en Integra.',
      '/tickets/' || NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notificar ON public.tickets;
CREATE TRIGGER notificar
AFTER INSERT OR UPDATE OF asignado_a_id, estado ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notificar_ticket();

-- Comunicados del tablón

CREATE OR REPLACE FUNCTION public.notificar_comunicado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.encolar_notificacion(
    'comunicado.nuevo', 'general', NULL,
    'Nuevo comunicado de ' || CASE NEW.area WHEN 'rrhh' THEN 'Recursos Humanos' WHEN 'marketing' THEN 'Marketing' ELSE NEW.area END,
    NEW.titulo,
    '/noticias');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notificar ON public.anuncios;
CREATE TRIGGER notificar
AFTER INSERT ON public.anuncios
FOR EACH ROW EXECUTE FUNCTION public.notificar_comunicado();

-- Permisos ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.notificacion_por_enviar(TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lanzar_envio_notificaciones() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_lanzar_envio_notificaciones() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reclamar_notificaciones(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nombre_empleado(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encolar_notificacion(TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_ausencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_turno() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notificar_comunicado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_notificaciones(INTEGER) TO service_role;

-- Tareas programadas -----------------------------------------------------------------

-- Reintentos de los avisos que fallaron (no hace nada si la cola está vacía)
SELECT cron.schedule('notificaciones-reintentos', '*/5 * * * *', 'SELECT public.lanzar_envio_notificaciones()');

-- Los avisos ya enviados se borran a los 90 días
SELECT cron.schedule(
  'notificaciones-limpieza', '30 3 * * *',
  $$DELETE FROM public.notificaciones WHERE estado IN ('enviada', 'omitida') AND created_at < now() - interval '90 days'$$
);
