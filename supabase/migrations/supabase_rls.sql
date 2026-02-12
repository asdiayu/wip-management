-- ==================================================================================
-- STORAGE MANAGEMENT SYSTEM - ROW LEVEL SECURITY (RLS) v1.1.4
-- ==================================================================================

-- Aktifkan RLS pada semua tabel
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 1. POLICIES FOR 'locations'
-- ==========================================

-- Semua user yang login bisa melihat daftar lokasi
CREATE POLICY "Enable read access for all authenticated users" ON locations
    FOR SELECT TO authenticated USING (true);

-- Hanya admin yang bisa mengelola master lokasi
CREATE POLICY "Enable full access for admins" ON locations
    FOR ALL TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- ==========================================
-- 2. POLICIES FOR 'materials'
-- ==========================================

-- Semua user yang login bisa melihat daftar barang
CREATE POLICY "Enable read access for all authenticated users" ON materials
    FOR SELECT TO authenticated USING (true);

-- Hanya admin yang bisa mengelola master barang
CREATE POLICY "Enable full access for admins" ON materials
    FOR ALL TO authenticated 
    USING (is_admin()) 
    WITH CHECK (is_admin());

-- ==========================================
-- 3. POLICIES FOR 'transactions'
-- ==========================================

-- Semua user yang login bisa melihat riwayat transaksi
CREATE POLICY "Enable read access for all authenticated users" ON transactions
    FOR SELECT TO authenticated USING (true);

-- Admin, Manager, dan Operator bisa membuat transaksi
CREATE POLICY "Enable insert for staff" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (get_my_role() IN ('admin', 'manager', 'operator'));

-- Hanya Admin yang bisa mengubah atau menghapus transaksi (Demi integritas stok)
CREATE POLICY "Enable update/delete for admins" ON transactions
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ==========================================
-- 4. POLICIES FOR 'audit_logs'
-- ==========================================

-- Logger (Aplikasi) harus bisa menulis log untuk semua aktivitas user
CREATE POLICY "Enable insert for all authenticated users" ON audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Hanya Admin dan Manager yang bisa melihat audit log
CREATE POLICY "Enable read for management" ON audit_logs
    FOR SELECT TO authenticated
    USING (get_my_role() IN ('admin', 'manager', 'operator'));

-- Hanya Admin yang bisa membersihkan log lama
CREATE POLICY "Enable delete for admins only" ON audit_logs
    FOR DELETE TO authenticated USING (is_admin());

-- ==========================================
-- 5. POLICIES FOR 'app_settings'
-- ==========================================

-- Diperlukan akses publik (anon) agar halaman Login bisa cek versi terbaru
CREATE POLICY "Allow public read access to app_settings" ON app_settings
    FOR SELECT USING (true);

-- Hanya admin yang bisa mengubah pengaturan aplikasi atau URL APK
CREATE POLICY "Allow admins to manage app_settings" ON app_settings
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ==================================================================================
-- PENJELASAN SINGKAT:
-- 1. viewer   : Hanya bisa SELECT (view) tabel utama.
-- 2. operator : Bisa SELECT dan INSERT ke 'transactions', tapi tidak bisa DELETE.
-- 3. manager  : Bisa SELECT semua, INSERT ke 'transactions' (untuk opname).
-- 4. admin    : Memiliki akses penuh (ALL) ke semua tabel.
-- ==================================================================================