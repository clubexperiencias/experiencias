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

