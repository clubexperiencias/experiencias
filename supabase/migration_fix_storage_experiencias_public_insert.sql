-- ==============================================================================
-- Migration: Permitir subida de fotos en bucket 'experiencias' para propuestas
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "Subida de fotos de experiencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir subida de fotos de experiencias" ON storage.objects;

    CREATE POLICY "Permitir subida de fotos de experiencias"
      ON storage.objects
      FOR INSERT
      TO public, anon, authenticated
      WITH CHECK (bucket_id = 'experiencias');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Aviso: No se pudo configurar la politica de subida en storage.objects para experiencias (%).', SQLERRM;
END;
$$;

