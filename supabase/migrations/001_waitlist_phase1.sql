-- ============================================================
-- Catamarca Secreta • Supabase Schema - Fase 1: Waitlist/Newsletter
-- ============================================================
-- Aplicá esta migración desde Supabase Studio → SQL Editor,
-- o con la CLI: supabase db push
--
-- Instrucciones de setup rápido:
-- 1. Creá un proyecto en https://supabase.com
-- 2. Abrí SQL Editor y pegá todo este contenido
-- 3. Copiá la URL y anon key a src/environments/environment.ts
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Tabla: waitlist_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist_members (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  interest       TEXT DEFAULT 'all',
  position       SERIAL,
  referral_code  TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending', 'confirmed', 'invited')),
  source         TEXT NOT NULL DEFAULT 'web_minimal_landing',
  referred_by    TEXT REFERENCES public.waitlist_members(referral_code) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_waitlist_email       ON public.waitlist_members(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral    ON public.waitlist_members(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status      ON public.waitlist_members(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at  ON public.waitlist_members(created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waitlist_members_updated_at
  BEFORE UPDATE ON public.waitlist_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Vista pública de estadísticas (sin exponer emails ni datos PII)
-- ============================================================
CREATE OR REPLACE VIEW public.waitlist_stats AS
SELECT
  COUNT(*)                                              AS total_members,
  COUNT(*) FILTER (WHERE status = 'confirmed')          AS confirmed_members,
  COUNT(*) FILTER (WHERE status = 'invited')            AS invited_members,
  MAX(position)                                         AS max_position
FROM public.waitlist_members;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.waitlist_members ENABLE ROW LEVEL SECURITY;

-- 1. Cualquier visitante anónimo puede insertar su propio registro
CREATE POLICY "Cualquier visitante puede registrarse en la lista de espera"
  ON public.waitlist_members
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 2. Un usuario solo puede ver su propio registro (por email si está autenticado)
CREATE POLICY "Usuario autenticado puede ver su propio registro"
  ON public.waitlist_members
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- 3. Los admins pueden hacer todo (service_role bypasses RLS)
-- La service_role key NUNCA debe exponerse en el frontend.

-- ============================================================
-- Vista pública de estadísticas (acceso anónimo permitido)
-- ============================================================
GRANT SELECT ON public.waitlist_stats TO anon;
GRANT SELECT ON public.waitlist_stats TO authenticated;
