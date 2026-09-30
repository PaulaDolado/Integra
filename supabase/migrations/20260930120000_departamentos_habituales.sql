-- Departamentos habituales de una empresa (los que ya existen no se tocan)
INSERT INTO public.departamentos (nombre, descripcion) VALUES
  ('Dirección General', 'Estrategia, dirección y coordinación de la empresa'),
  ('Finanzas y Contabilidad', 'Contabilidad, tesorería, facturación y control presupuestario'),
  ('Comercial y Ventas', 'Captación de clientes, ventas y relación comercial'),
  ('Atención al Cliente', 'Soporte, incidencias y posventa de clientes'),
  ('Operaciones', 'Planificación y ejecución de los procesos del negocio'),
  ('Producción', 'Fabricación y prestación del producto o servicio'),
  ('Logística', 'Almacén, inventario, envíos y transporte'),
  ('Compras', 'Proveedores, aprovisionamiento y negociación de compras'),
  ('Calidad', 'Control de calidad, auditorías y mejora continua'),
  ('Investigación y Desarrollo', 'Innovación y desarrollo de nuevos productos y servicios'),
  ('Legal', 'Asesoría jurídica, contratos y cumplimiento normativo'),
  ('Prevención de Riesgos Laborales', 'Seguridad y salud en el trabajo'),
  ('Comunicación', 'Comunicación interna y externa, prensa y relaciones públicas')
ON CONFLICT (nombre) DO NOTHING;
