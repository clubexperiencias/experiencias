-- ==============================================================================
-- EXPERIENCIAS.CLUB - PRIVILEGIOS DE INSERCIÓN PARA POSTULACIONES EN PRESTADORES
-- Resuelve el error 42501 (permission denied for table prestadores) para el rol anon
-- ==============================================================================

BEGIN;

-- 1. Asegurar permisos de uso de esquema e inserción para anon y authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.prestadores TO anon, authenticated;

-- 2. Asegurar que la política RLS permita la inserción pública de nuevas postulaciones
DROP POLICY IF EXISTS "Permitir postularse como prestador" ON public.prestadores;
CREATE POLICY "Permitir postularse como prestador"
  ON public.prestadores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendiente'
    AND active = false
  );

-- 3. Crear función atómica con SECURITY DEFINER como canal seguro garantizado
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
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_provider_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;

