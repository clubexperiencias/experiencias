-- ============================================================
-- 008_provider_status_and_banking.sql
-- EXPERIENCIAS.CLUB • Estado de prestadores y datos bancarios
-- ============================================================

ALTER TABLE public.provider_access
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprobado'
  CHECK (status IN ('aprobado', 'pendiente', 'dado_de_baja')),
ADD COLUMN IF NOT EXISTS cbu_alias TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS cuit_dni TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS account_holder TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Sincronizar active con status
UPDATE public.provider_access
SET active = (status = 'aprobado');

-- Políticas RLS para que admin_access pueda gestionar provider_access
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

GRANT ALL ON public.provider_access TO authenticated;
