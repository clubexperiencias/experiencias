-- ==============================================================================
-- EXPERIENCIAS.CLUB - MIGRACIÓN ARQUITECTÓNICA UNIFICADA
-- Consolida los 3 pilares del Club:
--   1. waitlist -> public.socios (membership_tier = 'waitlist')
--   2. postulaciones_prestadores -> public.provider_access (status = 'pendiente')
--   3. propuestas_experiencias -> public.experiencias (status = 'pendiente')
--
-- ORDEN OBLIGATORIO DE ACTUALIZACIÓN EN BASES DE DATOS EXISTENTES:
-- 1. migration_unify_tables.sql (ESTE SCRIPT):
--    DEBE ejecutarse PRIMERO mientras las tablas heredadas (waitlist,
--    postulaciones_prestadores, propuestas_experiencias) y las columnas legacy
--    (google_linked, converted en socios) existen con sus datos intactos.
-- 2. schema.sql:
--    Aplica el esquema canónico e índices completos.
-- 3. migration_rename_to_spanish.sql:
--    Renombra tablas y columnas a español y realiza la limpieza final de columnas
--    obsoletas.
-- ==============================================================================

BEGIN;

-- Asegurar extensión unaccent para derivación de slugs canónicos
CREATE EXTENSION IF NOT EXISTS "unaccent";

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

-- 1.3 Asegurar columnas legacy en socios para recibir datos de waitlist
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS converted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;

-- 1.4 Validar existencia de public.waitlist, forzar el orden de migración e insertar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waitlist'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'socios'
    ) AND EXISTS (
      SELECT 1 FROM public.socios WHERE membership_tier = 'waitlist'
    ) THEN
      RAISE NOTICE 'Aviso: public.waitlist no existe pero public.socios ya cuenta con registros de waitlist migrados.';
    ELSE
      RAISE EXCEPTION 'ERROR DE ORDEN DE ACTUALIZACIÓN: public.waitlist no existe y no hay registros en public.socios. migration_unify_tables.sql DEBE ejecutarse ANTES de schema.sql o migration_rename_to_spanish.sql para no perder datos históricos.';
    END IF;
  ELSE
    -- Migrar registros de waitlist a socios mientras ambas tablas y google_linked existen
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
      BOOL_OR(COALESCE(w.converted, false)),
      BOOL_OR(COALESCE(w.google_linked, false)),
      '',
      '',
      '',
      NULL,
      MIN(w.created_at),
      MIN(w.created_at)
    FROM public.waitlist w
    WHERE w.email IS NOT NULL AND TRIM(w.email) <> ''
    GROUP BY LOWER(TRIM(w.email))
    ON CONFLICT (email) DO UPDATE
    SET
      converted = public.socios.converted OR EXCLUDED.converted,
      google_linked = public.socios.google_linked OR EXCLUDED.google_linked,
      created_at = LEAST(public.socios.created_at, EXCLUDED.created_at);
  END IF;
END $$;

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
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS kicker TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS best_season TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS itinerary TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_agency TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_image_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_video_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS participant_requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3.4 Asegurar que todo provider_email referencie una fila existente en prestadores/provider_access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prestadores'
  ) THEN
    INSERT INTO public.prestadores (
      email,
      name,
      agency,
      phone,
      cbu_alias,
      cuit_dni,
      bank_name,
      active,
      status
    )
    SELECT DISTINCT ON (LOWER(TRIM(p.provider_email)))
      LOWER(TRIM(p.provider_email)),
      COALESCE(NULLIF(TRIM(p.provider_name), ''), 'Prestador'),
      COALESCE(TRIM(p.provider_agency), ''),
      COALESCE(TRIM(p.provider_phone), ''),
      COALESCE(TRIM(p.provider_cbu_alias), ''),
      COALESCE(TRIM(p.provider_cuit_dni), ''),
      COALESCE(TRIM(p.provider_bank_name), ''),
      false,
      'pendiente'
    FROM public.propuestas_experiencias p
    WHERE p.provider_email IS NOT NULL AND TRIM(p.provider_email) <> ''
    ON CONFLICT (email) DO UPDATE
    SET
      name = CASE WHEN public.prestadores.name = '' OR public.prestadores.name = 'Prestador' THEN EXCLUDED.name ELSE public.prestadores.name END,
      agency = CASE WHEN public.prestadores.agency = '' THEN EXCLUDED.agency ELSE public.prestadores.agency END,
      phone = CASE WHEN public.prestadores.phone = '' THEN EXCLUDED.phone ELSE public.prestadores.phone END;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provider_access'
  ) THEN
    INSERT INTO public.provider_access (
      email,
      name,
      phone,
      active,
      status
    )
    SELECT DISTINCT ON (LOWER(TRIM(p.provider_email)))
      LOWER(TRIM(p.provider_email)),
      COALESCE(NULLIF(TRIM(p.provider_name), ''), 'Prestador'),
      COALESCE(TRIM(p.provider_phone), ''),
      false,
      'pendiente'
    FROM public.propuestas_experiencias p
    WHERE p.provider_email IS NOT NULL AND TRIM(p.provider_email) <> ''
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- 3.5 Reconciliar propuestas aprobadas con experiencias existentes en el catálogo oficial (exp-<generatedSlug>)
UPDATE public.experiencias e
SET
  provider_agency = COALESCE(NULLIF(e.provider_agency, ''), p.provider_agency, ''),
  participant_requirements = COALESCE(NULLIF(e.participant_requirements, ''), p.participant_requirements, ''),
  notes = COALESCE(e.notes, p.notes),
  reviewed_at = COALESCE(e.reviewed_at, p.reviewed_at, now()),
  cover_image_name = COALESCE(e.cover_image_name, p.cover_image_name),
  video_url = COALESCE(e.video_url, p.cover_video_url),
  updated_at = GREATEST(e.updated_at, COALESCE(p.updated_at, p.created_at, e.updated_at))
FROM public.propuestas_experiencias p
WHERE p.status = 'aprobada'
  AND (
    e.id = p.id::TEXT
    OR e.id = 'exp-' || p.id::TEXT
    OR (
      p.id::TEXT = 'req-sunset-las-pirquitas'
      AND (
        e.id IN ('exp-sunset-las-pirquitas', 'exp-travesia-en-kayak-nocturna-luna-llena-en-el-jumeal')
        OR e.slug = 'sunset-las-pirquitas'
      )
    )
    OR (
      (
        LOWER(TRIM(unaccent(e.title))) =
        LOWER(TRIM(unaccent(p.title)))
        OR (
          p.provider_email IS NOT NULL AND TRIM(p.provider_email) <> ''
          AND LOWER(TRIM(e.provider_email)) = LOWER(TRIM(p.provider_email))
        )
      )
      AND (
        e.slug = LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g')))
        OR e.slug ~ ('^' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
        OR e.id = 'exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g')))
        OR e.id ~ ('^exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
      )
    )
  );

-- 3.6 Migrar registros restantes de propuestas_experiencias a experiencias con slugs únicos
WITH proposals_to_insert AS (
  SELECT
    p.*,
    COALESCE(
      NULLIF(LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
      'exp-' || SUBSTRING(REPLACE(p.id::TEXT, '-', '') FROM 1 FOR 8)
    ) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(
        NULLIF(LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
        'exp-' || SUBSTRING(REPLACE(p.id::TEXT, '-', '') FROM 1 FOR 8)
      )
      ORDER BY p.created_at, p.id
    ) AS batch_row_num
  FROM public.propuestas_experiencias p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.experiencias e
    WHERE e.id = p.id::TEXT
       OR (
         p.status = 'aprobada'
         AND (
           e.id = 'exp-' || p.id::TEXT
           OR (
             p.id::TEXT = 'req-sunset-las-pirquitas'
             AND (
               e.id IN ('exp-sunset-las-pirquitas', 'exp-travesia-en-kayak-nocturna-luna-llena-en-el-jumeal')
               OR e.slug = 'sunset-las-pirquitas'
             )
           )
           OR (
             (
               LOWER(TRIM(unaccent(e.title))) =
               LOWER(TRIM(unaccent(p.title)))
               OR (
                 p.provider_email IS NOT NULL AND TRIM(p.provider_email) <> ''
                 AND LOWER(TRIM(e.provider_email)) = LOWER(TRIM(p.provider_email))
               )
             )
             AND (
               e.slug = LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g')))
               OR e.slug ~ ('^' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
               OR e.id = 'exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g')))
               OR e.id ~ ('^exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRANSLATE(p.title, 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÑñ', 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
             )
           )
         )
       )
  )
)
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
  sp.id::TEXT,
  CASE
    WHEN sp.batch_row_num = 1 AND NOT EXISTS (
      SELECT 1 FROM public.experiencias e
      WHERE e.id <> sp.id::TEXT AND e.slug = sp.base_slug
    ) THEN sp.base_slug
    ELSE sp.base_slug || '-' || SUBSTRING(REPLACE(sp.id::TEXT, '-', '') FROM 1 FOR 8)
  END,
  sp.title,
  COALESCE(sp.kicker, 'EXPERIENCIA'),
  COALESCE(sp.subheading, ''),
  COALESCE(sp.region, 'Valle Central y Ambato'),
  CASE
    WHEN sp.difficulty ILIKE 'alta%' THEN 'Alta Montaña'
    WHEN sp.difficulty ILIKE 'exigente%' THEN 'Exigente'
    WHEN sp.difficulty ILIKE 'baja%' THEN 'Baja'
    ELSE 'Moderada'
  END,
  COALESCE(sp.duration, '4 horas'),
  CASE
    WHEN sp.altitude ~ '[0-9]+[^0-9]+[0-9]+' THEN 850
    WHEN NULLIF(REGEXP_REPLACE(sp.altitude, '[^0-9]', '', 'g'), '') IS NULL THEN 850
    WHEN LENGTH(REGEXP_REPLACE(sp.altitude, '[^0-9]', '', 'g')) <= 4
     AND REGEXP_REPLACE(sp.altitude, '[^0-9]', '', 'g')::INTEGER BETWEEN 0 AND 7000
      THEN REGEXP_REPLACE(sp.altitude, '[^0-9]', '', 'g')::INTEGER
    ELSE 850
  END,
  GREATEST(0, COALESCE(sp.price_ars, 0)),
  sp.price_usd,
  GREATEST(1, COALESCE(NULLIF(sp.capacity, 0), 12)),
  COALESCE(sp.season, 'Todo el año'),
  COALESCE(sp.itinerary, ''),
  COALESCE(sp.meeting_point, ''),
  COALESCE(sp.meeting_point_url, ''),
  COALESCE(sp.cover_image, '/assets/images/kayak-club-de-experiencias.jpg'),
  sp.cover_image_name,
  sp.cover_video_url,
  COALESCE(sp.album_photos, '[]'::jsonb),
  COALESCE(sp.provider_name, ''),
  CASE
    WHEN sp.provider_email IS NOT NULL AND TRIM(sp.provider_email) <> '' THEN LOWER(TRIM(sp.provider_email))
    ELSE NULL
  END,
  COALESCE(sp.provider_phone, ''),
  COALESCE(sp.provider_cbu_alias, ''),
  COALESCE(sp.provider_cuit_dni, ''),
  COALESCE(sp.provider_bank_name, ''),
  COALESCE(sp.provider_agency, ''),
  COALESCE(sp.participant_requirements, ''),
  sp.notes,
  CASE
    WHEN sp.status = 'aprobada' THEN 'publicada'
    WHEN sp.status = 'rechazada' THEN 'rechazada'
    ELSE 'pendiente'
  END,
  sp.reviewed_at,
  COALESCE(sp.created_at, now()),
  COALESCE(sp.updated_at, sp.created_at, now())
FROM proposals_to_insert sp
ON CONFLICT (id) DO UPDATE
SET
  reviewed_at = COALESCE(EXCLUDED.reviewed_at, public.experiencias.reviewed_at),
  provider_agency = COALESCE(NULLIF(EXCLUDED.provider_agency, ''), public.experiencias.provider_agency),
  participant_requirements = COALESCE(NULLIF(EXCLUDED.participant_requirements, ''), public.experiencias.participant_requirements),
  notes = COALESCE(EXCLUDED.notes, public.experiencias.notes),
  updated_at = EXCLUDED.updated_at;

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
        'converted', EXISTS (
          SELECT 1 FROM public.pagos_transferencias p
          WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
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
        'converted', EXISTS (
          SELECT 1 FROM public.pagos_transferencias p
          WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(s.email))
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

