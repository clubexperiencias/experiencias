-- ============================================================
-- 007_experience_public_url.sql
-- EXPERIENCIAS.CLUB • Campo de URL pública oficial para experiencias
-- ============================================================

ALTER TABLE public.experiencias_club
ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';

-- Actualización de la experiencia inaugural
UPDATE public.experiencias_club
SET public_url = 'https://experiencias.club/experiencias/kayak'
WHERE slug = 'kayak' AND (public_url IS NULL OR public_url = '');
