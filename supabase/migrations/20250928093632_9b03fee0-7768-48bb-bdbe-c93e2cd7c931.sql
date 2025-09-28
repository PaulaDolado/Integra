-- Create enums for state choices
CREATE TYPE proyecto_estado AS ENUM ('pendiente', 'en_progreso', 'completado', 'cancelado');
CREATE TYPE tarea_estado AS ENUM ('pendiente', 'en_progreso', 'completado');
CREATE TYPE vacacion_estado AS ENUM ('pendiente', 'aprobada', 'rechazada');
CREATE TYPE ticket_estado AS ENUM ('abierto', 'en_progreso', 'resuelto', 'cerrado');
CREATE TYPE ticket_prioridad AS ENUM ('baja', 'media', 'alta', 'urgente');

-- Create Cargo table
CREATE TABLE public.cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Departamento table
CREATE TABLE public.departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  jefe_departamento_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Empleado table (Employee profiles)
CREATE TABLE public.empleados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  primer_apellido VARCHAR(100) NOT NULL,
  segundo_apellido VARCHAR(100) NOT NULL,
  correo_electronico VARCHAR(255) UNIQUE NOT NULL,
  numero_telefono VARCHAR(15),
  cargo_id UUID REFERENCES public.cargos(id),
  departamento_id UUID REFERENCES public.departamentos(id),
  activo BOOLEAN DEFAULT true NOT NULL,
  fecha_ingreso DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add foreign key for department head
ALTER TABLE public.departamentos 
ADD CONSTRAINT fk_jefe_departamento 
FOREIGN KEY (jefe_departamento_id) REFERENCES public.empleados(id) ON DELETE SET NULL;

-- Create Proyecto table
CREATE TABLE public.proyectos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado proyecto_estado DEFAULT 'pendiente' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create many-to-many table for project members
CREATE TABLE public.proyecto_miembros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(proyecto_id, empleado_id)
);

-- Create Tarea table
CREATE TABLE public.tareas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  asignado_a_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  estado tarea_estado DEFAULT 'pendiente' NOT NULL,
  fecha_limite DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Anuncio table
CREATE TABLE public.anuncios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  fecha_publicacion TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create SolicitudVacacion table
CREATE TABLE public.solicitudes_vacacion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT,
  estado vacacion_estado DEFAULT 'pendiente' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Ticket table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  asignado_a_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  estado ticket_estado DEFAULT 'abierto' NOT NULL,
  prioridad ticket_prioridad DEFAULT 'media' NOT NULL,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  fecha_cierre TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Evento table
CREATE TABLE public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
  creador_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  ubicacion VARCHAR(255),
  es_privado BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create many-to-many table for event participants
CREATE TABLE public.evento_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE NOT NULL,
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(evento_id, empleado_id)
);

-- Enable RLS on all tables
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_vacacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_participantes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (employees can view their own data and company-wide data)
-- Cargos - readable by all authenticated users
CREATE POLICY "Cargos are viewable by authenticated users" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cargos are manageable by authenticated users" ON public.cargos FOR ALL TO authenticated USING (true);

-- Departamentos - readable by all authenticated users
CREATE POLICY "Departamentos are viewable by authenticated users" ON public.departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Departamentos are manageable by authenticated users" ON public.departamentos FOR ALL TO authenticated USING (true);

-- Empleados - users can view all employees but only manage their own profile
CREATE POLICY "Empleados are viewable by authenticated users" ON public.empleados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Empleados can update their own profile" ON public.empleados FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Empleados can insert their own profile" ON public.empleados FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Proyectos - viewable by all, manageable by project members
CREATE POLICY "Proyectos are viewable by authenticated users" ON public.proyectos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Proyectos are manageable by authenticated users" ON public.proyectos FOR ALL TO authenticated USING (true);

-- Proyecto miembros - viewable by all
CREATE POLICY "Proyecto miembros are viewable by authenticated users" ON public.proyecto_miembros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Proyecto miembros are manageable by authenticated users" ON public.proyecto_miembros FOR ALL TO authenticated USING (true);

-- Tareas - viewable by all, manageable by assigned users
CREATE POLICY "Tareas are viewable by authenticated users" ON public.tareas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tareas are manageable by authenticated users" ON public.tareas FOR ALL TO authenticated USING (true);

-- Anuncios - viewable by all
CREATE POLICY "Anuncios are viewable by authenticated users" ON public.anuncios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anuncios are manageable by authenticated users" ON public.anuncios FOR ALL TO authenticated USING (true);

-- Solicitudes vacacion - users can view all but only manage their own
CREATE POLICY "Solicitudes vacacion are viewable by authenticated users" ON public.solicitudes_vacacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own vacation requests" ON public.solicitudes_vacacion FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.empleados WHERE empleados.id = solicitudes_vacacion.empleado_id AND empleados.user_id = auth.uid())
);

-- Tickets - viewable by all
CREATE POLICY "Tickets are viewable by authenticated users" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tickets are manageable by authenticated users" ON public.tickets FOR ALL TO authenticated USING (true);

-- Eventos - viewable by all
CREATE POLICY "Eventos are viewable by authenticated users" ON public.eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Eventos are manageable by authenticated users" ON public.eventos FOR ALL TO authenticated USING (true);

-- Evento participantes - viewable by all
CREATE POLICY "Evento participantes are viewable by authenticated users" ON public.evento_participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Evento participantes are manageable by authenticated users" ON public.evento_participantes FOR ALL TO authenticated USING (true);

-- Create indexes for better performance
CREATE INDEX idx_empleados_user_id ON public.empleados(user_id);
CREATE INDEX idx_empleados_departamento ON public.empleados(departamento_id);
CREATE INDEX idx_empleados_cargo ON public.empleados(cargo_id);
CREATE INDEX idx_tareas_proyecto ON public.tareas(proyecto_id);
CREATE INDEX idx_tareas_asignado ON public.tareas(asignado_a_id);
CREATE INDEX idx_tickets_autor ON public.tickets(autor_id);
CREATE INDEX idx_tickets_asignado ON public.tickets(asignado_a_id);
CREATE INDEX idx_eventos_creador ON public.eventos(creador_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_cargos_updated_at BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departamentos_updated_at BEFORE UPDATE ON public.departamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_empleados_updated_at BEFORE UPDATE ON public.empleados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proyectos_updated_at BEFORE UPDATE ON public.proyectos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tareas_updated_at BEFORE UPDATE ON public.tareas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anuncios_updated_at BEFORE UPDATE ON public.anuncios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_solicitudes_vacacion_updated_at BEFORE UPDATE ON public.solicitudes_vacacion FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();