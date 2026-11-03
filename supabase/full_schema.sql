-- ============================================================
-- 001_identity_and_members.sql
-- EXPERIENCIAS.CLUB • Identity, Members, Waitlist & Admin Access
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABLA: waitlist (Prospectos y suscriptores de la landing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  converted            BOOLEAN NOT NULL DEFAULT false,
  google_linked        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);

-- Normalización estricta de waitlist (email minúsculas y sin espacios)
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

-- ============================================================
-- 2. SECUENCIA Y TABLA: socios (Socios Emergentes, Activos y Fundadores)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.socios_position_seq START WITH 100;

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

-- Trigger para updated_at automático
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

-- Trigger de normalización estricta en socios
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

-- ============================================================
-- 3. VINCULACIÓN CON SUPABASE AUTH (Google OAuth / Email)
-- ============================================================
-- 3.1 Cuando el usuario inicia sesión en auth.users, vincula auth_user_id y google_linked en socios y waitlist:
CREATE OR REPLACE FUNCTION public.handle_user_auth_link()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.socios
  SET auth_user_id = NEW.id,
      google_linked = true
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    AND (auth_user_id IS NULL OR auth_user_id != NEW.id OR google_linked = false);

  UPDATE public.waitlist
  SET google_linked = true
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    AND google_linked = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link_socio ON auth.users;
CREATE TRIGGER on_auth_user_created_link_socio
  AFTER INSERT OR UPDATE OF email, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_auth_link();

-- 3.2 Si el usuario ya existe en auth.users al registrarse o actualizarse en socios, asigna auth_user_id y google_linked:
CREATE OR REPLACE FUNCTION public.link_socio_to_existing_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  matching_auth_id UUID;
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    SELECT id INTO matching_auth_id
    FROM auth.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    LIMIT 1;

    IF matching_auth_id IS NOT NULL THEN
      NEW.auth_user_id = matching_auth_id;
    END IF;
  END IF;

  IF NEW.auth_user_id IS NOT NULL THEN
    NEW.google_linked = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_socio_insert_link_auth ON public.socios;
CREATE TRIGGER before_socio_insert_link_auth
  BEFORE INSERT OR UPDATE ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.link_socio_to_existing_auth_user();

-- ============================================================
-- 4. TABLA: admin_access (Accesos Administrativos Autorizados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'superadmin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS admin_access_updated_at ON public.admin_access;
CREATE TRIGGER admin_access_updated_at
  BEFORE UPDATE ON public.admin_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir consultar su propio acceso admin" ON public.admin_access;
CREATE POLICY "Permitir consultar su propio acceso admin"
  ON public.admin_access
  FOR SELECT
  TO authenticated
  USING (LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true);

REVOKE ALL ON public.admin_access FROM anon, PUBLIC;
GRANT SELECT ON public.admin_access TO authenticated;

-- Administradores iniciales
INSERT INTO public.admin_access (email, name, role, active)
VALUES 
  ('gonzagramaglia@gmail.com', 'Gonzalo Gramaglia', 'superadmin', true),
  ('vegvarel@gmail.com', 'Administrador Experiencias', 'superadmin', true),
  ('patriciofacundodiaztillar@gmail.com', 'Patricio Facundo Díaz Tillar', 'superadmin', true),
  ('admin@experiencias.club', 'Administrador Experiencias', 'superadmin', true)
ON CONFLICT (email) DO UPDATE 
SET active = true,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- ============================================================
-- 5. TABLA: postulaciones_fundadores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.postulaciones_fundadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL,
  motivation_letter    TEXT NOT NULL,
  agreed_to_protocol   BOOLEAN NOT NULL DEFAULT true CHECK (agreed_to_protocol = true),
  status               TEXT NOT NULL DEFAULT 'en_evaluacion'
                       CHECK (status IN ('en_evaluacion', 'aprobada', 'rechazada', 'dado_de_baja')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_fundadores_email ON public.postulaciones_fundadores(email);

DROP TRIGGER IF EXISTS postulaciones_fundadores_updated_at ON public.postulaciones_fundadores;
CREATE TRIGGER postulaciones_fundadores_updated_at
  BEFORE UPDATE ON public.postulaciones_fundadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. TABLA: postulaciones_prestadores (/experiencias/prestadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.postulaciones_prestadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'guia_montaña'
                       CHECK (category IN (
                         'guia_montaña',
                         'kayak_nautica',
                         'transporte_4x4',
                         'alojamiento',
                         'gastronomia',
                         'fotografia',
                         'cabalgatas',
                         'arqueologia',
                         'artesanias'
                       )),
  region               TEXT NOT NULL DEFAULT 'Puna & Fiambalá',
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL,
  website              TEXT NOT NULL,
  description          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (status IN ('pendiente', 'aprobado', 'rechazado', 'dado_de_baja')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_prestadores_email    ON public.postulaciones_prestadores(email);
CREATE INDEX IF NOT EXISTS idx_postulaciones_prestadores_category ON public.postulaciones_prestadores(category);
CREATE INDEX IF NOT EXISTS idx_postulaciones_prestadores_region   ON public.postulaciones_prestadores(region);

DROP TRIGGER IF EXISTS postulaciones_prestadores_updated_at ON public.postulaciones_prestadores;
CREATE TRIGGER postulaciones_prestadores_updated_at
  BEFORE UPDATE ON public.postulaciones_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. RPCs DE SOCIOS Y WAITLIST
-- ============================================================

-- 7.1 Registrar o actualizar correo en waitlist
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

-- 7.2 Consultar estado de registro de un correo
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

-- 7.3 Obtener socio de forma segura (sesión Auth o registration_token)
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

-- 7.4 Actualizar perfil de socio de forma segura
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

-- ============================================================
-- 8. SEGURIDAD Y PERMISOS (RLS)
-- ============================================================
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_fundadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postulaciones_prestadores ENABLE ROW LEVEL SECURITY;

-- Políticas waitlist
DROP POLICY IF EXISTS "Permitir guardar email en waitlist" ON public.waitlist;
CREATE POLICY "Permitir guardar email en waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura general de waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Admins can view all waitlist" ON public.waitlist;
CREATE POLICY "Admins can view all waitlist"
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

DROP POLICY IF EXISTS "Permitir consultar waitlist propio" ON public.waitlist;
CREATE POLICY "Permitir consultar waitlist propio"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email);

DROP POLICY IF EXISTS "Permitir actualizar waitlist propio" ON public.waitlist;
CREATE POLICY "Permitir actualizar waitlist propio"
  ON public.waitlist
  FOR UPDATE
  TO authenticated
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email)
  WITH CHECK (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email);

-- Políticas socios
DROP POLICY IF EXISTS "Permitir lectura general de socios" ON public.socios;

DROP POLICY IF EXISTS "Permitir consultar socio propio autenticado" ON public.socios;
CREATE POLICY "Permitir consultar socio propio autenticado"
  ON public.socios
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = auth_user_id
    OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email
  );

DROP POLICY IF EXISTS "Permitir actualizar socio propio autenticado" ON public.socios;
CREATE POLICY "Permitir actualizar socio propio autenticado"
  ON public.socios
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = auth_user_id
    OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email
  )
  WITH CHECK (
    auth.uid() = auth_user_id
    OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email
  );

-- Políticas postulaciones fundadores
DROP POLICY IF EXISTS "Permitir envío de postulaciones de fundadores" ON public.postulaciones_fundadores;
CREATE POLICY "Permitir envío de postulaciones de fundadores"
  ON public.postulaciones_fundadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar postulaciones de fundadores" ON public.postulaciones_fundadores;
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- Políticas postulaciones prestadores
DROP POLICY IF EXISTS "Permitir envío de postulaciones de prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Permitir envío de postulaciones de prestadores"
  ON public.postulaciones_prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar postulaciones de prestadores" ON public.postulaciones_prestadores;
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- Permisos y Grants
GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT SELECT, UPDATE ON public.waitlist TO authenticated;
GRANT SELECT, INSERT ON public.socios TO anon, authenticated;
GRANT UPDATE (full_name, dni, phone, experiences_wishlist, experiences_other, updated_at) ON public.socios TO authenticated;
GRANT INSERT ON public.postulaciones_fundadores TO anon, authenticated;
GRANT SELECT, UPDATE ON public.postulaciones_fundadores TO authenticated;
GRANT INSERT ON public.postulaciones_prestadores TO anon, authenticated;
GRANT SELECT, UPDATE ON public.postulaciones_prestadores TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.socios_position_seq TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_waitlist_email(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_registration_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_socio_by_session_or_token(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_socio_profile_secure(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- ============================================================
-- 002_experiences_and_payments.sql
-- EXPERIENCIAS.CLUB • Experiences Catalog, Bookings & Payment Receipts
-- ============================================================

-- ============================================================
-- 1. TABLA: experiencias (Catálogo Oficial de Rutas y Salidas)
-- ============================================================
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
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiencias_slug ON public.experiencias(slug);
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS album_photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.experiencias ADD COLUMN IF NOT EXISTS date_slots JSONB DEFAULT '[]'::jsonb;

DROP TRIGGER IF EXISTS experiencias_updated_at ON public.experiencias;
CREATE TRIGGER experiencias_updated_at
  BEFORE UPDATE ON public.experiencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Semilla inaugural de Kayak
INSERT INTO public.experiencias (
  id,
  slug,
  title,
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
  video_url,
  video_poster,
  altitude_meters
)
VALUES (
  'exp-kayak',
  'kayak',
  'Travesía en Kayak & Sunset en el Dique El Jumeal',
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
  '/assets/videos/kayak.mp4',
  '/assets/images/kayak-video.png',
  850
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
  receipt_storage_provider TEXT NOT NULL DEFAULT 'supabase'
                           CHECK (receipt_storage_provider IN ('supabase', 'local')),
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

  SELECT capacity_per_date, price_ars, dates, COALESCE(date_slots, '[]'::jsonb)
  INTO v_capacity, v_unit_price, v_dates, v_date_slots
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

-- 3.4 Listar envíos de comprobantes para prestadores y admins autenticados
CREATE OR REPLACE FUNCTION public.list_provider_transfer_submissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.provider_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
  ) THEN
    RETURN jsonb_build_object('status', 'unauthorized', 'submissions', '[]'::jsonb);
  END IF;

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
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.provider_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')) AND active = true
    )
  ) THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.list_provider_transfer_submissions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_transfer_submission(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_provider_transfer_submissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_transfer_submission(UUID, TEXT, TEXT) TO authenticated;

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

-- ============================================================
-- 003_providers_and_admin.sql
-- EXPERIENCIAS.CLUB • Providers Portal, Banking Audit, Storage & Admin Views
-- ============================================================

-- ============================================================
-- 1. TABLA: provider_access (Accesos y Datos Bancarios de Prestadores)
-- ============================================================
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

DROP TRIGGER IF EXISTS provider_access_updated_at ON public.provider_access;
CREATE TRIGGER provider_access_updated_at
  BEFORE UPDATE ON public.provider_access
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.provider_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can read their own access" ON public.provider_access;
CREATE POLICY "Providers can read their own access"
  ON public.provider_access
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    AND active = true
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

REVOKE ALL ON public.provider_access FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.provider_access TO authenticated;

-- Validación de campos administrativos: solo admins activos pueden modificar status, active o email
CREATE OR REPLACE FUNCTION public.check_provider_access_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status OR
      NEW.active IS DISTINCT FROM OLD.active OR
      LOWER(NEW.email) IS DISTINCT FROM LOWER(OLD.email)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    ) THEN
      RAISE EXCEPTION 'Acceso denegado: solo administradores activos pueden modificar campos administrativos del prestador';
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

-- ============================================================
-- 1.1 TABLA HISTÓRICA: Historial de Modificaciones de Datos Bancarios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_banking_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email TEXT NOT NULL,
  old_cbu_alias  TEXT,
  new_cbu_alias  TEXT NOT NULL,
  old_name       TEXT,
  new_name       TEXT NOT NULL,
  old_cuit_dni   TEXT,
  new_cuit_dni   TEXT NOT NULL,
  old_bank_name  TEXT,
  new_bank_name  TEXT NOT NULL,
  changed_by     TEXT NOT NULL DEFAULT 'provider',
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_banking_history_email ON public.provider_banking_history(provider_email);
CREATE INDEX IF NOT EXISTS idx_provider_banking_history_date  ON public.provider_banking_history(changed_at DESC);

ALTER TABLE public.provider_banking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view their own banking history" ON public.provider_banking_history;
CREATE POLICY "Providers can view their own banking history"
  ON public.provider_banking_history
  FOR SELECT
  TO authenticated
  USING (
    LOWER(provider_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- provider_banking_history es de solo inserción automática por trigger (append-only)
DROP POLICY IF EXISTS "Providers can insert into their own banking history" ON public.provider_banking_history;
DROP POLICY IF EXISTS "Admins can manage banking history" ON public.provider_banking_history;

DROP POLICY IF EXISTS "Admins can view banking history" ON public.provider_banking_history;
CREATE POLICY "Admins can view banking history"
  ON public.provider_banking_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

REVOKE ALL ON public.provider_banking_history FROM PUBLIC, anon;
GRANT SELECT ON public.provider_banking_history TO authenticated;

-- Trigger automático para registrar cambios bancarios
CREATE OR REPLACE FUNCTION public.handle_provider_banking_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_changed_by TEXT;
BEGIN
  IF (OLD.cbu_alias IS DISTINCT FROM NEW.cbu_alias OR
      OLD.name IS DISTINCT FROM NEW.name OR
      OLD.cuit_dni IS DISTINCT FROM NEW.cuit_dni OR
      OLD.bank_name IS DISTINCT FROM NEW.bank_name) THEN

    SELECT EXISTS (
      SELECT 1 FROM public.admin_access
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    ) INTO v_is_admin;

    IF v_is_admin THEN
      v_changed_by := 'admin';
    ELSE
      v_changed_by := 'provider';
    END IF;

    INSERT INTO public.provider_banking_history (
      provider_email,
      old_cbu_alias,
      new_cbu_alias,
      old_name,
      new_name,
      old_cuit_dni,
      new_cuit_dni,
      old_bank_name,
      new_bank_name,
      changed_by,
      changed_at
    ) VALUES (
      NEW.email,
      OLD.cbu_alias,
      NEW.cbu_alias,
      OLD.name,
      NEW.name,
      OLD.cuit_dni,
      NEW.cuit_dni,
      OLD.bank_name,
      NEW.bank_name,
      v_changed_by,
      now()
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

-- Prestadores iniciales autorizados
INSERT INTO public.provider_access (
  email,
  name,
  agency,
  active,
  status,
  cbu_alias,
  cuit_dni,
  bank_name,
  account_holder,
  phone
)
VALUES
  (
    'patriciofacundodiaztillar@gmail.com',
    'Patricio Facundo Díaz Tillar',
    'Catamarca Kayak & Aventura Náutica',
    true,
    'aprobado',
    '3840200500000056402423',
    '20-30456123-4',
    'Ualá Bank S.A.U.',
    'Patricio Facundo Díaz Tillar',
    '+54 383 455 8812'
  ),
  (
    'vegvarel@gmail.com',
    'vegvarel',
    'Catamarca Expediciones & Trekking',
    true,
    'aprobado',
    'VEGVAREL.EXPERIENCIAS',
    '20-33221144-5',
    'Banco Nación',
    'vegvarel',
    '+54 383 488 9900'
  ),
  (
    'gonzagramaglia@gmail.com',
    'Gonzalo Gramaglia',
    'Catamarca Experiencias & Expediciones',
    true,
    'aprobado',
    'EXPERIENCIAS.CLUB.MP',
    '20-33445566-7',
    'Banco Nación / Mercado Pago',
    'Gonzalo Gramaglia',
    '+54 9 11 5566 7788'
  )
ON CONFLICT (email) DO UPDATE
SET active = EXCLUDED.active,
    status = EXCLUDED.status,
    agency = EXCLUDED.agency,
    cbu_alias = EXCLUDED.cbu_alias,
    cuit_dni = EXCLUDED.cuit_dni,
    bank_name = EXCLUDED.bank_name,
    account_holder = EXCLUDED.account_holder,
    phone = EXCLUDED.phone,
    updated_at = now();

-- ============================================================
-- 2. TRIGGERS REACTIVOS DE CONVERSIÓN (Pagos <-> Waitlist <-> Socios)
-- ============================================================

-- 2.1 Al ingresar un comprobante de pago, marcar converted = true en waitlist
CREATE OR REPLACE FUNCTION public.handle_pago_transferencia_submitted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (LOWER(TRIM(NEW.email)), true, false)
  ON CONFLICT (email) DO UPDATE
  SET converted = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pago_transferencia_mark_converted ON public.pagos_transferencias;
CREATE TRIGGER on_pago_transferencia_mark_converted
  AFTER INSERT ON public.pagos_transferencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_pago_transferencia_submitted();

-- 2.2 Al registrar o actualizar socio, sincronizar waitlist y verificar si ya registra pagos
CREATE OR REPLACE FUNCTION public.handle_socio_registered()
RETURNS TRIGGER AS $$
DECLARE
  v_has_paid BOOLEAN := false;
BEGIN
  SELECT true INTO v_has_paid
  FROM public.pagos_transferencias
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;

  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (
    LOWER(TRIM(NEW.email)),
    COALESCE(v_has_paid, false),
    COALESCE(NEW.google_linked, false) OR (NEW.auth_user_id IS NOT NULL)
  )
  ON CONFLICT (email) DO UPDATE
  SET google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked,
      converted = public.waitlist.converted OR COALESCE(v_has_paid, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_socio_created_mark_waitlist ON public.socios;
CREATE TRIGGER on_socio_created_mark_waitlist
  AFTER INSERT OR UPDATE OF email, auth_user_id, google_linked ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.handle_socio_registered();

-- ============================================================
-- 3. RPCs DE REGISTRO ATÓMICO UNIFICADO
-- ============================================================

-- 3.1 Registrar socio emergente
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

-- 3.2 Registro atómico sin bloqueo de concurrencia
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

GRANT EXECUTE ON FUNCTION public.register_emergente_socio(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_socio_atomic(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- ============================================================
-- 4. RPCs DEL PORTAL ADMINISTRATIVO (Nómina y Comprobantes)
-- ============================================================

-- 4.1 Obtener nómina unificada indicando si pagó / envió comprobante
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

-- 4.2 Obtener todos los comprobantes y transferencias
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

REVOKE EXECUTE ON FUNCTION public.get_admin_all_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_all_members() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_all_submissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_all_submissions() TO authenticated;

-- ============================================================
-- 5. VISTA DE ESTADÍSTICAS PÚBLICAS
-- ============================================================
CREATE OR REPLACE VIEW public.waitlist_stats AS
SELECT
  COUNT(*)                     AS total_members,
  COALESCE(MAX(position), 100) AS max_position
FROM public.socios;

GRANT SELECT ON public.waitlist_stats TO anon, authenticated;

-- ============================================================
-- 6. ACTUALIZACIÓN CONSTRAINT DE ESTADO EN POSTULACIONES_PRESTADORES Y FUNDADORES
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'postulaciones_prestadores'
  ) THEN
    ALTER TABLE public.postulaciones_prestadores
      DROP CONSTRAINT IF EXISTS postulaciones_prestadores_status_check;
    ALTER TABLE public.postulaciones_prestadores
      ADD CONSTRAINT postulaciones_prestadores_status_check
      CHECK (status IN ('pendiente', 'aprobado', 'rechazado', 'dado_de_baja'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'postulaciones_fundadores'
  ) THEN
    ALTER TABLE public.postulaciones_fundadores
      DROP CONSTRAINT IF EXISTS postulaciones_fundadores_status_check;
    ALTER TABLE public.postulaciones_fundadores
      ADD CONSTRAINT postulaciones_fundadores_status_check
      CHECK (status IN ('en_evaluacion', 'aprobada', 'rechazada', 'dado_de_baja'));
  END IF;
END;
$$;

-- ============================================================
-- 7. STORAGE BUCKET Y POLÍTICAS PARA FOTOS DE EXPERIENCIAS ('experiencias')
-- ============================================================

-- 7.1 Crear o actualizar el bucket público 'experiencias'
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
      10485760, -- 10 MB límite por foto
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudo configurar storage.buckets automáticamente para experiencias (%).', SQLERRM;
END;
$$;

-- 7.2 Políticas RLS en storage.objects para el bucket 'experiencias'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Lectura pública de fotos a cualquier visitante
    DROP POLICY IF EXISTS "Lectura publica de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Lectura publica de fotos de experiencias"
      ON storage.objects
      FOR SELECT
      TO public, anon, authenticated
      USING (bucket_id = 'experiencias');

    -- Subida de fotos de experiencias a prestadores y admins autenticados
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

    -- Actualización o reemplazo de fotos existentes
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

    -- Eliminación de fotos de experiencias
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
    RAISE NOTICE 'Aviso: No se pudieron crear políticas en storage.objects para experiencias (%).', SQLERRM;
END;
$$;

