-- Rol de administrador: tiene todos los permisos, sea cual sea su departamento.
-- No se puede asignar desde la web (la columna no está entre las editables);
-- se gestiona desde el panel de Supabase.

ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS es_admin BOOLEAN NOT NULL DEFAULT false;

-- El usuario demo es administrador
UPDATE public.empleados e
SET es_admin = true
FROM auth.users u
WHERE u.id = e.user_id AND u.email = 'demo@integra.local';

-- Los administradores tienen cualquier permiso
CREATE OR REPLACE FUNCTION public.tengo_permiso(codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empleados e
    WHERE e.user_id = auth.uid()
      AND e.activo
      AND (
        e.es_admin
        OR EXISTS (
          SELECT 1 FROM public.departamento_permisos dp
          WHERE dp.departamento_id = e.departamento_id AND dp.permiso = codigo
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.mis_permisos()
RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.codigo
  FROM public.permisos p
  JOIN public.empleados e ON e.user_id = auth.uid() AND e.activo
  WHERE e.es_admin
     OR EXISTS (
       SELECT 1 FROM public.departamento_permisos dp
       WHERE dp.departamento_id = e.departamento_id AND dp.permiso = p.codigo
     );
$$;
