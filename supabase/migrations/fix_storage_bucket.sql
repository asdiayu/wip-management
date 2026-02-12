-- ==================================================================================
-- FIX: Storage Bucket 'app-releases' & RLS Policies
-- Jalankan ini di Supabase SQL Editor
-- ==================================================================================

-- 1. Buat bucket 'app-releases' jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-releases', 'app-releases', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Kebijakan: Akses Publik (Read-Only)
-- Agar aplikasi bisa cek & download APK tanpa hambatan
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'app-releases');

-- 3. Kebijakan: Full Access untuk Admin
-- Menggunakan fungsi is_admin() yang didefinisikan di schema.sql
DROP POLICY IF EXISTS "Admin Full Access" ON storage.objects;
CREATE POLICY "Admin Full Access" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'app-releases' 
        AND is_admin()
    )
    WITH CHECK (
        bucket_id = 'app-releases' 
        AND is_admin()
    );
