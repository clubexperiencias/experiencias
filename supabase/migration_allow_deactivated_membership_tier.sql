-- ==============================================================================
-- EXPERIENCIAS.CLUB - ACTUALIZACIÓN DE CONSTRAINT PARA MEMBERSHIP_TIER EN SOCIOS
-- Permite el estado 'dado_de_baja' en public.socios (toggleMemberBajaStatus)
-- ==============================================================================

BEGIN;

ALTER TABLE public.socios DROP CONSTRAINT IF EXISTS socios_membership_tier_check;
ALTER TABLE public.socios ADD CONSTRAINT socios_membership_tier_check
  CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador', 'dado_de_baja'));

COMMIT;

