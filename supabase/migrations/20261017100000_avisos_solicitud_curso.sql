-- Aviso en la campana a quien revisa las inscripciones a cursos cuando llega una
-- solicitud nueva (o alguien vuelve a pedir plaza tras cancelar la suya).
-- Lo reciben las mismas personas que ven la bandeja: empleados activos de un
-- departamento con «cursos.gestionar» y los administradores. Nunca quien la pide.

CREATE OR REPLACE FUNCTION public.avisar_solicitud_curso()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  titulo_curso TEXT;
BEGIN
  IF NEW.estado <> 'pendiente' OR (TG_OP = 'UPDATE' AND OLD.estado = 'pendiente') THEN
    RETURN NULL;
  END IF;

  SELECT titulo INTO titulo_curso FROM public.cursos WHERE id = NEW.curso_id;

  INSERT INTO public.avisos (empleado_id, tipo, titulo, cuerpo, enlace)
  SELECT e.id, 'curso', 'Nueva solicitud de curso',
    left(public.nombre_empleado(NEW.empleado_id) || ' ha pedido plaza en «' || titulo_curso || '».', 500),
    '/bandeja-cursos'
  FROM public.empleados e
  WHERE e.activo
    AND e.user_id IS NOT NULL
    AND e.id <> NEW.empleado_id
    AND (
      e.es_admin
      OR EXISTS (
        SELECT 1 FROM public.departamento_permisos dp
        WHERE dp.departamento_id = e.departamento_id AND dp.permiso = 'cursos.gestionar'
      )
    );
  RETURN NULL;
-- Un fallo al avisar nunca impide pedir plaza
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudieron crear los avisos de la solicitud de curso: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS avisar_revisores ON public.inscripciones_curso;
CREATE TRIGGER avisar_revisores
AFTER INSERT OR UPDATE OF estado ON public.inscripciones_curso
FOR EACH ROW EXECUTE FUNCTION public.avisar_solicitud_curso();

-- Se dispara solo: nadie debe llamarlo directamente
REVOKE EXECUTE ON FUNCTION public.avisar_solicitud_curso() FROM PUBLIC, anon, authenticated;
