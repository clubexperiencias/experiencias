-- ============================================================
-- MIGRACIÓN 009: Renombrar tabla a 'experiencias' y soportar edición de rutas desde portal Admin
-- ============================================================

-- 1. Renombrar tabla experiencias_club a experiencias de forma segura e idempotente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'experiencias_club'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'experiencias'
  ) THEN
    ALTER TABLE public.experiencias_club RENAME TO experiencias;
  END IF;
END;
$$;

-- 2. Si no existía ninguna de las dos tablas, crear public.experiencias
CREATE TABLE IF NOT EXISTS public.experiencias (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  short_title          TEXT,
  tagline              TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  region               TEXT NOT NULL DEFAULT 'Valle Central y Ambato',
  meeting_point        TEXT NOT NULL DEFAULT '',
  difficulty           TEXT NOT NULL DEFAULT 'Baja'
                       CHECK (difficulty IN ('Baja', 'Moderada', 'Exigente', 'Alta Montaña')),
  duration_label       TEXT NOT NULL DEFAULT '4 horas',
  price_ars            INTEGER NOT NULL DEFAULT 65000 CHECK (price_ars >= 0),
  capacity_per_date    INTEGER NOT NULL DEFAULT 12 CHECK (capacity_per_date >= 1),
  dates                JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL DEFAULT 'publicada'
                       CHECK (status IN ('borrador', 'publicada', 'oculta')),
  public_url           TEXT DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Asegurar todas las columnas en public.experiencias (idempotente)
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS kicker TEXT DEFAULT 'EXPEDICIÓN NÁUTICA: VALLE CENTRAL';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '/assets/videos/kayak.mp4';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS video_poster TEXT DEFAULT '/assets/images/kayak-video.png';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS altitude_meters INTEGER DEFAULT 850;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS best_season TEXT DEFAULT 'Todo el año';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS price_usd INTEGER DEFAULT 70;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS included JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS not_included JSONB DEFAULT '[]'::jsonb;

-- Ajustar constraint de status si era restrictivo
ALTER TABLE public.experiencias DROP CONSTRAINT IF EXISTS experiencias_status_check;
ALTER TABLE public.experiencias DROP CONSTRAINT IF EXISTS experiencias_club_status_check;
ALTER TABLE public.experiencias ADD CONSTRAINT experiencias_status_check CHECK (status IN ('borrador', 'publicada', 'oculta'));

-- 4. Índices
DROP INDEX IF EXISTS idx_experiencias_club_slug;
CREATE INDEX IF NOT EXISTS idx_experiencias_slug ON public.experiencias(slug);

-- 5. Trigger updated_at
DROP TRIGGER IF EXISTS experiencias_club_updated_at ON public.experiencias;
DROP TRIGGER IF EXISTS experiencias_updated_at ON public.experiencias;
CREATE TRIGGER experiencias_updated_at
  BEFORE UPDATE ON public.experiencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Semilla inaugural de Kayak actualizada
INSERT INTO public.experiencias (
  id,
  slug,
  title,
  short_title,
  tagline,
  description,
  region,
  meeting_point,
  difficulty,
  duration_label,
  price_ars,
  price_usd,
  capacity_per_date,
  dates,
  status,
  public_url,
  cover_image,
  kicker,
  video_url,
  video_poster,
  altitude_meters,
  best_season
)
VALUES (
  'exp-kayak',
  'kayak',
  'Travesía en Kayak & Sunset en el Dique El Jumeal',
  'Travesía en Kayak',
  'Remada guiada al atardecer con brindis de productos catamarqueños.',
  'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y coronamos la jornada con un brindis y picada de productos artesanales catamarqueños.',
  'Valle Central y Ambato',
  'Club Náutico Dique El Jumeal',
  'Baja',
  '4 Horas (Media Jornada)',
  65000,
  70,
  12,
  jsonb_build_array(
    to_char((CURRENT_DATE + INTERVAL '9 days'), 'YYYY-MM-DD'),
    to_char((CURRENT_DATE + INTERVAL '16 days'), 'YYYY-MM-DD'),
    to_char((CURRENT_DATE + INTERVAL '23 days'), 'YYYY-MM-DD')
  ),
  'publicada',
  'https://experiencias.club/experiencias/kayak',
  '/assets/images/kayak-club-de-experiencias.jpg',
  'EXPEDICIÓN NÁUTICA: VALLE CENTRAL',
  '/assets/videos/kayak.mp4',
  '/assets/images/kayak-video.png',
  850,
  'Todo el año'
)
ON CONFLICT (id) DO UPDATE SET
  public_url = EXCLUDED.public_url,
  updated_at = now();

-- 7. Políticas RLS
ALTER TABLE public.experiencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de experiencias_club" ON public.experiencias;
DROP POLICY IF EXISTS "Permitir crear y editar experiencias_club" ON public.experiencias;
DROP POLICY IF EXISTS "Permitir lectura publica de experiencias" ON public.experiencias;
DROP POLICY IF EXISTS "Permitir crear y editar experiencias" ON public.experiencias;

CREATE POLICY "Permitir lectura publica de experiencias"
  ON public.experiencias
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir crear y editar experiencias"
  ON public.experiencias
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiencias TO anon, authenticated;

-- 8. Actualizar RPC submit_experience_transfer para que consulte public.experiencias
CREATE OR REPLACE FUNCTION public.submit_experience_transfer(
  p_socio_id           TEXT,
  p_email              TEXT,
  p_full_name          TEXT,
  p_experience_id      TEXT,
  p_experience_title   TEXT,
  p_amount_ars         INTEGER,
  p_amount_usd         INTEGER,
  p_date               TEXT,
  p_participants       INTEGER,
  p_reference          TEXT,
  p_receipt_url        TEXT,
  p_receipt_path       TEXT,
  p_receipt_file_name  TEXT,
  p_receipt_mime_type  TEXT,
  p_receipt_file_size  INTEGER,
  p_payer_notes        TEXT,
  p_discount_code      TEXT,
  p_discount_ars       INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_reserved INTEGER;
  v_new_id   UUID;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' OR
     p_full_name IS NULL OR trim(p_full_name) = '' OR
     p_experience_id IS NULL OR trim(p_experience_id) = '' OR
     p_reference IS NULL OR trim(p_reference) = '' OR
     p_receipt_url IS NULL OR trim(p_receipt_url) = '' OR
     p_date IS NULL OR trim(p_date) = '' OR
     p_participants IS NULL OR p_participants < 1 THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT capacity_per_date INTO v_capacity
  FROM public.experiencias
  WHERE id = p_experience_id
  LIMIT 1;

  IF v_capacity IS NULL THEN
    v_capacity := 12;
  END IF;

  SELECT COALESCE(SUM(participants), 0) INTO v_reserved
  FROM public.pagos_transferencias
  WHERE experience_id = p_experience_id
    AND date = p_date
    AND status != 'rechazado';

  IF (v_reserved + p_participants) > v_capacity THEN
    RETURN jsonb_build_object(
      'status', 'no_capacity',
      'capacity', v_capacity,
      'reserved', v_reserved,
      'available', GREATEST(0, v_capacity - v_reserved)
    );
  END IF;

  INSERT INTO public.pagos_transferencias (
    socio_id,
    email,
    full_name,
    experience_id,
    experience_title,
    amount_ars,
    amount_usd,
    date,
    participants,
    reference,
    receipt_url,
    receipt_path,
    receipt_file_name,
    receipt_mime_type,
    receipt_file_size,
    payer_notes,
    discount_code,
    discount_ars,
    status
  )
  VALUES (
    p_socio_id,
    p_email,
    p_full_name,
    p_experience_id,
    p_experience_title,
    p_amount_ars,
    COALESCE(p_amount_usd, 0),
    p_date,
    p_participants,
    p_reference,
    p_receipt_url,
    p_receipt_path,
    p_receipt_file_name,
    p_receipt_mime_type,
    p_receipt_file_size,
    p_payer_notes,
    p_discount_code,
    COALESCE(p_discount_ars, 0),
    'pendiente'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'payment_id', v_new_id,
    'reserved', v_reserved + p_participants,
    'capacity', v_capacity
  );
END;
$$;

