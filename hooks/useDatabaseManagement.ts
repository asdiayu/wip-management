
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { downloadFile } from '../utils/fileHelper';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';

export interface DbStat {
    schema_name: string;
    table_name: string;
    row_count: number;
    total_size: string;
}

export const useDatabaseManagement = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resetMode, setResetMode] = useState<'keep_stock' | 'zero_stock'>('keep_stock');
    
    const [dbStats, setDbStats] = useState<DbStat[]>([]);
    const [totalDbSize, setTotalDbSize] = useState<string>('');
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(false);
    
    const [latestVersion, setLatestVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState('');
    const [apkFile, setApkFile] = useState<File | null>(null);
    
    const [showSql, setShowSql] = useState(false);
    const [activeSqlTab, setActiveSqlTab] = useState<'cleanup' | 'functions' | 'security' | 'storage'>('functions');

    const [truncateTarget, setTruncateTarget] = useState<DbStat | null>(null);
    const [truncateConfirmInput, setTruncateConfirmInput] = useState('');

    useEffect(() => {
        fetchDbStats();
        fetchVersionSettings();
    }, []);

    const fetchDbStats = async () => {
        setStatsLoading(true);
        setStatsError(false);
        try {
            const { data: tableData, error: tableError } = await supabase.rpc('get_db_stats');
            if (tableError) throw tableError;
            if (tableData) {
                setDbStats((tableData as any[]).map(t => ({
                    schema_name: t.schema_name || 'public',
                    table_name: t.table_name,
                    row_count: t.row_count,
                    total_size: t.total_size
                })));
            }
            const { data: totalData, error: totalError } = await supabase.rpc('get_total_db_size');
            if (!totalError && totalData) setTotalDbSize(totalData as string);
        } catch (error) {
            setStatsError(true);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchVersionSettings = async () => {
        const { data } = await supabase.from('app_settings').select('key, value').in('key', ['app_version', 'app_update_url']);
        if (data) {
            setLatestVersion(data.find(d => d.key === 'app_version')?.value || '');
            setUpdateUrl(data.find(d => d.key === 'app_update_url')?.value || '');
        }
    };

    const handleSaveVersion = async () => {
        setLoading('version');
        setMessage(null);
        try {
            // Pastikan session auth ada
            let { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const refreshed = await supabase.auth.refreshSession();
                session = refreshed.data.session;
            }
            if (!session) {
                throw new Error('Sesi login tidak valid. Silakan logout lalu login ulang sebagai admin.');
            }
            const sessionRole = session.user?.app_metadata?.role || session.user?.user_metadata?.role || 'unknown';

            let finalDownloadUrl = updateUrl;
            if (apkFile) {
                // Validasi ukuran file (Supabase Storage limit: 50MB untuk free tier)
                const fileSizeInMB = apkFile.size / (1024 * 1024);
                const MAX_FILE_SIZE_MB = 50; // Supabase Storage default limit

                if (fileSizeInMB > MAX_FILE_SIZE_MB) {
                    throw new Error(
                        `Ukuran file APK (${fileSizeInMB.toFixed(2)} MB) melebihi batas maksimum (${MAX_FILE_SIZE_MB} MB). ` +
                        `Silakan kurangi ukuran APK atau upgrade plan Supabase Anda.`
                    );
                }

                // Upload menggunakan Edge Function (dengan service role key yang bypass RLS)
                const form = new FormData();
                form.append('file', apkFile);
                form.append('version', latestVersion);

                // Invoke Edge Function 'upload-apk'
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
                const { data, error } = await supabase.functions.invoke('upload-apk', {
                    body: form,
                    headers: {
                        // Use anon key for function auth gate, and pass user token separately
                        Authorization: `Bearer ${supabaseAnonKey}`,
                        'x-user-jwt': session.access_token
                    }
                });

                if (error) {
                    let extra = '';
                    try {
                        const ctx: any = (error as any).context;
                        if (ctx) {
                            const status = ctx.status;
                            const bodyText = await ctx.text();
                            extra = ` status=${status} body=${bodyText}`;
                        }
                    } catch {}
                    throw new Error(
                        `Upload APK gagal: ${error.message}${extra}. ` +
                        `Pastikan Edge Function 'upload-apk' sudah di-deploy ke Supabase.`
                    );
                }

                if (!data?.publicUrl) {
                    throw new Error('Upload APK gagal: publicUrl tidak ditemukan.');
                }

                finalDownloadUrl = data.publicUrl as string;
            }
            const { error: upsertVerErr } = await supabase.from('app_settings').upsert({ key: 'app_version', value: latestVersion });
            if (upsertVerErr) throw new Error(`Simpan versi gagal: ${upsertVerErr.message}`);
            const { error: upsertUrlErr } = await supabase.from('app_settings').upsert({ key: 'app_update_url', value: finalDownloadUrl });
            if (upsertUrlErr) throw new Error(`Simpan URL update gagal: ${upsertUrlErr.message}`);
            showMessage('success', 'Update berhasil dipublikasikan!');
            fetchVersionSettings();
        } catch (error: any) {
            showMessage('error', error.message || "Gagal menyimpan.");
        } finally {
            setLoading(null);
        }
    };

    const handleRecalculateStock = async () => {
        setLoading('recalc');
        try {
            const { error: rpcError } = await supabase.rpc('recalculate_all_material_stocks');
            if (rpcError) throw rpcError;
            showMessage('success', 'Sinkronisasi berhasil!');
            fetchDbStats();
        } catch (e: any) { showMessage('error', e.message); } finally { setLoading(null); }
    };

    const handleBackup = async () => {
        setLoading('backup');
        try {
            const [m, l, t] = await Promise.all([
                supabase.from('materials').select('*'),
                supabase.from('locations').select('*'),
                supabase.from('transactions').select('*')
            ]);
            const backupJson = JSON.stringify({ 
                version: 3, 
                createdAt: new Date().toISOString(), 
                data: { materials: m.data, locations: l.data, transactions: t.data } 
            }, null, 2);
            await downloadFile(`backup_full_${new Date().toISOString().split('T')[0]}.json`, backupJson, 'application/json');
            showMessage('success', 'Backup didownload.');
        } catch (e: any) { showMessage('error', e.message); } finally { setLoading(null); }
    };

    const sanitizeData = (data: any[]) => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => {
            const clean: any = {};
            Object.keys(item).forEach(key => {
                const val = item[key];
                if (typeof val === 'object' && val !== null) return;
                if (val === "") {
                    clean[key] = null;
                } else {
                    clean[key] = val;
                }
            });
            return clean;
        });
    };

    const handleRestore = () => {
        if (!restoreFile) return;
        setIsRestoreConfirmOpen(true);
    };

    const executeRestore = async () => {
        if (!restoreFile) return;
        setIsRestoreConfirmOpen(false);
        setLoading('restore');
        setMessage(null);

        try {
            const fileContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = () => reject(new Error("Gagal membaca file fisik."));
                reader.readAsText(restoreFile);
            });

            const parsed = JSON.parse(fileContent);
            const rawData = parsed.data || parsed;

            if (!rawData.materials || !Array.isArray(rawData.materials)) {
                throw new Error("File backup tidak valid: Data 'materials' tidak ditemukan.");
            }

            const locations = sanitizeData(rawData.locations || []);
            const materials = sanitizeData(rawData.materials || []);
            const transactions = sanitizeData(rawData.transactions || []);

            const { error: rpcError } = await supabase.rpc('restore_database_rpc', { 
                locations_json: locations,
                materials_json: materials, 
                transactions_json: transactions 
            });

            if (rpcError) throw rpcError;

            await logActivity(user, 'RESTORE_DATABASE', `File: ${restoreFile.name}`);
            showMessage('success', 'RESTORE BERHASIL! Me-refresh halaman...');
            setTimeout(() => window.location.reload(), 2000);

        } catch (err: any) { 
            console.error("Critical Restore Error:", err);
            showMessage('error', "GAGAL RESTORE: " + (err.message || "Pastikan file JSON valid.")); 
        } finally {
            setLoading(null);
        }
    };

    const handleReset = async () => {
        if (resetConfirmText !== "RESET DATA") return;
        setLoading('reset');
        try {
            const rpcName = resetMode === 'keep_stock' ? 'consolidate_transactions_rpc' : 'clear_all_data_rpc';
            const { error } = await supabase.rpc(rpcName, { admin_pic: user?.email });
            if (error) throw error;
            await logActivity(user, 'RESET_DATABASE', `Mode: ${resetMode}`);
            showMessage('success', 'Reset berhasil!');
            setResetConfirmText('');
            fetchDbStats();
        } catch (e: any) { showMessage('error', "Gagal: " + e.message); } finally { setLoading(null); }
    };

    const executeTruncate = async () => {
        if (!truncateTarget || truncateConfirmInput !== truncateTarget.table_name) return;
        setLoading('truncate_' + truncateTarget.table_name);
        try {
            const { error } = await supabase.rpc('truncate_table', { 
                schema_name_param: truncateTarget.schema_name || 'public', 
                table_name_param: truncateTarget.table_name 
            });
            if (error) throw error;
            showMessage('success', `Tabel ${truncateTarget.table_name} dikosongkan.`);
            setTruncateTarget(null); 
            setTimeout(fetchDbStats, 1000);
        } catch (e: any) { showMessage('error', e.message); } finally { setLoading(null); }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        if (type === 'success') {
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const getSqlContent = () => {
        if (activeSqlTab === 'storage') {
            return `-- ==================================================================================
-- DEPLOY EDGE FUNCTION 'upload-apk' KE SUPABASE
-- Jalankan perintah ini di terminal di root project
-- ==================================================================================

npx supabase functions deploy upload-apk

-- ==================================================================================
-- SETELAH DEPLOY, COBA UPLOAD APK LAGI
-- Edge Function menggunakan service role key yang bisa bypass RLS storage.objects
-- ==================================================================================

-- CATATAN: Edge Function 'upload-apk' sudah ada di supabase/functions/upload-apk/index.ts
-- Pastikan function sudah di-deploy sebelum mencoba upload APK

-- ==================================================================================
-- OPSIONAL: JIKA INGIN MENGECEK STATUS EDGE FUNCTION
-- Jalankan ini di Supabase SQL Editor:
-- ==================================================================================

-- SELECT * FROM pg_stat_activity WHERE query LIKE '%upload-apk%' ORDER BY starttime DESC LIMIT 5;

-- ==================================================================================
-- OPSIONAL: JIKA INGIN MENGHAPUS EDGE FUNCTION
-- Jalankan ini di terminal:
-- ==================================================================================

npx supabase functions delete upload-apk

-- ==================================================================================
-- JIKA INGIN MENGATUR RLS STORAGE MANUAL (TIDAK DISARANKAN)
-- HANYA jika Edge Function tidak bekerja!
-- ==================================================================================

-- DROP POLICY IF EXISTS "Public Access" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('app-releases', 'app-releases', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Public Access" ON storage.objects
--     FOR SELECT USING (bucket_id = 'app-releases');
--
-- CREATE POLICY "Allow all uploads to app-releases" ON storage.objects
--     FOR INSERT TO authenticated
--     WITH CHECK (bucket_id = 'app-releases');
--
-- CREATE POLICY "Allow all updates to app-releases" ON storage.objects
--     FOR UPDATE TO authenticated
--     USING (bucket_id = 'app-releases')
--     WITH CHECK (bucket_id = 'app-releases');`;
        }

        if (activeSqlTab === 'security') {
            return `-- ==================================================================================
-- AKTIFKAN RLS & POLICIES (APP SETTINGS)
-- ==================================================================================

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Diperlukan akses publik (anon) agar halaman Login bisa cek versi terbaru
DROP POLICY IF EXISTS "Allow public read access to app_settings" ON app_settings;
CREATE POLICY "Allow public read access to app_settings" ON app_settings
    FOR SELECT USING (true);

-- Hanya admin yang bisa mengubah pengaturan aplikasi atau URL APK
DROP POLICY IF EXISTS "Allow admins to manage app_settings" ON app_settings;
CREATE POLICY "Allow admins to manage app_settings" ON app_settings
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());`;
        }

        if (activeSqlTab === 'cleanup') {
            return `-- ==================================================================================
-- OPTIONAL CLEANUP / RESET HELPERS
-- ==================================================================================
-- (Kosongkan tabel jika diperlukan, gunakan dengan hati-hati)
-- TRUNCATE transactions;
-- TRUNCATE materials;
-- TRUNCATE locations;`;
        }

        return `-- 1. HAPUS FUNGSI LAMA
DROP FUNCTION IF EXISTS restore_database_rpc(jsonb, jsonb, jsonb);

-- 2. FUNGSI RESTORE SUPER CEPAT & AMAN
CREATE OR REPLACE FUNCTION restore_database_rpc(locations_json jsonb, materials_json jsonb, transactions_json jsonb) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Matikan Triggers sementara (agar insert cepat & tidak error stok)
    ALTER TABLE transactions DISABLE TRIGGER trg_update_stock;

    -- Bersihkan Data Lama
    TRUNCATE transactions CASCADE;
    TRUNCATE materials CASCADE;
    TRUNCATE locations CASCADE;

    -- Jalankan Restore
    INSERT INTO locations SELECT * FROM jsonb_populate_recordset(null::locations, locations_json);
    INSERT INTO materials SELECT * FROM jsonb_populate_recordset(null::materials, materials_json);
    INSERT INTO transactions SELECT * FROM jsonb_populate_recordset(null::transactions, transactions_json);

    -- Nyalakan Trigger Kembali
    ALTER TABLE transactions ENABLE TRIGGER trg_update_stock;

    -- Sinkronisasi Stok Akhir (Full Scan)
    PERFORM recalculate_all_material_stocks();
END; $$;

-- 3. FUNGSI STATISTIK
CREATE OR REPLACE FUNCTION get_db_stats() RETURNS TABLE (schema_name text, table_name text, row_count bigint, total_size text) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT schemaname::text, relname::text, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;
END; $$;`;
    };

    return {
        loading, message, restoreFile, setRestoreFile, resetConfirmText, setResetConfirmText,
        resetMode, setResetMode, dbStats, totalDbSize, statsLoading, statsError,
        latestVersion, setLatestVersion, updateUrl, setUpdateUrl, apkFile, setApkFile,
        showSql, setShowSql, activeSqlTab, setActiveSqlTab, truncateTarget, setTruncateTarget,
        truncateConfirmInput, setTruncateConfirmInput, fetchDbStats, handleSaveVersion,
        handleRecalculateStock, handleBackup, handleRestore, handleReset, executeTruncate,
        getSqlContent, isRestoreConfirmOpen, setIsRestoreConfirmOpen, executeRestore
    };
};
