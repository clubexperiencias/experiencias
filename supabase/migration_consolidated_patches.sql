-- ==============================================================================
-- EXPERIENCIAS.CLUB - CONSOLIDATED DATABASE PATCHES
-- Combines all recent incremental fixes into one clean, idempotent script:
--   1. Membership Tier: Allow 'dado_de_baja' in public.socios
--   2. Provider Application: Grants & public submission policy on public.prestadores
--   3. Public Experiences: Grants on administradores/experiencias & public RLS policy
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. MEMBERSHIP TIER (allow deactivated members)
-- ==============================================================================
ALTER TABLE public.socios DROP CONSTRAINT IF EXISTS socios_membership_tier_check;
ALTER TABLE public.socios ADD CONSTRAINT socios_membership_tier_check
  CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador', 'dado_de_baja'));

-- ==============================================================================
-- 2. PROVIDER APPLICATIONS (public proposal submission)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.prestadores TO anon, authenticated;

DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.prestadores;
CREATE POLICY "Permitir postularse como prestador"
  ON public.prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendiente'
    AND active = false
    AND (
      (auth.role() = 'authenticated' OR (auth.jwt() ->> 'email') IS NOT NULL)
      OR (
        (slug IS NULL OR slug = '')
        AND (cbu_alias IS NULL OR cbu_alias = '')
        AND (cuit_dni IS NULL OR cuit_dni = '')
        AND (bank_name IS NULL OR bank_name = '')
        AND (account_holder IS NULL OR account_holder = '')
      )
    )
  );

-- ==============================================================================
-- 3. PUBLIC EXPERIENCES CATALOG (anonymous access without 42501 error)
-- ==============================================================================
GRANT SELECT ON public.administradores TO anon;
GRANT SELECT ON public.experiencias TO anon;

DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas anon" ON public.experiencias;
CREATE POLICY "Lectura publica de experiencias publicadas anon"
  ON public.experiencias
  FOR SELECT
  TO anon
  USING (status = 'publicada');

-- ==============================================================================
-- 4. RECONCILE MISSING PROVIDER SLUGS ON EXPERIENCES
-- ==============================================================================
UPDATE public.experiencias e
SET provider_slug = p.slug
FROM public.prestadores p
WHERE LOWER(e.provider_email) = LOWER(p.email)
  AND (e.provider_slug IS NULL OR e.provider_slug = '')
  AND p.slug IS NOT NULL AND p.slug <> '';

COMMIT;

