-- «Abierto recientemente» del dashboard: las últimas notas que ha abierto cada
-- empleado. Solo se accede a través de las dos funciones de abajo.

CREATE TABLE IF NOT EXISTS public.nota_aperturas (
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  nota_id UUID NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  abierta_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (empleado_id, nota_id)
);

CREATE INDEX IF NOT EXISTS idx_nota_aperturas_recientes ON public.nota_aperturas (empleado_id, abierta_at DESC);

ALTER TABLE public.nota_aperturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nota_aperturas FROM PUBLIC, anon, authenticated;

-- Cuántas aperturas se guardan por empleado: el resto no se llega a mostrar
-- (se guardan algunas más por si deja de tener acceso a alguna)
CREATE OR REPLACE FUNCTION public.registrar_apertura_nota(p_nota UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
BEGIN
  -- Comprueba el doble factor y que el usuario ve la nota
  PERFORM public.exigir_rol_nota(p_nota, false);

  INSERT INTO public.nota_aperturas (empleado_id, nota_id, abierta_at)
  VALUES (yo, p_nota, now())
  ON CONFLICT (empleado_id, nota_id) DO UPDATE SET abierta_at = now();

  DELETE FROM public.nota_aperturas
  WHERE empleado_id = yo
    AND nota_id NOT IN (
      SELECT nota_id FROM public.nota_aperturas
      WHERE empleado_id = yo
      ORDER BY abierta_at DESC
      LIMIT 30
    );
END;
$$;

-- Últimas notas abiertas por el usuario que todavía puede ver
CREATE OR REPLACE FUNCTION public.notas_recientes(p_limite INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  titulo VARCHAR,
  extracto VARCHAR,
  mi_rol TEXT,
  propietario_nombre TEXT,
  abierta_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    n.id, n.titulo, n.extracto,
    public.rol_en_nota(n.id),
    p.nombre || ' ' || p.primer_apellido,
    a.abierta_at, n.updated_at
  FROM public.nota_aperturas a
  JOIN public.notas n ON n.id = a.nota_id
  JOIN public.empleados p ON p.id = n.propietario_id
  WHERE a.empleado_id = public.mi_empleado_id()
    AND public.cumple_doble_factor()
    AND public.rol_en_nota(n.id) IS NOT NULL
  ORDER BY a.abierta_at DESC
  LIMIT least(greatest(coalesce(p_limite, 5), 1), 20);
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_apertura_nota(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notas_recientes(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_apertura_nota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notas_recientes(INTEGER) TO authenticated;
