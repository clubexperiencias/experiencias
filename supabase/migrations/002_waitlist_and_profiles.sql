-- ============================================================
-- EXPERIENCIAS.CLUB • Supabase Schema
-- Separación: 1. Tabla waitlist (Prospectos) y 2. Tabla socios (Miembros)
-- ============================================================
-- 1. waitlist: Tabla sencilla para recopilar mails en la landing (/)
-- 2. socios: Tabla de socios emergentes, plenos y fundadores con número de socio (arranca en 100)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABLA: waitlist (Recopilación inicial ágil desde la landing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  converted            BOOLEAN NOT NULL DEFAULT false,
  google_linked        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);

-- ============================================================
-- 2. SECUENCIA Y TABLA: socios (Socios Emergentes del Club)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.socios_position_seq START WITH 100;

CREATE TABLE IF NOT EXISTS public.socios (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  full_name            TEXT NOT NULL,
  dni                  TEXT NOT NULL,
  phone                TEXT NOT NULL,
  experiences_wishlist JSONB DEFAULT '[]'::jsonb,
  experiences_other    TEXT,
  position             INTEGER DEFAULT nextval('public.socios_position_seq') UNIQUE,
  membership_tier      TEXT NOT NULL DEFAULT 'emergente'
                       CHECK (membership_tier IN ('emergente', 'activo', 'fundador')),
  auth_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Para login con Google
  google_linked        BOOLEAN NOT NULL DEFAULT false,
  registration_token   UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.socios
  ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Asegurar que la secuencia continúe desde el máximo actual (o arranque en 100 si no hay socios)
SELECT setval(
  'public.socios_position_seq',
  GREATEST(COALESCE((SELECT MAX(position) FROM public.socios), 99), 99),
  true
);

CREATE INDEX IF NOT EXISTS idx_socios_email    ON public.socios(email);
CREATE INDEX IF NOT EXISTS idx_socios_position ON public.socios(position);

-- Normalización de datos existentes antes de crear índice único de DNI
UPDATE public.waitlist
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));

UPDATE public.socios
SET email = LOWER(TRIM(email)),
    full_name = TRIM(full_name),
    dni = regexp_replace(COALESCE(dni, ''), '\D', '', 'g'),
    phone = TRIM(COALESCE(phone, ''));

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_socios_dni_unique
    ON public.socios(dni)
    WHERE dni <> '';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Aviso: Ya existen filas con DNI duplicado en public.socios; el índice único idx_socios_dni_unique se omitió hasta limpiar duplicados.';
END;
$$;

-- Trigger de normalización estricta en waitlist
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

-- Trigger para updated_at automático en socios
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

-- Trigger para marcar converted=true y google_linked en waitlist al registrarse o actualizarse en socios
CREATE OR REPLACE FUNCTION public.handle_socio_registered()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.waitlist (email, converted, google_linked)
  VALUES (
    LOWER(TRIM(NEW.email)),
    true,
    COALESCE(NEW.google_linked, false) OR (NEW.auth_user_id IS NOT NULL)
  )
  ON CONFLICT (email) DO UPDATE
  SET converted = true,
      google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_socio_created_mark_waitlist ON public.socios;
CREATE TRIGGER on_socio_created_mark_waitlist
  AFTER INSERT OR UPDATE OF email, auth_user_id, google_linked ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.handle_socio_registered();

-- ============================================================
-- VINCULACIÓN AUTOMÁTICA CON SUPABASE AUTH (Google OAuth / Email)
-- ============================================================
-- 1. Cuando el usuario inicia sesión con Google en auth.users, vincula auth_user_id y google_linked en socios y waitlist:
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

-- 2. Si el usuario ya existe en auth.users al registrarse o actualizarse en socios, asigna auth_user_id y google_linked:
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

-- Sincronización retroactiva para registros existentes
UPDATE public.socios s
SET auth_user_id = u.id,
    google_linked = true
FROM auth.users u
WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(u.email));

UPDATE public.socios
SET google_linked = true
WHERE auth_user_id IS NOT NULL AND google_linked = false;

UPDATE public.waitlist w
SET converted = true,
    google_linked = w.google_linked OR s.google_linked OR (s.auth_user_id IS NOT NULL)
FROM public.socios s
WHERE LOWER(TRIM(w.email)) = LOWER(TRIM(s.email));

UPDATE public.waitlist w
SET google_linked = true
FROM auth.users u
WHERE LOWER(TRIM(w.email)) = LOWER(TRIM(u.email)) AND w.google_linked = false;

-- ============================================================
-- VISTA PÚBLICA DE ESTADÍSTICAS
-- ============================================================
CREATE OR REPLACE VIEW public.waitlist_stats AS
SELECT
  COUNT(*)                                  AS total_members,
  COALESCE(MAX(position), 100)              AS max_position
FROM public.socios;

-- ============================================================
-- SEGURIDAD (Row Level Security - RLS) Y FUNCIONES RPC SEGURAS
-- ============================================================
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas de waitlist y socios
DROP POLICY IF EXISTS "Permitir guardar email en waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Permitir consultar waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Permitir actualizar waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Permitir consultar waitlist propio" ON public.waitlist;
DROP POLICY IF EXISTS "Permitir actualizar waitlist propio" ON public.waitlist;

DROP POLICY IF EXISTS "Permitir registro de socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir consultar socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir actualizar socios" ON public.socios;
DROP POLICY IF EXISTS "Permitir consultar socio propio autenticado" ON public.socios;
DROP POLICY IF EXISTS "Permitir actualizar socio propio autenticado" ON public.socios;

-- Políticas para waitlist: inserción ágil pública, lectura/edición directa solo del propio usuario autenticado
CREATE POLICY "Permitir guardar email en waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir consultar waitlist propio"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email);

CREATE POLICY "Permitir actualizar waitlist propio"
  ON public.waitlist
  FOR UPDATE
  TO authenticated
  USING (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email)
  WITH CHECK (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email);

-- Políticas para socios: lectura y edición directa en tabla restringida al propio socio autenticado con Google/Supabase Auth
CREATE POLICY "Permitir consultar socio propio autenticado"
  ON public.socios
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = auth_user_id
    OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = email
  );

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

-- ============================================================
-- FUNCIONES RPC (SECURITY DEFINER) PARA EL FLUJO DE REGISTRO Y LOGIN
-- ============================================================

-- 1. Registrar o actualizar correo en waitlist de forma atómica y segura
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

-- 2. Consultar estado de registro de un correo sin exponer datos sensibles (DNI, teléfono, nombre)
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

-- 3. Registrar Socio Emergente de forma atómica (valida email y DNI únicos y marca converted=true en waitlist)
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

  IF EXISTS (SELECT 1 FROM public.socios WHERE email = v_email) THEN
    RETURN jsonb_build_object('status', 'already_registered_email');
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
  VALUES (v_email, true, v_inserted.google_linked)
  ON CONFLICT (email) DO UPDATE
  SET converted = true,
      google_linked = public.waitlist.google_linked OR EXCLUDED.google_linked;

  RETURN jsonb_build_object(
    'status', 'created',
    'socio', to_jsonb(v_inserted)
  );
END;
$$;

-- 4. Obtener socio de forma segura (requiere sesión de Google activa o el registration_token del dispositivo que lo creó)
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

  -- Autorizado si tiene sesión de Supabase Auth coincidente
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

  -- Autorizado si aún no vinculó Google y presenta el registration_token emitido al registrarse
  IF v_socio.google_linked = false
     AND p_registration_token IS NOT NULL
     AND v_socio.registration_token = p_registration_token THEN
    RETURN jsonb_build_object('status', 'ok', 'socio', to_jsonb(v_socio));
  END IF;

  RETURN jsonb_build_object('status', 'unauthorized');
END;
$$;

-- 5. Actualizar perfil de socio de forma segura (exige JWT de Google o registration_token válido)
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

-- Permisos para API de Supabase
GRANT SELECT, INSERT, UPDATE ON public.waitlist TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.socios TO anon, authenticated;
GRANT SELECT ON public.waitlist_stats TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.socios_position_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_waitlist_email(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_registration_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_emergente_socio(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_socio_by_session_or_token(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_socio_profile_secure(TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- ============================================================
-- 3. TABLA Y COLUMNAS: Postulaciones de Socios Fundadores
--    (con teléfono obligatorio y adhesión al protocolo)
-- ============================================================
ALTER TABLE public.socios
  ADD COLUMN IF NOT EXISTS founder_motivation_letter TEXT,
  ADD COLUMN IF NOT EXISTS founder_agreed_to_protocol BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founder_application_status TEXT
    CHECK (founder_application_status IN ('pendiente', 'aprobado', 'rechazado'));

-- Asegurar que phone sea obligatorio (NOT NULL) en socios
UPDATE public.socios SET phone = '' WHERE phone IS NULL;
ALTER TABLE public.socios ALTER COLUMN phone SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.postulaciones_fundadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL, -- Obligatorio
  motivation_letter    TEXT NOT NULL,
  agreed_to_protocol   BOOLEAN NOT NULL DEFAULT true CHECK (agreed_to_protocol = true),
  status               TEXT NOT NULL DEFAULT 'en_evaluacion'
                       CHECK (status IN ('en_evaluacion', 'aprobada', 'rechazada')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si la tabla ya existía con phone nullable, actualizarla a NOT NULL
UPDATE public.postulaciones_fundadores SET phone = '' WHERE phone IS NULL;
ALTER TABLE public.postulaciones_fundadores ALTER COLUMN phone SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_postulaciones_fundadores_email ON public.postulaciones_fundadores(email);

DROP TRIGGER IF EXISTS postulaciones_fundadores_updated_at ON public.postulaciones_fundadores;
CREATE TRIGGER postulaciones_fundadores_updated_at
  BEFORE UPDATE ON public.postulaciones_fundadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.postulaciones_fundadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir envío de postulaciones de fundadores" ON public.postulaciones_fundadores;
CREATE POLICY "Permitir envío de postulaciones de fundadores"
  ON public.postulaciones_fundadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar postulaciones de fundadores" ON public.postulaciones_fundadores;
CREATE POLICY "Permitir consultar postulaciones de fundadores"
  ON public.postulaciones_fundadores
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT ON public.postulaciones_fundadores TO anon, authenticated;

-- ============================================================
-- 4. TABLA: Postulaciones de Prestadores & Guías Locales (/experiencias/prestadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.postulaciones_prestadores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name            TEXT NOT NULL, -- Nombre y Apellido / Razón Social
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
                       CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
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

ALTER TABLE public.postulaciones_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir envío de postulaciones de prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Permitir envío de postulaciones de prestadores"
  ON public.postulaciones_prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar postulaciones de prestadores" ON public.postulaciones_prestadores;
CREATE POLICY "Permitir consultar postulaciones de prestadores"
  ON public.postulaciones_prestadores
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT ON public.postulaciones_prestadores TO anon, authenticated;
