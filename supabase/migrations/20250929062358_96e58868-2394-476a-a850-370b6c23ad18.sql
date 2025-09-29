-- Create basic company structure and test data
-- First, create some basic departments and positions
INSERT INTO departamentos (nombre, descripcion) VALUES 
('Recursos Humanos', 'Gestión del talento humano y bienestar laboral'),
('Tecnología', 'Desarrollo de software y soporte técnico'),
('Administración', 'Gestión administrativa y financiera');

INSERT INTO cargos (nombre, descripcion) VALUES 
('Gerente', 'Responsable de liderar equipos y tomar decisiones estratégicas'),
('Desarrollador', 'Programador y desarrollador de software'),
('Analista', 'Analista de sistemas y procesos');

-- Note: We cannot directly insert into auth.users table via SQL
-- The test user must be created through the Supabase Auth UI or API
-- However, we can prepare the employee profile structure for when the user is created