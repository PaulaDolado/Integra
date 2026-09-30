-- Permisos por departamento: cada departamento actúa como un rol.
-- Para dar o quitar un permiso basta con añadir o borrar una fila en
-- departamento_permisos desde el panel de Supabase.

-- Catálogo de permisos ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permisos (
  codigo VARCHAR(50) PRIMARY KEY,
  descripcion TEXT NOT NULL
);

INSERT INTO public.permisos (codigo, descripcion) VALUES
  ('comunicados.rrhh', 'Publicar, editar y borrar comunicados de RRHH en el tablón'),
  ('comunicados.marketing', 'Publicar, editar y borrar comunicados de Marketing en el tablón'),
  ('ausencias.aprobar', 'Aprobar o rechazar solicitudes de ausencia'),
  ('empleados.gestionar', 'Dar de alta empleados y cambiar su cargo, departamento o estado'),
  ('fichajes.ver_todos', 'Ver los fichajes de todos los empleados'),
  ('contactos_emergencia.ver', 'Ver los contactos de emergencia de todos los empleados'),
  ('datos_pago.ver', 'Ver los datos de pago (IBAN) de los empleados para la nómina'),
  ('tickets.gestionar', 'Ver, asignar y cambiar el estado de todos los tickets')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Permisos de cada departamento ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.departamento_permisos (
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  permiso VARCHAR(50) NOT NULL REFERENCES public.permisos(codigo) ON DELETE CASCADE,
  PRIMARY KEY (departamento_id, permiso)
);

INSERT INTO public.departamento_permisos (departamento_id, permiso)
SELECT d.id, p.permiso
FROM (VALUES
  ('Recursos Humanos', 'comunicados.rrhh'),
  ('Recursos Humanos', 'ausencias.aprobar'),
  ('Recursos Humanos', 'empleados.gestionar'),
  ('Recursos Humanos', 'fichajes.ver_todos'),
  ('Recursos Humanos', 'contactos_emergencia.ver'),
  ('Dirección General', 'ausencias.aprobar'),
  ('Dirección General', 'fichajes.ver_todos'),
  ('Finanzas y Contabilidad', 'datos_pago.ver'),
  ('Marketing', 'comunicados.marketing'),
  ('Comunicación', 'comunicados.marketing'),
  ('Tecnología', 'tickets.gestionar')
) AS p(departamento, permiso)
JOIN public.departamentos d ON d.nombre = p.departamento
ON CONFLICT DO NOTHING;

-- Solo se consultan con las funciones de abajo; se gestionan desde el panel
ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamento_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permisos visibles para usuarios autenticados" ON public.permisos;
CREATE POLICY "Permisos visibles para usuarios autenticados"
ON public.permisos FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permisos de departamento visibles para usuarios autenticados" ON public.departamento_permisos;
CREATE POLICY "Permisos de departamento visibles para usuarios autenticados"
ON public.departamento_permisos FOR SELECT TO authenticated
USING (true);

-- Doble factor también en estas tablas nuevas
DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.permisos;
CREATE POLICY "Exige doble factor si está activado"
ON public.permisos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.departamento_permisos;
CREATE POLICY "Exige doble factor si está activado"
ON public.departamento_permisos AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Funciones -------------------------------------------------------------------

-- true si el empleado activo de la sesión tiene el permiso por su departamento
CREATE OR REPLACE FUNCTION public.tengo_permiso(codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empleados e
    JOIN public.departamento_permisos dp ON dp.departamento_id = e.departamento_id
    WHERE e.user_id = auth.uid() AND e.activo AND dp.permiso = codigo
  );
$$;

-- Permisos del empleado de la sesión, para mostrar u ocultar acciones en la web
CREATE OR REPLACE FUNCTION public.mis_permisos()
RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT dp.permiso
  FROM public.empleados e
  JOIN public.departamento_permisos dp ON dp.departamento_id = e.departamento_id
  WHERE e.user_id = auth.uid() AND e.activo;
$$;

REVOKE EXECUTE ON FUNCTION public.tengo_permiso(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mis_permisos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tengo_permiso(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_permisos() TO authenticated;

-- Tablón: pasa del área fija por departamento a los permisos -----------------

DROP POLICY IF EXISTS "El departamento publica comunicados de su área" ON public.anuncios;
DROP POLICY IF EXISTS "El departamento edita comunicados de su área" ON public.anuncios;
DROP POLICY IF EXISTS "El departamento borra comunicados de su área" ON public.anuncios;

DROP POLICY IF EXISTS "Publicar comunicados con permiso del área" ON public.anuncios;
CREATE POLICY "Publicar comunicados con permiso del área"
ON public.anuncios FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id() AND public.tengo_permiso('comunicados.' || area));

DROP POLICY IF EXISTS "Editar comunicados con permiso del área" ON public.anuncios;
CREATE POLICY "Editar comunicados con permiso del área"
ON public.anuncios FOR UPDATE TO authenticated
USING (public.tengo_permiso('comunicados.' || area))
WITH CHECK (public.tengo_permiso('comunicados.' || area));

DROP POLICY IF EXISTS "Borrar comunicados con permiso del área" ON public.anuncios;
CREATE POLICY "Borrar comunicados con permiso del área"
ON public.anuncios FOR DELETE TO authenticated
USING (public.tengo_permiso('comunicados.' || area));

-- El mecanismo anterior queda sustituido por los permisos
DROP FUNCTION IF EXISTS public.mi_area_comunicados();
ALTER TABLE public.departamentos DROP COLUMN IF EXISTS area_comunicados;
