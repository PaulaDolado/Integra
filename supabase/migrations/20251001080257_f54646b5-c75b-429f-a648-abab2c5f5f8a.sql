-- Create fichajes table for time tracking
CREATE TABLE public.fichajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.fichajes ENABLE ROW LEVEL SECURITY;

-- Create policies for fichajes
CREATE POLICY "Users can view their own fichajes" 
ON public.fichajes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM empleados 
  WHERE empleados.id = fichajes.empleado_id 
  AND empleados.user_id = auth.uid()
));

CREATE POLICY "Users can create their own fichajes" 
ON public.fichajes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM empleados 
  WHERE empleados.id = fichajes.empleado_id 
  AND empleados.user_id = auth.uid()
));

-- Add index for better performance
CREATE INDEX idx_fichajes_empleado_id ON public.fichajes(empleado_id);
CREATE INDEX idx_fichajes_fecha_hora ON public.fichajes(fecha_hora DESC);