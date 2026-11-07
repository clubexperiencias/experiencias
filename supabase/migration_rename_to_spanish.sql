-- ==============================================================================
-- EXPERIENCIAS.CLUB - MIGRACIÓN A NOMENCLATURA EN ESPAÑOL
-- 1. provider_access              -> public.prestadores
-- 2. admin_access                 -> public.administradores
-- 3. provider_banking_history     -> public.historial_bancario
-- 4. public_provider_profiles     -> public.perfiles_publicos
-- 5. waitlist_stats               -> public.estadisticas_socios
-- ==============================================================================

BEGIN;

-- 1. Renombrar provider_access a prestadores (si existe como tabla base)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provider_access' AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.provider_access RENAME TO prestadores;
  END IF;
END $$;

-- 2. Renombrar admin_access a administradores (si existe como tabla base)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_access' AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.admin_access RENAME TO administradores;
  END IF;
END $$;

-- 3. Renombrar provider_banking_history a historial_bancario (si existe como tabla base)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provider_banking_history' AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.provider_banking_history RENAME TO historial_bancario;
  END IF;
END $$;

-- 4. Limpieza de vistas obsoletas de compatibilidad
DROP VIEW IF EXISTS public.provider_access CASCADE;
DROP VIEW IF EXISTS public.admin_access CASCADE;
DROP VIEW IF EXISTS public.historia_bancaria CASCADE;
DROP VIEW IF EXISTS public.provider_banking_history CASCADE;

-- 5. Limpieza de columnas redundantes en public.socios
ALTER TABLE public.socios DROP COLUMN IF EXISTS converted CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS google_linked CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_motivation_letter CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_agreed_to_protocol CASCADE;
ALTER TABLE public.socios DROP COLUMN IF EXISTS founder_application_status CASCADE;

-- 5. Habilitar RLS en prestadores, administradores e historial_bancario
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_bancario ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de seguridad en administradores
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

DROP POLICY IF EXISTS "Admins can view admins" ON public.administradores;
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

-- 7. Políticas de seguridad en prestadores
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

DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.prestadores;
CREATE POLICY "Permitir postularse como prestador"
  ON public.prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendiente'
    AND active = false
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

-- 8. Actualizar funciones RPC esenciales
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

-- 8.2 Actualizar record_waitlist_email según el esquema canónico (sin columnas obsoletas)
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

GRANT EXECUTE ON FUNCTION public.record_waitlist_email TO anon, authenticated;

-- 8.3 Actualizar get_admin_socios_roster según el esquema canónico (usando administradores y sin columnas eliminadas)
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
        'converted', (
          (s.membership_tier <> 'waitlist') OR EXISTS (
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

GRANT EXECUTE ON FUNCTION public.get_admin_socios_roster TO authenticated;

-- 9. Actualizar vistas canónicas en español
-- 9.1 perfiles_publicos (Vista pública segura de prestadores aprobados)
DROP VIEW IF EXISTS public.public_provider_profiles CASCADE;
DROP VIEW IF EXISTS public.perfiles_publicos CASCADE;
CREATE OR REPLACE VIEW public.perfiles_publicos AS
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

-- 9.2 estadisticas_socios (Métricas y conteos de la comunidad de socios)
DROP VIEW IF EXISTS public.waitlist_stats CASCADE;
DROP VIEW IF EXISTS public.estadisticas_socios CASCADE;
CREATE OR REPLACE VIEW public.estadisticas_socios AS
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

COMMIT;

