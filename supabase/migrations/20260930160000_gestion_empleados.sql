-- Gestión de empleados para quien tenga el permiso "empleados.gestionar"
-- (Recursos Humanos y administradores).

-- Las fichas se pueden crear antes de que exista la cuenta de acceso:
-- se vinculan solas cuando se crea un usuario con el mismo correo
ALTER TABLE public.empleados ALTER COLUMN user_id DROP NOT NULL;

-- Cargos habituales (los que ya existen no se tocan)
INSERT INTO public.cargos (nombre, descripcion) VALUES
  ('Director/a', 'Dirección de la empresa o de un área'),
  ('Responsable de área', 'Gestión de un equipo o departamento'),
  ('Coordinador/a', 'Coordinación de proyectos o equipos'),
  ('Técnico/a', 'Trabajo técnico especializado'),
  ('Especialista', 'Experto en una materia concreta'),
  ('Administrativo/a', 'Tareas administrativas y de gestión'),
  ('Comercial', 'Venta y relación con clientes'),
  ('Becario/a', 'Formación en prácticas')
ON CONFLICT (nombre) DO NOTHING;

-- Listado de la plantilla (vacío sin el permiso) ------------------------------
CREATE OR REPLACE FUNCTION public.gestion_empleados()
RETURNS TABLE (
  id UUID,
  nombre VARCHAR,
  primer_apellido VARCHAR,
  segundo_apellido VARCHAR,
  correo_electronico VARCHAR,
  numero_telefono VARCHAR,
  cargo_id UUID,
  cargo VARCHAR,
  departamento_id UUID,
  departamento VARCHAR,
  fecha_ingreso DATE,
  activo BOOLEAN,
  es_admin BOOLEAN,
  tiene_cuenta BOOLEAN,
  es_yo BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id, e.nombre, e.primer_apellido, e.segundo_apellido, e.correo_electronico,
    e.numero_telefono, e.cargo_id, c.nombre, e.departamento_id, d.nombre,
    e.fecha_ingreso, e.activo, e.es_admin, e.user_id IS NOT NULL,
    e.user_id = auth.uid()
  FROM public.empleados e
  LEFT JOIN public.cargos c ON c.id = e.cargo_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE public.tengo_permiso('empleados.gestionar') AND public.cumple_doble_factor()
  ORDER BY e.activo DESC, e.nombre, e.primer_apellido;
$$;

-- Alta (id NULL) o edición de una ficha --------------------------------------
CREATE OR REPLACE FUNCTION public.guardar_empleado(
  p_id UUID,
  p_nombre TEXT,
  p_primer_apellido TEXT,
  p_segundo_apellido TEXT,
  p_correo TEXT,
  p_telefono TEXT,
  p_cargo_id UUID,
  p_departamento_id UUID,
  p_fecha_ingreso DATE,
  p_activo BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  correo TEXT := lower(trim(p_correo));
  objetivo public.empleados%ROWTYPE;
  soy_admin BOOLEAN;
  resultado UUID;
BEGIN
  IF NOT public.tengo_permiso('empleados.gestionar') OR NOT public.cumple_doble_factor() THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar empleados' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_nombre), '') = '' OR coalesce(trim(p_primer_apellido), '') = '' OR coalesce(correo, '') = '' THEN
    RAISE EXCEPTION 'El nombre, el primer apellido y el correo son obligatorios' USING ERRCODE = '22023';
  END IF;

  IF correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El correo electrónico no es válido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.empleados
    WHERE lower(correo_electronico) = correo AND id IS DISTINCT FROM p_id
  ) THEN
    RAISE EXCEPTION 'Ya existe un empleado con ese correo' USING ERRCODE = '23505';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.empleados (
      user_id, nombre, primer_apellido, segundo_apellido, correo_electronico,
      numero_telefono, cargo_id, departamento_id, fecha_ingreso, activo
    )
    VALUES (
      -- Si ya existe una cuenta con ese correo, se vincula ahora
      (SELECT u.id FROM auth.users u
       WHERE lower(u.email) = correo
         AND NOT EXISTS (SELECT 1 FROM public.empleados x WHERE x.user_id = u.id)),
      trim(p_nombre), trim(p_primer_apellido), coalesce(trim(p_segundo_apellido), ''), correo,
      nullif(trim(p_telefono), ''), p_cargo_id, p_departamento_id,
      coalesce(p_fecha_ingreso, CURRENT_DATE), coalesce(p_activo, true)
    )
    RETURNING id INTO resultado;
    RETURN resultado;
  END IF;

  SELECT * INTO objetivo FROM public.empleados WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El empleado no existe' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(bool_or(es_admin), false) INTO soy_admin
  FROM public.empleados WHERE user_id = auth.uid();

  IF objetivo.es_admin AND NOT soy_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar a otro administrador' USING ERRCODE = '42501';
  END IF;

  IF objetivo.user_id = auth.uid() AND NOT coalesce(p_activo, true) THEN
    RAISE EXCEPTION 'No puedes darte de baja a ti mismo' USING ERRCODE = '42501';
  END IF;

  UPDATE public.empleados SET
    nombre = trim(p_nombre),
    primer_apellido = trim(p_primer_apellido),
    segundo_apellido = coalesce(trim(p_segundo_apellido), ''),
    correo_electronico = correo,
    numero_telefono = nullif(trim(p_telefono), ''),
    cargo_id = p_cargo_id,
    departamento_id = p_departamento_id,
    fecha_ingreso = coalesce(p_fecha_ingreso, objetivo.fecha_ingreso),
    activo = coalesce(p_activo, objetivo.activo)
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gestion_empleados() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guardar_empleado(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestion_empleados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_empleado(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, DATE, BOOLEAN) TO authenticated;

-- Vincula la ficha cuando se crea la cuenta con el mismo correo --------------
CREATE OR REPLACE FUNCTION public.vincular_empleado_nueva_cuenta()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.empleados
  SET user_id = NEW.id
  WHERE user_id IS NULL AND lower(correo_electronico) = lower(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vincular_empleado_nueva_cuenta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vincular_empleado_nueva_cuenta ON auth.users;
CREATE TRIGGER vincular_empleado_nueva_cuenta
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.vincular_empleado_nueva_cuenta();
