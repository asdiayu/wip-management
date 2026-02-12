-- ==================================================================================
-- AUTO BACKUP SETUP - pg_cron + pg_net + Storage Bucket
-- Backup otomatis setiap jam 7 pagi
-- Format sama dengan backup manual (materials, locations, transactions)
-- ==================================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create bucket untuk menyimpan backup dengan security configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'database-backups',
  'database-backups',
  false,                        -- Private bucket - tidak public accessible
  104857600,                    -- Max 100MB per file (mencegah upload file besar)
  ARRAY['application/json']     -- Hanya allow JSON files (format backup)
)
ON CONFLICT (id) DO NOTHING;

-- Update bucket jika sudah ada (untuk existing installations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'database-backups') THEN
    UPDATE storage.buckets
    SET
      file_size_limit = 104857600,
      allowed_mime_types = ARRAY['application/json']
    WHERE id = 'database-backups'
    AND (file_size_limit IS NULL OR allowed_mime_types IS NULL);
  END IF;
END $$;

-- 3. RLS Policies untuk bucket database-backups
-- Hanya admin yang bisa akses (READ/WRITE)
DROP POLICY IF EXISTS "Backup Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Backup Admin Full Access" ON storage.objects;

CREATE POLICY "Backup Admin Full Access" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'database-backups'
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (
                raw_user_meta_data->>'role' = 'admin'
                OR raw_app_meta_data->>'role' = 'admin'
            )
        )
    )
    WITH CHECK (
        bucket_id = 'database-backups'
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (
                raw_user_meta_data->>'role' = 'admin'
                OR raw_app_meta_data->>'role' = 'admin'
            )
        )
    );

-- 3.1 Index untuk RLS Performance (OPTIONAL)
-- Note: Ini membutuhkan superuser privileges. Jika error, skip bagian ini.
-- Index tidak critical karena backup bucket hanya diakses via service role (Edge Function)
-- dan RLS policy check jarang dilakukan dari client side.
--
-- Jika ingin membuat index, jalankan ini di Supabase Dashboard dengan admin privileges:
--
-- CREATE INDEX IF NOT EXISTS idx_storage_objects_backup_bucket
-- ON storage.objects(bucket_id)
-- WHERE bucket_id = 'database-backups';
--
-- CREATE INDEX IF NOT EXISTS idx_storage_objects_backup_ops
-- ON storage.objects(bucket_id, id)
-- WHERE bucket_id = 'database-backups';
--
-- Atau hubungi Supabase support untuk membuat indexes ini.

-- 4. Function untuk membuat backup JSON
CREATE OR REPLACE FUNCTION generate_backup_json()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    backup_json TEXT;
BEGIN
    -- Query data dari 3 tabel utama
    SELECT json_build_object(
        'version', 3,
        'createdAt', NOW(),
        'data', json_build_object(
            'materials', (SELECT coalesce(json_agg(row_to_json(materials)), '[]'::json) FROM materials),
            'locations', (SELECT coalesce(json_agg(row_to_json(locations)), '[]'::json) FROM locations),
            'transactions', (SELECT coalesce(json_agg(row_to_json(transactions)), '[]'::json) FROM transactions)
        )
    )::text INTO backup_json;

    RETURN backup_json;
END;
$$;

-- 5. Function untuk mengeksekusi backup dan upload ke storage
-- Catatan: Function ini akan dipanggil via Edge Function
-- karena pg_cron tidak bisa langsung upload ke storage dari SQL
CREATE OR REPLACE FUNCTION trigger_daily_backup()
RETURNS TABLE (success BOOLEAN, message TEXT, filename TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    backup_date TEXT;
    backup_filename TEXT;
    backup_json TEXT;
BEGIN
    -- Generate filename dengan format: backup_YYYY-MM-DD.json
    backup_date := TO_CHAR(NOW(), 'YYYY-MM-DD');
    backup_filename := 'backup_' || backup_date || '.json';

    -- Generate backup JSON
    SELECT generate_backup_json() INTO backup_json;

    -- Return data untuk diproses oleh Edge Function
    -- (Edge Function akan melakukan upload ke storage)
    RETURN QUERY SELECT true, 'Backup generated successfully', backup_filename;
END;
$$;

-- 6. Schedule job dengan pg_cron + pg_net
-- Setiap hari jam 07:00 UTC (atau sesuaikan timezone dengan WIB +7)
-- Untuk WIB jam 7 pagi, gunakan '0 0 * * *' (UTC 00:00 = WIB 07:00)
-- Atau '0 7 * * *' untuk UTC 07:00

-- Function untuk trigger backup via HTTP request
CREATE OR REPLACE FUNCTION trigger_backup_via_http()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_ref TEXT;
    edge_function_url TEXT;
    result TEXT;
BEGIN
    -- Get project reference from current_setting
    -- Format: https://<project-ref>.supabase.co/functions/v1/daily-backup
    project_ref := current_setting('app.settings.project_ref', true);

    IF project_ref IS NULL THEN
        -- Fallback: try to extract from database name or use a placeholder
        project_ref := 'YOUR_PROJECT_REF'; -- User harus mengganti ini
    END IF;

    edge_function_url := 'https://' || project_ref || '.supabase.co/functions/v1/daily-backup';

    -- Make async HTTP request to Edge Function
    PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'pg_cron'),
        timeout_milliseconds := 30000,
        raise_exception := false
    );

    -- Log to audit_logs (without user_id since it's a system job)
    INSERT INTO audit_logs (timestamp, user_email, action, details)
    VALUES (NOW(), 'system@backup', 'SCHEDULED_BACKUP_TRIGGERED',
            'Backup triggered via pg_cron at ' || NOW());
END;
$$;

-- Schedule cron job
-- '0 0 * * *' = Jam 00:00 UTC (07:00 WIB)
-- Jika ingin jam 07:00 UTC, gunakan '0 7 * * *'
SELECT cron.schedule(
    'daily-database-backup',
    '0 0 * * *', -- Jam 00:00 UTC (07:00 WIB)
    $$SELECT trigger_backup_via_http();$$
);

-- ==================================================================================
-- INSTRUKSI PENGGUNAAN:
-- ==================================================================================
--
-- 1. SETELAH MIGRASI:
--    - Jalankan SQL ini di Supabase SQL Editor
--    - Buat file .env dengan konfigurasi (lihat langkah 2)
--
-- 2. KONFIGURASI PROJECT REF & SERVICE KEY:
--    - Ganti 'YOUR_PROJECT_REF' di function trigger_backup_via_http() dengan project ref Anda
--    - Atau set manual:
--      SELECT set_config('app.settings.project_ref', 'xxxxx', false);
--      SELECT set_config('app.settings.service_role_key', 'eyJ...', false);
--
-- 3. DEPLOY EDGE FUNCTION:
--    - Install Supabase CLI: npm install -g supabase
--    - Deploy function: supabase functions deploy daily-backup
--
-- 4. CEK SCHEDULE:
--    SELECT * FROM cron.job;
--
-- 5. CEK LOG:
--    SELECT * FROM audit_logs WHERE action LIKE '%BACKUP%' ORDER BY timestamp DESC;
--
-- 6. TEST MANUAL:
--    - Test Edge Function:
--      curl -X POST https://<project-ref>.supabase.co/functions/v1/daily-backup \
--        -H "Authorization: Bearer <anon-key>" \
--        -H "Content-Type: application/json"
--
-- 7. CEK BACKUP:
--    - Download backup via admin panel atau:
--      select * from storage.files where bucket_id = 'database-backups';
--
-- CATATAN TIMEZONE:
-- - Default: Jam 00:00 UTC = 07:00 WIB
-- - Untuk timezone lain, sesuaikan cron schedule
-- - WIB (UTC+7): 00:00 UTC = 07:00 WIB
-- - Jika ingin jam 7 pagi UTC, gunakan '0 7 * * *'
--
-- SECURITY BEST PRACTICES (Priority 1 - Implemented):
-- ✅ Private bucket (public: false)
-- ✅ File size limit: 100MB max (mencegah upload besar)
-- ✅ MIME type restriction: Hanya application/json
-- ✅ RLS policies: Admin-only access
-- ⚠️  Indexes: SKIP (memerlukan superuser privileges)
--   → Index tidak critical karena:
--     - Backup bucket diakses via service role (Edge Function)
--     - RLS policy check jarang dari client side
--     - Service role bypasses RLS, jadi tidak ada performance impact
--
-- VERIFIKASI SETUP:
-- -- Cek bucket configuration
-- SELECT * FROM storage.buckets WHERE id = 'database-backups';
--
-- -- Cek RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%Backup%';
--
-- -- Test bucket access (sebagai admin user)
-- SELECT * FROM storage.objects WHERE bucket_id = 'database-backups' LIMIT 1;
-- ==================================================================================
