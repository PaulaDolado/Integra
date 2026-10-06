-- Google Calendar dentro de Integra: cada persona puede conectar su cuenta de
-- Google (OAuth, solo lectura) y ver sus eventos de Google en el Calendario.
-- Todo pasa por la Edge Function «google-calendar», que es la única que lee
-- estas tablas (con la clave de servicio). Los tokens de Google se guardan
-- cifrados con una clave que solo conoce la función (GOOGLE_TOKENS_CLAVE).

-- Una conexión por empleado
CREATE TABLE IF NOT EXISTS public.google_calendar_conexiones (
  empleado_id UUID NOT NULL PRIMARY KEY REFERENCES public.empleados(id) ON DELETE CASCADE,
  -- Cuenta de Google conectada, para mostrarla en la app
  email TEXT,
  refresh_token_cifrado TEXT NOT NULL,
  access_token_cifrado TEXT,
  access_token_expira TIMESTAMP WITH TIME ZONE,
  conectado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Peticiones de conexión en curso (el «state» de OAuth), válidas 10 minutos
CREATE TABLE IF NOT EXISTS public.google_oauth_estados (
  estado TEXT NOT NULL PRIMARY KEY CHECK (estado ~ '^[0-9a-f]{64}$'),
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  -- Página de Integra a la que se vuelve al terminar
  volver TEXT NOT NULL,
  expira TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '10 minutes'
);

-- Nadie las lee ni las escribe desde la app
ALTER TABLE public.google_calendar_conexiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_estados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_conexiones FROM anon, authenticated;
REVOKE ALL ON public.google_oauth_estados FROM anon, authenticated;

-- Para la app: si tengo Google Calendar conectado y con qué cuenta. Nunca los tokens.
CREATE OR REPLACE FUNCTION public.mi_conexion_google_calendar()
RETURNS TABLE (email TEXT, conectado_en TIMESTAMP WITH TIME ZONE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.email, c.conectado_en
  FROM public.google_calendar_conexiones c
  WHERE c.empleado_id = public.mi_empleado_id();
$$;

REVOKE EXECUTE ON FUNCTION public.mi_conexion_google_calendar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_conexion_google_calendar() TO authenticated;

-- Las peticiones de conexión que nadie terminó se borran solas
CREATE OR REPLACE FUNCTION public.limpiar_google_oauth_estados()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.google_oauth_estados WHERE expira < now();
$$;

REVOKE EXECUTE ON FUNCTION public.limpiar_google_oauth_estados() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('google-oauth-limpieza', '30 4 * * *', 'SELECT public.limpiar_google_oauth_estados()');
  END IF;
END $$;
