-- Perfil de empleado para el usuario demo.
-- 1. Crea antes el usuario en Supabase: Authentication → Users → Add user
--    (email: demo@integra.local, marca "Auto Confirm User").
-- 2. Ejecuta este script en el SQL Editor de Supabase.
INSERT INTO public.empleados (
  user_id,
  nombre,
  primer_apellido,
  segundo_apellido,
  correo_electronico,
  numero_telefono,
  cargo_id,
  departamento_id,
  activo,
  fecha_ingreso
)
SELECT
  u.id,
  'Demo',
  'Integra',
  'Pruebas',
  u.email,
  '+34 600 000 000',
  (SELECT id FROM public.cargos WHERE nombre = 'Analista' LIMIT 1),
  (SELECT id FROM public.departamentos WHERE nombre = 'Tecnología' LIMIT 1),
  true,
  CURRENT_DATE
FROM auth.users u
WHERE u.email = 'demo@integra.local'
ON CONFLICT (user_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  primer_apellido = EXCLUDED.primer_apellido,
  segundo_apellido = EXCLUDED.segundo_apellido,
  numero_telefono = EXCLUDED.numero_telefono,
  cargo_id = EXCLUDED.cargo_id,
  departamento_id = EXCLUDED.departamento_id;
