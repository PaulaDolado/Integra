-- Gestión documental: notas colaborativas.
-- Cada nota es un documento Yjs (CRDT). El contenido no se guarda como HTML,
-- sino como una lista de cambios Yjs que se pueden aplicar en cualquier orden:
--   · notas.estado        estado compactado (base64), con los cambios hasta notas.estado_hasta
--   · nota_cambios        cambios posteriores, uno por cada guardado de un editor
-- Los navegadores cargan estado + cambios, se avisan de los nuevos por Realtime
-- (postgres_changes de nota_cambios, que respeta RLS) y de vez en cuando
-- compactan los cambios en el estado. Los cursores de los demás van por un canal
-- privado de broadcast ("nota:<id>") que solo pueden usar quienes ven la nota.
--
-- Roles: propietario (quien la crea), editor y lector. Solo el propietario
-- comparte, deja de compartir y elimina. Los lectores no pueden escribir nada.

-- Tablas -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  propietario_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL DEFAULT '',
  -- Fondo de la hoja
  formato VARCHAR(10) NOT NULL DEFAULT 'blanco' CHECK (formato IN ('blanco', 'punteado', 'rayas')),
  -- Primeras líneas en texto plano, para la lista de notas
  extracto VARCHAR(300) NOT NULL DEFAULT '',
  -- Estado Yjs compactado (base64) e id del último cambio que incluye
  estado TEXT NOT NULL DEFAULT '',
  estado_hasta BIGINT NOT NULL DEFAULT 0,
  actualizado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_propietario ON public.notas (propietario_id);

CREATE TABLE IF NOT EXISTS public.nota_colaboradores (
  nota_id UUID NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  rol VARCHAR(10) NOT NULL CHECK (rol IN ('lector', 'editor')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (nota_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_nota_colaboradores_empleado ON public.nota_colaboradores (empleado_id);

CREATE TABLE IF NOT EXISTS public.nota_cambios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nota_id UUID NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  -- Cambio Yjs en base64 (varios cambios seguidos de un editor, ya combinados)
  datos TEXT NOT NULL CHECK (length(datos) BETWEEN 1 AND 4000000),
  -- Pestaña que lo envió: así no se vuelve a pedir su propio cambio
  sesion UUID NOT NULL,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nota_cambios_nota ON public.nota_cambios (nota_id, id);

-- Acceso ------------------------------------------------------------------------------

-- Rol del usuario en la nota: propietario, editor, lector o NULL si no la ve.
-- SECURITY DEFINER para usarla en las políticas sin recursión.
CREATE OR REPLACE FUNCTION public.rol_en_nota(p_nota UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN n.propietario_id = yo.id THEN 'propietario'
    ELSE (SELECT c.rol FROM public.nota_colaboradores c WHERE c.nota_id = n.id AND c.empleado_id = yo.id)
  END
  FROM public.notas n, (SELECT public.mi_empleado_id() AS id) yo
  WHERE n.id = p_nota AND yo.id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_nota(p_nota UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.rol_en_nota(p_nota) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.puede_editar_nota(p_nota UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(public.rol_en_nota(p_nota) IN ('propietario', 'editor'), false);
$$;

-- Id de la nota a partir de un texto que empieza por él (carpeta del bucket o
-- tema de Realtime). NULL si no es un UUID, para no romper la política con un cast.
CREATE OR REPLACE FUNCTION public.nota_de_texto(p_texto TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_texto::uuid
  END;
$$;

-- Comprueba el doble factor y el rol mínimo. Devuelve el rol.
CREATE OR REPLACE FUNCTION public.exigir_rol_nota(p_nota UUID, p_editar BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rol TEXT;
BEGIN
  IF NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Verifica el doble factor para continuar' USING ERRCODE = '42501';
  END IF;
  rol := public.rol_en_nota(p_nota);
  IF rol IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta nota' USING ERRCODE = '42501';
  END IF;
  IF p_editar AND rol = 'lector' THEN
    RAISE EXCEPTION 'Solo puedes leer esta nota' USING ERRCODE = '42501';
  END IF;
  RETURN rol;
END;
$$;

-- Permisos de las tablas --------------------------------------------------------------
-- Se leen con RLS; todos los cambios pasan por las funciones de abajo.

ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_cambios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notas, public.nota_colaboradores, public.nota_cambios FROM anon, authenticated;
GRANT SELECT ON public.notas, public.nota_colaboradores, public.nota_cambios TO authenticated;

DROP POLICY IF EXISTS "Ven la nota el propietario y sus colaboradores" ON public.notas;
CREATE POLICY "Ven la nota el propietario y sus colaboradores"
ON public.notas FOR SELECT TO authenticated
USING (public.puede_ver_nota(id));

DROP POLICY IF EXISTS "Ven los colaboradores quienes ven la nota" ON public.nota_colaboradores;
CREATE POLICY "Ven los colaboradores quienes ven la nota"
ON public.nota_colaboradores FOR SELECT TO authenticated
USING (public.puede_ver_nota(nota_id));

DROP POLICY IF EXISTS "Ven los cambios quienes ven la nota" ON public.nota_cambios;
CREATE POLICY "Ven los cambios quienes ven la nota"
ON public.nota_cambios FOR SELECT TO authenticated
USING (public.puede_ver_nota(nota_id));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.notas;
CREATE POLICY "Exige doble factor si está activado"
ON public.notas AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.nota_colaboradores;
CREATE POLICY "Exige doble factor si está activado"
ON public.nota_colaboradores AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.nota_cambios;
CREATE POLICY "Exige doble factor si está activado"
ON public.nota_cambios AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Funciones ---------------------------------------------------------------------------

-- Lista de notas que ve el usuario: las suyas y las compartidas con él
CREATE OR REPLACE FUNCTION public.mis_notas()
RETURNS TABLE (
  id UUID,
  titulo VARCHAR,
  formato VARCHAR,
  extracto VARCHAR,
  mi_rol TEXT,
  propietario_id UUID,
  propietario_nombre TEXT,
  colaboradores INTEGER,
  actualizado_por_nombre TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH yo AS (SELECT public.mi_empleado_id() AS id)
  SELECT
    n.id, n.titulo, n.formato, n.extracto,
    CASE WHEN n.propietario_id = yo.id THEN 'propietario' ELSE c.rol END,
    n.propietario_id,
    p.nombre || ' ' || p.primer_apellido,
    (SELECT count(*)::integer FROM public.nota_colaboradores x WHERE x.nota_id = n.id),
    a.nombre || ' ' || a.primer_apellido,
    n.created_at, n.updated_at
  FROM yo
  JOIN public.notas n ON true
  LEFT JOIN public.nota_colaboradores c ON c.nota_id = n.id AND c.empleado_id = yo.id
  JOIN public.empleados p ON p.id = n.propietario_id
  LEFT JOIN public.empleados a ON a.id = n.actualizado_por
  WHERE yo.id IS NOT NULL
    AND public.cumple_doble_factor()
    AND (n.propietario_id = yo.id OR c.empleado_id IS NOT NULL)
  ORDER BY n.updated_at DESC;
$$;

-- Abre una nota: datos, estado compactado y rol del usuario
CREATE OR REPLACE FUNCTION public.abrir_nota(p_nota UUID)
RETURNS TABLE (
  id UUID,
  titulo VARCHAR,
  formato VARCHAR,
  propietario_id UUID,
  estado TEXT,
  estado_hasta BIGINT,
  mi_rol TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rol TEXT := public.exigir_rol_nota(p_nota, false);
BEGIN
  RETURN QUERY
  SELECT n.id, n.titulo, n.formato, n.propietario_id, n.estado, n.estado_hasta, rol
  FROM public.notas n WHERE n.id = p_nota;
END;
$$;

-- Nota nueva, en blanco
CREATE OR REPLACE FUNCTION public.crear_nota(p_titulo TEXT DEFAULT '', p_formato TEXT DEFAULT 'blanco')
RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  nueva UUID;
BEGIN
  IF NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'Verifica el doble factor para continuar' USING ERRCODE = '42501';
  END IF;
  IF yo IS NULL THEN
    RAISE EXCEPTION 'No tienes perfil de empleado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notas (propietario_id, titulo, formato, actualizado_por)
  VALUES (yo, left(btrim(coalesce(p_titulo, '')), 200), coalesce(p_formato, 'blanco'), yo)
  RETURNING notas.id INTO nueva;
  RETURN nueva;
END;
$$;

-- Título y formato de la hoja (editores). NULL deja el valor como estaba.
CREATE OR REPLACE FUNCTION public.actualizar_nota(p_nota UUID, p_titulo TEXT DEFAULT NULL, p_formato TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_rol_nota(p_nota, true);
  UPDATE public.notas SET
    titulo = coalesce(left(btrim(p_titulo), 200), titulo),
    formato = coalesce(p_formato, formato),
    actualizado_por = public.mi_empleado_id(),
    updated_at = now()
  WHERE id = p_nota;
END;
$$;

-- Guarda un cambio Yjs de un editor y actualiza el extracto de la lista
CREATE OR REPLACE FUNCTION public.guardar_cambios_nota(p_nota UUID, p_datos TEXT, p_sesion UUID, p_extracto TEXT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  nuevo BIGINT;
BEGIN
  PERFORM public.exigir_rol_nota(p_nota, true);

  INSERT INTO public.nota_cambios (nota_id, datos, sesion, autor_id)
  VALUES (p_nota, p_datos, p_sesion, yo)
  RETURNING id INTO nuevo;

  -- Mientras alguien escribe se guarda cada medio segundo: la fila de la nota
  -- (y con ella las listas abiertas por Realtime) solo cambia si cambia el
  -- extracto o el autor, o cada 30 segundos
  UPDATE public.notas SET
    extracto = coalesce(left(p_extracto, 300), extracto),
    actualizado_por = yo,
    updated_at = now()
  WHERE id = p_nota
    AND (
      extracto IS DISTINCT FROM coalesce(left(p_extracto, 300), extracto)
      OR actualizado_por IS DISTINCT FROM yo
      OR updated_at < now() - interval '30 seconds'
    );

  RETURN nuevo;
END;
$$;

-- Sustituye los cambios (p_base, p_hasta] por un estado compactado que los
-- incluye. Solo si nadie ha compactado antes (estado_hasta sigue en p_base) y
-- si en ese tramo están exactamente los p_cuantos cambios que leyó el navegador:
-- un cambio que llegue tarde con un id menor no se pierde.
CREATE OR REPLACE FUNCTION public.compactar_nota(p_nota UUID, p_estado TEXT, p_base BIGINT, p_hasta BIGINT, p_cuantos INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actual BIGINT;
  hay INTEGER;
BEGIN
  PERFORM public.exigir_rol_nota(p_nota, true);

  SELECT estado_hasta INTO actual FROM public.notas WHERE id = p_nota FOR UPDATE;
  IF actual IS DISTINCT FROM p_base OR p_hasta <= p_base OR coalesce(p_estado, '') = '' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO hay FROM public.nota_cambios
  WHERE nota_id = p_nota AND id > p_base AND id <= p_hasta;
  IF hay <> p_cuantos THEN
    RETURN false;
  END IF;

  UPDATE public.notas SET estado = p_estado, estado_hasta = p_hasta WHERE id = p_nota;
  DELETE FROM public.nota_cambios WHERE nota_id = p_nota AND id > p_base AND id <= p_hasta;
  RETURN true;
END;
$$;

-- Quienes tienen acceso a la nota, empezando por el propietario
CREATE OR REPLACE FUNCTION public.colaboradores_nota(p_nota UUID)
RETURNS TABLE (
  empleado_id UUID,
  nombre VARCHAR,
  primer_apellido VARCHAR,
  cargo VARCHAR,
  departamento VARCHAR,
  rol TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_rol_nota(p_nota, false);
  RETURN QUERY
  SELECT e.id, e.nombre, e.primer_apellido, cg.nombre, d.nombre, x.rol
  FROM (
    SELECT n.propietario_id AS empleado_id, 'propietario'::text AS rol, 0 AS orden, n.created_at
    FROM public.notas n WHERE n.id = p_nota
    UNION ALL
    SELECT c.empleado_id, c.rol::text, 1, c.created_at
    FROM public.nota_colaboradores c WHERE c.nota_id = p_nota
  ) x
  JOIN public.empleados e ON e.id = x.empleado_id
  LEFT JOIN public.cargos cg ON cg.id = e.cargo_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  ORDER BY x.orden, x.created_at;
END;
$$;

-- Compartir con un compañero o cambiarle el rol (solo el propietario).
-- Le llega un aviso la primera vez.
CREATE OR REPLACE FUNCTION public.compartir_nota(p_nota UUID, p_empleado UUID, p_rol TEXT)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n public.notas%ROWTYPE;
  nuevo BOOLEAN;
BEGIN
  IF public.exigir_rol_nota(p_nota, true) <> 'propietario' THEN
    RAISE EXCEPTION 'Solo quien creó la nota puede compartirla' USING ERRCODE = '42501';
  END IF;
  IF p_rol NOT IN ('lector', 'editor') THEN
    RAISE EXCEPTION 'Rol no válido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO n FROM public.notas WHERE id = p_nota;
  IF p_empleado = n.propietario_id THEN
    RAISE EXCEPTION 'La nota ya es tuya' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = p_empleado AND activo) THEN
    RAISE EXCEPTION 'El empleado no existe o no está activo' USING ERRCODE = 'P0002';
  END IF;

  nuevo := NOT EXISTS (SELECT 1 FROM public.nota_colaboradores WHERE nota_id = p_nota AND empleado_id = p_empleado);

  INSERT INTO public.nota_colaboradores (nota_id, empleado_id, rol)
  VALUES (p_nota, p_empleado, p_rol)
  ON CONFLICT (nota_id, empleado_id) DO UPDATE SET rol = EXCLUDED.rol;

  IF nuevo THEN
    PERFORM public.crear_aviso(
      p_empleado,
      'nota',
      public.nombre_empleado(n.propietario_id) || ' ha compartido una nota contigo',
      coalesce(nullif(n.titulo, ''), 'Sin título') || CASE WHEN p_rol = 'editor' THEN ' · puedes editarla' ELSE ' · solo lectura' END,
      '/documentos/' || p_nota
    );
  END IF;
END;
$$;

-- Quitar el acceso: el propietario a cualquiera; cada colaborador, a sí mismo
CREATE OR REPLACE FUNCTION public.quitar_colaborador_nota(p_nota UUID, p_empleado UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rol TEXT := public.exigir_rol_nota(p_nota, false);
BEGIN
  IF rol <> 'propietario' AND p_empleado IS DISTINCT FROM public.mi_empleado_id() THEN
    RAISE EXCEPTION 'Solo quien creó la nota puede quitar a otros' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.nota_colaboradores WHERE nota_id = p_nota AND empleado_id = p_empleado;
END;
$$;

-- Eliminar la nota con sus cambios (solo el propietario). Las imágenes se
-- borran antes desde la app con la API de Storage.
CREATE OR REPLACE FUNCTION public.eliminar_nota(p_nota UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.exigir_rol_nota(p_nota, true) <> 'propietario' THEN
    RAISE EXCEPTION 'Solo quien creó la nota puede eliminarla' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.notas WHERE id = p_nota;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rol_en_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_ver_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_editar_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.exigir_rol_nota(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mis_notas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.abrir_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_nota(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_nota(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guardar_cambios_nota(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compactar_nota(UUID, TEXT, BIGINT, BIGINT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.colaboradores_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compartir_nota(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quitar_colaborador_nota(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_nota(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rol_en_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_editar_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_notas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_nota(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_nota(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_cambios_nota(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compactar_nota(UUID, TEXT, BIGINT, BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.colaboradores_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compartir_nota(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_colaborador_nota(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_nota(UUID) TO authenticated;

-- Avisos: «Fulano ha compartido una nota contigo» -------------------------------------

ALTER TABLE public.avisos DROP CONSTRAINT IF EXISTS avisos_tipo_check;
ALTER TABLE public.avisos ADD CONSTRAINT avisos_tipo_check
  CHECK (tipo IN ('ausencia', 'turno', 'ticket', 'comunicado', 'nota'));

-- Imágenes de las notas ---------------------------------------------------------------
-- Carpeta = id de la nota. Las ve quien ve la nota, las sube quien la edita y
-- las borra el propietario (al eliminar la nota).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('notas', 'notas', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Imágenes de notas visibles si la nota es visible" ON storage.objects;
CREATE POLICY "Imágenes de notas visibles si la nota es visible"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'notas'
  AND public.puede_ver_nota(public.nota_de_texto((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "Editores suben imágenes a sus notas" ON storage.objects;
CREATE POLICY "Editores suben imágenes a sus notas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notas'
  AND public.cumple_doble_factor()
  AND public.puede_editar_nota(public.nota_de_texto((storage.foldername(name))[1]))
);

DROP POLICY IF EXISTS "El propietario borra las imágenes de su nota" ON storage.objects;
CREATE POLICY "El propietario borra las imágenes de su nota"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'notas'
  AND public.cumple_doble_factor()
  AND public.rol_en_nota(public.nota_de_texto((storage.foldername(name))[1])) = 'propietario'
);

-- Tiempo real -------------------------------------------------------------------------

-- Cambios del contenido, del título y de quién tiene acceso (respetan RLS)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['notas', 'nota_colaboradores', 'nota_cambios'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;

-- Cursores de los demás: canal privado "nota:<id>". Solo pueden escuchar y
-- enviar quienes ven la nota. Los demás canales de la app no son privados y no
-- les afectan estas políticas.
CREATE OR REPLACE FUNCTION public.puede_usar_canal_nota(p_tema TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_tema LIKE 'nota:%'
    AND public.cumple_doble_factor()
    AND public.puede_ver_nota(public.nota_de_texto(substr(p_tema, 6)));
$$;

REVOKE EXECUTE ON FUNCTION public.puede_usar_canal_nota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_usar_canal_nota(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Quien ve la nota recibe los cursores" ON realtime.messages;
CREATE POLICY "Quien ve la nota recibe los cursores"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.messages.extension = 'broadcast' AND public.puede_usar_canal_nota((SELECT realtime.topic())));

DROP POLICY IF EXISTS "Quien ve la nota envía su cursor" ON realtime.messages;
CREATE POLICY "Quien ve la nota envía su cursor"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.messages.extension = 'broadcast' AND public.puede_usar_canal_nota((SELECT realtime.topic())));
