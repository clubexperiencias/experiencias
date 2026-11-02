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

    -- 2. Permitir subir fotos de experiencias a usuarios autenticados y anon (prestadores y admins)
    DROP POLICY IF EXISTS "Subida de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Subida de fotos de experiencias"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'experiencias');

    -- 3. Permitir actualizar o reemplazar fotos existentes en el bucket
    DROP POLICY IF EXISTS "Actualizacion de fotos de experiencias" ON storage.objects;
    CREATE POLICY "Actualizacion de fotos de experiencias"
      ON storage.objects
      FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'experiencias');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudieron crear políticas en storage.objects para experiencias (%).', SQLERRM;
END;
$$;

