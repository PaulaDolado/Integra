-- Tablón de anuncios: comunicados de Recursos Humanos y Marketing.
-- Solo publica cada área su propio departamento.

-- Cada comunicado pertenece a un área
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'rrhh'
    CHECK (area IN ('rrhh', 'marketing'));

-- El tablón se consulta por mes
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha_publicacion
  ON public.anuncios(fecha_publicacion DESC);

-- Qué área de comunicados publica cada departamento (NULL = ninguna)
ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS area_comunicados VARCHAR(20) UNIQUE
    CHECK (area_comunicados IN ('rrhh', 'marketing'));

INSERT INTO public.departamentos (nombre, descripcion)
VALUES ('Marketing', 'Comunicación, marca y campañas')
ON CONFLICT (nombre) DO NOTHING;

UPDATE public.departamentos SET area_comunicados = 'rrhh' WHERE nombre = 'Recursos Humanos';
UPDATE public.departamentos SET area_comunicados = 'marketing' WHERE nombre = 'Marketing';

-- Área en la que puede publicar el empleado de la sesión (NULL si ninguna)
CREATE OR REPLACE FUNCTION public.mi_area_comunicados()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.area_comunicados
  FROM public.empleados e
  JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE e.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.mi_area_comunicados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_area_comunicados() TO authenticated;

-- Permisos: todos leen el tablón; cada departamento gestiona los de su área
DROP POLICY IF EXISTS "Empleados publican noticias propias" ON public.anuncios;
DROP POLICY IF EXISTS "El autor edita su noticia" ON public.anuncios;
DROP POLICY IF EXISTS "El autor borra su noticia" ON public.anuncios;

DROP POLICY IF EXISTS "El departamento publica comunicados de su área" ON public.anuncios;
CREATE POLICY "El departamento publica comunicados de su área"
ON public.anuncios FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id() AND area = public.mi_area_comunicados());

DROP POLICY IF EXISTS "El departamento edita comunicados de su área" ON public.anuncios;
CREATE POLICY "El departamento edita comunicados de su área"
ON public.anuncios FOR UPDATE TO authenticated
USING (area = public.mi_area_comunicados())
WITH CHECK (area = public.mi_area_comunicados());

DROP POLICY IF EXISTS "El departamento borra comunicados de su área" ON public.anuncios;
CREATE POLICY "El departamento borra comunicados de su área"
ON public.anuncios FOR DELETE TO authenticated
USING (area = public.mi_area_comunicados());
