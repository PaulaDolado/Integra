-- Suscripción al calendario desde Google Calendar (u otro calendario).
-- Cada empleado tiene un enlace privado con un token secreto. Google pide ese
-- enlace cada pocas horas a la Edge Function «calendario-ics», que devuelve los
-- eventos que la persona ve en Integra en formato iCalendar (.ics).
-- Solo va de Integra a Google: los cambios hechos en Google no vuelven.

CREATE TABLE IF NOT EXISTS public.calendario_enlaces (
  empleado_id UUID NOT NULL PRIMARY KEY REFERENCES public.empleados(id) ON DELETE CASCADE,
  -- 64 caracteres hexadecimales (dos UUID aleatorios sin guiones, unos 244 bits)
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Nadie lee ni escribe la tabla desde la app: solo con las funciones de abajo
ALTER TABLE public.calendario_enlaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_enlaces FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.nuevo_token_calendario()
RETURNS TEXT
LANGUAGE sql VOLATILE
AS $$
  SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

-- Mi enlace: lo crea la primera vez y después devuelve siempre el mismo
CREATE OR REPLACE FUNCTION public.mi_token_calendario()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  t TEXT;
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'No tienes ficha de empleado' USING ERRCODE = '42501';
  END IF;
  -- Como el resto de los datos: con doble factor activado, hay que haberlo verificado
  IF NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Verifica el doble factor' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.calendario_enlaces (empleado_id, token)
  VALUES (yo, public.nuevo_token_calendario())
  ON CONFLICT (empleado_id) DO NOTHING;

  SELECT token INTO t FROM public.calendario_enlaces WHERE empleado_id = yo;
  RETURN t;
END;
$$;

-- Enlace nuevo: el anterior deja de funcionar (por si se ha compartido sin querer)
CREATE OR REPLACE FUNCTION public.regenerar_token_calendario()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  t TEXT := public.nuevo_token_calendario();
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'No tienes ficha de empleado' USING ERRCODE = '42501';
  END IF;
  -- Como el resto de los datos: con doble factor activado, hay que haberlo verificado
  IF NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Verifica el doble factor' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.calendario_enlaces (empleado_id, token, created_at)
  VALUES (yo, t, now())
  ON CONFLICT (empleado_id) DO UPDATE SET token = EXCLUDED.token, created_at = now();
  RETURN t;
END;
$$;

-- Los eventos del enlace: los mismos que la persona ve en la app (los públicos,
-- los suyos y aquellos en los que participa), de hace dos meses a dentro de un
-- año. Si el token no existe o el empleado ya no está activo, no devuelve nada.
-- Solo la llama la Edge Function, con la clave de servicio.
CREATE OR REPLACE FUNCTION public.eventos_suscripcion_calendario(p_token TEXT)
RETURNS TABLE (
  id UUID,
  titulo VARCHAR,
  descripcion TEXT,
  fecha_inicio TIMESTAMP WITH TIME ZONE,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  ubicacion VARCHAR,
  es_privado BOOLEAN,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH quien AS (
    SELECT c.empleado_id
    FROM public.calendario_enlaces c
    JOIN public.empleados e ON e.id = c.empleado_id AND e.activo
    WHERE c.token = p_token
  )
  SELECT ev.id, ev.titulo, ev.descripcion, ev.fecha_inicio, ev.fecha_fin, ev.ubicacion, ev.es_privado, ev.updated_at
  FROM public.eventos ev, quien
  WHERE ev.fecha_fin >= now() - interval '60 days'
    AND ev.fecha_inicio <= now() + interval '1 year'
    AND (
      NOT ev.es_privado
      OR ev.creador_id = quien.empleado_id
      OR EXISTS (
        SELECT 1 FROM public.evento_participantes p
        WHERE p.evento_id = ev.id AND p.empleado_id = quien.empleado_id
      )
    )
  ORDER BY ev.fecha_inicio;
$$;

REVOKE EXECUTE ON FUNCTION public.nuevo_token_calendario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mi_token_calendario() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerar_token_calendario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_token_calendario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_token_calendario() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.eventos_suscripcion_calendario(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eventos_suscripcion_calendario(TEXT) TO service_role;
