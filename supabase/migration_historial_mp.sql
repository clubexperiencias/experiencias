-- ==============================================================================
-- MIGRACIÓN: historial_mp
-- Tabla de auditoría privada para registrar cambios de cuenta de Mercado Pago
-- (vinculaciones, desvinculaciones y actualización de credenciales/collector)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.historial_mp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_email  TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('connect', 'disconnect', 'update')),
  collector_id    TEXT,
  mp_nickname     TEXT,
  mp_email        TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  changed_by      TEXT NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta y auditoría cronológica
CREATE INDEX IF NOT EXISTS idx_historial_mp_email ON public.historial_mp(provider_email);
CREATE INDEX IF NOT EXISTS idx_historial_mp_changed_at ON public.historial_mp(changed_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.historial_mp ENABLE ROW LEVEL SECURITY;

-- 1. Política SELECT: Acceso EXCLUSIVO para Administradores activos
-- (Los usuarios generales, anónimos y prestadores no pueden listar la tabla globalmente)
DROP POLICY IF EXISTS "Solo administradores pueden ver historial mp" ON public.historial_mp;
CREATE POLICY "Solo administradores pueden ver historial mp"
  ON public.historial_mp
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administradores
      WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        AND active = true
    )
  );

-- Eliminar cualquier política de inserción directa desde clientes autenticados.
-- Las auditorías solo se crean de forma confiable a través del backend / service_role.
DROP POLICY IF EXISTS "Usuarios autenticados registran eventos en historial mp" ON public.historial_mp;

-- 2. Grants de seguridad (service_role y lectura exclusiva para authenticated)
REVOKE ALL ON public.historial_mp FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.historial_mp FROM authenticated;
GRANT SELECT ON public.historial_mp TO authenticated;
GRANT ALL ON public.historial_mp TO service_role;
