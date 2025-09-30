-- Create employee profile for the test user
-- Insert employee record for the existing user pdolado@empresa.cat
INSERT INTO empleados (
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
) VALUES (
  '70bc8c1c-be24-4b15-b508-17c756987dc8', -- User ID from auth.users
  'Pedro',
  'Dolado',
  'García',
  'pdolado@empresa.cat',
  '+34 612 345 678',
  (SELECT id FROM cargos WHERE nombre = 'Desarrollador' LIMIT 1),
  (SELECT id FROM departamentos WHERE nombre = 'Tecnología' LIMIT 1),
  true,
  CURRENT_DATE
) ON CONFLICT (user_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  primer_apellido = EXCLUDED.primer_apellido,
  segundo_apellido = EXCLUDED.segundo_apellido,
  correo_electronico = EXCLUDED.correo_electronico,
  numero_telefono = EXCLUDED.numero_telefono,
  cargo_id = EXCLUDED.cargo_id,
  departamento_id = EXCLUDED.departamento_id;