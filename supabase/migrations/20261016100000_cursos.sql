-- Inscripción a cursos. RRHH y Dirección publican el catálogo; cada empleado
-- pide plaza y RRHH o Dirección aprueban o rechazan la solicitud.

-- Permiso -----------------------------------------------------------------------------

INSERT INTO public.permisos (codigo, descripcion) VALUES
  ('cursos.gestionar', 'Crear, editar y cancelar cursos y aprobar o rechazar las inscripciones')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.departamento_permisos (departamento_id, permiso)
SELECT d.id, 'cursos.gestionar'
FROM public.departamentos d
WHERE d.nombre IN ('Recursos Humanos', 'Dirección General')
ON CONFLICT DO NOTHING;

-- Tablas ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL CHECK (length(trim(titulo)) > 0),
  descripcion TEXT NOT NULL DEFAULT '',
  modalidad VARCHAR(10) NOT NULL CHECK (modalidad IN ('presencial', 'online')),
  -- Sala o dirección (presencial)
  lugar VARCHAR(300),
  -- Enlace a la sesión (online): solo web
  enlace TEXT CHECK (enlace IS NULL OR enlace ~* '^https?://'),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  horas NUMERIC(6, 1) CHECK (horas IS NULL OR horas > 0),
  certificado BOOLEAN NOT NULL DEFAULT false,
  -- Último día para apuntarse (NULL = hasta el día antes de empezar)
  plazo_inscripcion DATE,
  cancelado BOOLEAN NOT NULL DEFAULT false,
  creado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cursos_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT cursos_plazo CHECK (plazo_inscripcion IS NULL OR plazo_inscripcion < fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cursos_fecha_inicio ON public.cursos (fecha_inicio);

CREATE TABLE IF NOT EXISTS public.inscripciones_curso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  estado VARCHAR(10) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  -- Por qué le interesa, opcional
  motivo TEXT,
  comentario_revision TEXT,
  revisado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (curso_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_curso_empleado ON public.inscripciones_curso (empleado_id);

DROP TRIGGER IF EXISTS update_cursos_updated_at ON public.cursos;
CREATE TRIGGER update_cursos_updated_at BEFORE UPDATE ON public.cursos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inscripciones_curso_updated_at ON public.inscripciones_curso;
CREATE TRIGGER update_inscripciones_curso_updated_at BEFORE UPDATE ON public.inscripciones_curso
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permisos de las tablas --------------------------------------------------------------
-- El catálogo lo ve toda la plantilla y lo gestiona quien tiene el permiso.
-- Las inscripciones solo se leen; se piden, cancelan y revisan con las funciones.

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones_curso ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cursos, public.inscripciones_curso FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT SELECT ON public.inscripciones_curso TO authenticated;

DROP POLICY IF EXISTS "Cursos: ver el catálogo" ON public.cursos;
CREATE POLICY "Cursos: ver el catálogo"
ON public.cursos FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Cursos: crear con permiso" ON public.cursos;
CREATE POLICY "Cursos: crear con permiso"
ON public.cursos FOR INSERT TO authenticated
WITH CHECK ((SELECT public.tengo_permiso('cursos.gestionar')));

DROP POLICY IF EXISTS "Cursos: editar con permiso" ON public.cursos;
CREATE POLICY "Cursos: editar con permiso"
ON public.cursos FOR UPDATE TO authenticated
USING ((SELECT public.tengo_permiso('cursos.gestionar')))
WITH CHECK ((SELECT public.tengo_permiso('cursos.gestionar')));

DROP POLICY IF EXISTS "Cursos: borrar con permiso" ON public.cursos;
CREATE POLICY "Cursos: borrar con permiso"
ON public.cursos FOR DELETE TO authenticated
USING ((SELECT public.tengo_permiso('cursos.gestionar')));

DROP POLICY IF EXISTS "Inscripciones: ver las propias o con permiso" ON public.inscripciones_curso;
CREATE POLICY "Inscripciones: ver las propias o con permiso"
ON public.inscripciones_curso FOR SELECT TO authenticated
USING (
  empleado_id = (SELECT public.mi_empleado_id())
  OR (SELECT public.tengo_permiso('cursos.gestionar'))
);

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.cursos;
CREATE POLICY "Exige doble factor si está activado"
ON public.cursos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.inscripciones_curso;
CREATE POLICY "Exige doble factor si está activado"
ON public.inscripciones_curso AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Funciones del empleado --------------------------------------------------------------

-- Pide plaza en un curso abierto. Quien canceló su solicitud puede volver a pedirla.
CREATE OR REPLACE FUNCTION public.solicitar_curso(p_curso UUID, p_motivo TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  curso public.cursos%ROWTYPE;
  existente public.inscripciones_curso%ROWTYPE;
  resultado UUID;
BEGIN
  IF yo IS NULL OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No puedes inscribirte en cursos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO curso FROM public.cursos WHERE id = p_curso;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El curso no existe' USING ERRCODE = 'P0002';
  END IF;
  IF curso.cancelado THEN
    RAISE EXCEPTION 'El curso está cancelado' USING ERRCODE = '55000';
  END IF;
  IF current_date >= curso.fecha_inicio OR current_date > coalesce(curso.plazo_inscripcion, curso.fecha_inicio) THEN
    RAISE EXCEPTION 'El plazo de inscripción ha terminado' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO existente FROM public.inscripciones_curso
  WHERE curso_id = p_curso AND empleado_id = yo
  FOR UPDATE;

  IF FOUND THEN
    IF existente.estado <> 'cancelada' THEN
      RAISE EXCEPTION 'Ya tienes una solicitud para este curso' USING ERRCODE = '23505';
    END IF;
    UPDATE public.inscripciones_curso
    SET estado = 'pendiente', motivo = nullif(trim(p_motivo), ''), created_at = now(),
        comentario_revision = NULL, revisado_por = NULL, fecha_revision = NULL
    WHERE id = existente.id
    RETURNING id INTO resultado;
  ELSE
    INSERT INTO public.inscripciones_curso (curso_id, empleado_id, motivo)
    VALUES (p_curso, yo, nullif(trim(p_motivo), ''))
    RETURNING id INTO resultado;
  END IF;
  RETURN resultado;
END;
$$;

-- Cancela la propia solicitud (pendiente o aprobada) antes de que empiece el curso
CREATE OR REPLACE FUNCTION public.cancelar_inscripcion_curso(p_inscripcion UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  insc public.inscripciones_curso%ROWTYPE;
  inicio DATE;
BEGIN
  IF yo IS NULL OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No puedes cancelar inscripciones' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO insc FROM public.inscripciones_curso WHERE id = p_inscripcion FOR UPDATE;
  IF NOT FOUND OR insc.empleado_id <> yo THEN
    RAISE EXCEPTION 'La inscripción no existe' USING ERRCODE = 'P0002';
  END IF;
  IF insc.estado NOT IN ('pendiente', 'aprobada') THEN
    RAISE EXCEPTION 'Esta inscripción ya no se puede cancelar' USING ERRCODE = '55000';
  END IF;

  SELECT fecha_inicio INTO inicio FROM public.cursos WHERE id = insc.curso_id;
  IF current_date >= inicio THEN
    RAISE EXCEPTION 'El curso ya ha empezado' USING ERRCODE = '55000';
  END IF;

  UPDATE public.inscripciones_curso SET estado = 'cancelada' WHERE id = p_inscripcion;
END;
$$;

-- Funciones de gestión ----------------------------------------------------------------

-- Todas las inscripciones con el curso y el empleado. Vacío sin el permiso.
CREATE OR REPLACE FUNCTION public.bandeja_cursos()
RETURNS TABLE (
  id UUID,
  curso_id UUID,
  curso_titulo VARCHAR,
  curso_fecha_inicio DATE,
  curso_fecha_fin DATE,
  curso_cancelado BOOLEAN,
  empleado_id UUID,
  empleado_nombre TEXT,
  departamento VARCHAR,
  estado VARCHAR,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  revisado_por_nombre TEXT,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  comentario_revision TEXT,
  es_mia BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    i.id,
    c.id, c.titulo, c.fecha_inicio, c.fecha_fin, c.cancelado,
    i.empleado_id,
    concat_ws(' ', e.nombre, e.primer_apellido, nullif(e.segundo_apellido, '')),
    d.nombre,
    i.estado,
    i.motivo,
    i.created_at,
    concat_ws(' ', r.nombre, r.primer_apellido),
    i.fecha_revision,
    i.comentario_revision,
    i.empleado_id = public.mi_empleado_id()
  FROM public.inscripciones_curso i
  JOIN public.cursos c ON c.id = i.curso_id
  JOIN public.empleados e ON e.id = i.empleado_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  LEFT JOIN public.empleados r ON r.id = i.revisado_por
  WHERE public.tengo_permiso('cursos.gestionar')
    AND public.cumple_doble_factor()
  ORDER BY (i.estado = 'pendiente') DESC, c.fecha_inicio ASC, i.created_at ASC;
$$;

-- Aprueba o rechaza una solicitud pendiente. Nadie revisa las suyas.
CREATE OR REPLACE FUNCTION public.revisar_inscripcion_curso(
  p_inscripcion UUID,
  p_aprobar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  revisor UUID := public.mi_empleado_id();
  insc public.inscripciones_curso%ROWTYPE;
BEGIN
  IF NOT public.tengo_permiso('cursos.gestionar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para revisar inscripciones' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO insc FROM public.inscripciones_curso WHERE id = p_inscripcion FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La inscripción no existe' USING ERRCODE = 'P0002';
  END IF;
  IF insc.empleado_id = revisor THEN
    RAISE EXCEPTION 'No puedes revisar tus propias solicitudes' USING ERRCODE = '42501';
  END IF;
  IF insc.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya ha sido revisada' USING ERRCODE = '55000';
  END IF;

  UPDATE public.inscripciones_curso
  SET estado = CASE WHEN p_aprobar THEN 'aprobada' ELSE 'rechazada' END,
      revisado_por = revisor,
      fecha_revision = now(),
      comentario_revision = nullif(trim(p_comentario), '')
  WHERE id = p_inscripcion;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.solicitar_curso(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_inscripcion_curso(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bandeja_cursos() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revisar_inscripcion_curso(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_curso(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_inscripcion_curso(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bandeja_cursos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_inscripcion_curso(UUID, BOOLEAN, TEXT) TO authenticated;

-- Avisos en la app ----------------------------------------------------------------------

ALTER TABLE public.avisos DROP CONSTRAINT IF EXISTS avisos_tipo_check;
ALTER TABLE public.avisos ADD CONSTRAINT avisos_tipo_check
  CHECK (tipo IN ('ausencia', 'turno', 'ticket', 'comunicado', 'nota', 'curso'));

-- Al empleado, cuando aprueban o rechazan su solicitud
CREATE OR REPLACE FUNCTION public.avisar_inscripcion_curso()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  titulo_curso TEXT;
BEGIN
  IF OLD.estado = 'pendiente' AND NEW.estado IN ('aprobada', 'rechazada') THEN
    SELECT titulo INTO titulo_curso FROM public.cursos WHERE id = NEW.curso_id;
    PERFORM public.crear_aviso(
      NEW.empleado_id, 'curso',
      CASE WHEN NEW.estado = 'aprobada' THEN 'Inscripción aprobada' ELSE 'Inscripción rechazada' END,
      'Tu solicitud para el curso «' || titulo_curso || '» ha sido '
        || CASE WHEN NEW.estado = 'aprobada' THEN 'aprobada' ELSE 'rechazada' END || '.'
        || coalesce(' Comentario: ' || nullif(trim(NEW.comentario_revision), ''), ''),
      '/cursos');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar ON public.inscripciones_curso;
CREATE TRIGGER avisar
AFTER UPDATE OF estado ON public.inscripciones_curso
FOR EACH ROW EXECUTE FUNCTION public.avisar_inscripcion_curso();

-- A quien tenía solicitud pendiente o aprobada, cuando se cancela el curso
CREATE OR REPLACE FUNCTION public.avisar_curso_cancelado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inscrito UUID;
BEGIN
  IF NOT OLD.cancelado AND NEW.cancelado THEN
    FOR inscrito IN
      SELECT empleado_id FROM public.inscripciones_curso
      WHERE curso_id = NEW.id AND estado IN ('pendiente', 'aprobada')
    LOOP
      PERFORM public.crear_aviso(
        inscrito, 'curso', 'Curso cancelado',
        'Se ha cancelado el curso «' || NEW.titulo || '» ' || public.rango_fechas(NEW.fecha_inicio, NEW.fecha_fin) || '.',
        '/cursos');
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar_cancelacion ON public.cursos;
CREATE TRIGGER avisar_cancelacion
AFTER UPDATE OF cancelado ON public.cursos
FOR EACH ROW EXECUTE FUNCTION public.avisar_curso_cancelado();

-- Los triggers se disparan solos: nadie debe llamarlos directamente
REVOKE EXECUTE ON FUNCTION public.avisar_inscripcion_curso() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avisar_curso_cancelado() FROM PUBLIC, anon, authenticated;

-- Tiempo real: el catálogo, la bandeja y «Mis inscripciones» se actualizan solos ---------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cursos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cursos;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inscripciones_curso'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inscripciones_curso;
  END IF;
END $$;

ALTER TABLE public.inscripciones_curso REPLICA IDENTITY FULL;
