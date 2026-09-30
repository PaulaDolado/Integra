-- Fichajes de toda la plantilla para quien tenga el permiso "fichajes.ver_todos"
-- (Recursos Humanos, Dirección General y administradores). Solo lectura.

DROP POLICY IF EXISTS "Revisores ven los fichajes de la plantilla" ON public.fichajes;
CREATE POLICY "Revisores ven los fichajes de la plantilla"
ON public.fichajes FOR SELECT TO authenticated
USING (public.tengo_permiso('fichajes.ver_todos'));

-- Plantilla activa (también quien aún no ha fichado), con su departamento
CREATE OR REPLACE FUNCTION public.plantilla_fichajes()
RETURNS TABLE (id UUID, nombre TEXT, departamento_id UUID, departamento VARCHAR)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, concat_ws(' ', e.nombre, e.primer_apellido, e.segundo_apellido), e.departamento_id, d.nombre
  FROM public.empleados e
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE e.activo
    AND public.tengo_permiso('fichajes.ver_todos')
    AND public.cumple_doble_factor()
  ORDER BY 2;
$$;

REVOKE EXECUTE ON FUNCTION public.plantilla_fichajes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plantilla_fichajes() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_fichajes_empleado_fecha ON public.fichajes(empleado_id, fecha_hora);

-- Quién está trabajando se actualiza en tiempo real
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fichajes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fichajes;
  END IF;
END $$;
