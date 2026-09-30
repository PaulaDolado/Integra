-- Corrección manual de fichajes (RRHH y Dirección General, permiso "fichajes.editar").
-- El registro de jornada debe conservar el rastro de cualquier cambio: nada se
-- borra ni se sobrescribe sin dejar constancia de quién, cuándo y por qué.

-- Permiso nuevo ---------------------------------------------------------------

INSERT INTO public.permisos (codigo, descripcion) VALUES
  ('fichajes.editar', 'Añadir, modificar o anular fichajes de otros empleados con justificación')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.departamento_permisos (departamento_id, permiso)
SELECT d.id, 'fichajes.editar'
FROM public.departamentos d
WHERE d.nombre IN ('Recursos Humanos', 'Dirección General')
ON CONFLICT DO NOTHING;

-- Estado de cada fichaje --------------------------------------------------------

ALTER TABLE public.fichajes
  -- Añadido a mano por RRHH/Dirección (el empleado no fichó)
  ADD COLUMN IF NOT EXISTS es_manual BOOLEAN NOT NULL DEFAULT false,
  -- Anulado: no cuenta en las horas pero se conserva
  ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false,
  -- Hora que registró el empleado antes de la primera modificación
  ADD COLUMN IF NOT EXISTS fecha_hora_original TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS justificacion TEXT,
  ADD COLUMN IF NOT EXISTS corregido_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corregido_en TIMESTAMP WITH TIME ZONE;

-- Historial de auditoría (solo se añaden filas, nunca se modifican) ------------

CREATE TABLE IF NOT EXISTS public.fichaje_correcciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fichaje_id UUID NOT NULL REFERENCES public.fichajes(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL,
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('alta', 'modificacion', 'anulacion')),
  tipo VARCHAR(10) NOT NULL,
  fecha_hora_anterior TIMESTAMP WITH TIME ZONE,
  fecha_hora_nueva TIMESTAMP WITH TIME ZONE,
  justificacion TEXT NOT NULL,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichaje_correcciones_empleado
  ON public.fichaje_correcciones(empleado_id, created_at DESC);

ALTER TABLE public.fichaje_correcciones ENABLE ROW LEVEL SECURITY;

-- El empleado ve las correcciones de sus fichajes; RRHH y Dirección, todas
DROP POLICY IF EXISTS "Correcciones visibles para el empleado y los revisores" ON public.fichaje_correcciones;
CREATE POLICY "Correcciones visibles para el empleado y los revisores"
ON public.fichaje_correcciones FOR SELECT TO authenticated
USING (empleado_id = public.mi_empleado_id() OR public.tengo_permiso('fichajes.ver_todos'));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.fichaje_correcciones;
CREATE POLICY "Exige doble factor si está activado"
ON public.fichaje_correcciones AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- La hora de un fichaje normal la sigue poniendo el servidor ------------------
-- Solo las funciones de corrección pueden guardar otra hora (activan un
-- indicador de la transacción que no está accesible desde la API)
CREATE OR REPLACE FUNCTION public.fijar_hora_fichaje()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('integra.correccion_fichaje', true), '') <> 'on' THEN
    NEW.fecha_hora := now();
    NEW.es_manual := false;
    NEW.anulado := false;
    NEW.fecha_hora_original := NULL;
    NEW.justificacion := NULL;
    NEW.corregido_por := NULL;
    NEW.corregido_en := NULL;
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

-- Comprobaciones comunes de las correcciones
CREATE OR REPLACE FUNCTION public.validar_correccion_fichaje(p_empleado UUID, p_justificacion TEXT, p_fecha_hora TIMESTAMP WITH TIME ZONE)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
BEGIN
  IF NOT public.tengo_permiso('fichajes.editar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para corregir fichajes' USING ERRCODE = '42501';
  END IF;
  IF p_empleado = yo THEN
    RAISE EXCEPTION 'No puedes corregir tus propios fichajes; pídeselo a otra persona de RRHH o Dirección' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_justificacion, ''))) < 10 THEN
    RAISE EXCEPTION 'Explica el motivo de la corrección (mínimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_fecha_hora IS NOT NULL AND p_fecha_hora > now() THEN
    RAISE EXCEPTION 'No se puede registrar un fichaje en el futuro' USING ERRCODE = '22023';
  END IF;
  RETURN yo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_correccion_fichaje(UUID, TEXT, TIMESTAMP WITH TIME ZONE) FROM PUBLIC, anon, authenticated;

-- Añadir un fichaje olvidado
CREATE OR REPLACE FUNCTION public.anadir_fichaje_manual(
  p_empleado UUID,
  p_tipo TEXT,
  p_fecha_hora TIMESTAMP WITH TIME ZONE,
  p_justificacion TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.validar_correccion_fichaje(p_empleado, p_justificacion, p_fecha_hora);
  nuevo UUID;
BEGIN
  IF p_tipo NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'El tipo debe ser entrada o salida' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = p_empleado) THEN
    RAISE EXCEPTION 'El empleado no existe' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('integra.correccion_fichaje', 'on', true);
  INSERT INTO public.fichajes (empleado_id, tipo, fecha_hora, es_manual, justificacion, corregido_por, corregido_en)
  VALUES (p_empleado, p_tipo, p_fecha_hora, true, trim(p_justificacion), yo, now())
  RETURNING id INTO nuevo;
  PERFORM set_config('integra.correccion_fichaje', 'off', true);

  INSERT INTO public.fichaje_correcciones (fichaje_id, empleado_id, accion, tipo, fecha_hora_nueva, justificacion, autor_id)
  VALUES (nuevo, p_empleado, 'alta', p_tipo, p_fecha_hora, trim(p_justificacion), yo);

  RETURN nuevo;
END;
$$;

-- Cambiar la hora de un fichaje
CREATE OR REPLACE FUNCTION public.modificar_fichaje(
  p_fichaje UUID,
  p_fecha_hora TIMESTAMP WITH TIME ZONE,
  p_justificacion TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.fichajes%ROWTYPE;
  yo UUID;
BEGIN
  SELECT * INTO f FROM public.fichajes WHERE id = p_fichaje FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El fichaje no existe' USING ERRCODE = 'P0002';
  END IF;
  yo := public.validar_correccion_fichaje(f.empleado_id, p_justificacion, p_fecha_hora);
  IF f.anulado THEN
    RAISE EXCEPTION 'El fichaje está anulado' USING ERRCODE = '55000';
  END IF;
  IF p_fecha_hora = f.fecha_hora THEN
    RETURN;
  END IF;

  UPDATE public.fichajes SET
    fecha_hora = p_fecha_hora,
    fecha_hora_original = coalesce(fecha_hora_original, CASE WHEN es_manual THEN NULL ELSE f.fecha_hora END),
    justificacion = trim(p_justificacion),
    corregido_por = yo,
    corregido_en = now()
  WHERE id = p_fichaje;

  INSERT INTO public.fichaje_correcciones (fichaje_id, empleado_id, accion, tipo, fecha_hora_anterior, fecha_hora_nueva, justificacion, autor_id)
  VALUES (p_fichaje, f.empleado_id, 'modificacion', f.tipo, f.fecha_hora, p_fecha_hora, trim(p_justificacion), yo);
END;
$$;

-- Anular un fichaje erróneo (se conserva, pero deja de contar)
CREATE OR REPLACE FUNCTION public.anular_fichaje(p_fichaje UUID, p_justificacion TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.fichajes%ROWTYPE;
  yo UUID;
BEGIN
  SELECT * INTO f FROM public.fichajes WHERE id = p_fichaje FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El fichaje no existe' USING ERRCODE = 'P0002';
  END IF;
  yo := public.validar_correccion_fichaje(f.empleado_id, p_justificacion, NULL);
  IF f.anulado THEN
    RETURN;
  END IF;

  UPDATE public.fichajes SET
    anulado = true,
    justificacion = trim(p_justificacion),
    corregido_por = yo,
    corregido_en = now()
  WHERE id = p_fichaje;

  INSERT INTO public.fichaje_correcciones (fichaje_id, empleado_id, accion, tipo, fecha_hora_anterior, justificacion, autor_id)
  VALUES (p_fichaje, f.empleado_id, 'anulacion', f.tipo, f.fecha_hora, trim(p_justificacion), yo);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anadir_fichaje_manual(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modificar_fichaje(UUID, TIMESTAMP WITH TIME ZONE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.anular_fichaje(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anadir_fichaje_manual(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modificar_fichaje(UUID, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_fichaje(UUID, TEXT) TO authenticated;

-- Nombres de quien corrige, para mostrarlos junto a cada corrección
CREATE OR REPLACE FUNCTION public.autores_correcciones_fichajes()
RETURNS TABLE (id UUID, nombre TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT e.id, concat_ws(' ', e.nombre, e.primer_apellido)
  FROM public.empleados e
  JOIN public.fichaje_correcciones c ON c.autor_id = e.id
  WHERE c.empleado_id = public.mi_empleado_id() OR public.tengo_permiso('fichajes.ver_todos');
$$;

REVOKE EXECUTE ON FUNCTION public.autores_correcciones_fichajes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autores_correcciones_fichajes() TO authenticated;

-- Las modificaciones y anulaciones también llegan en tiempo real
ALTER TABLE public.fichajes REPLICA IDENTITY FULL;
