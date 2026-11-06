-- ==============================================================================
-- EXPERIENCIAS.CLUB - MIGRACIÓN ARQUITECTÓNICA UNIFICADA
-- Consolida los 3 pilares del Club:
--   1. waitlist -> public.socios (membership_tier = 'waitlist')
--   2. postulaciones_prestadores -> public.provider_access (status = 'pendiente')
--   3. propuestas_experiencias -> public.experiencias (status = 'pendiente')
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. UNIFICACIÓN DE SOCIOS & WAITLIST
-- ==============================================================================

-- 1.1 Ajustar columnas en public.socios para admitir prospectos sin datos completos
ALTER TABLE public.socios ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.socios ALTER COLUMN full_name SET DEFAULT '';
ALTER TABLE public.socios ALTER COLUMN dni DROP NOT NULL;
ALTER TABLE public.socios ALTER COLUMN dni SET DEFAULT '';
ALTER TABLE public.socios ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.socios ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE public.socios ALTER COLUMN position DROP NOT NULL;

-- 1.2 Actualizar constraint de membresía para incluir 'waitlist'
ALTER TABLE public.socios DROP CONSTRAINT IF EXISTS socios_membership_tier_check;
ALTER TABLE public.socios ADD CONSTRAINT socios_membership_tier_check
  CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador'));

-- 1.3 Agregar flag de conversión en socios
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS converted BOOLEAN NOT NULL DEFAULT false;

-- 1.4 Migrar registros de waitlist a socios
INSERT INTO public.socios (
  email,
  membership_tier,
  converted,
  google_linked,
  full_name,
  dni,
  phone,
  position,
  created_at,
  updated_at
)
SELECT
  LOWER(TRIM(w.email)),
  'waitlist',
  COALESCE(w.converted, false),
  COALESCE(w.google_linked, false),
  '',
  '',
  '',
  NULL,
  w.created_at,
  w.created_at
FROM public.waitlist w
ON CONFLICT (email) DO UPDATE
SET
  converted = public.socios.converted OR EXCLUDED.converted,
  google_linked = public.socios.google_linked OR EXCLUDED.google_linked;

-- ==============================================================================
-- 2. UNIFICACIÓN DE PRESTADORES & POSTULACIONES
-- ==============================================================================

-- 2.1 Ampliar status de provider_access
ALTER TABLE public.provider_access DROP CONSTRAINT IF EXISTS provider_access_status_check;
ALTER TABLE public.provider_access ADD CONSTRAINT provider_access_status_check
  CHECK (status IN ('aprobado', 'pendiente', 'rechazado', 'dado_de_baja'));

-- 2.2 Agregar columnas de postulación a provider_access
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Catamarca';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2.3 Migrar registros de postulaciones_prestadores a provider_access
INSERT INTO public.provider_access (
  email,
  name,
  phone,
  category,
  region,
  website,
  description,
  notes,
  status,
  active,
  created_at,
  updated_at
)
SELECT
  LOWER(TRIM(p.email)),
  COALESCE(p.full_name, ''),
  COALESCE(p.phone, ''),
  COALESCE(p.category, ''),
  COALESCE(p.region, 'Catamarca'),
  COALESCE(p.website, ''),
  COALESCE(p.description, ''),
  p.notes,
  COALESCE(p.status, 'pendiente'),
  (COALESCE(p.status, 'pendiente') = 'aprobado'),
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM public.postulaciones_prestadores p
ON CONFLICT (email) DO UPDATE
SET
  category = COALESCE(NULLIF(public.provider_access.category, ''), EXCLUDED.category),
  region = COALESCE(NULLIF(public.provider_access.region, ''), EXCLUDED.region),
  description = COALESCE(NULLIF(public.provider_access.description, ''), EXCLUDED.description),
  notes = COALESCE(public.provider_access.notes, EXCLUDED.notes);

-- ==============================================================================
-- 3. UNIFICACIÓN DE EXPERIENCIAS & PROPUESTAS
-- ==============================================================================

-- 3.1 Ampliar status de experiencias
ALTER TABLE public.experiencias DROP CONSTRAINT IF EXISTS experiencias_status_check;
ALTER TABLE public.experiencias ADD CONSTRAINT experiencias_status_check
  CHECK (status IN ('borrador', 'pendiente', 'publicada', 'oculta', 'rechazada'));

-- 3.2 Flexibilizar constraint de dificultad para admitir textos descriptivos del formulario
ALTER TABLE public.experiencias DROP CONSTRAINT IF EXISTS experiencias_difficulty_check;
ALTER TABLE public.experiencias ADD CONSTRAINT experiencias_difficulty_check
  CHECK (
    difficulty IN ('Baja', 'Moderada', 'Exigente', 'Alta Montaña')
    OR difficulty ILIKE 'baja%'
    OR difficulty ILIKE 'moderada%'
    OR difficulty ILIKE 'exigente%'
    OR difficulty ILIKE 'alta%'
  );

-- 3.3 Agregar columnas de propuesta a experiencias
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_agency TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_image_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_video_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS participant_requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3.4 Migrar registros de propuestas_experiencias a experiencias
INSERT INTO public.experiencias (
  id,
  slug,
  title,
  kicker,
  tagline,
  region,
  difficulty,
  duration_label,
  altitude_meters,
  price_ars,
  price_usd,
  capacity_per_date,
  best_season,
  itinerary,
  meeting_point,
  meeting_point_url,
  cover_image,
  cover_image_name,
  video_url,
  album_photos,
  provider_name,
  provider_email,
  provider_phone,
  provider_cbu_alias,
  provider_cuit_dni,
  provider_bank_name,
  provider_agency,
  participant_requirements,
  notes,
  status,
  reviewed_at,
  created_at,
  updated_at
)
SELECT
  p.id,
  COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(p.title, '[^a-zA-Z0-9]+', '-', 'g')), ''),
    'exp-' || p.id
  ) || CASE
    WHEN EXISTS (
      SELECT 1 FROM public.experiencias e
      WHERE e.id <> p.id
        AND e.slug = COALESCE(NULLIF(LOWER(REGEXP_REPLACE(p.title, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'exp-' || p.id)
    ) THEN '-' || SUBSTRING(p.id::TEXT FROM 1 FOR 8)
    ELSE ''
  END,
  p.title,
  COALESCE(p.kicker, 'EXPERIENCIA'),
  COALESCE(p.subheading, ''),
  COALESCE(p.region, 'Valle Central y Ambato'),
  CASE
    WHEN p.difficulty ILIKE 'alta%' THEN 'Alta Montaña'
    WHEN p.difficulty ILIKE 'exigente%' THEN 'Exigente'
    WHEN p.difficulty ILIKE 'baja%' THEN 'Baja'
    ELSE 'Moderada'
  END,
  COALESCE(p.duration, '4 horas'),
  COALESCE(NULLIF(REGEXP_REPLACE(p.altitude, '[^0-9]', '', 'g'), '')::INTEGER, 850),
  GREATEST(0, COALESCE(p.price_ars, 0)),
  p.price_usd,
  GREATEST(1, COALESCE(NULLIF(p.capacity, 0), 12)),
  COALESCE(p.season, 'Todo el año'),
  COALESCE(p.itinerary, ''),
  COALESCE(p.meeting_point, ''),
  COALESCE(p.meeting_point_url, ''),
  COALESCE(p.cover_image, '/assets/images/kayak-club-de-experiencias.jpg'),
  p.cover_image_name,
  p.cover_video_url,
  COALESCE(p.album_photos, '[]'::jsonb),
  p.provider_name,
  p.provider_email,
  p.provider_phone,
  p.provider_cbu_alias,
  p.provider_cuit_dni,
  p.provider_bank_name,
  p.provider_agency,
  p.participant_requirements,
  p.notes,
  CASE
    WHEN p.status = 'aprobada' THEN 'publicada'
    WHEN p.status = 'rechazada' THEN 'rechazada'
    ELSE 'pendiente'
  END,
  p.reviewed_at,
  p.created_at,
  p.updated_at
FROM public.propuestas_experiencias p
ON CONFLICT (id) DO UPDATE
SET
  reviewed_at = EXCLUDED.reviewed_at,
  provider_agency = EXCLUDED.provider_agency;

-- ==============================================================================
-- 4. ACTUALIZACIÓN DE VISTAS Y RPCS
-- ==============================================================================

-- 4.1 Vista estadisticas_socios sobre public.socios
DROP VIEW IF EXISTS public.waitlist_stats CASCADE;
DROP VIEW IF EXISTS public.estadisticas_socios CASCADE;
CREATE VIEW public.estadisticas_socios AS
SELECT
  COUNT(*)                                                                 AS total_members,
  COALESCE(MAX(position), 100)                                             AS max_position,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier <> 'waitlist') AS total_socios,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'waitlist')  AS total_waitlist,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'fundador')   AS total_fundadores,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'activo')     AS total_activos,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'emergente')  AS total_emergentes,
  (SELECT COALESCE(MAX(position), 99) FROM public.socios)                  AS last_position
FROM public.socios;

GRANT SELECT ON public.estadisticas_socios TO anon, authenticated;

-- 4.2 RPC record_waitlist_email sobre public.socios
CREATE OR REPLACE FUNCTION public.record_waitlist_email(
  p_email TEXT,
  p_google_linked BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  INSERT INTO public.socios (
    email,
    membership_tier,
    converted,
    google_linked,
    full_name,
    dni,
    phone,
    position
  )
  VALUES (
    v_email,
    'waitlist',
    false,
    COALESCE(p_google_linked, false),
    '',
    '',
    '',
    NULL
  )
  ON CONFLICT (email) DO UPDATE
  SET google_linked = public.socios.google_linked OR EXCLUDED.google_linked;

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_waitlist_email TO anon, authenticated;

-- 4.3 RPC get_admin_socios_roster unificado
CREATE OR REPLACE FUNCTION public.get_admin_socios_roster()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_socios JSONB;
  v_waitlist JSONB;
BEGIN
  -- Caller authorization: Only active admins
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_access
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores activos pueden acceder a la nómina';
  END IF;

  -- Socios oficiales:
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'type', 'socio',
        'email', s.email,
        'fullName', s.full_name,
        'dni', s.dni,
        'phone', s.phone,
        'position', s.position,
        'membershipTier', s.membership_tier,
        'googleLinked', (COALESCE(s.google_linked, false) OR (s.auth_user_id IS NOT NULL)),
        'converted', (
          COALESCE(s.converted, false) OR EXISTS (
            SELECT 1 FROM public.pagos_transferencias p
            WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
          )
        ),
        'paymentsCount', (
          SELECT COUNT(*)::INTEGER FROM public.pagos_transferencias p
          WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
        ),
        'experiencesWishlist', COALESCE(s.experiences_wishlist, '[]'::jsonb),
        'experiencesOther', s.experiences_other,
        'createdAt', s.created_at
      )
      ORDER BY s.position ASC NULLS LAST, s.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_socios
  FROM public.socios s
  WHERE s.membership_tier <> 'waitlist';

  -- Prospectos de lista de espera (directamente desde socios):
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'type', 'waitlist',
        'email', s.email,
        'fullName', COALESCE(
          NULLIF(TRIM(s.full_name), ''),
          NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
          NULLIF(TRIM(u.raw_user_meta_data ->> 'name'), ''),
          NULL
        ),
        'dni', NULLIF(TRIM(s.dni), ''),
        'phone', NULLIF(TRIM(s.phone), ''),
        'position', NULL,
        'membershipTier', 'waitlist',
        'googleLinked', (COALESCE(s.google_linked, false) OR (u.id IS NOT NULL) OR (s.auth_user_id IS NOT NULL)),
        'converted', (
          COALESCE(s.converted, false) OR EXISTS (
            SELECT 1 FROM public.pagos_transferencias p
            WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
          )
        ),
        'paymentsCount', (
          SELECT COUNT(*)::INTEGER FROM public.pagos_transferencias p
          WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
        ),
        'experiencesWishlist', COALESCE(s.experiences_wishlist, '[]'::jsonb),
        'experiencesOther', s.experiences_other,
        'createdAt', s.created_at
      )
      ORDER BY s.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_waitlist
  FROM public.socios s
  LEFT JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(s.email))
  WHERE s.membership_tier = 'waitlist';

  RETURN jsonb_build_object(
    'socios', v_socios,
    'waitlist', v_waitlist,
    'total_socios', jsonb_array_length(v_socios),
    'total_waitlist', jsonb_array_length(v_waitlist)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_socios_roster TO authenticated;

-- ==============================================================================
-- 5. POLÍTICAS RLS ADICIONALES
-- ==============================================================================

-- Permitir a usuarios anónimos y autenticados postularse como prestador directamente en provider_access
DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.provider_access;
CREATE POLICY "Permitir postularse como prestador"
  ON public.provider_access
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendiente'
    AND active = false
  );

COMMIT;

