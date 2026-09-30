-- Organigrama sin datos personales, contactos de emergencia para RRHH y
-- datos de pago para Finanzas (con registro de cada consulta del IBAN).

-- Organigrama: solo persona, puesto y departamento ---------------------------------

CREATE OR REPLACE FUNCTION public.organigrama()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  cargo VARCHAR,
  departamento_id UUID,
  departamento VARCHAR,
  es_responsable BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id,
    concat_ws(' ', e.nombre, e.primer_apellido, nullif(e.segundo_apellido, '')),
    c.nombre,
    e.departamento_id,
    d.nombre,
    d.jefe_departamento_id = e.id
  FROM public.empleados e
  LEFT JOIN public.cargos c ON c.id = e.cargo_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE e.activo AND auth.uid() IS NOT NULL AND public.cumple_doble_factor()
  ORDER BY d.nombre NULLS LAST, (d.jefe_departamento_id = e.id) DESC, 2;
$$;

REVOKE EXECUTE ON FUNCTION public.organigrama() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organigrama() TO authenticated;

-- Contactos de emergencia (permiso "contactos_emergencia.ver") ---------------------

DROP POLICY IF EXISTS "RRHH consulta los contactos de emergencia" ON public.contactos_emergencia;
CREATE POLICY "RRHH consulta los contactos de emergencia"
ON public.contactos_emergencia FOR SELECT TO authenticated
USING (public.tengo_permiso('contactos_emergencia.ver'));

-- Toda la plantilla activa, también quien no tiene ningún contacto
CREATE OR REPLACE FUNCTION public.contactos_emergencia_plantilla()
RETURNS TABLE (
  empleado_id UUID,
  empleado TEXT,
  departamento VARCHAR,
  telefono_empleado VARCHAR,
  contacto_id UUID,
  contacto TEXT,
  relacion TEXT,
  telefono TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id,
    concat_ws(' ', e.nombre, e.primer_apellido, nullif(e.segundo_apellido, '')),
    d.nombre,
    e.numero_telefono,
    ce.id, ce.nombre::text, ce.relacion::text, ce.telefono::text
  FROM public.empleados e
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  LEFT JOIN public.contactos_emergencia ce ON ce.empleado_id = e.id
  WHERE e.activo
    AND public.tengo_permiso('contactos_emergencia.ver')
    AND public.cumple_doble_factor()
  ORDER BY 2, ce.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.contactos_emergencia_plantilla() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contactos_emergencia_plantilla() TO authenticated;

-- Datos de pago (permiso "datos_pago.ver") -----------------------------------------
-- La tabla sigue siendo privada de cada empleado: Finanzas accede solo mediante
-- estas funciones, que enmascaran el IBAN y registran cada consulta completa.

CREATE TABLE IF NOT EXISTS public.accesos_datos_pago (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  -- NULL en una exportación de toda la plantilla
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('ver', 'exportar')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accesos_datos_pago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finanzas consulta el registro de accesos" ON public.accesos_datos_pago;
CREATE POLICY "Finanzas consulta el registro de accesos"
ON public.accesos_datos_pago FOR SELECT TO authenticated
USING (public.tengo_permiso('datos_pago.ver'));

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.accesos_datos_pago;
CREATE POLICY "Exige doble factor si está activado"
ON public.accesos_datos_pago AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));

-- Listado con el IBAN enmascarado (solo los 4 últimos dígitos)
CREATE OR REPLACE FUNCTION public.datos_pago_plantilla()
RETURNS TABLE (
  empleado_id UUID,
  empleado TEXT,
  departamento VARCHAR,
  forma_pago VARCHAR,
  iban_enmascarado TEXT,
  actualizado TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id,
    concat_ws(' ', e.nombre, e.primer_apellido, nullif(e.segundo_apellido, '')),
    d.nombre,
    dp.forma_pago,
    CASE WHEN dp.iban IS NULL THEN NULL
         ELSE left(dp.iban, 2) || repeat('•', greatest(length(dp.iban) - 6, 0)) || right(dp.iban, 4) END,
    dp.updated_at
  FROM public.empleados e
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  LEFT JOIN public.datos_pago dp ON dp.empleado_id = e.id
  WHERE e.activo
    AND public.tengo_permiso('datos_pago.ver')
    AND public.cumple_doble_factor()
  ORDER BY 2;
$$;

-- IBAN completo de un empleado; queda registrado quién lo consultó
CREATE OR REPLACE FUNCTION public.ver_iban(p_empleado UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  resultado TEXT;
BEGIN
  IF NOT public.tengo_permiso('datos_pago.ver') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para ver los datos de pago' USING ERRCODE = '42501';
  END IF;
  SELECT iban INTO resultado FROM public.datos_pago WHERE empleado_id = p_empleado;
  INSERT INTO public.accesos_datos_pago (autor_id, empleado_id, accion)
  VALUES (public.mi_empleado_id(), p_empleado, 'ver');
  RETURN resultado;
END;
$$;

-- Exportación para la nómina (IBAN completo); queda registrada
CREATE OR REPLACE FUNCTION public.exportar_datos_pago()
RETURNS TABLE (empleado TEXT, departamento VARCHAR, forma_pago VARCHAR, iban VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.tengo_permiso('datos_pago.ver') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para exportar los datos de pago' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.accesos_datos_pago (autor_id, empleado_id, accion)
  VALUES (public.mi_empleado_id(), NULL, 'exportar');
  RETURN QUERY
    SELECT concat_ws(' ', e.nombre, e.primer_apellido, nullif(e.segundo_apellido, '')), d.nombre, dp.forma_pago, dp.iban
    FROM public.empleados e
    LEFT JOIN public.departamentos d ON d.id = e.departamento_id
    JOIN public.datos_pago dp ON dp.empleado_id = e.id
    WHERE e.activo
    ORDER BY 1;
END;
$$;

-- Últimos accesos con el nombre de quién consultó y de quién
CREATE OR REPLACE FUNCTION public.accesos_datos_pago_recientes()
RETURNS TABLE (id UUID, autor TEXT, empleado TEXT, accion VARCHAR, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id,
         concat_ws(' ', au.nombre, au.primer_apellido),
         concat_ws(' ', em.nombre, em.primer_apellido),
         a.accion, a.created_at
  FROM public.accesos_datos_pago a
  LEFT JOIN public.empleados au ON au.id = a.autor_id
  LEFT JOIN public.empleados em ON em.id = a.empleado_id
  WHERE public.tengo_permiso('datos_pago.ver') AND public.cumple_doble_factor()
  ORDER BY a.created_at DESC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.datos_pago_plantilla() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ver_iban(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.exportar_datos_pago() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accesos_datos_pago_recientes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.datos_pago_plantilla() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ver_iban(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exportar_datos_pago() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accesos_datos_pago_recientes() TO authenticated;
