-- ============================================================
-- 002_experiencias_y_pagos.sql
-- EXPERIENCIAS.CLUB • Catálogo Oficial de Experiencias y Gestión de Pagos / Comprobantes
-- ============================================================

-- ============================================================
-- 1. TABLA: experiencias (Catálogo Oficial de Rutas y Salidas)
-- ============================================================
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
  price_usd            INTEGER DEFAULT 70,
  capacity_per_date    INTEGER NOT NULL DEFAULT 12 CHECK (capacity_per_date >= 1),
  dates                JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL DEFAULT 'publicada'
                       CHECK (status IN ('borrador', 'publicada', 'oculta')),
  public_url           TEXT DEFAULT '',
  cover_image          TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg',
  album_photos         JSONB DEFAULT '[]'::jsonb,
  kicker               TEXT DEFAULT 'EXPEDICIÓN NÁUTICA: VALLE CENTRAL',
  video_url            TEXT DEFAULT '/assets/videos/kayak.mp4',
  video_poster         TEXT DEFAULT '/assets/images/kayak-video.png',
  altitude_meters      INTEGER DEFAULT 850,
  best_season          TEXT DEFAULT 'Todo el año',
  highlights           JSONB DEFAULT '[]'::jsonb,
  included             JSONB DEFAULT '[]'::jsonb,
  not_included         JSONB DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiencias_slug ON public.experiencias(slug);
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS album_photos JSONB DEFAULT '[]'::jsonb;

DROP TRIGGER IF EXISTS experiencias_updated_at ON public.experiencias;
CREATE TRIGGER experiencias_updated_at
  BEFORE UPDATE ON public.experiencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Semilla inaugural de Kayak
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

-- Políticas RLS para experiencias
ALTER TABLE public.experiencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published experiencias" ON public.experiencias;
CREATE POLICY "Public can view published experiencias"
  ON public.experiencias
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'publicada'
    OR EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage experiencias" ON public.experiencias;
CREATE POLICY "Admins can manage experiencias"
  ON public.experiencias
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

REVOKE ALL ON public.experiencias FROM anon, PUBLIC;
GRANT SELECT ON public.experiencias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiencias TO authenticated;

-- ============================================================
-- 2. TABLA: pagos_transferencias (Comprobantes y Gestión de Reservas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pagos_transferencias (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference                TEXT NOT NULL UNIQUE,
  experience_id            TEXT NOT NULL,
  experience_title         TEXT NOT NULL,
  date                     TEXT NOT NULL,
  participants             INTEGER NOT NULL CHECK (participants BETWEEN 1 AND 6),
  amount_ars               INTEGER NOT NULL CHECK (amount_ars >= 0),
  discount_code            TEXT,
  discount_ars             INTEGER DEFAULT 0,
  full_name                TEXT NOT NULL,
  email                    TEXT NOT NULL,
  dni                      TEXT NOT NULL,
  phone                    TEXT NOT NULL,
  socio_id                 UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  receipt_file_name        TEXT NOT NULL,
  receipt_mime_type        TEXT NOT NULL,
  receipt_size_bytes       INTEGER NOT NULL CHECK (receipt_size_bytes > 0),
  receipt_url              TEXT NOT NULL,
  receipt_storage_key      TEXT,
  receipt_storage_provider TEXT NOT NULL DEFAULT 'r2'
                           CHECK (receipt_storage_provider IN ('r2', 'supabase', 'local')),
  status                   TEXT NOT NULL DEFAULT 'pendiente'
                           CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  rejection_reason         TEXT,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at              TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_transferencias_email         ON public.pagos_transferencias(email);
CREATE INDEX IF NOT EXISTS idx_pagos_transferencias_experience    ON public.pagos_transferencias(experience_id, date);
CREATE INDEX IF NOT EXISTS idx_pagos_transferencias_status        ON public.pagos_transferencias(status);
CREATE INDEX IF NOT EXISTS idx_pagos_transferencias_reference     ON public.pagos_transferencias(reference);

DROP TRIGGER IF EXISTS pagos_transferencias_updated_at ON public.pagos_transferencias;
CREATE TRIGGER pagos_transferencias_updated_at
  BEFORE UPDATE ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Normalización de email, nombre y DNI al escribir pagos
CREATE OR REPLACE FUNCTION public.normalize_pago_transferencia_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(TRIM(COALESCE(NEW.email, '')));
  NEW.full_name = TRIM(COALESCE(NEW.full_name, ''));
  NEW.dni = regexp_replace(COALESCE(NEW.dni, ''), '\D', '', 'g');
  NEW.phone = TRIM(COALESCE(NEW.phone, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pagos_transferencias_normalize_before_write ON public.pagos_transferencias;
CREATE TRIGGER pagos_transferencias_normalize_before_write
  BEFORE INSERT OR UPDATE ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.normalize_pago_transferencia_row();

ALTER TABLE public.pagos_transferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de pagos propios autenticados" ON public.pagos_transferencias;
CREATE POLICY "Permitir lectura de pagos propios autenticados"
  ON public.pagos_transferencias
  FOR SELECT
  TO authenticated
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email);

DROP POLICY IF EXISTS "Admins can manage pagos_transferencias" ON public.pagos_transferencias;
CREATE POLICY "Admins can manage pagos_transferencias"
  ON public.pagos_transferencias
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.pagos_transferencias TO anon, authenticated;

-- ============================================================
-- 3. RPCs DE PAGOS Y RESERVAS
-- ============================================================

-- 3.1 Registrar pago por transferencia (consulta public.experiencias y valida cupos)
CREATE OR REPLACE FUNCTION public.submit_experience_transfer(
  p_reference TEXT,
  p_experience_id TEXT,
  p_experience_title TEXT,
  p_date TEXT,
  p_participants INTEGER,
  p_amount_ars INTEGER,
  p_discount_code TEXT DEFAULT NULL,
  p_discount_ars INTEGER DEFAULT 0,
  p_full_name TEXT DEFAULT '',
  p_email TEXT DEFAULT '',
  p_dni TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_receipt_file_name TEXT DEFAULT 'comprobante.jpg',
  p_receipt_mime_type TEXT DEFAULT 'image/jpeg',
  p_receipt_size_bytes INTEGER DEFAULT 1,
  p_receipt_url TEXT DEFAULT '',
  p_receipt_storage_key TEXT DEFAULT NULL,
  p_receipt_storage_provider TEXT DEFAULT 'r2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_dni TEXT := regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g');
  v_socio_id UUID := NULL;
  v_capacity INTEGER := 12;
  v_reserved INTEGER := 0;
  v_inserted public.pagos_transferencias%ROWTYPE;
BEGIN
  IF v_email = '' OR TRIM(COALESCE(p_full_name, '')) = '' OR TRIM(COALESCE(p_receipt_url, '')) = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF auth.uid() IS NULL
     OR LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) <> v_email THEN
    RETURN jsonb_build_object('status', 'unauthorized');
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
    AND status <> 'rechazado';

  IF (v_reserved + p_participants) > v_capacity THEN
    RETURN jsonb_build_object('status', 'no_seats_available', 'available', GREATEST(0, v_capacity - v_reserved));
  END IF;

  SELECT id INTO v_socio_id
  FROM public.socios
  WHERE email = v_email
  LIMIT 1;

  INSERT INTO public.pagos_transferencias (
    reference,
    experience_id,
    experience_title,
    date,
    participants,
    amount_ars,
    discount_code,
    discount_ars,
    full_name,
    email,
    dni,
    phone,
    socio_id,
    receipt_file_name,
    receipt_mime_type,
    receipt_size_bytes,
    receipt_url,
    receipt_storage_key,
    receipt_storage_provider,
    status
  )
  VALUES (
    UPPER(TRIM(p_reference)),
    p_experience_id,
    p_experience_title,
    p_date,
    p_participants,
    p_amount_ars,
    p_discount_code,
    p_discount_ars,
    p_full_name,
    v_email,
    v_dni,
    p_phone,
    v_socio_id,
    p_receipt_file_name,
    p_receipt_mime_type,
    p_receipt_size_bytes,
    p_receipt_url,
    p_receipt_storage_key,
    p_receipt_storage_provider,
    'pendiente'
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_inserted.id,
    'reference', v_inserted.reference,
    'reserved', v_reserved + p_participants,
    'capacity', v_capacity
  );
END;
$$;

-- 3.2 Consultar cupos reservados por fecha de una experiencia
CREATE OR REPLACE FUNCTION public.get_reserved_seats_by_experience(
  p_experience_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', sub.date,
        'reserved_seats', sub.reserved_seats
      )
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT date, SUM(participants)::INTEGER AS reserved_seats
    FROM public.pagos_transferencias
    WHERE experience_id = p_experience_id
      AND status <> 'rechazado'
    GROUP BY date
  ) sub;

  RETURN v_result;
END;
$$;

-- 3.3 Obtener comprobantes y reservas de un socio
CREATE OR REPLACE FUNCTION public.get_member_transfer_submissions(
  p_email TEXT,
  p_registration_token UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_jwt_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_auth_uid UUID := auth.uid();
  v_socio public.socios%ROWTYPE;
  v_authorized BOOLEAN := false;
  v_items JSONB;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

  IF v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN
    v_authorized := true;
  ELSE
    SELECT * INTO v_socio
    FROM public.socios
    WHERE email = v_email
    LIMIT 1;

    IF FOUND THEN
      IF v_auth_uid IS NOT NULL AND v_socio.auth_user_id = v_auth_uid THEN
        v_authorized := true;
      ELSIF v_socio.google_linked = false
            AND p_registration_token IS NOT NULL
            AND v_socio.registration_token = p_registration_token THEN
        v_authorized := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.submitted_at DESC), '[]'::jsonb)
  INTO v_items
  FROM public.pagos_transferencias t
  WHERE t.email = v_email;

  RETURN jsonb_build_object('status', 'ok', 'submissions', v_items);
END;
$$;

-- 3.4 Listar envíos de comprobantes para prestadores
CREATE OR REPLACE FUNCTION public.list_provider_transfer_submissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.submitted_at DESC), '[]'::jsonb)
  INTO v_items
  FROM public.pagos_transferencias t;

  RETURN jsonb_build_object('status', 'ok', 'submissions', v_items);
END;
$$;

-- 3.5 Aprobar o rechazar comprobante (y ascender socio emergente a activo)
CREATE OR REPLACE FUNCTION public.review_transfer_submission(
  p_submission_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated public.pagos_transferencias%ROWTYPE;
BEGIN
  IF p_status NOT IN ('aprobado', 'rechazado') THEN
    RETURN jsonb_build_object('status', 'invalid_status');
  END IF;

  UPDATE public.pagos_transferencias
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rechazado' THEN NULLIF(TRIM(COALESCE(p_rejection_reason, '')), '') ELSE NULL END,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_submission_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_status = 'aprobado' THEN
    UPDATE public.socios
    SET membership_tier = 'activo',
        updated_at = now()
    WHERE (id = v_updated.socio_id OR email = v_updated.email)
      AND membership_tier = 'emergente';
  END IF;

  RETURN jsonb_build_object('status', 'updated', 'submission', to_jsonb(v_updated));
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_experience_transfer(
  TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reserved_seats_by_experience(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_transfer_submissions(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_provider_transfer_submissions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_transfer_submission(UUID, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- 4. BUCKET DE STORAGE ('comprobantes') Y POLÍTICAS
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'comprobantes',
      'comprobantes',
      false,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudo configurar storage.buckets automáticamente (%).', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "Permitir subir comprobantes" ON storage.objects;
    CREATE POLICY "Permitir subir comprobantes"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'comprobantes');

    DROP POLICY IF EXISTS "Permitir ver comprobantes" ON storage.objects;
    CREATE POLICY "Permitir ver comprobantes"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'comprobantes'
        AND (
          EXISTS (
            SELECT 1 FROM public.pagos_transferencias
            WHERE receipt_storage_key = storage.objects.name
              AND (
                LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
                OR socio_id IN (SELECT id FROM public.socios WHERE auth_user_id = auth.uid())
              )
          )
          OR EXISTS (
            SELECT 1 FROM public.admin_access
            WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
              AND active = true
          )
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudieron crear políticas en storage.objects (%).', SQLERRM;
END;
$$;

