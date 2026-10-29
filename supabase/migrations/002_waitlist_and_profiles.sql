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
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar que los números de socio arranquen en 100
ALTER SEQUENCE public.socios_position_seq RESTART WITH 100;

CREATE INDEX IF NOT EXISTS idx_socios_email    ON public.socios(email);
CREATE INDEX IF NOT EXISTS idx_socios_position ON public.socios(position);

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

-- Trigger para marcar converted=true en waitlist al registrarse en socios
CREATE OR REPLACE FUNCTION public.handle_socio_registered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.waitlist
  SET converted = true
  WHERE email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_socio_created_mark_waitlist ON public.socios;
CREATE TRIGGER on_socio_created_mark_waitlist
  AFTER INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.handle_socio_registered();

-- ============================================================
-- VINCULACIÓN AUTOMÁTICA CON SUPABASE AUTH (Google OAuth / Email)
-- ============================================================
-- 1. Cuando el usuario inicia sesión con Google en auth.users, vincula auth_user_id en socios:
CREATE OR REPLACE FUNCTION public.handle_user_auth_link()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.socios
  SET auth_user_id = NEW.id
  WHERE email = NEW.email AND (auth_user_id IS NULL OR auth_user_id != NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link_socio ON auth.users;
CREATE TRIGGER on_auth_user_created_link_socio
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_auth_link();

-- 2. Si el usuario ya existe en auth.users al registrarse en socios, asigna auth_user_id:
CREATE OR REPLACE FUNCTION public.link_socio_to_existing_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  matching_auth_id UUID;
BEGIN
  SELECT id INTO matching_auth_id FROM auth.users WHERE email = NEW.email LIMIT 1;
  IF matching_auth_id IS NOT NULL THEN
    NEW.auth_user_id = matching_auth_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_socio_insert_link_auth ON public.socios;
CREATE TRIGGER before_socio_insert_link_auth
  BEFORE INSERT ON public.socios
  FOR EACH ROW EXECUTE FUNCTION public.link_socio_to_existing_auth_user();

-- ============================================================
-- VISTA PÚBLICA DE ESTADÍSTICAS
-- ============================================================
CREATE OR REPLACE VIEW public.waitlist_stats AS
SELECT
  COUNT(*)                                  AS total_members,
  COALESCE(MAX(position), 100)              AS max_position
FROM public.socios;

-- ============================================================
-- SEGURIDAD (Row Level Security - RLS)
-- ============================================================
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

-- Políticas para waitlist
DROP POLICY IF EXISTS "Permitir guardar email en waitlist" ON public.waitlist;
CREATE POLICY "Permitir guardar email en waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar waitlist" ON public.waitlist;
CREATE POLICY "Permitir consultar waitlist"
  ON public.waitlist
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Políticas para socios
DROP POLICY IF EXISTS "Permitir registro de socios" ON public.socios;
CREATE POLICY "Permitir registro de socios"
  ON public.socios
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir consultar socios" ON public.socios;
CREATE POLICY "Permitir consultar socios"
  ON public.socios
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir actualizar socios" ON public.socios;
CREATE POLICY "Permitir actualizar socios"
  ON public.socios
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Permisos públicos para API de Supabase
GRANT SELECT, INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL ON public.socios TO anon, authenticated;
GRANT SELECT ON public.waitlist_stats TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.socios_position_seq TO anon, authenticated;
