-- RRHH puede modificar los contactos de emergencia y los datos de pago de toda
-- la plantilla. Ver el IBAN completo y exportarlo sigue siendo solo de Finanzas.

INSERT INTO public.permisos (codigo, descripcion) VALUES
  ('contactos_emergencia.editar', 'Añadir, modificar y borrar los contactos de emergencia de cualquier empleado'),
  ('datos_pago.editar', 'Cambiar la forma de pago y el IBAN de cualquier empleado (sin ver el IBAN completo)')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.departamento_permisos (departamento_id, permiso)
SELECT d.id, p.permiso
FROM public.departamentos d
CROSS JOIN (VALUES ('contactos_emergencia.editar'), ('datos_pago.editar')) AS p(permiso)
WHERE d.nombre = 'Recursos Humanos'
ON CONFLICT DO NOTHING;

-- Contactos de emergencia ----------------------------------------------------------

DROP POLICY IF EXISTS "RRHH consulta los contactos de emergencia" ON public.contactos_emergencia;
CREATE POLICY "RRHH consulta los contactos de emergencia"
ON public.contactos_emergencia FOR SELECT TO authenticated
USING (public.tengo_permiso('contactos_emergencia.ver') OR public.tengo_permiso('contactos_emergencia.editar'));

DROP POLICY IF EXISTS "RRHH añade contactos de emergencia" ON public.contactos_emergencia;
CREATE POLICY "RRHH añade contactos de emergencia"
ON public.contactos_emergencia FOR INSERT TO authenticated
WITH CHECK (public.tengo_permiso('contactos_emergencia.editar'));

DROP POLICY IF EXISTS "RRHH modifica contactos de emergencia" ON public.contactos_emergencia;
CREATE POLICY "RRHH modifica contactos de emergencia"
ON public.contactos_emergencia FOR UPDATE TO authenticated
USING (public.tengo_permiso('contactos_emergencia.editar'))
WITH CHECK (public.tengo_permiso('contactos_emergencia.editar'));

DROP POLICY IF EXISTS "RRHH borra contactos de emergencia" ON public.contactos_emergencia;
CREATE POLICY "RRHH borra contactos de emergencia"
ON public.contactos_emergencia FOR DELETE TO authenticated
USING (public.tengo_permiso('contactos_emergencia.editar'));

-- El listado de la plantilla también para quien solo puede editar
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
    AND (public.tengo_permiso('contactos_emergencia.ver') OR public.tengo_permiso('contactos_emergencia.editar'))
    AND public.cumple_doble_factor()
  ORDER BY 2, ce.created_at;
$$;

-- Datos de pago --------------------------------------------------------------------

-- Los cambios de otra persona también quedan en el registro de accesos
ALTER TABLE public.accesos_datos_pago DROP CONSTRAINT IF EXISTS accesos_datos_pago_accion_check;
ALTER TABLE public.accesos_datos_pago ADD CONSTRAINT accesos_datos_pago_accion_check
  CHECK (accion IN ('ver', 'exportar', 'modificar'));

-- El listado con el IBAN enmascarado también para quien solo puede editar
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
    AND (public.tengo_permiso('datos_pago.ver') OR public.tengo_permiso('datos_pago.editar'))
    AND public.cumple_doble_factor()
  ORDER BY 2;
$$;

-- Cambia los datos de pago de un empleado y deja constancia de quién lo hizo.
-- No hay política de escritura directa: así ningún cambio se salta el registro.
CREATE OR REPLACE FUNCTION public.guardar_datos_pago(p_empleado UUID, p_forma_pago TEXT, p_iban TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  iban_limpio TEXT := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
BEGIN
  IF NOT public.tengo_permiso('datos_pago.editar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar los datos de pago' USING ERRCODE = '42501';
  END IF;
  IF iban_limpio !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' THEN
    RAISE EXCEPTION 'El IBAN no es válido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.datos_pago (empleado_id, forma_pago, iban, updated_at)
  VALUES (p_empleado, p_forma_pago, iban_limpio, now())
  ON CONFLICT (empleado_id) DO UPDATE
    SET forma_pago = EXCLUDED.forma_pago, iban = EXCLUDED.iban, updated_at = now();

  INSERT INTO public.accesos_datos_pago (autor_id, empleado_id, accion)
  VALUES (public.mi_empleado_id(), p_empleado, 'modificar');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guardar_datos_pago(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_datos_pago(UUID, TEXT, TEXT) TO authenticated;
