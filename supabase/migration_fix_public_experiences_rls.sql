-- ==============================================================================
-- [SUPERSEDED] This migration is incorporated in supabase/schema.sql and
-- supabase/migration_consolidated_patches.sql. Retained for historical reference.
-- ==============================================================================

-- 1. Grant table select privileges to 'anon' role
-- Resolves PostgreSQL error 42501: "permission denied for table administradores"
GRANT SELECT ON public.administradores TO anon;
GRANT SELECT ON public.experiencias TO anon;

-- 2. Ensure public read policy for published experiences is active
DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas anon" ON public.experiencias;
CREATE POLICY "Lectura publica de experiencias publicadas anon"
  ON public.experiencias
  FOR SELECT
  TO anon
  USING (status = 'publicada');

