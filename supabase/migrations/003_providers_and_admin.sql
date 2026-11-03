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

