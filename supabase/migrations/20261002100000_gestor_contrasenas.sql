-- Gestor de contraseñas personal, cifrado de extremo a extremo.
-- El navegador cifra cada entrada con una clave derivada de la contraseña
-- maestra (PBKDF2 + AES-GCM). Aquí solo se guarda texto cifrado: ni la base de
-- datos ni un administrador pueden leer las contraseñas, y la contraseña
-- maestra no se envía nunca al servidor.

-- Una bóveda por usuario: parámetros para derivar la clave y un verificador
-- (un texto conocido cifrado) para comprobar la contraseña maestra.
CREATE TABLE IF NOT EXISTS public.boveda_claves (
  user_id UUID NOT NULL PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sal TEXT NOT NULL,
  iteraciones INTEGER NOT NULL CHECK (iteraciones >= 100000),
  verificador TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cada entrada es un único bloque cifrado (nombre, web, usuario, contraseña y
-- notas). Al borrar la bóveda se borran también sus entradas.
CREATE TABLE IF NOT EXISTS public.boveda_entradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES public.boveda_claves(user_id) ON DELETE CASCADE,
  datos TEXT NOT NULL CHECK (length(datos) <= 65536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boveda_entradas_user_id ON public.boveda_entradas(user_id);

ALTER TABLE public.boveda_claves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boveda_entradas ENABLE ROW LEVEL SECURITY;

-- Solo el propietario, sin excepciones: ni administradores ni departamentos
DROP POLICY IF EXISTS "Cada usuario gestiona su bóveda" ON public.boveda_claves;
CREATE POLICY "Cada usuario gestiona su bóveda"
ON public.boveda_claves FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Cada usuario gestiona sus contraseñas" ON public.boveda_entradas;
CREATE POLICY "Cada usuario gestiona sus contraseñas"
ON public.boveda_entradas FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.boveda_claves;
CREATE POLICY "Exige doble factor si está activado"
ON public.boveda_claves AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.boveda_entradas;
CREATE POLICY "Exige doble factor si está activado"
ON public.boveda_entradas AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP TRIGGER IF EXISTS update_boveda_claves_updated_at ON public.boveda_claves;
CREATE TRIGGER update_boveda_claves_updated_at
BEFORE UPDATE ON public.boveda_claves
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_boveda_entradas_updated_at ON public.boveda_entradas;
CREATE TRIGGER update_boveda_entradas_updated_at
BEFORE UPDATE ON public.boveda_entradas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cambio de contraseña maestra: la bóveda y todas sus entradas, cifradas de
-- nuevo en el navegador, se guardan en una sola transacción para que nunca
-- queden entradas cifradas con la clave anterior.
-- p_entradas: [{"id": "<uuid>", "datos": "<cifrado>"}, ...]
CREATE OR REPLACE FUNCTION public.cambiar_clave_maestra(
  p_sal TEXT,
  p_iteraciones INTEGER,
  p_verificador TEXT,
  p_entradas JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  esperadas INTEGER;
  actualizadas INTEGER;
BEGIN
  UPDATE public.boveda_claves
  SET sal = p_sal, iteraciones = p_iteraciones, verificador = p_verificador
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes ninguna bóveda creada' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO esperadas FROM public.boveda_entradas WHERE user_id = auth.uid();

  UPDATE public.boveda_entradas be
  SET datos = e.datos
  FROM jsonb_to_recordset(p_entradas) AS e(id UUID, datos TEXT)
  WHERE be.id = e.id AND be.user_id = auth.uid();
  GET DIAGNOSTICS actualizadas = ROW_COUNT;

  -- Si se ha añadido una entrada desde otra pestaña mientras tanto, se anula
  -- todo: quedaría cifrada con la clave antigua y sería ilegible
  IF actualizadas <> esperadas THEN
    RAISE EXCEPTION 'La bóveda ha cambiado mientras se cifraba de nuevo. Vuelve a intentarlo.' USING ERRCODE = '40001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cambiar_clave_maestra(TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_clave_maestra(TEXT, INTEGER, TEXT, JSONB) TO authenticated;
