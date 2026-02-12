-- ==================================================================================
-- OPTIONAL: Performance Indexes for Backup Bucket
-- ==================================================================================
--
-- FILE INI OPSIONAL - Hanya jalankan jika dibutuhkan dan punya akses superuser
--
-- NOTE: Indexes ini memerlukan superuser privileges untuk membuat pada tabel
-- storage.objects (tabel sistem Supabase).
--
-- CARA MENJALANKAN:
-- 1. Buka Supabase Dashboard → Database → SQL Editor
-- 2. Copy paste SQL di bawah ini
-- 3. Jika tetap error permission, hubungi Supabase Support
--
-- ALASAN INDEX TIDAK CRITICAL:
-- - Backup bucket diakses via service role key (Edge Function)
-- - Service role BYPASS RLS, jadi tidak ada policy check
-- - Client jarang akses bucket ini (hanya admin download)
-- - Performance impact minimal tanpa index
--
-- ==================================================================================

-- Index 1: Bucket lookup index
-- Mempercepat query filter by bucket_id
CREATE INDEX IF NOT EXISTS idx_storage_objects_backup_bucket
ON storage.objects(bucket_id)
WHERE bucket_id = 'database-backups';

-- Index 2: Operations index
-- Mempercepat query dengan bucket_id + id lookup
CREATE INDEX IF NOT EXISTS idx_storage_objects_backup_ops
ON storage.objects(bucket_id, id)
WHERE bucket_id = 'database-backups';

-- Verify indexes created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'objects'
  AND indexname LIKE '%backup%';

-- Expected output:
-- indexname                                  | indexdef
-- -------------------------------------------|---------------------------------------------------------
-- idx_storage_objects_backup_bucket          | CREATE INDEX ... ON storage.objects USING btree (bucket_id) WHERE bucket_id = 'database-backups'
-- idx_storage_objects_backup_ops             | CREATE INDEX ... ON storage.objects USING btree (bucket_id, id) WHERE bucket_id = 'database-backups'

-- ==================================================================================
-- JIKA INGIN MENGHAPUS INDEXES (Rollback):
-- ==================================================================================
--
-- DROP INDEX IF EXISTS idx_storage_objects_backup_bucket;
-- DROP INDEX IF EXISTS idx_storage_objects_backup_ops;
--
-- ==================================================================================
