-- ==================================================================================
-- STORAGE MANAGEMENT SYSTEM - DATABASE CLEANUP (DROP)
-- Gunakan ini SEBELUM menjalankan supabase_schema.sql v1.2.0
-- WARNING: Perintah ini akan MENGHAPUS SEMUA DATA jika tidak ada backup!
-- ==================================================================================

-- 1. HAPUS SEMUA TABEL DAN RELASINYA (CASCADE)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- 2. HAPUS SEMUA FUNGSI RPC (DASHBOARD & ANALYTICS)
DROP FUNCTION IF EXISTS get_dashboard_kpi CASCADE;
DROP FUNCTION IF EXISTS get_daily_trend_stats CASCADE;
DROP FUNCTION IF EXISTS get_top_movers_stats CASCADE;
DROP FUNCTION IF EXISTS get_material_analytics_stats CASCADE;
DROP FUNCTION IF EXISTS get_abc_analysis_stats CASCADE;

-- 3. HAPUS SEMUA FUNGSI RPC (OPERATIONAL)
DROP FUNCTION IF EXISTS get_locations_with_stock CASCADE;
DROP FUNCTION IF EXISTS get_location_stock_summary CASCADE;
DROP FUNCTION IF EXISTS get_stock_by_location CASCADE;
DROP FUNCTION IF EXISTS recalculate_all_material_stocks CASCADE;

-- 4. HAPUS SEMUA FUNGSI RPC (DATABASE MANAGEMENT)
DROP FUNCTION IF EXISTS get_db_stats CASCADE;
DROP FUNCTION IF EXISTS get_total_db_size CASCADE;
DROP FUNCTION IF EXISTS restore_database_rpc CASCADE;
DROP FUNCTION IF EXISTS consolidate_transactions_rpc CASCADE;
DROP FUNCTION IF EXISTS clear_all_data_rpc CASCADE;
DROP FUNCTION IF EXISTS truncate_table CASCADE;

-- 5. HAPUS SEMUA FUNGSI RPC (USER & SECURITY)
DROP FUNCTION IF EXISTS get_users_list CASCADE;
DROP FUNCTION IF EXISTS create_user_by_admin CASCADE;
DROP FUNCTION IF EXISTS update_user_role CASCADE;
DROP FUNCTION IF EXISTS update_password_by_admin CASCADE;
DROP FUNCTION IF EXISTS delete_user_by_admin CASCADE;
DROP FUNCTION IF EXISTS is_admin CASCADE;
DROP FUNCTION IF EXISTS get_my_role CASCADE;

-- 6. HAPUS SHARED UTILITIES
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS sync_material_stock CASCADE;