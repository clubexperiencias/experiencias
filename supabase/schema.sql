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

CREATE INDEX IF NOT EXISTS idx_socios_email    ON public.socios(email);
CREATE INDEX IF NOT EXISTS idx_socios_position ON public.socios(position);

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

ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS pleno_activated_at TIMESTAMPTZ;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS pleno_expires_at TIMESTAMPTZ;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS pleno_discount_code TEXT;

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

-- 2.5 prestadores (Accesos, Postulaciones y Datos Bancarios de Prestadores)
CREATE TABLE IF NOT EXISTS public.prestadores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL DEFAULT '',
  agency                  TEXT NOT NULL DEFAULT '',
  active                  BOOLEAN NOT NULL DEFAULT true,
  status                  TEXT NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado', 'pendiente', 'rechazado', 'dado_de_baja')),
  tier                    TEXT NOT NULL DEFAULT 'emergente' CHECK (tier IN ('emergente', 'pleno', 'fundador')),
  rubro                   TEXT NOT NULL DEFAULT '',
  verified                BOOLEAN NOT NULL DEFAULT false,
  rating_score            NUMERIC(3,2) NOT NULL DEFAULT 5.00 CHECK (rating_score >= 1.0 AND rating_score <= 5.0),
  rating_count            INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  cbu_alias               TEXT NOT NULL DEFAULT '',
  cuit_dni                TEXT NOT NULL DEFAULT '',
  bank_name               TEXT NOT NULL DEFAULT '',
  account_holder          TEXT NOT NULL DEFAULT '',
  phone                   TEXT NOT NULL DEFAULT '',
  website                 TEXT NOT NULL DEFAULT '',
  social_media            TEXT NOT NULL DEFAULT '',
  social_media_secondary  TEXT NOT NULL DEFAULT '',
  slug                    TEXT NOT NULL DEFAULT '',
  bio                     TEXT NOT NULL DEFAULT '',
  avatar_url              TEXT NOT NULL DEFAULT '',
  cover_url               TEXT NOT NULL DEFAULT '',
  category                TEXT NOT NULL DEFAULT '',
  region                  TEXT NOT NULL DEFAULT 'Catamarca',
  description             TEXT NOT NULL DEFAULT '',
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestadores_email ON public.prestadores(email);
CREATE INDEX IF NOT EXISTS idx_prestadores_tier ON public.prestadores(tier);
CREATE INDEX IF NOT EXISTS idx_prestadores_rating ON public.prestadores(rating_score DESC, rating_count DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestadores_nonempty_slug
  ON public.prestadores(slug)
  WHERE slug IS NOT NULL AND slug <> '';

-- Cuenta Oficial del Club de Experiencias como Prestador Institucional
INSERT INTO public.prestadores (
  email, name, agency, slug, phone, cbu_alias, cuit_dni, bank_name, account_holder, bio, website, active, status,
  tier, rubro, verified, rating_score, rating_count
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
  'aprobado',
  'fundador',
  'Operador Oficial del Club',
  true,
  5.00,
  1
) ON CONFLICT (email) DO UPDATE SET
  agency = EXCLUDED.agency,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  tier = 'fundador',
  rubro = COALESCE(NULLIF(public.prestadores.rubro, ''), 'Operador Oficial del Club'),
  verified = true,
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

-- 2.7.1 historial_mp (Auditoría de Vinculaciones y Modificaciones de Mercado Pago)
CREATE TABLE IF NOT EXISTS public.historial_mp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email  TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('connect', 'disconnect', 'update')),
  collector_id    TEXT,
  mp_nickname     TEXT,
  mp_email        TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  changed_by      TEXT NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_mp_email ON public.historial_mp(provider_email);
CREATE INDEX IF NOT EXISTS idx_historial_mp_changed_at ON public.historial_mp(changed_at DESC);

-- 2.8 experiencias (Catálogo Oficial de Rutas y Salidas)
CREATE TABLE IF NOT EXISTS public.experiencias (
  id                       TEXT PRIMARY KEY,
  slug                     TEXT NOT NULL UNIQUE,
  title                    TEXT NOT NULL,
  short_title              TEXT DEFAULT '',
  kicker                   TEXT DEFAULT '',
  tagline                  TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  region                   TEXT NOT NULL DEFAULT 'Valle Central y Ambato',
  meeting_point            TEXT NOT NULL DEFAULT '',
  meeting_point_url        TEXT NOT NULL DEFAULT '',
  difficulty               TEXT NOT NULL DEFAULT 'Ninguna'
                           CHECK (
                             difficulty IN ('Ninguna', 'Baja', 'Moderada', 'Exigente', 'Alta Montaña')
                             OR difficulty ILIKE 'ninguna%'
                             OR difficulty ILIKE 'baja%'
                             OR difficulty ILIKE 'moderada%'
                             OR difficulty ILIKE 'exigente%'
                             OR difficulty ILIKE 'alta%'
                           ),
  duration_label           TEXT NOT NULL DEFAULT '4 horas',
  price_ars                INTEGER NOT NULL DEFAULT 65000 CHECK (price_ars >= 0),
  price_usd                INTEGER DEFAULT 70,
  capacity_per_date        INTEGER NOT NULL DEFAULT 12 CHECK (capacity_per_date >= 1),
  dates                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_slots               JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'publicada'
                           CHECK (status IN ('borrador', 'pendiente', 'publicada', 'oculta', 'rechazada')),
  display_location         TEXT NOT NULL DEFAULT 'catalogo'
                           CHECK (display_location IN ('catalogo', 'destacada', 'no_listada')),
  category                 TEXT NOT NULL DEFAULT 'expediciones',
  public_url               TEXT DEFAULT '',
  cover_image              TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg',
  cover_image_name         TEXT,
  cover_video_name         TEXT,
  album_photos             JSONB DEFAULT '[]'::jsonb,
  gallery_images           JSONB DEFAULT '[]'::jsonb,
  video_url                TEXT DEFAULT '/assets/videos/kayak.mp4',
  video_poster             TEXT DEFAULT '/assets/images/kayak-video.png',
  altitude_meters          INTEGER DEFAULT 850,
  best_season              TEXT DEFAULT '',
  itinerary                TEXT DEFAULT '',
  highlights               JSONB DEFAULT '[]'::jsonb,
  included                 JSONB DEFAULT '[]'::jsonb,
  not_included             JSONB DEFAULT '[]'::jsonb,
  promos_and_pricing       TEXT DEFAULT '',
  pricing_packs            JSONB DEFAULT '[]'::jsonb,
  participant_requirements TEXT NOT NULL DEFAULT '',
  notes                    TEXT,
  reviewed_at              TIMESTAMPTZ,
  is_locked                BOOLEAN NOT NULL DEFAULT false,
  is_exclusive_club        BOOLEAN NOT NULL DEFAULT true,
  is_club_experience       BOOLEAN NOT NULL DEFAULT false,
  favorites_count          INTEGER NOT NULL DEFAULT 0 CHECK (favorites_count >= 0),
  provider_id              UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  provider_agency          TEXT NOT NULL DEFAULT '',
  provider_slug            TEXT,
  provider_name            TEXT,
  provider_email           TEXT DEFAULT 'patriciofacundodiaztillar@gmail.com' REFERENCES public.prestadores(email) ON UPDATE CASCADE ON DELETE SET NULL,
  provider_phone           TEXT,
  provider_cbu_alias       TEXT,
  provider_cuit_dni        TEXT,
  provider_bank_name       TEXT,
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'expediciones';
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS pricing_packs JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_experiencias_slug ON public.experiencias(slug);
CREATE INDEX IF NOT EXISTS idx_experiencias_category ON public.experiencias(category);
CREATE INDEX IF NOT EXISTS idx_experiencias_display ON public.experiencias(display_location, is_locked, status);
CREATE INDEX IF NOT EXISTS idx_experiencias_provider_id ON public.experiencias(provider_id);
CREATE INDEX IF NOT EXISTS idx_experiencias_favorites ON public.experiencias(favorites_count DESC);

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
  date                     TEXT,
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
  receipt_storage_key      TEXT,
  receipt_storage_provider TEXT DEFAULT 'supabase',
  status                   TEXT NOT NULL DEFAULT 'pendiente'
                           CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  rejection_reason         TEXT,
  reviewed_by              TEXT,
  reviewed_at              TIMESTAMPTZ,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_reference ON public.pagos_transferencias(reference);
CREATE INDEX IF NOT EXISTS idx_pagos_email     ON public.pagos_transferencias(email);
CREATE INDEX IF NOT EXISTS idx_pagos_status    ON public.pagos_transferencias(status);

-- 2.10 calificaciones_prestadores (Votos y Reseñas de Socios para Prestadores)
CREATE TABLE IF NOT EXISTS public.calificaciones_prestadores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id   UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  socio_id       UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  socio_email    TEXT NOT NULL,
  score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comentario     TEXT DEFAULT '',
  experience_id  TEXT REFERENCES public.experiencias(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_calificaciones_prestador_socio UNIQUE (prestador_id, socio_email)
);

CREATE INDEX IF NOT EXISTS idx_calif_prestador_id ON public.calificaciones_prestadores(prestador_id);
CREATE INDEX IF NOT EXISTS idx_calif_socio_email  ON public.calificaciones_prestadores(socio_email);
CREATE INDEX IF NOT EXISTS idx_calif_experience_id ON public.calificaciones_prestadores(experience_id);

-- 2.11 experiencias_favoritas (Favoritos y Wishlist de Socios)
CREATE TABLE IF NOT EXISTS public.experiencias_favoritas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id       UUID REFERENCES public.socios(id) ON DELETE CASCADE,
  socio_email    TEXT NOT NULL,
  experience_id  TEXT NOT NULL REFERENCES public.experiencias(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_experiencias_favoritas_socio_exp UNIQUE (socio_email, experience_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_fav_socio_email   ON public.experiencias_favoritas(socio_email);
CREATE INDEX IF NOT EXISTS idx_exp_fav_experience_id ON public.experiencias_favoritas(experience_id);
CREATE INDEX IF NOT EXISTS idx_exp_fav_socio_id      ON public.experiencias_favoritas(socio_id);

-- Vista retrocompatible para referencias heredadas
DROP VIEW IF EXISTS public.experiencias_favoritos CASCADE;
CREATE VIEW public.experiencias_favoritos AS
  SELECT * FROM public.experiencias_favoritas;

-- 2.12 descuentos (Cupones y Promociones Dinámicas)
CREATE TABLE IF NOT EXISTS public.descuentos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT DEFAULT '',
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value      NUMERIC NOT NULL CHECK (discount_value > 0),
  scope               TEXT NOT NULL DEFAULT 'general' CHECK (scope IN ('general', 'experience', 'provider', 'membership')),
  experience_id       TEXT REFERENCES public.experiencias(id) ON UPDATE CASCADE ON DELETE SET NULL,
  experience_slug     TEXT,
  provider_id         UUID REFERENCES public.prestadores(id) ON UPDATE CASCADE ON DELETE SET NULL,
  is_automatic        BOOLEAN NOT NULL DEFAULT false,
  min_amount_ars      NUMERIC NOT NULL DEFAULT 0 CHECK (min_amount_ars >= 0),
  max_discount_ars    NUMERIC CHECK (max_discount_ars IS NULL OR max_discount_ars > 0),
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  max_uses            INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count          INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_descuentos_code_upper ON public.descuentos (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_descuentos_active ON public.descuentos (active);
CREATE INDEX IF NOT EXISTS idx_descuentos_experience_id ON public.descuentos (experience_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_provider_id ON public.descuentos (provider_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_scope ON public.descuentos (scope);

DO $$
BEGIN
  ALTER TABLE public.descuentos DROP CONSTRAINT IF EXISTS descuentos_scope_check;
  ALTER TABLE public.descuentos ADD CONSTRAINT descuentos_scope_check CHECK (scope IN ('general', 'experience', 'provider', 'membership'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

ALTER TABLE public.descuentos ADD COLUMN IF NOT EXISTS duration_months INTEGER CHECK (duration_months IS NULL OR duration_months > 0);
ALTER TABLE public.descuentos ADD COLUMN IF NOT EXISTS pleno_only BOOLEAN NOT NULL DEFAULT false;

-- Baja automática de Socios Plenos con membresía promocional vencida
CREATE OR REPLACE FUNCTION public.expire_overdue_pleno_memberships()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.socios
  SET
    membership_tier = 'emergente',
    updated_at = now()
  WHERE membership_tier IN ('activo', 'pleno')
    AND pleno_expires_at IS NOT NULL
    AND pleno_expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_pleno_memberships() TO authenticated, service_role;

-- ==============================================================================
-- 3. VISTAS
-- ==============================================================================

-- 3.1 estadisticas_socios (Métricas y conteos de la comunidad de socios)
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
DROP VIEW IF EXISTS public.perfiles_publicos CASCADE;
CREATE VIEW public.perfiles_publicos AS
SELECT
  id,
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
  tier,
  rubro,
  verified,
  rating_score,
  rating_count,
  category,
  region,
  active,
  status
FROM public.prestadores
WHERE active = true AND status = 'aprobado';

GRANT SELECT ON public.perfiles_publicos TO anon, authenticated;

-- 3.3 v_prestadores_ranking (Ranking Oficial Dinámico y Ponderado)
DROP VIEW IF EXISTS public.v_prestadores_ranking CASCADE;
CREATE VIEW public.v_prestadores_ranking AS
SELECT
  p.id,
  p.name,
  p.agency,
  p.slug,
  p.email,
  p.phone,
  p.avatar_url,
  p.cover_url,
  p.tier,
  p.rubro,
  p.category,
  p.region,
  p.verified,
  p.rating_score,
  p.rating_count,
  p.active,
  p.status,
  ROW_NUMBER() OVER (
    ORDER BY
      CASE p.tier
        WHEN 'fundador' THEN 1
        WHEN 'pleno' THEN 2
        WHEN 'emergente' THEN 3
        ELSE 4
      END ASC,
      p.rating_score DESC,
      p.rating_count DESC,
      p.created_at ASC
  ) AS ranking_position,
  COUNT(e.id) FILTER (WHERE e.status = 'publicada') AS active_experiences_count
FROM public.prestadores p
LEFT JOIN public.experiencias e ON (e.provider_id = p.id OR LOWER(TRIM(e.provider_email)) = LOWER(TRIM(p.email)))
WHERE p.active = true AND p.status = 'aprobado'
GROUP BY p.id;

GRANT SELECT ON public.v_prestadores_ranking TO anon, authenticated;

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

DROP TRIGGER IF EXISTS calificaciones_prestadores_updated_at ON public.calificaciones_prestadores;
CREATE TRIGGER calificaciones_prestadores_updated_at
  BEFORE UPDATE ON public.calificaciones_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS descuentos_updated_at ON public.descuentos;
CREATE TRIGGER descuentos_updated_at
  BEFORE UPDATE ON public.descuentos
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
  v_is_expiry_rpc BOOLEAN := false;
BEGIN
  GET DIAGNOSTICS v_context = PG_CONTEXT;
  IF v_context LIKE '%register_socio%' OR v_context LIKE '%activate_socio_pleno%' THEN
    v_is_registration_rpc := true;
  END IF;
  IF v_context LIKE '%expire_overdue_pleno_memberships%' THEN
    v_is_expiry_rpc := true;
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
  ELSIF v_is_registration_rpc AND NEW.membership_tier = 'activo' THEN
    -- Permitir elevación de nivel a Socio Pleno ('activo') desde la RPC autorizada
    IF NEW.position IS NULL AND OLD.position IS NULL THEN
      NEW.position := nextval('public.socios_position_seq');
    END IF;
  ELSIF v_is_expiry_rpc AND OLD.membership_tier IN ('activo', 'pleno') AND NEW.membership_tier = 'emergente' THEN
    -- Permitir baja automática por vencimiento desde expire_overdue_pleno_memberships
    NULL;
  ELSIF NEW.position IS DISTINCT FROM OLD.position OR
        NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar la categoría o posición del socio.';
  END IF;

  IF NOT v_is_registration_rpc AND (
       NEW.pleno_expires_at IS DISTINCT FROM OLD.pleno_expires_at OR
       NEW.pleno_activated_at IS DISTINCT FROM OLD.pleno_activated_at OR
       NEW.pleno_discount_code IS DISTINCT FROM OLD.pleno_discount_code
     ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores o la RPC de activación pueden modificar la vigencia de Socio Pleno.';
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

-- 4.8 Recálculo automático de promedio y votos en prestadores
CREATE OR REPLACE FUNCTION public.recalculate_prestador_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prestador_id UUID;
  v_score NUMERIC(3,2);
  v_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_prestador_id := OLD.prestador_id;
  ELSE
    v_prestador_id := NEW.prestador_id;
  END IF;

  IF v_prestador_id IS NOT NULL THEN
    PERFORM 1
    FROM public.prestadores
    WHERE id = v_prestador_id
    FOR UPDATE;

    SELECT
      COALESCE(ROUND(AVG(score)::numeric, 2), 5.00),
      COUNT(*)::INTEGER
    INTO v_score, v_count
    FROM public.calificaciones_prestadores
    WHERE prestador_id = v_prestador_id;

    UPDATE public.prestadores
    SET
      rating_score = CASE WHEN v_count = 0 THEN 5.00 ELSE v_score END,
      rating_count = v_count,
      updated_at = now()
    WHERE id = v_prestador_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_calificaciones_prestadores_rating ON public.calificaciones_prestadores;
CREATE TRIGGER trg_calificaciones_prestadores_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.calificaciones_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_prestador_rating();

-- 4.9 Contador de favoritas en catálogo de experiencias
CREATE OR REPLACE FUNCTION public.sync_experiencias_favoritas_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exp_id TEXT;
  v_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_exp_id := OLD.experience_id;
  ELSE
    v_exp_id := NEW.experience_id;
  END IF;

  IF v_exp_id IS NOT NULL THEN
    PERFORM 1
    FROM public.experiencias
    WHERE id = v_exp_id
    FOR UPDATE;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.experiencias_favoritas
    WHERE experience_id = v_exp_id;

    UPDATE public.experiencias
    SET favorites_count = v_count
    WHERE id = v_exp_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Compatibilidad retroactiva
CREATE OR REPLACE FUNCTION public.sync_experiencias_favorites_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.sync_experiencias_favoritas_count();
END;
$$;

DROP TRIGGER IF EXISTS trg_experiencias_favorites_count ON public.experiencias_favoritas;
DROP TRIGGER IF EXISTS trg_experiencias_favoritas_count ON public.experiencias_favoritas;
CREATE TRIGGER trg_experiencias_favoritas_count
  AFTER INSERT OR DELETE ON public.experiencias_favoritas
  FOR EACH ROW EXECUTE FUNCTION public.sync_experiencias_favoritas_count();

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
DROP FUNCTION IF EXISTS public.submit_provider_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_provider_application(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_category TEXT DEFAULT 'guia_montaña',
  p_region TEXT DEFAULT 'Puna & Fiambalá',
  p_website TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_agency TEXT DEFAULT '',
  p_auto_approve BOOLEAN DEFAULT false,
  p_tier TEXT DEFAULT 'emergente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_jwt_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_status TEXT;
  v_active BOOLEAN;
  v_tier TEXT := COALESCE(NULLIF(TRIM(p_tier), ''), 'emergente');
  v_auto BOOLEAN := COALESCE(p_auto_approve, false)
    AND v_tier = 'emergente'
    AND v_jwt_email <> ''
    AND v_jwt_email = v_email;
  v_slug_base TEXT;
  v_slug TEXT := NULL;
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

  IF v_auto THEN
    v_slug_base := regexp_replace(
      lower(COALESCE(NULLIF(TRIM(p_agency), ''), NULLIF(TRIM(p_name), ''), split_part(v_email, '@', 1))),
      '[^a-z0-9]+',
      '-',
      'g'
    );
    v_slug_base := trim(both '-' from left(v_slug_base, 55));
    IF v_slug_base = '' THEN
      v_slug_base := 'prestador';
    END IF;
    v_slug := v_slug_base || '-' || substr(md5(v_email || clock_timestamp()::text), 1, 5);
  END IF;

  INSERT INTO public.prestadores (
    email,
    name,
    agency,
    slug,
    phone,
    category,
    region,
    website,
    description,
    tier,
    status,
    active
  )
  VALUES (
    v_email,
    TRIM(COALESCE(p_name, '')),
    TRIM(COALESCE(p_agency, '')),
    COALESCE(v_slug, ''),
    TRIM(COALESCE(p_phone, '')),
    COALESCE(NULLIF(TRIM(p_category), ''), 'guia_montaña'),
    COALESCE(NULLIF(TRIM(p_region), ''), 'Puna & Fiambalá'),
    TRIM(COALESCE(p_website, '')),
    TRIM(COALESCE(p_description, '')),
    v_tier,
    CASE WHEN v_auto THEN 'aprobado' ELSE 'pendiente' END,
    v_auto
  );

  RETURN jsonb_build_object('success', true, 'approved', v_auto);
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

GRANT EXECUTE ON FUNCTION public.submit_provider_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;

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

DROP FUNCTION IF EXISTS public.submit_experience_transfer(
  TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.submit_experience_transfer(
  TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.submit_experience_transfer(
  TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER
);

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
  p_receipt_storage_provider TEXT DEFAULT 'supabase',
  p_pricing_pack_id TEXT DEFAULT NULL,
  p_stay_length INTEGER DEFAULT NULL
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
  v_member_tier TEXT := 'emergente';
  v_capacity INTEGER := 12;
  v_unit_price INTEGER := 0;
  v_dates JSONB := '[]'::jsonb;
  v_date_slots JSONB := '[]'::jsonb;
  v_pricing_packs JSONB := '[]'::jsonb;
  v_provider_email TEXT := '';
  v_category TEXT := 'expediciones';
  v_check_date TEXT := p_date;
  v_slot JSONB;
  v_pack JSONB;
  v_matched_pack JSONB := NULL;
  v_pack_has_dates BOOLEAN := false;
  v_pack_has_weekdays BOOLEAN := false;
  v_pack_date_valid BOOLEAN := false;
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

  SELECT capacity_per_date, price_ars, dates, COALESCE(date_slots, '[]'::jsonb), COALESCE(pricing_packs, '[]'::jsonb), COALESCE(provider_email, ''), category
  INTO v_capacity, v_unit_price, v_dates, v_date_slots, v_pricing_packs, v_provider_email, v_category
  FROM public.experiencias
  WHERE id = p_experience_id
  LIMIT 1
  FOR UPDATE;

  SELECT
    id,
    CASE
      WHEN LOWER(COALESCE(membership_tier, 'emergente')) IN ('activo', 'pleno')
           AND pleno_expires_at IS NOT NULL
           AND pleno_expires_at <= now()
      THEN 'emergente'
      ELSE COALESCE(membership_tier, 'emergente')
    END
  INTO v_socio_id, v_member_tier
  FROM public.socios
  WHERE email = v_email
  LIMIT 1;

  IF v_capacity IS NULL THEN
    v_capacity := 12;
  END IF;

  IF p_date ~* '^\d{4}-\d{2}-\d{2}\s+al\s+' THEN
    v_check_date := (regexp_match(p_date, '^(\d{4}-\d{2}-\d{2})'))[1];
  ELSE
    v_check_date := p_date;
  END IF;

  IF v_dates IS NOT NULL AND jsonb_array_length(v_dates) > 0 AND NOT (v_dates ? v_check_date) THEN
    RETURN jsonb_build_object(
      'status', 'invalid_date',
      'message', 'La fecha seleccionada no está disponible.'
    );
  END IF;

  -- Validar si el slot específico de fecha está cerrado o tiene cupo diferenciado
  IF v_date_slots IS NOT NULL AND jsonb_array_length(v_date_slots) > 0 THEN
    FOR v_slot IN SELECT * FROM jsonb_array_elements(v_date_slots)
    LOOP
      IF (v_slot ->> 'date') = v_check_date THEN
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

  IF p_pricing_pack_id IS NOT NULL AND TRIM(p_pricing_pack_id) <> '' THEN
    IF v_pricing_packs IS NOT NULL AND jsonb_typeof(v_pricing_packs) = 'array' THEN
      FOR v_pack IN SELECT * FROM jsonb_array_elements(v_pricing_packs)
      LOOP
        IF (v_pack ->> 'id') = TRIM(p_pricing_pack_id)
           AND COALESCE((v_pack ->> 'active')::boolean, true) IS TRUE
           AND COALESCE((v_pack ->> 'seats')::integer, 0) = p_participants THEN
          v_pack_has_dates := jsonb_typeof(v_pack -> 'validDates') = 'array' AND jsonb_array_length(v_pack -> 'validDates') > 0;
          v_pack_has_weekdays := jsonb_typeof(v_pack -> 'validWeekdays') = 'array' AND jsonb_array_length(v_pack -> 'validWeekdays') > 0;
          v_pack_date_valid := false;
          IF NOT v_pack_has_dates AND NOT v_pack_has_weekdays THEN
            v_pack_date_valid := true;
          ELSIF p_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
            IF v_pack_has_dates AND (v_pack -> 'validDates') ? p_date THEN
              v_pack_date_valid := true;
            END IF;
            IF NOT v_pack_date_valid AND v_pack_has_weekdays THEN
              SELECT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(v_pack -> 'validWeekdays') AS wd
                WHERE wd::integer = EXTRACT(DOW FROM p_date::date)::integer
              ) INTO v_pack_date_valid;
            END IF;
          END IF;

          IF v_pack_date_valid THEN
            v_matched_pack := v_pack;
            EXIT;
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF v_matched_pack IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'invalid_amount',
        'message', 'El pack promocional seleccionado no es válido para esta fecha o cantidad de cupos.'
      );
    END IF;
  END IF;

  IF (v_unit_price IS NOT NULL AND v_unit_price > 0) OR v_matched_pack IS NOT NULL THEN
    IF v_matched_pack IS NOT NULL THEN
      v_expected_subtotal := GREATEST(0, COALESCE((v_matched_pack ->> 'totalPriceArs')::integer, 0));
    ELSIF v_category = 'hospedajes' OR p_date ~* '\d+\s*noche' THEN
      v_expected_subtotal := v_unit_price * GREATEST(1, COALESCE(p_stay_length, (regexp_match(p_date, '(\d+)\s*noche', 'i'))[1]::integer, 1));
    ELSE
      v_expected_subtotal := v_unit_price * p_participants;
    END IF;

    IF p_discount_code IS NOT NULL AND TRIM(p_discount_code) <> '' THEN
      SELECT
        CASE
          WHEN discount_type = 'percentage' THEN
            CASE
              WHEN max_discount_ars IS NOT NULL AND max_discount_ars > 0 THEN
                LEAST(ROUND((v_expected_subtotal * discount_value) / 100)::integer, max_discount_ars::integer)
              ELSE
                ROUND((v_expected_subtotal * discount_value) / 100)::integer
            END
          WHEN discount_type = 'fixed_amount' THEN
            LEAST(v_expected_subtotal, discount_value::integer)
          ELSE 0
        END
      INTO v_expected_discount
      FROM public.descuentos
      WHERE UPPER(code) = UPPER(TRIM(p_discount_code))
        AND active = true
        AND (COALESCE(pleno_only, false) = false OR LOWER(v_member_tier) IN ('activo', 'pleno', 'fundador'))
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
        AND (min_amount_ars IS NULL OR min_amount_ars <= v_expected_subtotal)
        AND (
          scope = 'general'
          OR (scope = 'experience' AND (experience_id = p_experience_id OR experience_slug = (SELECT slug FROM public.experiencias WHERE id = p_experience_id LIMIT 1)))
          OR (scope = 'provider' AND provider_id = (SELECT provider_id FROM public.experiencias WHERE id = p_experience_id LIMIT 1))
        )
      LIMIT 1;

      IF v_expected_discount IS NULL THEN
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

-- 5.15 can_socio_rate_provider (Verificación de elegibilidad para calificar prestador)
DROP FUNCTION IF EXISTS public.can_socio_rate_provider(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.can_socio_rate_provider(
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_socio_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_socio_id UUID;
  v_prestador_email TEXT;
  v_has_approved_payment BOOLEAN := false;
  v_already_rated BOOLEAN := false;
  v_current_score INTEGER := NULL;
  v_current_comment TEXT := '';
BEGIN
  IF v_socio_email = '' THEN
    RETURN jsonb_build_object(
      'can_vote', false,
      'has_voted', false,
      'reason', 'Debes ser socio e iniciar sesión para calificar a un prestador.'
    );
  END IF;

  SELECT id INTO v_socio_id FROM public.socios WHERE LOWER(email) = v_socio_email;
  SELECT LOWER(email) INTO v_prestador_email FROM public.prestadores WHERE id = p_provider_id;

  IF v_prestador_email IS NULL THEN
    RETURN jsonb_build_object(
      'can_vote', false,
      'has_voted', false,
      'reason', 'El prestador solicitado no existe.'
    );
  END IF;

  -- Verificar si el socio tiene al menos un pago aprobado con este prestador
  SELECT EXISTS (
    SELECT 1 FROM public.pagos_transferencias pt
    WHERE (LOWER(TRIM(pt.email)) = v_socio_email OR (v_socio_id IS NOT NULL AND pt.socio_id = v_socio_id))
      AND pt.status = 'aprobado'
      AND (
        LOWER(TRIM(COALESCE(pt.provider_email, ''))) = v_prestador_email
        OR pt.experience_id IN (
          SELECT id FROM public.experiencias
          WHERE provider_id = p_provider_id OR LOWER(TRIM(provider_email)) = v_prestador_email
        )
      )
  ) INTO v_has_approved_payment;

  -- Verificar si ya votó previamente
  SELECT
    EXISTS (
      SELECT 1 FROM public.calificaciones_prestadores
      WHERE prestador_id = p_provider_id AND LOWER(socio_email) = v_socio_email
    ),
    (
      SELECT score FROM public.calificaciones_prestadores
      WHERE prestador_id = p_provider_id AND LOWER(socio_email) = v_socio_email
      LIMIT 1
    ),
    (
      SELECT comentario FROM public.calificaciones_prestadores
      WHERE prestador_id = p_provider_id AND LOWER(socio_email) = v_socio_email
      LIMIT 1
    )
  INTO v_already_rated, v_current_score, v_current_comment;

  IF NOT v_has_approved_payment THEN
    RETURN jsonb_build_object(
      'can_vote', false,
      'has_voted', v_already_rated,
      'current_score', v_current_score,
      'current_comment', COALESCE(v_current_comment, ''),
      'reason', 'Solo los socios que hayan completado una experiencia con este prestador pueden calificarlo.'
    );
  END IF;

  RETURN jsonb_build_object(
    'can_vote', true,
    'has_voted', v_already_rated,
    'current_score', v_current_score,
    'current_comment', COALESCE(v_current_comment, ''),
    'reason', 'Habilitado para calificar'
  );
END;
$$;

-- 5.16 submit_prestador_rating (Registro atómico y seguro de calificación)
DROP FUNCTION IF EXISTS public.submit_prestador_rating(UUID, INTEGER, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_prestador_rating(
  p_provider_id UUID,
  p_score INTEGER,
  p_comentario TEXT DEFAULT '',
  p_experience_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_email TEXT;
  v_socio_id UUID;
  v_eligibility JSONB;
BEGIN
  v_caller_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Acceso no autenticado: Debes iniciar sesión como socio para calificar.';
  END IF;

  IF p_score < 1 OR p_score > 5 THEN
    RAISE EXCEPTION 'Puntaje inválido: debe estar comprendido entre 1 y 5 estrellas.';
  END IF;

  -- Comprobar elegibilidad obligatoria
  v_eligibility := public.can_socio_rate_provider(p_provider_id);
  IF NOT (v_eligibility ->> 'can_vote')::boolean THEN
    RAISE EXCEPTION '%', (v_eligibility ->> 'reason');
  END IF;

  SELECT id INTO v_socio_id FROM public.socios WHERE LOWER(email) = v_caller_email;

  -- Insertar o actualizar voto
  INSERT INTO public.calificaciones_prestadores (
    prestador_id,
    socio_id,
    socio_email,
    score,
    comentario,
    experience_id,
    updated_at
  ) VALUES (
    p_provider_id,
    v_socio_id,
    v_caller_email,
    p_score,
    COALESCE(p_comentario, ''),
    p_experience_id,
    now()
  )
  ON CONFLICT (prestador_id, socio_email) DO UPDATE
  SET
    score = EXCLUDED.score,
    comentario = CASE WHEN EXCLUDED.comentario <> '' THEN EXCLUDED.comentario ELSE public.calificaciones_prestadores.comentario END,
    experience_id = COALESCE(EXCLUDED.experience_id, public.calificaciones_prestadores.experience_id),
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Calificación registrada exitosamente.'
  );
END;
$$;

-- 5.17 toggle_experiencia_favorita (Gestión atómica de experiencias favoritas de socios)
DROP FUNCTION IF EXISTS public.toggle_experiencia_favorita(TEXT);
DROP FUNCTION IF EXISTS public.toggle_experiencia_favorito(TEXT);
DROP FUNCTION IF EXISTS public.toggle_experiencia_favorito(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_experiencia_favorita(
  p_experience_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_email TEXT;
  v_socio_id UUID;
  v_is_fav BOOLEAN;
  v_total_favs INTEGER;
  v_resolved_exp_id TEXT;
BEGIN
  v_caller_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Debes ser socio e iniciar sesión para marcar favoritos.';
  END IF;

  -- Resolver id real de la experiencia en public.experiencias
  SELECT id INTO v_resolved_exp_id
  FROM public.experiencias
  WHERE id = p_experience_id OR LOWER(slug) = LOWER(p_experience_id)
  LIMIT 1;

  IF v_resolved_exp_id IS NULL THEN
    v_resolved_exp_id := p_experience_id;
  END IF;

  SELECT id INTO v_socio_id FROM public.socios WHERE LOWER(email) = v_caller_email;

  SELECT EXISTS (
    SELECT 1 FROM public.experiencias_favoritas
    WHERE LOWER(socio_email) = v_caller_email AND experience_id = v_resolved_exp_id
  ) INTO v_is_fav;

  IF v_is_fav THEN
    DELETE FROM public.experiencias_favoritas
    WHERE LOWER(socio_email) = v_caller_email AND experience_id = v_resolved_exp_id;
    v_is_fav := false;
  ELSE
    INSERT INTO public.experiencias_favoritas (socio_id, socio_email, experience_id)
    VALUES (v_socio_id, v_caller_email, v_resolved_exp_id)
    ON CONFLICT (socio_email, experience_id) DO NOTHING;
    v_is_fav := true;
  END IF;

  SELECT favorites_count INTO v_total_favs FROM public.experiencias WHERE id = v_resolved_exp_id;

  RETURN jsonb_build_object(
    'is_favorite', v_is_fav,
    'favorites_count', COALESCE(v_total_favs, 0)
  );
END;
$$;

-- Alias retrocompatible
CREATE OR REPLACE FUNCTION public.toggle_experiencia_favorito(
  p_experience_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.toggle_experiencia_favorita(p_experience_id);
END;
$$;

-- 5.18 get_my_provider_ratings (Lectura segura de calificaciones propias del socio autenticado)
CREATE OR REPLACE FUNCTION public.get_my_provider_ratings()
RETURNS TABLE (
  prestador_id UUID,
  score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_caller_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cp.prestador_id, cp.score
  FROM public.calificaciones_prestadores cp
  WHERE LOWER(cp.socio_email) = v_caller_email;
END;
$$;

-- Obtener votos y reseñas detalladas de un prestador (solo administradores autorizados)
CREATE OR REPLACE FUNCTION public.get_calificaciones_prestador_admin(
  p_prestador_id UUID
)
RETURNS TABLE (
  id UUID,
  prestador_id UUID,
  socio_id UUID,
  socio_email TEXT,
  score INTEGER,
  comentario TEXT,
  experience_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Caller authorization: Solo administradores activos
  IF NOT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores activos pueden consultar el detalle de votantes';
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.prestador_id,
    cp.socio_id,
    cp.socio_email,
    cp.score,
    cp.comentario,
    cp.experience_id,
    cp.created_at,
    cp.updated_at
  FROM public.calificaciones_prestadores cp
  WHERE cp.prestador_id = p_prestador_id
  ORDER BY cp.created_at DESC;
END;
$$;

-- 5.19 record_discount_redemption (Redención de cupones y registro seguro de usos)
CREATE OR REPLACE FUNCTION public.record_discount_redemption(
  p_code TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_discount public.descuentos%ROWTYPE;
BEGIN
  IF v_code = '' THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  SELECT * INTO v_discount
  FROM public.descuentos
  WHERE UPPER(code) = v_code AND active = true
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_discount.max_uses IS NOT NULL AND v_discount.uses_count >= v_discount.max_uses THEN
    RETURN jsonb_build_object('status', 'max_uses_reached');
  END IF;

  UPDATE public.descuentos
  SET uses_count = uses_count + 1,
      updated_at = now()
  WHERE id = v_discount.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_discount.id,
    'code', v_discount.code,
    'uses_count', v_discount.uses_count + 1
  );
END;
$$;

-- 5.20 admin_soft_delete_experience (Baja lógica y liberación de slug para administradores)
CREATE OR REPLACE FUNCTION public.admin_soft_delete_experience(
  p_experience_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp public.experiencias%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_new_slug TEXT;
  v_notes JSONB;
BEGIN
  -- 1. Validar que el usuario sea administrador activo
  IF NOT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores activos pueden dar de baja experiencias';
  END IF;

  -- 2. Buscar la experiencia
  SELECT * INTO v_exp
  FROM public.experiencias
  WHERE id = p_experience_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Experiencia no encontrada');
  END IF;

  -- 3. Si ya estaba eliminada, retornar ok idempotente
  IF v_exp.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_deleted', 'id', v_exp.id, 'slug', v_exp.slug);
  END IF;

  -- 4. Liberar el slug agregando sufijo único de borrado para permitir reutilización inmediata
  v_new_slug := v_exp.slug || '--deleted-' || to_char(v_now, 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6);

  -- 5. Preservar o inicializar metadatos en notes
  BEGIN
    IF v_exp.notes IS NOT NULL AND TRIM(v_exp.notes) LIKE '{%' THEN
      v_notes := v_exp.notes::jsonb;
    ELSE
      v_notes := jsonb_build_object('previous_notes', COALESCE(v_exp.notes, ''));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_notes := jsonb_build_object('previous_notes', COALESCE(v_exp.notes, ''));
  END;

  v_notes := v_notes || jsonb_build_object(
    'deleted', true,
    'deleted_at', v_now,
    'deleted_by', COALESCE(auth.jwt() ->> 'email', 'admin_portal'),
    'original_slug', v_exp.slug
  );

  -- 6. Actualizar registro: status oculta, display no listada, slug liberado, timestamp
  UPDATE public.experiencias
  SET
    status = 'oculta',
    display_location = 'no_listada',
    slug = v_new_slug,
    deleted_at = v_now,
    notes = v_notes::text,
    updated_at = v_now
  WHERE id = v_exp.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_exp.id,
    'original_slug', v_exp.slug,
    'freed_slug', v_new_slug,
    'deleted_at', v_now
  );
END;
$$;

-- 5.21 activate_socio_pleno_atomic (Activación segura de membresía Socio Pleno con cupón promocional)
CREATE OR REPLACE FUNCTION public.activate_socio_pleno_atomic(
  p_email TEXT,
  p_full_name TEXT,
  p_dni TEXT,
  p_phone TEXT,
  p_discount_code TEXT DEFAULT NULL,
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
  v_code TEXT := UPPER(TRIM(COALESCE(p_discount_code, '')));
  v_jwt_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_auth_uid UUID := auth.uid();
  v_socio public.socios%ROWTYPE;
  v_discount public.descuentos%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_pleno_expires_at TIMESTAMPTZ := NULL;
  v_subtotal NUMERIC := 23000;
  v_discount_ars NUMERIC := 0;
  v_remaining_balance NUMERIC := 23000;
BEGIN
  -- 1. Validaciones básicas de entrada
  IF v_email = '' OR v_name = '' OR length(v_dni) < 7 OR length(v_dni) > 9 OR v_phone = '' THEN
    RETURN jsonb_build_object('status', 'invalid_input', 'message', 'Completá todos los campos obligatorios.');
  END IF;

  -- 2. Validar autenticación
  IF v_auth_uid IS NULL OR v_jwt_email <> v_email THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'message', 'Se requiere autenticación válida vía Google.');
  END IF;

  -- 3. Validar código de descuento (requerido para activación) y recalcular saldo independiente contra ARS 23.000
  IF v_code = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid_code',
      'message', 'Por el momento, la activación de Socio Pleno está habilitada para personas elegidas por el Club con código promocional.'
    );
  END IF;

  SELECT * INTO v_discount
  FROM public.descuentos
  WHERE UPPER(code) = v_code
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Códigos estándar predefinidos de cortesía (bonificación total del 100%) sólo si no existe fila registrada
    IF v_code IN ('PLENO100', 'SOCIO100', 'LANZAMIENTO100', 'BONIFICADO100', 'CLUB100') THEN
      v_discount_ars := v_subtotal;
      v_remaining_balance := 0;
    ELSE
      RETURN jsonb_build_object(
        'status', 'invalid_code',
        'message', 'El código de descuento no es válido o está inactivo.'
      );
    END IF;
  ELSE
    -- Rechazar si el cupón registrado está inactivo
    IF NOT v_discount.active THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'El código de descuento está inactivo.');
    END IF;

    -- Validar vigencia
    IF v_discount.starts_at IS NOT NULL AND v_discount.starts_at > v_now THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'Esta promoción aún no comenzó.');
    END IF;
    IF v_discount.ends_at IS NOT NULL AND v_discount.ends_at < v_now THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'Este código promocional ha expirado.');
    END IF;
    IF v_discount.max_uses IS NOT NULL AND v_discount.uses_count >= v_discount.max_uses THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'Este código promocional alcanzó el límite máximo de usos.');
    END IF;

    -- Validar scope: 'general' o 'membership'
    IF v_discount.scope NOT IN ('general', 'membership') THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'Este cupón solo aplica para expediciones específicas y no para membresías.');
    END IF;

    -- Validar monto mínimo si aplica (min_amount_ars)
    IF v_discount.min_amount_ars IS NOT NULL AND v_discount.min_amount_ars > 0 AND v_subtotal < v_discount.min_amount_ars THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'message', 'El monto de la membresía no alcanza el mínimo requerido para este cupón.');
    END IF;

    -- Recalcular descuento efectivo independientemente contra ARS 23.000
    IF v_discount.discount_type = 'percentage' THEN
      v_discount_ars := ROUND((v_subtotal * v_discount.discount_value) / 100.0);
      -- Aplicar tope máximo de descuento si está configurado (max_discount_ars)
      IF v_discount.max_discount_ars IS NOT NULL AND v_discount.max_discount_ars > 0 THEN
        v_discount_ars := LEAST(v_discount_ars, v_discount.max_discount_ars);
      END IF;
    ELSIF v_discount.discount_type = 'fixed_amount' THEN
      v_discount_ars := ROUND(v_discount.discount_value);
    ELSE
      v_discount_ars := 0;
    END IF;

    -- Acotar descuento entre 0 y el subtotal
    v_discount_ars := GREATEST(0, LEAST(v_discount_ars, v_subtotal));
    v_remaining_balance := v_subtotal - v_discount_ars;

    -- Rechazar activación salvo que el saldo restante calculado sea cero
    IF v_remaining_balance > 0 THEN
      RETURN jsonb_build_object(
        'status', 'invalid_code',
        'message', 'Por el momento, la activación inmediata requiere un cupón que cubra el 100% de la membresía.'
      );
    END IF;

    IF v_discount.duration_months IS NOT NULL AND v_discount.duration_months > 0 THEN
      v_pleno_expires_at := v_now + make_interval(months => v_discount.duration_months);
    END IF;
  END IF;

  -- 4. Registrar o actualizar socio con categoría 'activo' (Socio Pleno)
  SELECT * INTO v_socio FROM public.socios WHERE email = v_email LIMIT 1;
  IF FOUND THEN
    -- Proteger cuadro vitalicio: si ya es Socio Fundador (Nivel 3), rechazar la degradación a nivel inferior
    IF v_socio.membership_tier = 'fundador' THEN
      RETURN jsonb_build_object(
        'status', 'already_fundador',
        'message', 'Ya contás con la membresía vitalicia de Socio Fundador (Nivel 3). No es posible cambiar a una categoría inferior.'
      );
    END IF;

    -- Validar DNI único si ya está registrado en otra cuenta
    IF v_dni <> '' AND EXISTS (SELECT 1 FROM public.socios WHERE dni = v_dni AND email <> v_email) THEN
      RETURN jsonb_build_object('status', 'already_registered_dni', 'message', 'Ya existe un socio registrado con este DNI.');
    END IF;

    UPDATE public.socios
    SET
      full_name = v_name,
      dni = v_dni,
      phone = v_phone,
      membership_tier = 'activo',
      pleno_activated_at = v_now,
      pleno_expires_at = v_pleno_expires_at,
      pleno_discount_code = NULLIF(v_code, ''),
      position = CASE WHEN position IS NULL THEN nextval('public.socios_position_seq') ELSE position END,
      experiences_wishlist = CASE WHEN p_experiences_wishlist IS NOT NULL THEN p_experiences_wishlist ELSE experiences_wishlist END,
      experiences_other = CASE WHEN p_experiences_other IS NOT NULL AND TRIM(p_experiences_other) <> '' THEN TRIM(p_experiences_other) ELSE experiences_other END,
      auth_user_id = v_auth_uid,
      updated_at = v_now
    WHERE email = v_email
    RETURNING * INTO v_socio;
  ELSE
    -- Validar DNI único si es nuevo
    IF EXISTS (SELECT 1 FROM public.socios WHERE dni = v_dni AND dni <> '') THEN
      RETURN jsonb_build_object('status', 'already_registered_dni', 'message', 'Ya existe un socio registrado con este DNI.');
    END IF;

    INSERT INTO public.socios (
      email,
      full_name,
      dni,
      phone,
      experiences_wishlist,
      experiences_other,
      membership_tier,
      pleno_activated_at,
      pleno_expires_at,
      pleno_discount_code,
      position,
      auth_user_id,
      created_at,
      updated_at
    ) VALUES (
      v_email,
      v_name,
      v_dni,
      v_phone,
      COALESCE(p_experiences_wishlist, '[]'::jsonb),
      TRIM(p_experiences_other),
      'activo',
      v_now,
      v_pleno_expires_at,
      NULLIF(v_code, ''),
      nextval('public.socios_position_seq'),
      v_auth_uid,
      v_now,
      v_now
    )
    RETURNING * INTO v_socio;
  END IF;

  -- 5. Incrementar uso del cupón sólo tras la inserción o actualización exitosa del socio
  IF v_discount.id IS NOT NULL THEN
    UPDATE public.descuentos
    SET uses_count = uses_count + 1,
        updated_at = v_now
    WHERE id = v_discount.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'socio', to_jsonb(v_socio) - 'registration_token'
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
REVOKE EXECUTE ON FUNCTION public.can_socio_rate_provider(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_socio_rate_provider(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_prestador_rating(UUID, INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_prestador_rating(UUID, INTEGER, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_experiencia_favorita(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_experiencia_favorita(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_experiencia_favorito(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_experiencia_favorito(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_provider_ratings() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_ratings() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_calificaciones_prestador_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_calificaciones_prestador_admin(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_discount_redemption(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_experience(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_socio_pleno_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) Y POLÍTICAS
-- ==============================================================================

-- 6.1 Habilitación de RLS en todas las tablas
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_fundadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_mp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiencias_favoritas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descuentos ENABLE ROW LEVEL SECURITY;

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
GRANT SELECT ON public.administradores TO anon;
GRANT SELECT ON public.experiencias TO anon;

DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.prestadores;
CREATE POLICY "Permitir postularse como prestador"
  ON public.prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
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
    )
    OR (
      status = 'aprobado'
      AND active = true
      AND COALESCE(tier, 'emergente') = 'emergente'
      AND (auth.role() = 'authenticated' OR (auth.jwt() ->> 'email') IS NOT NULL)
      AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
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

-- 6.8.1 Políticas en historial_mp (Privada: Solo Administradores)
DROP POLICY IF EXISTS "Solo administradores pueden ver historial mp" ON public.historial_mp;
CREATE POLICY "Solo administradores pueden ver historial mp"
  ON public.historial_mp
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Usuarios autenticados registran eventos en historial mp" ON public.historial_mp;

-- 6.9 Políticas en experiencias
GRANT SELECT ON public.experiencias TO anon, authenticated;
GRANT ALL ON public.experiencias TO authenticated;
GRANT ALL ON public.experiencias TO service_role;

DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas" ON public.experiencias;
DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas anon" ON public.experiencias;
DROP POLICY IF EXISTS "Lectura de experiencias para usuarios autenticados" ON public.experiencias;

CREATE POLICY "Lectura publica de experiencias publicadas anon"
  ON public.experiencias
  FOR SELECT
  TO anon
  USING (status = 'publicada' AND deleted_at IS NULL);

CREATE POLICY "Lectura de experiencias para usuarios autenticados"
  ON public.experiencias
  FOR SELECT
  TO authenticated
  USING (
    (status = 'publicada' AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR (
      provider_email IS NOT NULL
      AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND deleted_at IS NULL
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

-- 6.11 Políticas en calificaciones_prestadores
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.calificaciones_prestadores FROM anon, authenticated;
GRANT SELECT (id, prestador_id, score, comentario, experience_id, created_at, updated_at)
  ON public.calificaciones_prestadores TO anon, authenticated;

DROP POLICY IF EXISTS "Lectura publica de calificaciones de prestadores" ON public.calificaciones_prestadores;
CREATE POLICY "Lectura publica de calificaciones de prestadores"
  ON public.calificaciones_prestadores
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Socios pueden registrar sus calificaciones" ON public.calificaciones_prestadores;
DROP POLICY IF EXISTS "Admins pueden registrar calificaciones" ON public.calificaciones_prestadores;
CREATE POLICY "Admins pueden registrar calificaciones"
  ON public.calificaciones_prestadores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Socios pueden actualizar sus propias calificaciones" ON public.calificaciones_prestadores;
DROP POLICY IF EXISTS "Admins pueden actualizar calificaciones" ON public.calificaciones_prestadores;
CREATE POLICY "Admins pueden actualizar calificaciones"
  ON public.calificaciones_prestadores
  FOR UPDATE
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

DROP POLICY IF EXISTS "Admins pueden eliminar calificaciones" ON public.calificaciones_prestadores;
CREATE POLICY "Admins pueden eliminar calificaciones"
  ON public.calificaciones_prestadores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.12 Políticas en experiencias_favoritas
GRANT SELECT, INSERT, DELETE ON public.experiencias_favoritas TO authenticated;
GRANT SELECT ON public.experiencias_favoritos TO authenticated;

DROP POLICY IF EXISTS "Socios leen sus propios favoritos" ON public.experiencias_favoritas;
DROP POLICY IF EXISTS "Socios leen sus propias experiencias favoritas" ON public.experiencias_favoritas;
CREATE POLICY "Socios leen sus propias experiencias favoritas"
  ON public.experiencias_favoritas
  FOR SELECT
  TO authenticated
  USING (
    LOWER(socio_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Socios agregan sus propios favoritos" ON public.experiencias_favoritas;
DROP POLICY IF EXISTS "Socios agregan sus propias experiencias favoritas" ON public.experiencias_favoritas;
CREATE POLICY "Socios agregan sus propias experiencias favoritas"
  ON public.experiencias_favoritas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    LOWER(socio_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Socios eliminan sus propios favoritos" ON public.experiencias_favoritas;
DROP POLICY IF EXISTS "Socios eliminan sus propias experiencias favoritas" ON public.experiencias_favoritas;
CREATE POLICY "Socios eliminan sus propias experiencias favoritas"
  ON public.experiencias_favoritas
  FOR DELETE
  TO authenticated
  USING (
    LOWER(socio_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.13 Políticas en descuentos
DROP POLICY IF EXISTS "Admins gestionan descuentos" ON public.descuentos;
CREATE POLICY "Admins gestionan descuentos"
  ON public.descuentos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
  );

DROP POLICY IF EXISTS "Lectura publica de descuentos activos" ON public.descuentos;
CREATE POLICY "Lectura publica de descuentos activos"
  ON public.descuentos
  FOR SELECT
  TO public, anon, authenticated
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

GRANT SELECT ON public.descuentos TO anon, authenticated;
GRANT ALL ON public.descuentos TO authenticated;

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
    DROP POLICY IF EXISTS "Permitir subida de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Permitir subida de fotos de experiencias"
      ON storage.objects
      FOR INSERT
      TO public, anon, authenticated
      WITH CHECK (bucket_id = 'experiencias');

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

-- ============================================================================
-- 10. TESTIMONIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.testimonios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id        UUID REFERENCES public.socios(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL DEFAULT '',
  membership_tier TEXT NOT NULL DEFAULT 'emergente'
                  CHECK (membership_tier IN ('fundador', 'activo', 'emergente', 'waitlist')),
  content         TEXT NOT NULL CHECK (length(trim(content)) >= 10 AND length(content) <= 1500),
  active          BOOLEAN NOT NULL DEFAULT true,
  featured        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_testimonios_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_testimonios_email   ON public.testimonios(email);
CREATE INDEX IF NOT EXISTS idx_testimonios_tier    ON public.testimonios(membership_tier);
CREATE INDEX IF NOT EXISTS idx_testimonios_active  ON public.testimonios(active);
CREATE INDEX IF NOT EXISTS idx_testimonios_socioid ON public.testimonios(socio_id);

ALTER TABLE public.testimonios ENABLE ROW LEVEL SECURITY;

-- Politica: lectura publica de testimonios activos
DROP POLICY IF EXISTS "Lectura publica de testimonios activos" ON public.testimonios;
CREATE POLICY "Lectura publica de testimonios activos"
  ON public.testimonios
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Politica: administradores gestion completa
DROP POLICY IF EXISTS "Administradores gestion de testimonios" ON public.testimonios;
CREATE POLICY "Administradores gestion de testimonios"
  ON public.testimonios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
    )
  );

-- Politica: socio puede ver su propio testimonio (incluso si se encuentra inactivo)
DROP POLICY IF EXISTS "Socio gestion de su propio testimonio" ON public.testimonios;
DROP POLICY IF EXISTS "Socio lectura de su propio testimonio" ON public.testimonios;
CREATE POLICY "Socio lectura de su propio testimonio"
  ON public.testimonios
  FOR SELECT
  TO authenticated
  USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- Revocación de permisos de escritura directa para authenticated y anon.
-- La publicación y edición de testimonios por parte de socios se gestiona
-- exclusivamente a través de la función SECURITY DEFINER submit_socio_testimonio(),
-- previniendo manipulación de campos privilegiados (membership_tier, featured, active, socio_id).
REVOKE INSERT, UPDATE, DELETE ON public.testimonios FROM anon, authenticated;

-- Restricción de acceso a nivel de columnas para el rol anon:
-- Se revoca SELECT completo y solo se conceden las columnas públicas no sensibles,
-- impidiendo que consultas directas o fallbacks expongan campos de identidad privada (email, full_name, socio_id).
REVOKE SELECT ON public.testimonios FROM anon;
GRANT SELECT (
  id,
  membership_tier,
  content,
  featured,
  active,
  created_at,
  updated_at
) ON public.testimonios TO anon;
GRANT SELECT ON public.testimonios TO authenticated;
GRANT ALL ON public.testimonios TO service_role;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_testimonios_updated_at ON public.testimonios;
CREATE TRIGGER trg_testimonios_updated_at
  BEFORE UPDATE ON public.testimonios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RPC: public.submit_socio_testimonio
DROP FUNCTION IF EXISTS public.submit_socio_testimonio(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_socio_testimonio(
  p_content TEXT,
  p_email   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_email       TEXT;
  v_email           TEXT;
  v_socio_id        UUID;
  v_full_name       TEXT;
  v_membership_tier TEXT;
  v_content         TEXT;
  v_testimonio_id   UUID;
  v_created_at      TIMESTAMPTZ;
  v_updated_at      TIMESTAMPTZ;
  v_is_admin        BOOLEAN := false;
BEGIN
  -- Requerir sesión JWT verificada para autorizar la publicación
  v_jwt_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  IF v_jwt_email = '' OR v_jwt_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no autenticada o token inválido');
  END IF;

  -- Verificar si el llamador es un administrador activo
  SELECT EXISTS (
    SELECT 1 FROM public.administradores
    WHERE LOWER(email) = v_jwt_email AND active = true
  ) INTO v_is_admin;

  -- Si es administrador y especificó p_email, permitirlo; de lo contrario, exigir coincidencia con el JWT
  IF v_is_admin AND p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
    v_email := LOWER(TRIM(p_email));
  ELSE
    IF p_email IS NOT NULL AND TRIM(p_email) <> '' AND LOWER(TRIM(p_email)) <> v_jwt_email THEN
      RETURN jsonb_build_object('success', false, 'error', 'No autorizado: el email no coincide con la sesión autenticada');
    END IF;
    v_email := v_jwt_email;
  END IF;

  v_content := TRIM(p_content);
  IF length(v_content) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El testimonio debe tener al menos 10 caracteres');
  END IF;
  IF length(v_content) > 1500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El testimonio no puede superar los 1500 caracteres');
  END IF;

  -- Buscar socio registrado
  SELECT id, COALESCE(full_name, ''), membership_tier, created_at
  INTO v_socio_id, v_full_name, v_membership_tier, v_created_at
  FROM public.socios
  WHERE LOWER(email) = v_email
  LIMIT 1;

  IF v_socio_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo los socios registrados pueden publicar un testimonio');
  END IF;

  -- Upsert en testimonios
  INSERT INTO public.testimonios (
    socio_id,
    email,
    full_name,
    membership_tier,
    content,
    active,
    updated_at
  )
  VALUES (
    v_socio_id,
    v_email,
    v_full_name,
    COALESCE(v_membership_tier, 'emergente'),
    v_content,
    true,
    now()
  )
  ON CONFLICT (email) DO UPDATE
  SET
    socio_id        = EXCLUDED.socio_id,
    full_name       = EXCLUDED.full_name,
    membership_tier = EXCLUDED.membership_tier,
    content         = EXCLUDED.content,
    active          = true,
    updated_at      = now()
  RETURNING id, updated_at INTO v_testimonio_id, v_updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_testimonio_id,
    'email', v_email,
    'full_name', v_full_name,
    'membership_tier', v_membership_tier,
    'content', v_content,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_socio_testimonio(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_socio_testimonio(TEXT, TEXT) TO authenticated, service_role;

-- RPC: public.get_socios_testimonios (proyección pública anónima sin email ni full_name)
DROP FUNCTION IF EXISTS public.get_socios_testimonios();
CREATE OR REPLACE FUNCTION public.get_socios_testimonios()
RETURNS TABLE (
  id              UUID,
  author_display  TEXT,
  membership_tier TEXT,
  tier_label      TEXT,
  member_since    TIMESTAMPTZ,
  content         TEXT,
  payments_count  INTEGER,
  featured        BOOLEAN,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    CASE
      WHEN COALESCE(s.full_name, t.full_name, '') = '' THEN 'Socio del Club'
      ELSE (
        SELECT
          initcap(trim(parts[1])) ||
          CASE
            WHEN array_length(parts, 1) > 1 THEN ' ' || upper(left(trim(parts[array_length(parts, 1)]), 1)) || '.'
            ELSE ''
          END
        FROM (SELECT string_to_array(trim(COALESCE(s.full_name, t.full_name)), ' ') AS parts) sub
      )
    END AS author_display,
    COALESCE(s.membership_tier, t.membership_tier, 'emergente') AS membership_tier,
    CASE COALESCE(s.membership_tier, t.membership_tier, 'emergente')
      WHEN 'fundador'  THEN 'Socio Fundador'
      WHEN 'activo'    THEN 'Socio Pleno'
      WHEN 'emergente' THEN 'Socio Emergente'
      ELSE 'Socio del Club'
    END AS tier_label,
    COALESCE(s.created_at, t.created_at) AS member_since,
    t.content,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.pagos_transferencias pt
      WHERE (pt.socio_id = t.socio_id OR LOWER(TRIM(pt.email)) = LOWER(TRIM(t.email)))
        AND pt.status IN ('aprobado', 'pendiente')
    ), 0) AS payments_count,
    t.featured,
    t.created_at,
    t.updated_at
  FROM public.testimonios t
  LEFT JOIN public.socios s ON (s.id = t.socio_id OR LOWER(s.email) = LOWER(t.email))
  WHERE t.active = true
  ORDER BY
    CASE COALESCE(s.membership_tier, t.membership_tier, 'emergente')
      WHEN 'fundador'  THEN 1
      WHEN 'activo'    THEN 2
      WHEN 'emergente' THEN 3
      ELSE 4
    END ASC,
    payments_count DESC,
    t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_socios_testimonios() TO anon, authenticated, service_role;

-- RPC: public.get_my_socio_testimonio (Ruta autenticada segura para que el socio acceda a su registro completo)
DROP FUNCTION IF EXISTS public.get_my_socio_testimonio();
CREATE OR REPLACE FUNCTION public.get_my_socio_testimonio()
RETURNS TABLE (
  id              UUID,
  socio_id        UUID,
  email           TEXT,
  full_name       TEXT,
  author_display  TEXT,
  membership_tier TEXT,
  tier_label      TEXT,
  content         TEXT,
  featured        BOOLEAN,
  active          BOOLEAN,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_email TEXT;
BEGIN
  v_jwt_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  IF v_jwt_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.socio_id,
    t.email,
    t.full_name,
    CASE
      WHEN COALESCE(s.full_name, t.full_name, '') = '' THEN 'Socio del Club'
      ELSE (
        SELECT
          initcap(trim(parts[1])) ||
          CASE
            WHEN array_length(parts, 1) > 1 THEN ' ' || upper(left(trim(parts[array_length(parts, 1)]), 1)) || '.'
            ELSE ''
          END
        FROM (SELECT string_to_array(trim(COALESCE(s.full_name, t.full_name)), ' ') AS parts) sub
      )
    END AS author_display,
    COALESCE(s.membership_tier, t.membership_tier, 'emergente') AS membership_tier,
    CASE COALESCE(s.membership_tier, t.membership_tier, 'emergente')
      WHEN 'fundador'  THEN 'Socio Fundador'
      WHEN 'activo'    THEN 'Socio Pleno'
      WHEN 'emergente' THEN 'Socio Emergente'
      ELSE 'Socio del Club'
    END AS tier_label,
    t.content,
    t.featured,
    t.active,
    t.created_at,
    t.updated_at
  FROM public.testimonios t
  LEFT JOIN public.socios s ON (s.id = t.socio_id OR LOWER(s.email) = LOWER(t.email))
  WHERE LOWER(t.email) = v_jwt_email
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_socio_testimonio() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_socio_testimonio() TO authenticated, service_role;