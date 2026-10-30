-- Imagen pública y experiencia inicial del catálogo.
ALTER TABLE public.experiencias_club
  ADD COLUMN IF NOT EXISTS cover_image TEXT NOT NULL
  DEFAULT '/assets/images/kayak-club-de-experiencias.jpg';

UPDATE public.experiencias_club
SET
  cover_image = '/assets/images/kayak-club-de-experiencias.jpg',
  updated_at = now()
WHERE id = 'exp-kayak';
