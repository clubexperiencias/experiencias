-- ============================================================
-- 004_experiencias_storage.sql
-- Políticas de Storage para el bucket 'experiencias' (Público)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- 1. Permitir lectura pública de fotos a cualquier visitante
    DROP POLICY IF EXISTS "Lectura publica de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Lectura publica de fotos de experiencias"
      ON storage.objects
      FOR SELECT
      TO public, anon, authenticated
      USING (bucket_id = 'experiencias');

    -- 2. Permitir subir fotos de experiencias únicamente a prestadores y admins autenticados
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

    -- 3. Permitir actualizar o reemplazar fotos existentes únicamente a prestadores y admins autenticados
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
          OR EXISTS (
            SELECT 1 FROM public.provider_access
            WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email') AND active = true
          )
        )
      );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudieron crear políticas en storage.objects para experiencias (%).', SQLERRM;
END;
$$;

