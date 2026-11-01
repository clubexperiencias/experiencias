-- Acceso manual al Portal de Prestadores.experiencias.club.
-- Para habilitar una cuenta, insertar su email y dejar active = true.
CREATE TABLE IF NOT EXISTS public.provider_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  agency TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'aprobado' CHECK (status IN ('aprobado', 'pendiente', 'dado_de_baja')),
  cbu_alias TEXT NOT NULL DEFAULT '',
  cuit_dni TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can read their own access" ON public.provider_access;
CREATE POLICY "Providers can read their own access"
  ON public.provider_access
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email') AND active = true);

GRANT SELECT ON public.provider_access TO authenticated;
