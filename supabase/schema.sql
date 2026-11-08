-- ==============================================================================
-- EXPERIENCIAS.CLUB • Esquema Canónico de Base de Datos (schema.sql)
-- ==============================================================================
-- Catamarca • Expediciones Andinas & Club Náutico
--
-- Este script define la estructura completa, índices, funciones RPC,
-- triggers y políticas de seguridad (RLS) para Supabase.
--
-- Ejecución: Puede ejecutarse completo en el Editor SQL de Supabase.
-- Idempotencia: 100% idempotente (CREATE IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONES Y SECUENCIAS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE SEQUENCE IF NOT EXISTS public.socios_position_seq START WITH 100;

-- ==============================================================================
-- 2. TABLAS E ÍNDICES (ESQUEMA CANÓNICO UNIFICADO)
-- ==============================================================================

-- Limpieza de vistas obsoletas de compatibilidad
DROP VIEW IF EXISTS public.provider_access CASCADE;
DROP VIEW IF EXISTS public.admin_access CASCADE;
DROP VIEW IF EXISTS public.provider_banking_history CASCADE;
DROP VIEW IF EXISTS public.historia_bancaria CASCADE;
DROP VIEW IF EXISTS public.public_provider_profiles CASCADE;
DROP VIEW IF EXISTS public.waitlist_stats CASCADE;

-- Migración segura y consolidación de tablas heredadas hacia el esquema canónico
-- La migración valida las filas copiadas y solo permite eliminar las tablas heredadas si la migración tiene éxito
DO $$
DECLARE
  v_missing_waitlist INTEGER := 0;
  v_missing_postulaciones INTEGER := 0;
  v_missing_propuestas INTEGER := 0;
BEGIN
  -- 1. Migración y validación de public.waitlist -> public.socios
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waitlist'
  ) THEN
    -- Asegurar que public.socios exista en el esquema actual y admita prospectos de waitlist
    CREATE TABLE IF NOT EXISTS public.socios (
      id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email                       TEXT NOT NULL UNIQUE,
      full_name                   TEXT DEFAULT '',
      dni                         TEXT DEFAULT '',
      phone                       TEXT DEFAULT '',
      experiences_wishlist        JSONB DEFAULT '[]'::jsonb,
      experiences_other           TEXT,
      position                    INTEGER UNIQUE,
      membership_tier             TEXT NOT NULL DEFAULT 'emergente'
                                  CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador', 'dado_de_baja')),
      auth_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      registration_token          UUID NOT NULL DEFAULT gen_random_uuid(),
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.socios ALTER COLUMN full_name DROP NOT NULL;
    ALTER TABLE public.socios ALTER COLUMN full_name SET DEFAULT '';
    ALTER TABLE public.socios ALTER COLUMN dni DROP NOT NULL;
    ALTER TABLE public.socios ALTER COLUMN dni SET DEFAULT '';
    ALTER TABLE public.socios ALTER COLUMN phone DROP NOT NULL;
    ALTER TABLE public.socios ALTER COLUMN phone SET DEFAULT '';
    ALTER TABLE public.socios ALTER COLUMN position DROP NOT NULL;
    ALTER TABLE public.socios DROP CONSTRAINT IF EXISTS socios_membership_tier_check;
    ALTER TABLE public.socios ADD CONSTRAINT socios_membership_tier_check
      CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador', 'dado_de_baja'));

    -- Migrar prospectos de waitlist a socios
    INSERT INTO public.socios (
      email,
      membership_tier,
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
      '',
      '',
      '',
      NULL,
      MIN(w.created_at),
      MIN(w.created_at)
    FROM public.waitlist w
    WHERE w.email IS NOT NULL AND TRIM(w.email) <> ''
    GROUP BY LOWER(TRIM(w.email))
    ON CONFLICT (email) DO NOTHING;

    -- Validar que todos los registros de waitlist existan en socios
    SELECT COUNT(*) INTO v_missing_waitlist
    FROM public.waitlist w
    WHERE NOT EXISTS (
      SELECT 1 FROM public.socios s
      WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(w.email))
    );

    IF v_missing_waitlist > 0 THEN
      RAISE EXCEPTION 'Fallo de validación en migración: % registros de public.waitlist no fueron transferidos a public.socios', v_missing_waitlist;
    END IF;

    -- Solo permitir eliminar la tabla una vez validada exitosamente la migración
    DROP TABLE public.waitlist CASCADE;
  END IF;

  -- 2. Migración y validación de public.postulaciones_prestadores -> public.prestadores
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'postulaciones_prestadores'
  ) THEN
    -- Si existe provider_access como tabla base y no prestadores, renombrarla primero
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'prestadores' AND table_type = 'BASE TABLE'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'provider_access' AND table_type = 'BASE TABLE'
    ) THEN
      ALTER TABLE public.provider_access RENAME TO prestadores;
    END IF;

    -- Asegurar tabla canónica prestadores
    CREATE TABLE IF NOT EXISTS public.prestadores (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email          TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL DEFAULT '',
      agency         TEXT NOT NULL DEFAULT '',
      active         BOOLEAN NOT NULL DEFAULT true,
      status         TEXT NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado', 'pendiente', 'rechazado', 'dado_de_baja')),
      cbu_alias      TEXT NOT NULL DEFAULT '',
      cuit_dni       TEXT NOT NULL DEFAULT '',
      bank_name      TEXT NOT NULL DEFAULT '',
      account_holder TEXT NOT NULL DEFAULT '',
      phone          TEXT NOT NULL DEFAULT '',
      website        TEXT NOT NULL DEFAULT '',
      social_media   TEXT NOT NULL DEFAULT '',
      social_media_secondary TEXT NOT NULL DEFAULT '',
      slug           TEXT NOT NULL DEFAULT '',
      bio            TEXT NOT NULL DEFAULT '',
      avatar_url     TEXT NOT NULL DEFAULT '',
      cover_url      TEXT NOT NULL DEFAULT '',
      category       TEXT NOT NULL DEFAULT '',
      region         TEXT NOT NULL DEFAULT 'Catamarca',
      description    TEXT NOT NULL DEFAULT '',
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Catamarca';
    ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Migrar postulaciones_prestadores hacia el esquema canónico de prestadores
    INSERT INTO public.prestadores (
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
      category = COALESCE(NULLIF(public.prestadores.category, ''), EXCLUDED.category),
      region = COALESCE(NULLIF(public.prestadores.region, ''), EXCLUDED.region),
      description = COALESCE(NULLIF(public.prestadores.description, ''), EXCLUDED.description),
      notes = COALESCE(public.prestadores.notes, EXCLUDED.notes);

    -- Validar que todas las postulaciones se encuentren registradas en prestadores
    SELECT COUNT(*) INTO v_missing_postulaciones
    FROM public.postulaciones_prestadores p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.prestadores pr
      WHERE LOWER(TRIM(pr.email)) = LOWER(TRIM(p.email))
    );

    IF v_missing_postulaciones > 0 THEN
      RAISE EXCEPTION 'Fallo de validación en migración: % registros de public.postulaciones_prestadores no se encuentran en public.prestadores', v_missing_postulaciones;
    END IF;

    -- Solo permitir eliminar la tabla una vez validada exitosamente la migración
    DROP TABLE public.postulaciones_prestadores CASCADE;
  END IF;

  -- 3. Migración y validación de public.propuestas_experiencias -> public.experiencias
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'propuestas_experiencias'
  ) THEN
    -- Asegurar tabla canónica experiencias
    CREATE TABLE IF NOT EXISTS public.experiencias (
      id                   TEXT PRIMARY KEY,
      slug                 TEXT NOT NULL UNIQUE,
      title                TEXT NOT NULL,
      kicker               TEXT DEFAULT '',
      tagline              TEXT NOT NULL DEFAULT '',
      description          TEXT NOT NULL DEFAULT '',
      region               TEXT NOT NULL DEFAULT 'Valle Central y Ambato',
      meeting_point        TEXT NOT NULL DEFAULT '',
      meeting_point_url    TEXT NOT NULL DEFAULT '',
      difficulty           TEXT NOT NULL DEFAULT 'Baja',
      duration_label       TEXT NOT NULL DEFAULT '4 horas',
      price_ars            INTEGER NOT NULL DEFAULT 65000 CHECK (price_ars >= 0),
      price_usd            INTEGER DEFAULT 70,
      capacity_per_date    INTEGER NOT NULL DEFAULT 12 CHECK (capacity_per_date >= 1),
      dates                JSONB NOT NULL DEFAULT '[]'::jsonb,
      date_slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
      status               TEXT NOT NULL DEFAULT 'publicada'
                           CHECK (status IN ('borrador', 'pendiente', 'publicada', 'oculta', 'rechazada')),
      public_url           TEXT DEFAULT '',
      cover_image          TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg',
      cover_image_name     TEXT,
      cover_video_name     TEXT,
      album_photos         JSONB DEFAULT '[]'::jsonb,
      video_url            TEXT DEFAULT '/assets/videos/kayak.mp4',
      video_poster         TEXT DEFAULT '/assets/images/kayak-video.png',
      altitude_meters      INTEGER DEFAULT 850,
      best_season          TEXT DEFAULT '',
      itinerary            TEXT DEFAULT '',
      highlights           JSONB DEFAULT '[]'::jsonb,
      included             JSONB DEFAULT '[]'::jsonb,
      not_included         JSONB DEFAULT '[]'::jsonb,
      participant_requirements TEXT NOT NULL DEFAULT '',
      notes                TEXT,
      reviewed_at          TIMESTAMPTZ,
      provider_agency      TEXT NOT NULL DEFAULT '',
      provider_email       TEXT DEFAULT 'patriciofacundodiaztillar@gmail.com',
      provider_name        TEXT,
      provider_phone       TEXT,
      provider_cbu_alias   TEXT,
      provider_cuit_dni    TEXT,
      provider_bank_name   TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS kicker TEXT DEFAULT '';
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS best_season TEXT DEFAULT '';
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS itinerary TEXT DEFAULT '';
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_agency TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS participant_requirements TEXT NOT NULL DEFAULT '';

    -- Asegurar que provider_email exista en prestadores para mantener integridad referencial
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
    END IF;

    -- Reconciliar propuestas aprobadas con experiencias existentes en el catálogo
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
            OR e.slug ~ ('^' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
            OR e.id = 'exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g')))
            OR e.id ~ ('^exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
          )
        )
      );

    -- Migrar propuestas restantes generando slugs únicos y normalizando defaults
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
                   OR e.slug ~ ('^' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
                   OR e.id = 'exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g')))
                   OR e.id ~ ('^exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
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
      sp.created_at,
      COALESCE(sp.updated_at, sp.created_at)
    FROM proposals_to_insert sp
    ON CONFLICT (id) DO NOTHING;

    -- Validar que todas las propuestas estén preservadas en experiencias
    SELECT COUNT(*) INTO v_missing_propuestas
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
                 OR e.slug ~ ('^' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
                 OR e.id = 'exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g')))
                 OR e.id ~ ('^exp-' || LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(unaccent(p.title), '[^a-zA-Z0-9]+', '-', 'g'))) || '(-[0-9]+|-exp)$')
               )
             )
           )
         )
    );

    IF v_missing_propuestas > 0 THEN
      RAISE EXCEPTION 'Fallo de validación en migración: % registros de public.propuestas_experiencias no fueron transferidos o reconciliados en public.experiencias', v_missing_propuestas;
    END IF;

    -- Solo permitir eliminar la tabla una vez validada exitosamente la migración
    DROP TABLE public.propuestas_experiencias CASCADE;
  END IF;
END $$;

-- 2.1 socios (Prospectos Waitlist, Socios Emergentes, Activos y Fundadores)
CREATE TABLE IF NOT EXISTS public.socios (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                       TEXT NOT NULL UNIQUE,
  full_name                   TEXT DEFAULT '',
  dni                         TEXT DEFAULT '',
  phone                       TEXT DEFAULT '',
  experiences_wishlist        JSONB DEFAULT '[]'::jsonb,
  experiences_other           TEXT,
  position                    INTEGER UNIQUE,
  membership_tier             TEXT NOT NULL DEFAULT 'emergente'
                              CHECK (membership_tier IN ('waitlist', 'emergente', 'activo', 'fundador', 'dado_de_baja')),
  auth_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registration_token          UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Limpieza de columnas obsoletas y redundantes en public.socios
ALTER TABLE public.socios DROP COLUMN IF EXISTS converted CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS google_linked CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_motivation_letter CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_agreed_to_protocol CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_application_status CASCADE;

CREATE INDEX IF NOT EXISTS idx_socios_email    ON public.socios(email);
CREATE INDEX IF NOT EXISTS idx_socios_position ON public.socios(position);
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS registration_token UUID NOT NULL DEFAULT gen_random_uuid();

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_socios_dni_unique
    ON public.socios(dni)
    WHERE dni <> '';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Aviso: Filas con DNI duplicado omitieron el índice único.';
END;
$$;

-- 2.3 administradores (Nómina de Administradores con Rol)
CREATE TABLE IF NOT EXISTS public.administradores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'admin'
                       CHECK (role IN ('superadmin', 'admin', 'moderator')),
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_administradores_email ON public.administradores(email);

-- Administradores autorizados por defecto
INSERT INTO public.administradores (email, name, role, active)
VALUES
  ('gonzagramaglia@gmail.com', 'Gonzalo Gramaglia', 'superadmin', true),
  ('vegvarel@gmail.com', 'Pablo Vegvarel', 'superadmin', true),
  ('patriciofacundodiaztillar@gmail.com', 'Patricio Facundo Díaz Tillar', 'superadmin', true),
  ('admin@experiencias.club', 'Administrador Experiencias', 'superadmin', true)
ON CONFLICT (email) DO NOTHING;

-- 2.4 postulaciones_fundadores (Postulaciones para Socio Fundador)
CREATE TABLE IF NOT EXISTS public.postulaciones_fundadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL,
  motivation_letter    TEXT NOT NULL,
  agreed_to_protocol   BOOLEAN NOT NULL DEFAULT false,
  status               TEXT NOT NULL DEFAULT 'en_evaluacion'
                       CHECK (status IN ('en_evaluacion', 'aprobada', 'rechazada', 'dado_de_baja')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_fundadores_email ON public.postulaciones_fundadores(email);
ALTER TABLE public.postulaciones_fundadores ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2.5 prestadores (Accesos, Postulaciones y Datos Bancarios de Prestadores)
CREATE TABLE IF NOT EXISTS public.prestadores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  agency         TEXT NOT NULL DEFAULT '',
  active         BOOLEAN NOT NULL DEFAULT true,
  status         TEXT NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado', 'pendiente', 'rechazado', 'dado_de_baja')),
  cbu_alias      TEXT NOT NULL DEFAULT '',
  cuit_dni       TEXT NOT NULL DEFAULT '',
  bank_name      TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  website        TEXT NOT NULL DEFAULT '',
  social_media   TEXT NOT NULL DEFAULT '',
  social_media_secondary TEXT NOT NULL DEFAULT '',
  slug           TEXT NOT NULL DEFAULT '',
  bio            TEXT NOT NULL DEFAULT '',
  avatar_url     TEXT NOT NULL DEFAULT '',
  cover_url      TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT '',
  region         TEXT NOT NULL DEFAULT 'Catamarca',
  description    TEXT NOT NULL DEFAULT '',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestadores_email ON public.prestadores(email);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS agency TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprobado';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS cbu_alias TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS cuit_dni TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS account_holder TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS social_media TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS social_media_secondary TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Catamarca';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS notes TEXT;

-- Normalizar posibles slugs duplicados no vacíos antes de crear el índice único
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'prestadores'
  ) THEN
    WITH duplicates AS (
      SELECT id, slug,
             ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
      FROM public.prestadores
      WHERE slug IS NOT NULL AND slug <> ''
    )
    UPDATE public.prestadores pa
    SET slug = pa.slug || '-' || SUBSTRING(pa.id::text, 1, 6)
    FROM duplicates d
    WHERE pa.id = d.id AND d.rn > 1;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_prestadores_slug;
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestadores_nonempty_slug
  ON public.prestadores(slug)
  WHERE slug IS NOT NULL AND slug <> '';

-- Cuenta Oficial del Club de Experiencias como Prestador Institucional
INSERT INTO public.prestadores (
  email, name, agency, slug, phone, cbu_alias, cuit_dni, bank_name, account_holder, bio, website, active, status
) VALUES (
  'admin@experiencias.club',
  'Club de Experiencias',
  'Club de Experiencias',
  'club-de-experiencias',
  '+54 9 383 456-7890',
  'EXPERIENCIAS.CLUB.MP',
  '30-71829401-4',
  'Mercado Pago / Banco Nación',
  'Club de Experiencias Catamarca',
  'Cuenta institucional oficial del Club de Experiencias. Administrada conjuntamente por el equipo de administradores.',
  'https://experiencias.club',
  true,
  'aprobado'
) ON CONFLICT (email) DO UPDATE SET
  agency = EXCLUDED.agency,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  active = true,
  status = 'aprobado';

-- 2.7 historial_bancario (Auditoría de Modificaciones Bancarias)
CREATE TABLE IF NOT EXISTS public.historial_bancario (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email TEXT NOT NULL,
  cbu_alias      TEXT,
  cuit_dni       TEXT,
  bank_name      TEXT,
  account_holder TEXT,
  old_cbu_alias  TEXT,
  new_cbu_alias  TEXT DEFAULT '',
  old_name       TEXT,
  new_name       TEXT DEFAULT '',
  old_cuit_dni   TEXT,
  new_cuit_dni   TEXT DEFAULT '',
  old_bank_name  TEXT,
  new_bank_name  TEXT DEFAULT '',
  old_account_holder TEXT,
  new_account_holder TEXT DEFAULT '',
  changed_by     TEXT NOT NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_bancario_email ON public.historial_bancario(provider_email);

-- 2.8 experiencias (Catálogo Oficial de Rutas y Salidas)
CREATE TABLE IF NOT EXISTS public.experiencias (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  kicker               TEXT DEFAULT '',
  tagline              TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  region               TEXT NOT NULL DEFAULT 'Valle Central y Ambato',
  meeting_point        TEXT NOT NULL DEFAULT '',
  meeting_point_url    TEXT NOT NULL DEFAULT '',
  difficulty           TEXT NOT NULL DEFAULT 'Baja'
                       CHECK (
                         difficulty IN ('Baja', 'Moderada', 'Exigente', 'Alta Montaña')
                         OR difficulty ILIKE 'baja%'
                         OR difficulty ILIKE 'moderada%'
                         OR difficulty ILIKE 'exigente%'
                         OR difficulty ILIKE 'alta%'
                       ),
  duration_label       TEXT NOT NULL DEFAULT '4 horas',
  price_ars            INTEGER NOT NULL DEFAULT 65000 CHECK (price_ars >= 0),
  price_usd            INTEGER DEFAULT 70,
  capacity_per_date    INTEGER NOT NULL DEFAULT 12 CHECK (capacity_per_date >= 1),
  dates                JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL DEFAULT 'publicada'
                       CHECK (status IN ('borrador', 'pendiente', 'publicada', 'oculta', 'rechazada')),
  public_url           TEXT DEFAULT '',
  cover_image          TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg',
  cover_image_name     TEXT,
  cover_video_name     TEXT,
  album_photos         JSONB DEFAULT '[]'::jsonb,
  video_url            TEXT DEFAULT '/assets/videos/kayak.mp4',
  video_poster         TEXT DEFAULT '/assets/images/kayak-video.png',
  altitude_meters      INTEGER DEFAULT 850,
  best_season          TEXT DEFAULT '',
  itinerary            TEXT DEFAULT '',
  highlights           JSONB DEFAULT '[]'::jsonb,
  included             JSONB DEFAULT '[]'::jsonb,
  not_included         JSONB DEFAULT '[]'::jsonb,
  participant_requirements TEXT NOT NULL DEFAULT '',
  notes                TEXT,
  reviewed_at          TIMESTAMPTZ,
  provider_agency      TEXT NOT NULL DEFAULT '',
  provider_email       TEXT DEFAULT 'patriciofacundodiaztillar@gmail.com',
  provider_name        TEXT,
  provider_phone       TEXT,
  provider_cbu_alias   TEXT,
  provider_cuit_dni    TEXT,
  provider_bank_name   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiencias_slug ON public.experiencias(slug);
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS album_photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS date_slots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_email TEXT DEFAULT 'patriciofacundodiaztillar@gmail.com';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_slug TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_phone TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_cbu_alias TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_cuit_dni TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_bank_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS kicker TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS itinerary TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS best_season TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS promos_and_pricing TEXT DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_agency TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_image_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS cover_video_name TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS participant_requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_experiencias_provider_email' AND table_name = 'experiencias'
  ) THEN
    ALTER TABLE public.experiencias
      ADD CONSTRAINT fk_experiencias_provider_email
      FOREIGN KEY (provider_email) REFERENCES public.prestadores(email)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Actualizar experiencias oficiales del Club de Experiencias (ej. Kayak)
UPDATE public.experiencias
SET
  provider_name = 'Club de Experiencias',
  provider_slug = 'club-de-experiencias',
  provider_email = 'admin@experiencias.club',
  provider_phone = '+54 9 383 456-7890'
WHERE slug = 'kayak' OR slug = 'exp-kayak';

ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS meeting_point_url TEXT NOT NULL DEFAULT '';

-- 2.9 pagos_transferencias (Registro de Comprobantes de Pago)
CREATE TABLE IF NOT EXISTS public.pagos_transferencias (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference                TEXT NOT NULL UNIQUE,
  experience_id            TEXT NOT NULL REFERENCES public.experiencias(id) ON UPDATE CASCADE,
  experience_title         TEXT NOT NULL,
  provider_email           TEXT,
  full_name                TEXT NOT NULL,
  email                    TEXT NOT NULL,
  phone                    TEXT NOT NULL DEFAULT '',
  dni                      TEXT NOT NULL DEFAULT '',
  selected_date            TEXT NOT NULL,
  participants             INTEGER NOT NULL DEFAULT 1 CHECK (participants >= 1),
  amount_ars               INTEGER NOT NULL CHECK (amount_ars >= 0),
  discount_code            TEXT,
  discount_ars             INTEGER NOT NULL DEFAULT 0,
  socio_id                 UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  receipt_file_name        TEXT,
  receipt_mime_type        TEXT,
  receipt_size_bytes       INTEGER,
  receipt_url              TEXT,
  receipt_storage_path     TEXT,
  receipt_storage_provider TEXT DEFAULT 'supabase',
  status                   TEXT NOT NULL DEFAULT 'pendiente'
                           CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  rejection_reason         TEXT,
  reviewed_by              TEXT,
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_reference ON public.pagos_transferencias(reference);
CREATE INDEX IF NOT EXISTS idx_pagos_email     ON public.pagos_transferencias(email);
CREATE INDEX IF NOT EXISTS idx_pagos_status    ON public.pagos_transferencias(status);
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS selected_date TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_storage_key TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS provider_email TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS discount_ars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS socio_id UUID;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_file_name TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_mime_type TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_size_bytes INTEGER;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_storage_provider TEXT DEFAULT 'supabase';
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  -- Backfill de created_at a partir de submitted_at si existen registros legacy con created_at nulo
  UPDATE public.pagos_transferencias
  SET created_at = COALESCE(submitted_at, now())
  WHERE created_at IS NULL;

  -- Sincronizar submitted_at si es nulo
  UPDATE public.pagos_transferencias
  SET submitted_at = created_at
  WHERE submitted_at IS NULL;

  -- Backfill de selected_date desde date solo cuando selected_date no existe o está vacío
  UPDATE public.pagos_transferencias
  SET selected_date = date
  WHERE (selected_date IS NULL OR selected_date = '')
    AND date IS NOT NULL AND date <> '';

  -- Sincronizar date si está vacío a partir de selected_date
  UPDATE public.pagos_transferencias
  SET date = selected_date
  WHERE (date IS NULL OR date = '')
    AND selected_date IS NOT NULL AND selected_date <> '';

  -- Backfill de receipt_storage_path desde receipt_storage_key solo cuando está vacío
  UPDATE public.pagos_transferencias
  SET receipt_storage_path = receipt_storage_key
  WHERE (receipt_storage_path IS NULL OR receipt_storage_path = '')
    AND receipt_storage_key IS NOT NULL AND receipt_storage_key <> '';

  -- Sincronizar receipt_storage_key si está vacío
  UPDATE public.pagos_transferencias
  SET receipt_storage_key = receipt_storage_path
  WHERE (receipt_storage_key IS NULL OR receipt_storage_key = '')
    AND receipt_storage_path IS NOT NULL AND receipt_storage_path <> '';

  -- Asegurar valor por defecto y restricción NOT NULL en created_at
  ALTER TABLE public.pagos_transferencias ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE public.pagos_transferencias ALTER COLUMN created_at SET NOT NULL;
END $$;

-- ==============================================================================
-- 3. VISTAS
-- ==============================================================================

-- 3.1 estadisticas_socios (Métricas y conteos de la comunidad de socios)
DROP VIEW IF EXISTS public.waitlist_stats CASCADE;
DROP VIEW IF EXISTS public.estadisticas_socios CASCADE;
CREATE VIEW public.estadisticas_socios AS
SELECT
  COUNT(*)                                                               AS total_members,
  COALESCE(MAX(position), 100)                                           AS max_position,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier <> 'waitlist') AS total_socios,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'waitlist')  AS total_waitlist,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'fundador') AS total_fundadores,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'activo')   AS total_activos,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'emergente')AS total_emergentes,
  (SELECT COALESCE(MAX(position), 99) FROM public.socios)                AS last_position
FROM public.socios;

GRANT SELECT ON public.estadisticas_socios TO anon, authenticated;

-- 3.2 perfiles_publicos (Vista pública segura de prestadores aprobados, sin datos bancarios o fiscales)
DROP VIEW IF EXISTS public.public_provider_profiles CASCADE;
DROP VIEW IF EXISTS public.perfiles_publicos CASCADE;
CREATE VIEW public.perfiles_publicos AS
SELECT
  email,
  name,
  agency,
  slug,
  bio,
  phone,
  website,
  social_media,
  social_media_secondary,
  avatar_url,
  cover_url,
  active,
  status
FROM public.prestadores
WHERE active = true AND status = 'aprobado';

GRANT SELECT ON public.perfiles_publicos TO anon, authenticated;

-- ==============================================================================
-- 4. TRIGGERS Y FUNCIONES DE NORMALIZACIÓN
-- ==============================================================================

-- 4.1 Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS socios_updated_at ON public.socios;
CREATE TRIGGER socios_updated_at
  BEFORE UPDATE ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS administradores_updated_at ON public.administradores;
CREATE TRIGGER administradores_updated_at
  BEFORE UPDATE ON public.administradores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS postulaciones_fundadores_updated_at ON public.postulaciones_fundadores;
CREATE TRIGGER postulaciones_fundadores_updated_at
  BEFORE UPDATE ON public.postulaciones_fundadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS prestadores_updated_at ON public.prestadores;
CREATE TRIGGER prestadores_updated_at
  BEFORE UPDATE ON public.prestadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS experiencias_updated_at ON public.experiencias;
CREATE TRIGGER experiencias_updated_at
  BEFORE UPDATE ON public.experiencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS pagos_transferencias_updated_at ON public.pagos_transferencias;
CREATE TRIGGER pagos_transferencias_updated_at
  BEFORE UPDATE ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2 Normalización de socios
CREATE OR REPLACE FUNCTION public.normalize_socio_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(TRIM(NEW.email));
  NEW.full_name = TRIM(COALESCE(NEW.full_name, ''));
  NEW.dni = regexp_replace(COALESCE(NEW.dni, ''), '\D', '', 'g');
  NEW.phone = TRIM(COALESCE(NEW.phone, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS socios_normalize_before_write ON public.socios;
CREATE TRIGGER socios_normalize_before_write
  BEFORE INSERT OR UPDATE ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.normalize_socio_row();

-- 4.4 Normalización de pagos_transferencias
CREATE OR REPLACE FUNCTION public.normalize_pago_transferencia_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(TRIM(NEW.email));
  NEW.reference = UPPER(TRIM(NEW.reference));
  NEW.full_name = TRIM(COALESCE(NEW.full_name, ''));
  NEW.dni = regexp_replace(COALESCE(NEW.dni, ''), '\D', '', 'g');
  NEW.phone = TRIM(COALESCE(NEW.phone, ''));

  IF NEW.selected_date IS NOT NULL AND (NEW.date IS NULL OR NEW.date = '') THEN
    NEW.date = NEW.selected_date;
  ELSIF (NEW.selected_date IS NULL OR NEW.selected_date = '') AND NEW.date IS NOT NULL THEN
    NEW.selected_date = NEW.date;
  END IF;

  IF NEW.created_at IS NOT NULL AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at = NEW.created_at;
  ELSIF NEW.created_at IS NULL AND NEW.submitted_at IS NOT NULL THEN
    NEW.created_at = NEW.submitted_at;
  END IF;

  IF NEW.receipt_storage_path IS NOT NULL AND NEW.receipt_storage_key IS NULL THEN
    NEW.receipt_storage_key = NEW.receipt_storage_path;
  ELSIF NEW.receipt_storage_path IS NULL AND NEW.receipt_storage_key IS NOT NULL THEN
    NEW.receipt_storage_path = NEW.receipt_storage_key;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pagos_normalize_before_write ON public.pagos_transferencias;
CREATE TRIGGER pagos_normalize_before_write
  BEFORE INSERT OR UPDATE ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.normalize_pago_transferencia_row();

-- 4.5 Vinculación de auth.users con socios
CREATE OR REPLACE FUNCTION public.handle_user_auth_link()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.socios
  SET auth_user_id = NEW.id,
      updated_at = now()
  WHERE LOWER(email) = LOWER(NEW.email)
    AND (auth_user_id IS NULL OR auth_user_id <> NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link_socio ON auth.users;
CREATE TRIGGER on_auth_user_created_link_socio
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_auth_link();

CREATE OR REPLACE FUNCTION public.link_socio_to_existing_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_id UUID;
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
      NEW.auth_user_id = v_auth_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS socios_before_insert_link_auth ON public.socios;
CREATE TRIGGER socios_before_insert_link_auth
  BEFORE INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.link_socio_to_existing_auth_user();

-- 4.5 Asignación automática de posición para nuevos socios que no sean waitlist
CREATE OR REPLACE FUNCTION public.assign_socio_position()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.membership_tier <> 'waitlist' AND NEW.position IS NULL THEN
    NEW.position := nextval('public.socios_position_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS socios_before_insert_assign_position ON public.socios;
CREATE TRIGGER socios_before_insert_assign_position
  BEFORE INSERT ON public.socios
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_socio_position();

-- 4.5.1 Restricción de modificación de columnas en socios para usuarios no-administradores
CREATE OR REPLACE FUNCTION public.check_socio_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jwt_role TEXT;
  v_current_email TEXT;
  v_is_admin BOOLEAN := false;
  v_context TEXT := '';
  v_is_registration_rpc BOOLEAN := false;
BEGIN
  GET DIAGNOSTICS v_context = PG_CONTEXT;
  IF v_context LIKE '%register_socio%' THEN
    v_is_registration_rpc := true;
  END IF;

  -- Si es ejecución interna/sistema sin contexto JWT, permitir
  IF auth.jwt() IS NULL THEN
    IF OLD.membership_tier = 'waitlist' AND NEW.membership_tier = 'emergente' THEN
      IF NEW.position IS NULL AND OLD.position IS NULL THEN
        NEW.position := nextval('public.socios_position_seq');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  -- Eximir al rol privilegiado de backend (service_role)
  IF v_jwt_role = 'service_role' THEN
    IF OLD.membership_tier = 'waitlist' AND NEW.membership_tier = 'emergente' THEN
      IF NEW.position IS NULL AND OLD.position IS NULL THEN
        NEW.position := nextval('public.socios_position_seq');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_current_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = v_current_email AND active = true
  ) INTO v_is_admin;

  IF v_is_admin THEN
    IF OLD.membership_tier = 'waitlist' AND NEW.membership_tier = 'emergente' THEN
      IF NEW.position IS NULL AND OLD.position IS NULL THEN
        NEW.position := nextval('public.socios_position_seq');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Para usuarios no administradores:
  -- Distinguir el flujo de las RPCs de registro (que asignan posición vía secuencia)
  -- de las actualizaciones directas enviadas por el socio (donde la base de datos asigna
  -- obligatoriamente la posición de la secuencia sin aceptar valores arbitrarios del cliente).
  IF OLD.membership_tier = 'waitlist' AND NEW.membership_tier = 'emergente' AND OLD.position IS NULL THEN
    IF v_is_registration_rpc THEN
      -- Preservar la asignación por secuencia ya efectuada en register_socio / register_socio_atomic
      IF NEW.position IS NULL THEN
        NEW.position := nextval('public.socios_position_seq');
      END IF;
    ELSE
      -- Actualización directa: no permitir elegir posición, asignar la siguiente de la secuencia
      NEW.position := nextval('public.socios_position_seq');
    END IF;
  ELSIF NEW.position IS DISTINCT FROM OLD.position OR
        NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar la categoría o posición del socio.';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email OR
     NEW.created_at IS DISTINCT FROM OLD.created_at OR
     NEW.registration_token IS DISTINCT FROM OLD.registration_token THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar la categoría, posición o credenciales del socio.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_socio_update ON public.socios;
CREATE TRIGGER trg_check_socio_update
  BEFORE UPDATE ON public.socios
  FOR EACH ROW
  EXECUTE FUNCTION public.check_socio_update_permissions();

-- 4.6 Control y auditoría de datos bancarios de prestadores
CREATE OR REPLACE FUNCTION public.check_provider_access_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jwt_role TEXT;
  v_is_admin BOOLEAN := false;
  v_current_email TEXT;
BEGIN
  IF auth.jwt() IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  -- Eximir al rol privilegiado de backend (service_role)
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_current_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = v_current_email AND active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    IF NEW.active IS DISTINCT FROM OLD.active OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Solo administradores pueden modificar el estado o habilitación del prestador.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_provider_access_update ON public.prestadores;
CREATE TRIGGER trg_check_provider_access_update
  BEFORE UPDATE ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.check_provider_access_update();

CREATE OR REPLACE FUNCTION public.handle_provider_banking_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed_by TEXT;
BEGIN
  IF (OLD.cbu_alias IS DISTINCT FROM NEW.cbu_alias) OR
     (OLD.cuit_dni IS DISTINCT FROM NEW.cuit_dni) OR
     (OLD.bank_name IS DISTINCT FROM NEW.bank_name) OR
     (OLD.account_holder IS DISTINCT FROM NEW.account_holder) THEN

    v_changed_by := COALESCE(auth.jwt() ->> 'email', 'sistema');

    INSERT INTO public.historial_bancario (
      provider_email,
      cbu_alias,
      cuit_dni,
      bank_name,
      account_holder,
      changed_by
    ) VALUES (
      NEW.email,
      NEW.cbu_alias,
      NEW.cuit_dni,
      NEW.bank_name,
      NEW.account_holder,
      v_changed_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_banking_history ON public.prestadores;
CREATE TRIGGER trg_provider_banking_history
  AFTER UPDATE ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_provider_banking_history();

-- 4.7 Notificación interna al registrar pago
CREATE OR REPLACE FUNCTION public.handle_pago_transferencia_submitted()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pago_transferencia_submitted ON public.pagos_transferencias;
CREATE TRIGGER on_pago_transferencia_submitted
  AFTER INSERT ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_pago_transferencia_submitted();

-- 4.8 Notificación interna al registrar socio
CREATE OR REPLACE FUNCTION public.handle_socio_registered()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload = jsonb_build_object(
    'socio_id', NEW.id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'position', NEW.position,
    'membership_tier', NEW.membership_tier
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_socio_registered_trigger ON public.socios;
CREATE TRIGGER on_socio_registered_trigger
  AFTER INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.handle_socio_registered();

-- ==============================================================================
-- 5. FUNCIONES RPC DE APLICACIÓN
-- ==============================================================================

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
  v_auth_uid UUID;
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  SELECT id INTO v_auth_uid FROM auth.users WHERE LOWER(email) = v_email LIMIT 1;

  INSERT INTO public.socios (
    email,
    membership_tier,
    auth_user_id,
    full_name,
    dni,
    phone,
    position
  )
  VALUES (
    v_email,
    'waitlist',
    v_auth_uid,
    '',
    '',
    '',
    NULL
  )
  ON CONFLICT (email) DO UPDATE
  SET auth_user_id = COALESCE(public.socios.auth_user_id, EXCLUDED.auth_user_id);

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_email_registration_status(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_tier TEXT;
  v_google_linked BOOLEAN := false;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object(
      'in_socios', false,
      'in_waitlist', false,
      'google_linked', false
    );
  END IF;

  SELECT membership_tier, (s.auth_user_id IS NOT NULL)
  INTO v_tier, v_google_linked
  FROM public.socios s
  WHERE s.email = v_email
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'in_socios', (v_tier <> 'waitlist'),
      'in_waitlist', (v_tier = 'waitlist'),
      'google_linked', COALESCE(v_google_linked, false)
    );
  END IF;

  RETURN jsonb_build_object(
    'in_socios', false,
    'in_waitlist', false,
    'google_linked', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_provider_status(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_access_status TEXT;
  v_access_active BOOLEAN;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object('status', 'unregistered');
  END IF;

  SELECT status, active
  INTO v_access_status, v_access_active
  FROM public.prestadores
  WHERE LOWER(email) = v_email
  LIMIT 1;

  IF FOUND THEN
    IF v_access_status = 'pendiente' THEN
      RETURN jsonb_build_object('status', 'pending');
    ELSIF v_access_status = 'aprobado' AND v_access_active = true THEN
      RETURN jsonb_build_object('status', 'approved');
    ELSE
      RETURN jsonb_build_object('status', 'inactive');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'unregistered');
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_provider_status(TEXT) TO anon, authenticated, service_role;

-- 4.8 Postulación atómica de prestadores (canal seguro con SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.submit_provider_application(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_category TEXT DEFAULT 'guia_montaña',
  p_region TEXT DEFAULT 'Puna & Fiambalá',
  p_website TEXT DEFAULT '',
  p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_status TEXT;
  v_active BOOLEAN;
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email', 'message', 'El correo electrónico ingresado no es válido.');
  END IF;

  SELECT status, active INTO v_status, v_active
  FROM public.prestadores
  WHERE LOWER(email) = v_email
  LIMIT 1;

  IF FOUND THEN
    IF v_status = 'pendiente' THEN
      RETURN jsonb_build_object(
        'success', false,
        'already_registered', true,
        'status', 'pending',
        'message', 'Ya recibimos una postulación con este correo electrónico y se encuentra en revisión.'
      );
    ELSIF v_status = 'aprobado' AND v_active = true THEN
      RETURN jsonb_build_object(
        'success', false,
        'already_registered', true,
        'status', 'approved',
        'message', 'Este correo electrónico ya pertenece a un prestador registrado en la plataforma.'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'already_registered', true,
        'status', 'inactive',
        'message', 'La cuenta asociada a este correo electrónico se encuentra inactiva o dada de baja.'
      );
    END IF;
  END IF;

  INSERT INTO public.prestadores (
    email,
    name,
    phone,
    category,
    region,
    website,
    description,
    status,
    active
  )
  VALUES (
    v_email,
    TRIM(COALESCE(p_name, '')),
    TRIM(COALESCE(p_phone, '')),
    COALESCE(NULLIF(TRIM(p_category), ''), 'guia_montaña'),
    COALESCE(NULLIF(TRIM(p_region), ''), 'Puna & Fiambalá'),
    TRIM(COALESCE(p_website, '')),
    TRIM(COALESCE(p_description, '')),
    'pendiente',
    false
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_registered', true,
      'status', 'duplicate',
      'message', 'Ya existe una postulación o registro con este correo electrónico.'
    );
  WHEN OTHERS THEN
    RAISE WARNING 'Error en submit_provider_application: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'internal_error');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_provider_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_socio_by_session_or_token(
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
BEGIN
  SELECT * INTO v_socio
  FROM public.socios
  WHERE email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_auth_uid IS NOT NULL AND (v_socio.auth_user_id = v_auth_uid OR v_jwt_email = v_email) THEN
    IF v_socio.auth_user_id IS NULL THEN
      UPDATE public.socios
      SET auth_user_id = v_auth_uid
      WHERE id = v_socio.id
      RETURNING * INTO v_socio;
    END IF;
    RETURN jsonb_build_object('status', 'ok', 'socio', to_jsonb(v_socio));
  END IF;

  IF v_socio.auth_user_id IS NULL
     AND p_registration_token IS NOT NULL
     AND v_socio.registration_token = p_registration_token THEN
    RETURN jsonb_build_object('status', 'ok', 'socio', to_jsonb(v_socio));
  END IF;

  RETURN jsonb_build_object('status', 'unauthorized');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_socio_profile_secure(
  p_email TEXT,
  p_registration_token UUID DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_experiences_wishlist JSONB DEFAULT NULL,
  p_experiences_other TEXT DEFAULT NULL
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
  v_clean_dni TEXT := regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g');
  v_socio public.socios%ROWTYPE;
  v_is_authorized BOOLEAN := false;
BEGIN
  SELECT * INTO v_socio
  FROM public.socios
  WHERE email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_auth_uid IS NOT NULL AND (v_socio.auth_user_id = v_auth_uid OR v_jwt_email = v_email) THEN
    v_is_authorized := true;
  ELSIF v_socio.auth_user_id IS NULL
        AND p_registration_token IS NOT NULL
        AND v_socio.registration_token = p_registration_token THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  IF v_clean_dni <> '' AND EXISTS (
    SELECT 1 FROM public.socios
    WHERE dni = v_clean_dni AND id <> v_socio.id
  ) THEN
    RETURN jsonb_build_object('status', 'dni_conflict');
  END IF;

  UPDATE public.socios
  SET full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
      dni = CASE WHEN v_clean_dni <> '' THEN v_clean_dni ELSE dni END,
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      experiences_wishlist = COALESCE(p_experiences_wishlist, experiences_wishlist),
      experiences_other = p_experiences_other,
      auth_user_id = COALESCE(auth_user_id, CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN v_auth_uid ELSE NULL END),
      updated_at = now()
  WHERE id = v_socio.id
  RETURNING * INTO v_socio;

  RETURN jsonb_build_object('status', 'updated', 'socio', to_jsonb(v_socio));
END;
$$;

CREATE OR REPLACE FUNCTION public.register_emergente_socio(
  p_email TEXT,
  p_full_name TEXT,
  p_dni TEXT,
  p_phone TEXT,
  p_experiences_wishlist JSONB DEFAULT '[]'::jsonb,
  p_experiences_other TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_name TEXT := TRIM(COALESCE(p_full_name, ''));
  v_dni TEXT := regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g');
  v_phone TEXT := TRIM(COALESCE(p_phone, ''));
  v_jwt_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_auth_uid UUID := auth.uid();
  v_inserted public.socios%ROWTYPE;
BEGIN
  IF v_email = '' OR v_name = '' OR length(v_dni) < 7 OR length(v_dni) > 9 OR v_phone = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF v_auth_uid IS NULL OR v_jwt_email <> v_email THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'message', 'Se requiere autenticación válida para registrar el socio.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.socios WHERE email = v_email) THEN
    IF v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN
      UPDATE public.socios
      SET full_name = CASE WHEN v_name <> '' THEN v_name ELSE full_name END,
          dni = CASE WHEN v_dni <> '' THEN v_dni ELSE dni END,
          phone = CASE WHEN v_phone <> '' THEN v_phone ELSE phone END,
          experiences_wishlist = CASE WHEN p_experiences_wishlist IS NOT NULL THEN p_experiences_wishlist ELSE experiences_wishlist END,
          experiences_other = CASE WHEN p_experiences_other IS NOT NULL AND TRIM(p_experiences_other) <> '' THEN TRIM(p_experiences_other) ELSE experiences_other END,
          membership_tier = CASE WHEN membership_tier = 'waitlist' THEN 'emergente' ELSE membership_tier END,
          position = CASE WHEN membership_tier = 'waitlist' AND position IS NULL THEN nextval('public.socios_position_seq') ELSE position END,
          auth_user_id = v_auth_uid,
          updated_at = now()
      WHERE email = v_email
      RETURNING * INTO v_inserted;

      RETURN jsonb_build_object(
        'status', 'created',
        'socio', to_jsonb(v_inserted)
      );
    ELSE
      RETURN jsonb_build_object('status', 'already_registered_email');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.socios WHERE dni = v_dni AND dni <> '') THEN
    RETURN jsonb_build_object('status', 'already_registered_dni');
  END IF;

  INSERT INTO public.socios (
    email,
    full_name,
    dni,
    phone,
    experiences_wishlist,
    experiences_other,
    membership_tier,
    position,
    auth_user_id
  )
  VALUES (
    v_email,
    v_name,
    v_dni,
    v_phone,
    COALESCE(p_experiences_wishlist, '[]'::jsonb),
    NULLIF(TRIM(COALESCE(p_experiences_other, '')), ''),
    'emergente',
    nextval('public.socios_position_seq'),
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN v_auth_uid ELSE NULL END
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'status', 'created',
    'socio', to_jsonb(v_inserted)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_socio_atomic(
  p_email TEXT,
  p_full_name TEXT,
  p_dni TEXT,
  p_phone TEXT,
  p_experiences_wishlist JSONB DEFAULT '[]'::jsonb,
  p_experiences_other TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_name TEXT := TRIM(COALESCE(p_full_name, ''));
  v_dni TEXT := TRIM(COALESCE(p_dni, ''));
  v_phone TEXT := TRIM(COALESCE(p_phone, ''));
  v_jwt_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_auth_uid UUID := auth.uid();
  v_inserted public.socios%ROWTYPE;
BEGIN
  IF v_email = '' OR v_name = '' OR length(v_dni) < 7 OR length(v_dni) > 9 OR v_phone = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF v_auth_uid IS NULL OR v_jwt_email <> v_email THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'message', 'Se requiere autenticación válida para registrar el socio.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.socios WHERE email = v_email) THEN
    IF v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN
      UPDATE public.socios
      SET full_name = CASE WHEN v_name <> '' THEN v_name ELSE full_name END,
          dni = CASE WHEN v_dni <> '' THEN v_dni ELSE dni END,
          phone = CASE WHEN v_phone <> '' THEN v_phone ELSE phone END,
          experiences_wishlist = CASE WHEN p_experiences_wishlist IS NOT NULL THEN p_experiences_wishlist ELSE experiences_wishlist END,
          experiences_other = CASE WHEN p_experiences_other IS NOT NULL AND TRIM(p_experiences_other) <> '' THEN TRIM(p_experiences_other) ELSE experiences_other END,
          membership_tier = CASE WHEN membership_tier = 'waitlist' THEN 'emergente' ELSE membership_tier END,
          position = CASE WHEN membership_tier = 'waitlist' AND position IS NULL THEN nextval('public.socios_position_seq') ELSE position END,
          auth_user_id = v_auth_uid,
          updated_at = now()
      WHERE email = v_email
      RETURNING * INTO v_inserted;

      RETURN jsonb_build_object(
        'status', 'created',
        'socio', to_jsonb(v_inserted) - 'registration_token'
      );
    ELSE
      RETURN jsonb_build_object('status', 'already_registered');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.socios WHERE dni = v_dni AND dni <> '') THEN
    RETURN jsonb_build_object('status', 'already_registered_dni');
  END IF;

  INSERT INTO public.socios (
    email,
    full_name,
    dni,
    phone,
    experiences_wishlist,
    experiences_other,
    membership_tier,
    position,
    auth_user_id
  )
  VALUES (
    v_email,
    v_name,
    v_dni,
    v_phone,
    COALESCE(p_experiences_wishlist, '[]'::jsonb),
    NULLIF(TRIM(COALESCE(p_experiences_other, '')), ''),
    'emergente',
    nextval('public.socios_position_seq'),
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN v_auth_uid ELSE NULL END
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'status', 'created',
    'socio', to_jsonb(v_inserted) - 'registration_token'
  );
END;
$$;

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
  p_receipt_storage_provider TEXT DEFAULT 'supabase'
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
  v_unit_price INTEGER := 0;
  v_dates JSONB := '[]'::jsonb;
  v_date_slots JSONB := '[]'::jsonb;
  v_provider_email TEXT := '';
  v_slot JSONB;
  v_expected_subtotal INTEGER := 0;
  v_expected_discount INTEGER := 0;
  v_expected_total INTEGER := 0;
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

  SELECT capacity_per_date, price_ars, dates, COALESCE(date_slots, '[]'::jsonb), COALESCE(provider_email, '')
  INTO v_capacity, v_unit_price, v_dates, v_date_slots, v_provider_email
  FROM public.experiencias
  WHERE id = p_experience_id
  LIMIT 1
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    v_capacity := 12;
  END IF;

  IF v_dates IS NOT NULL AND jsonb_array_length(v_dates) > 0 AND NOT (v_dates ? p_date) THEN
    RETURN jsonb_build_object(
      'status', 'invalid_date',
      'message', 'La fecha seleccionada no está disponible.'
    );
  END IF;

  -- Validar si el slot específico de fecha está cerrado o tiene cupo diferenciado
  IF v_date_slots IS NOT NULL AND jsonb_array_length(v_date_slots) > 0 THEN
    FOR v_slot IN SELECT * FROM jsonb_array_elements(v_date_slots)
    LOOP
      IF (v_slot ->> 'date') = p_date THEN
        IF (v_slot ->> 'closed')::boolean IS TRUE THEN
          RETURN jsonb_build_object(
            'status', 'date_closed',
            'message', 'Esta fecha se encuentra cerrada para nuevas reservas.'
          );
        END IF;
        IF (v_slot ->> 'unlimited')::boolean IS TRUE THEN
          v_capacity := 999;
        ELSIF (v_slot ->> 'capacity') IS NOT NULL AND (v_slot ->> 'capacity')::integer > 0 THEN
          v_capacity := (v_slot ->> 'capacity')::integer;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_unit_price IS NOT NULL AND v_unit_price > 0 THEN
    v_expected_subtotal := v_unit_price * p_participants;

    IF p_discount_code IS NOT NULL AND TRIM(p_discount_code) <> '' THEN
      IF UPPER(TRIM(p_discount_code)) IN ('FUNDADOR100') THEN
        v_expected_discount := v_expected_subtotal;
      ELSIF UPPER(TRIM(p_discount_code)) IN ('FUNDADOR20') THEN
        v_expected_discount := ROUND(v_expected_subtotal * 0.20);
      ELSIF UPPER(TRIM(p_discount_code)) IN ('SOCIO15', 'DESCUENTO15') THEN
        v_expected_discount := ROUND(v_expected_subtotal * 0.15);
      ELSIF UPPER(TRIM(p_discount_code)) IN ('AMIGO10', 'CLUB10', 'SOCIO10') THEN
        v_expected_discount := ROUND(v_expected_subtotal * 0.10);
      ELSIF UPPER(TRIM(p_discount_code)) IN ('SOCIOFUNDADOR7') THEN
        v_expected_discount := ROUND(v_expected_subtotal * 0.07);
      ELSE
        v_expected_discount := 0;
      END IF;
    ELSE
      v_expected_discount := 0;
    END IF;

    v_expected_total := GREATEST(0, v_expected_subtotal - v_expected_discount);
    IF p_amount_ars <> v_expected_total THEN
      RETURN jsonb_build_object(
        'status', 'invalid_amount',
        'message', 'El monto transferido no coincide con el total calculado para esta reserva.',
        'expected_amount', v_expected_total
      );
    END IF;
  ELSE
    v_expected_total := p_amount_ars;
    v_expected_discount := COALESCE(p_discount_ars, 0);
  END IF;

  SELECT COALESCE(SUM(participants), 0) INTO v_reserved
  FROM public.pagos_transferencias
  WHERE experience_id = p_experience_id
    AND selected_date = p_date
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
    provider_email,
    selected_date,
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
    receipt_storage_path,
    receipt_storage_provider,
    status
  )
  VALUES (
    UPPER(TRIM(p_reference)),
    p_experience_id,
    p_experience_title,
    v_provider_email,
    p_date,
    p_participants,
    v_expected_total,
    p_discount_code,
    v_expected_discount,
    p_full_name,
    v_email,
    v_dni,
    p_phone,
    v_socio_id,
    p_receipt_file_name,
    p_receipt_mime_type,
    p_receipt_size_bytes,
    p_receipt_url,
    COALESCE(p_receipt_storage_key, p_receipt_url),
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
        'date', sub.selected_date,
        'reserved_seats', sub.reserved_seats
      )
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT selected_date, SUM(participants)::INTEGER AS reserved_seats
    FROM public.pagos_transferencias
    WHERE experience_id = p_experience_id
      AND status <> 'rechazado'
    GROUP BY selected_date
  ) sub;

  RETURN v_result;
END;
$$;

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
      ELSIF v_socio.auth_user_id IS NULL
            AND p_registration_token IS NOT NULL
            AND v_socio.registration_token = p_registration_token THEN
        v_authorized := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM public.pagos_transferencias t
  WHERE t.email = v_email;

  RETURN jsonb_build_object('status', 'ok', 'submissions', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_provider_transfer_submissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_provider BOOLEAN;
  v_items JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.prestadores
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_provider;

  IF NOT (v_is_admin OR v_is_provider) THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

  IF v_is_admin THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.pagos_transferencias t;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.pagos_transferencias t
    WHERE LOWER(t.provider_email) = v_caller_email
       OR EXISTS (
         SELECT 1 FROM public.experiencias e
         WHERE e.id = t.experience_id AND LOWER(e.provider_email) = v_caller_email
       );
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'submissions', v_items);
END;
$$;

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
  v_caller_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_admin BOOLEAN;
  v_is_provider BOOLEAN;
  v_updated public.pagos_transferencias%ROWTYPE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.prestadores
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_provider;

  IF NOT (v_is_admin OR v_is_provider) THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  IF p_status NOT IN ('aprobado', 'rechazado') THEN
    RETURN jsonb_build_object('status', 'invalid_status');
  END IF;

  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pagos_transferencias t
      WHERE t.id = p_submission_id
        AND (
          LOWER(t.provider_email) = v_caller_email
          OR EXISTS (
            SELECT 1 FROM public.experiencias e
            WHERE e.id = t.experience_id AND LOWER(e.provider_email) = v_caller_email
          )
        )
    ) THEN
      RETURN jsonb_build_object('status', 'unauthorized');
    END IF;
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

CREATE OR REPLACE FUNCTION public.get_admin_all_members()
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
    SELECT 1 FROM public.administradores
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
        'googleLinked', (s.auth_user_id IS NOT NULL),
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
        'googleLinked', (u.id IS NOT NULL OR s.auth_user_id IS NOT NULL),
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

CREATE OR REPLACE FUNCTION public.get_admin_all_submissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subs JSONB;
BEGIN
  -- Caller authorization: Only active admins
  IF NOT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores activos pueden acceder a los comprobantes';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'reference', p.reference,
        'experienceId', p.experience_id,
        'experienceTitle', p.experience_title,
        'date', p.selected_date,
        'participants', p.participants,
        'amountArs', p.amount_ars,
        'discountCode', p.discount_code,
        'discountArs', p.discount_ars,
        'fullName', p.full_name,
        'email', p.email,
        'dni', p.dni,
        'phone', p.phone,
        'socioId', p.socio_id,
        'receipt', jsonb_build_object(
          'fileName', p.receipt_file_name,
          'mimeType', p.receipt_mime_type,
          'sizeBytes', p.receipt_size_bytes,
          'url', p.receipt_url,
          'storageKey', p.receipt_storage_path,
          'provider', p.receipt_storage_provider
        ),
        'status', p.status,
        'rejectionReason', p.rejection_reason,
        'submittedAt', p.created_at,
        'reviewedAt', p.reviewed_at
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_subs
  FROM public.pagos_transferencias p;

  RETURN v_subs;
END;
$$;

-- 4.14 RPC get_admin_socios_roster (compatibilidad con esquema canónico)
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
  -- Caller authorization: Solo administradores activos
  IF NOT EXISTS (
    SELECT 1 FROM public.administradores
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
        'googleLinked', (s.auth_user_id IS NOT NULL),
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
        'googleLinked', (u.id IS NOT NULL OR s.auth_user_id IS NOT NULL),
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

-- Permisos de ejecución de RPCs
GRANT EXECUTE ON FUNCTION public.record_waitlist_email TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_socios_roster TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_registration_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_socio_by_session_or_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_socio_profile_secure TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_emergente_socio TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_socio_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_experience_transfer TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reserved_seats_by_experience TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_transfer_submissions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_provider_transfer_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_transfer_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_all_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_all_submissions TO authenticated;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- ==============================================================================

-- 6.1 Habilitación de RLS en todas las tablas
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_fundadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_transferencias ENABLE ROW LEVEL SECURITY;

-- 6.3 Políticas en socios
DROP POLICY IF EXISTS "Socios can read own profile by auth_user_id" ON public.socios;
CREATE POLICY "Socios can read own profile by auth_user_id"
  ON public.socios
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Socios can update own profile" ON public.socios;
CREATE POLICY "Socios can update own profile"
  ON public.socios
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Permitir registro de socios" ON public.socios;
DROP POLICY IF EXISTS "Admins can insert socios" ON public.socios;
CREATE POLICY "Admins can insert socios"
  ON public.socios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.4 Políticas en administradores
-- Función auxiliar para verificar administradores activos sin recursión RLS
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can view admin_access" ON public.administradores;
DROP POLICY IF EXISTS "Users can view own admin_access" ON public.administradores;
DROP POLICY IF EXISTS "Users can view own administradores" ON public.administradores;
CREATE POLICY "Users can view own administradores"
  ON public.administradores
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR public.is_active_admin()
  );

-- 6.5 Políticas en postulaciones_fundadores
DROP POLICY IF EXISTS "Permitir postularse como fundador" ON public.postulaciones_fundadores;
CREATE POLICY "Permitir postularse como fundador"
  ON public.postulaciones_fundadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view postulaciones_fundadores" ON public.postulaciones_fundadores;
CREATE POLICY "Admins can view postulaciones_fundadores"
  ON public.postulaciones_fundadores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Admins can update postulaciones_fundadores" ON public.postulaciones_fundadores;
CREATE POLICY "Admins can update postulaciones_fundadores"
  ON public.postulaciones_fundadores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.6 Política para permitir nuevas postulaciones en prestadores
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

-- 6.7 Políticas en prestadores
DROP POLICY IF EXISTS "Providers can read their own access" ON public.prestadores;
DROP POLICY IF EXISTS "Prestadores can read own profile" ON public.prestadores;
CREATE POLICY "Prestadores can read own profile"
  ON public.prestadores
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Providers can update their own profile" ON public.prestadores;
DROP POLICY IF EXISTS "Prestadores can update own profile" ON public.prestadores;
CREATE POLICY "Prestadores can update own profile"
  ON public.prestadores
  FOR UPDATE
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    AND active = true
  )
  WITH CHECK (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    AND active = true
  );

DROP POLICY IF EXISTS "Admins can manage provider_access" ON public.prestadores;
DROP POLICY IF EXISTS "Admins can manage prestadores" ON public.prestadores;
CREATE POLICY "Admins can manage prestadores"
  ON public.prestadores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.8 Políticas en historial_bancario
DROP POLICY IF EXISTS "Admins and providers can view banking history" ON public.historial_bancario;
CREATE POLICY "Admins and providers can view banking history"
  ON public.historial_bancario
  FOR SELECT
  TO authenticated
  USING (
    LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.9 Políticas en experiencias
DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas" ON public.experiencias;
DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas anon" ON public.experiencias;
DROP POLICY IF EXISTS "Lectura de experiencias para usuarios autenticados" ON public.experiencias;

CREATE POLICY "Lectura publica de experiencias publicadas anon"
  ON public.experiencias
  FOR SELECT
  TO anon
  USING (status = 'publicada');

CREATE POLICY "Lectura de experiencias para usuarios autenticados"
  ON public.experiencias
  FOR SELECT
  TO authenticated
  USING (
    status = 'publicada'
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR (
      provider_email IS NOT NULL
      AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Gestion total de experiencias para administradores" ON public.experiencias;
CREATE POLICY "Gestion total de experiencias para administradores"
  ON public.experiencias
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Prestadores pueden proponer experiencias" ON public.experiencias;
CREATE POLICY "Prestadores pueden proponer experiencias"
  ON public.experiencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prestadores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Prestadores pueden actualizar sus experiencias" ON public.experiencias;
CREATE POLICY "Prestadores pueden actualizar sus experiencias"
  ON public.experiencias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prestadores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prestadores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- 6.10 Políticas en pagos_transferencias
DROP POLICY IF EXISTS "Permitir registrar comprobante de pago" ON public.pagos_transferencias;
CREATE POLICY "Permitir registrar comprobante de pago"
  ON public.pagos_transferencias
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios leen sus propios pagos o reservas" ON public.pagos_transferencias;
CREATE POLICY "Usuarios leen sus propios pagos o reservas"
  ON public.pagos_transferencias
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.experiencias e
      WHERE e.id = experience_id
        AND LOWER(e.provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Gestion de comprobantes para admins y prestadores" ON public.pagos_transferencias;
CREATE POLICY "Gestion de comprobantes para admins y prestadores"
  ON public.pagos_transferencias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.experiencias e
      JOIN public.prestadores pa ON LOWER(pa.email) = LOWER(e.provider_email)
      WHERE e.id = experience_id
        AND LOWER(pa.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND pa.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.experiencias e
      JOIN public.prestadores pa ON LOWER(pa.email) = LOWER(e.provider_email)
      WHERE e.id = experience_id
        AND LOWER(pa.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND pa.active = true
    )
  );

-- ==============================================================================
-- 7. STORAGE BUCKETS Y POLÍTICAS DE ALMACENAMIENTO
-- ==============================================================================

-- 7.1 Bucket comprobantes (Privado)
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
    DROP POLICY IF EXISTS "Permitir subida publica de comprobantes" ON storage.objects;
    CREATE POLICY "Permitir subida publica de comprobantes"
      ON storage.objects
      FOR INSERT
      TO public, anon, authenticated
      WITH CHECK (bucket_id = 'comprobantes');

    DROP POLICY IF EXISTS "Lectura de comprobantes para admins y prestadores" ON storage.objects;
    CREATE POLICY "Lectura de comprobantes para admins y prestadores"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'comprobantes'
        AND (
          EXISTS (
            SELECT 1 FROM public.administradores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.prestadores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudieron configurar politicas en storage.objects (%).', SQLERRM;
END;
$$;

-- 7.2 Bucket experiencias (Público)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'experiencias',
      'experiencias',
      true,
      52428800,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
    )
    ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = 52428800,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudo configurar storage.buckets para experiencias (%).', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "Lectura publica de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Lectura publica de fotos de experiencias"
      ON storage.objects
      FOR SELECT
      TO public, anon, authenticated
      USING (bucket_id = 'experiencias');

    DROP POLICY IF EXISTS "Subida de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Subida de fotos de experiencias"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'experiencias'
        AND (
          EXISTS (
            SELECT 1 FROM public.administradores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.prestadores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
        )
      );

    DROP POLICY IF EXISTS "Actualizacion de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Actualizacion de fotos de experiencias"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'experiencias'
        AND (
          EXISTS (
            SELECT 1 FROM public.administradores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR (
            (auth.uid()::text = owner::text)
            AND EXISTS (
              SELECT 1 FROM public.prestadores
              WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
            )
          )
        )
      );

    DROP POLICY IF EXISTS "Eliminacion de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Eliminacion de fotos de experiencias"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'experiencias'
        AND (
          EXISTS (
            SELECT 1 FROM public.administradores
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR (
            (auth.uid()::text = owner::text)
            AND EXISTS (
              SELECT 1 FROM public.prestadores
              WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
            )
          )
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudieron crear politicas en storage.objects para experiencias (%).', SQLERRM;
END;
$$;
