-- Unifica la ubicación de la experiencia de Kayak en Dique El Jumeal.
UPDATE public.experiencias_club
SET
  title = 'Travesía en Kayak & Sunset en el Dique El Jumeal',
  description = 'Remada guiada en kayak en las aguas calmas del Dique El Jumeal, con pausa al atardecer y brindis de productos catamarqueños.',
  updated_at = now()
WHERE id = 'exp-kayak';
