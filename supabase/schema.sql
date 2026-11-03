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

CREATE SEQUENCE IF NOT EXISTS public.socios_position_seq START WITH 100;

-- ==============================================================================
-- 2. TABLAS E ÍNDICES
-- ==============================================================================

-- 2.1 waitlist (Prospectos y suscriptores de la landing)
CREATE TABLE IF NOT EXISTS public.waitlist (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  converted            BOOLEAN NOT NULL DEFAULT false,
  google_linked        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS converted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;

-- 2.2 socios (Socios Emergentes, Activos y Fundadores)
CREATE TABLE IF NOT EXISTS public.socios (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                       TEXT NOT NULL UNIQUE,
  full_name                   TEXT NOT NULL,
  dni                         TEXT NOT NULL,
  phone                       TEXT NOT NULL,
  experiences_wishlist        JSONB DEFAULT '[]'::jsonb,
  experiences_other           TEXT,
  position                    INTEGER DEFAULT nextval('public.socios_position_seq') UNIQUE,
  membership_tier             TEXT NOT NULL DEFAULT 'emergente'
                              CHECK (membership_tier IN ('emergente', 'activo', 'fundador')),
  auth_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  google_linked               BOOLEAN NOT NULL DEFAULT false,
  registration_token          UUID NOT NULL DEFAULT gen_random_uuid(),
  founder_motivation_letter   TEXT,
  founder_agreed_to_protocol  BOOLEAN NOT NULL DEFAULT false,
  founder_application_status  TEXT CHECK (founder_application_status IN ('pendiente', 'aprobado', 'rechazado')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_socios_email    ON public.socios(email);
CREATE INDEX IF NOT EXISTS idx_socios_position ON public.socios(position);
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS registration_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS founder_motivation_letter TEXT;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS founder_agreed_to_protocol BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS founder_application_status TEXT;

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

-- 2.3 admin_access (Nómina de Administradores con Rol)
CREATE TABLE IF NOT EXISTS public.admin_access (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'admin'
                       CHECK (role IN ('superadmin', 'admin', 'moderator')),
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_email ON public.admin_access(email);

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

-- 2.5 postulaciones_prestadores (Postulaciones de Guías y Operadores)
CREATE TABLE IF NOT EXISTS public.postulaciones_prestadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  category             TEXT NOT NULL,
  region               TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL,
  website              TEXT,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (status IN ('pendiente', 'aprobado', 'rechazado', 'dado_de_baja')),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_prestadores_email ON public.postulaciones_prestadores(email);
ALTER TABLE public.postulaciones_prestadores ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.postulaciones_prestadores ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.postulaciones_prestadores ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2.6 provider_access (Accesos y Datos Bancarios de Prestadores)
CREATE TABLE IF NOT EXISTS public.provider_access (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  agency         TEXT NOT NULL DEFAULT '',
  active         BOOLEAN NOT NULL DEFAULT true,
  status         TEXT NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado', 'pendiente', 'dado_de_baja')),
  cbu_alias      TEXT NOT NULL DEFAULT '',
  cuit_dni       TEXT NOT NULL DEFAULT '',
  bank_name      TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_access_email ON public.provider_access(email);
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS agency TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprobado';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS cbu_alias TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS cuit_dni TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS account_holder TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_access ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- 2.7 provider_banking_history (Auditoría de Modificaciones Bancarias)
CREATE TABLE IF NOT EXISTS public.provider_banking_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email TEXT NOT NULL,
  cbu_alias      TEXT,
  cuit_dni       TEXT,
  bank_name      TEXT,
  account_holder TEXT,
  changed_by     TEXT NOT NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_banking_history_email ON public.provider_banking_history(provider_email);
ALTER TABLE public.provider_banking_history ADD COLUMN IF NOT EXISTS old_account_holder TEXT;
ALTER TABLE public.provider_banking_history ADD COLUMN IF NOT EXISTS new_account_holder TEXT NOT NULL DEFAULT '';
ALTER TABLE public.provider_banking_history ADD COLUMN IF NOT EXISTS account_holder TEXT;

-- 2.8 experiencias (Catálogo Oficial de Rutas y Salidas)
CREATE TABLE IF NOT EXISTS public.experiencias (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
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
  date_slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status               TEXT NOT NULL DEFAULT 'publicada'
                       CHECK (status IN ('borrador', 'publicada', 'oculta')),
  public_url           TEXT DEFAULT '',
  cover_image          TEXT DEFAULT '/assets/images/kayak-club-de-experiencias.jpg',
  album_photos         JSONB DEFAULT '[]'::jsonb,
  video_url            TEXT DEFAULT '/assets/videos/kayak.mp4',
  video_poster         TEXT DEFAULT '/assets/images/kayak-video.png',
  altitude_meters      INTEGER DEFAULT 850,
  highlights           JSONB DEFAULT '[]'::jsonb,
  included             JSONB DEFAULT '[]'::jsonb,
  not_included         JSONB DEFAULT '[]'::jsonb,
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
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_phone TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_cbu_alias TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_cuit_dni TEXT;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS provider_bank_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_experiencias_provider_email' AND table_name = 'experiencias'
  ) THEN
    ALTER TABLE public.experiencias
      ADD CONSTRAINT fk_experiencias_provider_email
      FOREIGN KEY (provider_email) REFERENCES public.provider_access(email)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2.9 pagos_transferencias (Registro de Comprobantes de Pago)
CREATE TABLE IF NOT EXISTS public.pagos_transferencias (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference            TEXT NOT NULL UNIQUE,
  experience_id        TEXT NOT NULL REFERENCES public.experiencias(id) ON UPDATE CASCADE,
  experience_title     TEXT NOT NULL,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL DEFAULT '',
  dni                  TEXT NOT NULL DEFAULT '',
  selected_date        TEXT NOT NULL,
  participants         INTEGER NOT NULL DEFAULT 1 CHECK (participants >= 1),
  amount_ars           INTEGER NOT NULL CHECK (amount_ars >= 0),
  receipt_url          TEXT,
  receipt_storage_path TEXT,
  status               TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  rejection_reason     TEXT,
  reviewed_by          TEXT,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_reference ON public.pagos_transferencias(reference);
CREATE INDEX IF NOT EXISTS idx_pagos_email     ON public.pagos_transferencias(email);
CREATE INDEX IF NOT EXISTS idx_pagos_status    ON public.pagos_transferencias(status);
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.pagos_transferencias ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ==============================================================================
-- 3. VISTAS
-- ==============================================================================

DROP VIEW IF EXISTS public.waitlist_stats CASCADE;
CREATE VIEW public.waitlist_stats AS
SELECT
  COUNT(*)                                                               AS total_members,
  COALESCE(MAX(position), 100)                                           AS max_position,
  (SELECT COUNT(*) FROM public.socios)                                   AS total_socios,
  (SELECT COUNT(*) FROM public.waitlist)                                 AS total_waitlist,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'fundador') AS total_fundadores,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'activo')   AS total_activos,
  (SELECT COUNT(*) FROM public.socios WHERE membership_tier = 'emergente')AS total_emergentes,
  (SELECT COALESCE(MAX(position), 99) FROM public.socios)                AS last_position
FROM public.socios;

GRANT SELECT ON public.waitlist_stats TO anon, authenticated;

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

DROP TRIGGER IF EXISTS admin_access_updated_at ON public.admin_access;
CREATE TRIGGER admin_access_updated_at
  BEFORE UPDATE ON public.admin_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS postulaciones_fundadores_updated_at ON public.postulaciones_fundadores;
CREATE TRIGGER postulaciones_fundadores_updated_at
  BEFORE UPDATE ON public.postulaciones_fundadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS postulaciones_prestadores_updated_at ON public.postulaciones_prestadores;
CREATE TRIGGER postulaciones_prestadores_updated_at
  BEFORE UPDATE ON public.postulaciones_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS provider_access_updated_at ON public.provider_access;
CREATE TRIGGER provider_access_updated_at
  BEFORE UPDATE ON public.provider_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS experiencias_updated_at ON public.experiencias;
CREATE TRIGGER experiencias_updated_at
  BEFORE UPDATE ON public.experiencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS pagos_transferencias_updated_at ON public.pagos_transferencias;
CREATE TRIGGER pagos_transferencias_updated_at
  BEFORE UPDATE ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2 Normalización de waitlist
CREATE OR REPLACE FUNCTION public.normalize_waitlist_row()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email = LOWER(TRIM(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waitlist_normalize_before_write ON public.waitlist;
CREATE TRIGGER waitlist_normalize_before_write
  BEFORE INSERT OR UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.normalize_waitlist_row();

-- 4.3 Normalización de socios
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
      google_linked = true,
      updated_at = now()
  WHERE LOWER(email) = LOWER(NEW.email)
    AND (auth_user_id IS NULL OR auth_user_id <> NEW.id);

  UPDATE public.waitlist
  SET google_linked = true
  WHERE LOWER(email) = LOWER(NEW.email);

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
      NEW.google_linked = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS socios_before_insert_link_auth ON public.socios;
CREATE TRIGGER socios_before_insert_link_auth
  BEFORE INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.link_socio_to_existing_auth_user();

-- 4.6 Control y auditoría de datos bancarios de prestadores
CREATE OR REPLACE FUNCTION public.check_provider_access_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN := false;
  v_current_email TEXT;
BEGIN
  v_current_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT EXISTS (
    SELECT 1 FROM public.admin_access
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

DROP TRIGGER IF EXISTS trg_check_provider_access_update ON public.provider_access;
CREATE TRIGGER trg_check_provider_access_update
  BEFORE UPDATE ON public.provider_access
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

    INSERT INTO public.provider_banking_history (
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

DROP TRIGGER IF EXISTS trg_provider_banking_history ON public.provider_access;
CREATE TRIGGER trg_provider_banking_history
  AFTER UPDATE ON public.provider_access
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
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (v_email, false, COALESCE(p_google_linked, false))
  ON CONFLICT (email) DO UPDATE
  SET google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked;

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
  v_in_socios BOOLEAN := false;
  v_in_waitlist BOOLEAN := false;
  v_google_linked BOOLEAN := false;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object(
      'in_socios', false,
      'in_waitlist', false,
      'google_linked', false
    );
  END IF;

  SELECT true, COALESCE(s.google_linked, s.auth_user_id IS NOT NULL, false)
  INTO v_in_socios, v_google_linked
  FROM public.socios s
  WHERE s.email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    v_in_socios := false;
  END IF;

  SELECT true, COALESCE(v_google_linked, false) OR COALESCE(w.google_linked, false)
  INTO v_in_waitlist, v_google_linked
  FROM public.waitlist w
  WHERE w.email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    v_in_waitlist := false;
  END IF;

  RETURN jsonb_build_object(
    'in_socios', COALESCE(v_in_socios, false),
    'in_waitlist', COALESCE(v_in_waitlist, false),
    'google_linked', COALESCE(v_google_linked, false)
  );
END;
$$;

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
    IF v_socio.auth_user_id IS NULL OR v_socio.google_linked = false THEN
      UPDATE public.socios
      SET auth_user_id = v_auth_uid,
          google_linked = true
      WHERE id = v_socio.id
      RETURNING * INTO v_socio;
    END IF;
    RETURN jsonb_build_object('status', 'ok', 'socio', to_jsonb(v_socio));
  END IF;

  IF v_socio.google_linked = false
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
  ELSIF v_socio.google_linked = false
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
      google_linked = google_linked OR (v_auth_uid IS NOT NULL AND v_jwt_email = v_email),
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
          auth_user_id = v_auth_uid,
          google_linked = true,
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
    auth_user_id,
    google_linked
  )
  VALUES (
    v_email,
    v_name,
    v_dni,
    v_phone,
    COALESCE(p_experiences_wishlist, '[]'::jsonb),
    NULLIF(TRIM(COALESCE(p_experiences_other, '')), ''),
    'emergente',
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN v_auth_uid ELSE NULL END,
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN true ELSE false END
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (
    v_email,
    EXISTS (SELECT 1 FROM public.pagos_transferencias WHERE LOWER(TRIM(email)) = v_email),
    v_inserted.google_linked
  )
  ON CONFLICT (email) DO UPDATE
  SET converted = public.waitlist.converted OR EXISTS (SELECT 1 FROM public.pagos_transferencias WHERE LOWER(TRIM(email)) = v_email),
      google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked;

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
          auth_user_id = v_auth_uid,
          google_linked = true,
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
    auth_user_id,
    google_linked
  )
  VALUES (
    v_email,
    v_name,
    v_dni,
    v_phone,
    COALESCE(p_experiences_wishlist, '[]'::jsonb),
    NULLIF(TRIM(COALESCE(p_experiences_other, '')), ''),
    'emergente',
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN v_auth_uid ELSE NULL END,
    CASE WHEN v_auth_uid IS NOT NULL AND v_jwt_email = v_email THEN true ELSE false END
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (
    v_email,
    EXISTS (SELECT 1 FROM public.pagos_transferencias WHERE LOWER(TRIM(email)) = v_email),
    v_inserted.google_linked
  )
  ON CONFLICT (email) DO UPDATE
  SET converted = public.waitlist.converted OR EXISTS (SELECT 1 FROM public.pagos_transferencias WHERE LOWER(TRIM(email)) = v_email),
      google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked;

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
    provider_email,
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
    SELECT 1 FROM public.admin_access
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.provider_access
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_provider;

  IF NOT (v_is_admin OR v_is_provider) THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

  IF v_is_admin THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.submitted_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.pagos_transferencias t;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.submitted_at DESC), '[]'::jsonb)
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
    SELECT 1 FROM public.admin_access
    WHERE LOWER(email) = v_caller_email AND active = true
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.provider_access
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
        'googleLinked', COALESCE(s.google_linked, s.auth_user_id IS NOT NULL, false),
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
  FROM public.socios s;

  -- Prospectos de lista de espera:
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'type', 'waitlist',
        'email', w.email,
        'fullName', NULL,
        'dni', NULL,
        'phone', NULL,
        'position', NULL,
        'membershipTier', 'waitlist',
        'googleLinked', COALESCE(w.google_linked, false),
        'converted', (
          COALESCE(w.converted, false) OR EXISTS (
            SELECT 1 FROM public.pagos_transferencias p
            WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(w.email))
          )
        ),
        'paymentsCount', (
          SELECT COUNT(*)::INTEGER FROM public.pagos_transferencias p
          WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(w.email))
        ),
        'experiencesWishlist', '[]'::jsonb,
        'experiencesOther', NULL,
        'createdAt', w.created_at
      )
      ORDER BY w.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_waitlist
  FROM public.waitlist w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.socios s WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(w.email))
  );

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
    SELECT 1 FROM public.admin_access
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
        'date', p.date,
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
          'storageKey', p.receipt_storage_key,
          'provider', p.receipt_storage_provider
        ),
        'status', p.status,
        'rejectionReason', p.rejection_reason,
        'submittedAt', p.submitted_at,
        'reviewedAt', p.reviewed_at
      )
      ORDER BY p.submitted_at DESC
    ),
    '[]'::jsonb
  ) INTO v_subs
  FROM public.pagos_transferencias p;

  RETURN v_subs;
END;
$$;

-- Permisos de ejecución de RPCs
GRANT EXECUTE ON FUNCTION public.record_waitlist_email TO anon, authenticated;
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
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_fundadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_banking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_transferencias ENABLE ROW LEVEL SECURITY;

-- 6.2 Políticas en waitlist
DROP POLICY IF EXISTS "Permitir insercion anonima en waitlist" ON public.waitlist;
CREATE POLICY "Permitir insercion anonima en waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view waitlist" ON public.waitlist;
CREATE POLICY "Admins can view waitlist"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

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
      SELECT 1 FROM public.admin_access
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
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Permitir registro de socios" ON public.socios;
CREATE POLICY "Permitir registro de socios"
  ON public.socios
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 6.4 Políticas en admin_access
DROP POLICY IF EXISTS "Admins can view admin_access" ON public.admin_access;
CREATE POLICY "Admins can view admin_access"
  ON public.admin_access
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.admin_access a2
      WHERE LOWER(a2.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND a2.role = 'superadmin'
        AND a2.active = true
    )
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
      SELECT 1 FROM public.admin_access
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
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.6 Políticas en postulaciones_prestadores
DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.postulaciones_prestadores;
CREATE POLICY "Permitir postularse como prestador"
  ON public.postulaciones_prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view postulaciones_prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Admins can view postulaciones_prestadores"
  ON public.postulaciones_prestadores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

DROP POLICY IF EXISTS "Users can read own postulaciones_prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Users can read own postulaciones_prestadores"
  ON public.postulaciones_prestadores
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Admins can update postulaciones_prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Admins can update postulaciones_prestadores"
  ON public.postulaciones_prestadores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.7 Políticas en provider_access
DROP POLICY IF EXISTS "Providers can read their own access" ON public.provider_access;
CREATE POLICY "Providers can read their own access"
  ON public.provider_access
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Providers can update their own profile" ON public.provider_access;
CREATE POLICY "Providers can update their own profile"
  ON public.provider_access
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

DROP POLICY IF EXISTS "Admins can manage provider_access" ON public.provider_access;
CREATE POLICY "Admins can manage provider_access"
  ON public.provider_access
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

-- 6.8 Políticas en provider_banking_history
DROP POLICY IF EXISTS "Admins and providers can view banking history" ON public.provider_banking_history;
CREATE POLICY "Admins and providers can view banking history"
  ON public.provider_banking_history
  FOR SELECT
  TO authenticated
  USING (
    LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- 6.9 Políticas en experiencias
DROP POLICY IF EXISTS "Lectura publica de experiencias publicadas" ON public.experiencias;
CREATE POLICY "Lectura publica de experiencias publicadas"
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

DROP POLICY IF EXISTS "Prestadores pueden proponer experiencias" ON public.experiencias;
CREATE POLICY "Prestadores pueden proponer experiencias"
  ON public.experiencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.provider_access
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
      SELECT 1 FROM public.provider_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    AND LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.provider_access
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
      SELECT 1 FROM public.admin_access
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
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.experiencias e
      JOIN public.provider_access pa ON LOWER(pa.email) = LOWER(e.provider_email)
      WHERE e.id = experience_id
        AND LOWER(pa.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND pa.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.experiencias e
      JOIN public.provider_access pa ON LOWER(pa.email) = LOWER(e.provider_email)
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
            SELECT 1 FROM public.admin_access
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.provider_access
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
      10485760,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
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
            SELECT 1 FROM public.admin_access
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.provider_access
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
            SELECT 1 FROM public.admin_access
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR (
            (auth.uid()::text = owner::text)
            AND EXISTS (
              SELECT 1 FROM public.provider_access
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
            SELECT 1 FROM public.admin_access
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
          OR (
            (auth.uid()::text = owner::text)
            AND EXISTS (
              SELECT 1 FROM public.provider_access
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
