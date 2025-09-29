-- Fix security issue: Restrict employee data access to own profile only
-- Drop the overly permissive policy that allows all authenticated users to view all employee data
DROP POLICY IF EXISTS "Empleados are viewable by authenticated users" ON public.empleados;

-- Create a new policy that only allows users to view their own employee profile
CREATE POLICY "Users can only view their own employee profile" 
ON public.empleados 
FOR SELECT 
USING (user_id = auth.uid());

-- Also fix the vacation requests table to only allow users to see their own requests
-- Drop the overly broad policy
DROP POLICY IF EXISTS "Solicitudes vacacion are viewable by authenticated users" ON public.solicitudes_vacacion;

-- Create a policy that only allows users to see their own vacation requests
CREATE POLICY "Users can only view their own vacation requests" 
ON public.solicitudes_vacacion 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM public.empleados 
  WHERE empleados.id = solicitudes_vacacion.empleado_id 
    AND empleados.user_id = auth.uid()
));