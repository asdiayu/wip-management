-- ==================================================================================
-- STORAGE MANAGEMENT SYSTEM - DATABASE SCHEMA v1.1.4
-- ==================================================================================

-- 1. UTILITIES & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES

-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: locations
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: materials
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    stock NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    department TEXT,
    machine_number TEXT,
    min_stock NUMERIC DEFAULT 0,
    max_stock NUMERIC,
    default_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity NUMERIC NOT NULL CHECK (quantity >= 0),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    shift TEXT,
    pic TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
CREATE INDEX IF NOT EXISTS idx_materials_dept ON materials(department);
CREATE INDEX IF NOT EXISTS idx_transactions_mat_id ON transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_transactions_loc_id ON transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(timestamp);

-- 4. TRIGGERS

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION sync_material_stock() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.type = 'IN' THEN UPDATE materials SET stock = stock + NEW.quantity WHERE id = NEW.material_id;
        ELSIF NEW.type = 'OUT' THEN UPDATE materials SET stock = stock - NEW.quantity WHERE id = NEW.material_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.type = 'IN' THEN UPDATE materials SET stock = stock - OLD.quantity WHERE id = OLD.material_id;
        ELSIF OLD.type = 'OUT' THEN UPDATE materials SET stock = stock + OLD.quantity WHERE id = OLD.material_id;
        END IF;
    END IF;
    RETURN NULL;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_stock ON transactions;
CREATE TRIGGER trg_sync_stock AFTER INSERT OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION sync_material_stock();

-- 5. ACCESS CONTROL HELPERS

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (raw_user_meta_data->>'role' = 'admin' OR raw_app_meta_data->>'role' = 'admin')); END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
BEGIN RETURN (SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role', 'viewer') FROM auth.users WHERE id = auth.uid()); END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. BUSINESS LOGIC & ANALYTICS RPC (OPTIMIZED)

-- [EXISTING] Helper
CREATE OR REPLACE FUNCTION get_locations_with_stock() RETURNS TABLE (location_id UUID) AS $$
BEGIN RETURN QUERY SELECT DISTINCT t.location_id FROM transactions t GROUP BY t.location_id, t.material_id HAVING SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) > 0; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_location_stock_summary(target_location_id UUID) RETURNS TABLE (material_id UUID, stock_qty NUMERIC) AS $$
BEGIN RETURN QUERY SELECT t.material_id, SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) as stock_qty FROM transactions t WHERE t.location_id = target_location_id GROUP BY t.material_id HAVING SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) > 0; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_stock_by_location(material_id_param UUID) RETURNS TABLE (location_id UUID, location_name TEXT, stock_quantity NUMERIC) AS $$
BEGIN RETURN QUERY SELECT l.id, l.name, COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0) as stock FROM locations l LEFT JOIN transactions t ON t.location_id = l.id AND t.material_id = material_id_param GROUP BY l.id, l.name HAVING COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0) > 0; END; $$ LANGUAGE plpgsql;

-- [NEW] Dashboard KPI Summary (Server-Side)
CREATE OR REPLACE FUNCTION get_dashboard_kpi(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (total_transactions BIGINT, volume_in NUMERIC, volume_out NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT COUNT(id), COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0), COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0)
    FROM transactions WHERE timestamp >= start_date AND timestamp <= end_date AND shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment');
END; $$;

-- [NEW] Daily Trend Chart (Server-Side Grouping)
CREATE OR REPLACE FUNCTION get_daily_trend_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (trx_date TEXT, total_in NUMERIC, total_out NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT TO_CHAR(timestamp, 'YYYY-MM-DD'), COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0), COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0)
    FROM transactions WHERE timestamp >= start_date AND timestamp <= end_date AND shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment') GROUP BY 1 ORDER BY 1 ASC;
END; $$;

-- [NEW] Top Movers (Server-Side Sorting)
CREATE OR REPLACE FUNCTION get_top_movers_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, limit_count INT DEFAULT 5)
RETURNS TABLE (material_name TEXT, unit TEXT, transaction_count BIGINT, total_quantity NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT m.name, m.unit, COUNT(t.id), SUM(t.quantity) FROM transactions t JOIN materials m ON t.material_id = m.id
    WHERE t.timestamp >= start_date AND t.timestamp <= end_date AND t.shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment') GROUP BY m.name, m.unit ORDER BY COUNT(t.id) DESC LIMIT limit_count;
END; $$;

-- [NEW] Analytics: Forecast & Slow Moving (Combined optimized query)
CREATE OR REPLACE FUNCTION get_material_analytics_stats()
RETURNS TABLE (id UUID, name TEXT, unit TEXT, current_stock NUMERIC, last_trx_date TIMESTAMPTZ, avg_daily_out NUMERIC, days_to_empty NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY WITH velocity AS (
        SELECT material_id, SUM(quantity) as total_out_30d, MAX(timestamp) as last_trx FROM transactions 
        WHERE type = 'OUT' AND timestamp >= (NOW() - INTERVAL '30 days') AND shift NOT IN ('Transfer', 'Return', 'Adjustment') GROUP BY material_id
    )
    SELECT m.id, m.name, m.unit, m.stock, (SELECT MAX(timestamp) FROM transactions t WHERE t.material_id = m.id) as last_trx_date,
    COALESCE(v.total_out_30d / 30.0, 0) as avg_daily_out, CASE WHEN COALESCE(v.total_out_30d, 0) = 0 THEN 9999 ELSE m.stock / (v.total_out_30d / 30.0) END
    FROM materials m LEFT JOIN velocity v ON m.id = v.material_id ORDER BY CASE WHEN COALESCE(v.total_out_30d, 0) = 0 THEN 9999 ELSE m.stock / (v.total_out_30d / 30.0) END ASC;
END; $$;

-- [NEW] Analytics: ABC Pareto Analysis (Window Functions)
CREATE OR REPLACE FUNCTION get_abc_analysis_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (material_name TEXT, unit TEXT, usage_qty NUMERIC, cumulative_percentage NUMERIC, abc_class TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY WITH usage_data AS (
        SELECT m.name, m.unit, COALESCE(SUM(t.quantity), 0) as qty FROM transactions t JOIN materials m ON t.material_id = m.id
        WHERE t.type = 'OUT' AND t.timestamp >= start_date AND t.timestamp <= end_date AND t.shift NOT IN ('Transfer', 'Return', 'Adjustment') GROUP BY m.name, m.unit
    ), total_vol AS ( SELECT SUM(qty) as total FROM usage_data ),
    cumulative AS ( SELECT u.name, u.unit, u.qty, SUM(u.qty) OVER (ORDER BY u.qty DESC) as running_total, (SELECT total FROM total_vol) as grand_total FROM usage_data u WHERE u.qty > 0 )
    SELECT c.name, c.unit, c.qty, (c.running_total / c.grand_total) * 100,
    CASE WHEN (c.running_total / c.grand_total) <= 0.80 THEN 'A' WHEN (c.running_total / c.grand_total) <= 0.95 THEN 'B' ELSE 'C' END
    FROM cumulative c ORDER BY c.qty DESC;
END; $$;

-- [NEW] Report Summary Aggregation (Server-Side)
CREATE OR REPLACE FUNCTION get_report_summary(
    start_date TIMESTAMPTZ, 
    end_date TIMESTAMPTZ,
    material_id_param UUID DEFAULT NULL,
    location_id_param UUID DEFAULT NULL,
    shift_param TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    total_in NUMERIC,
    total_out NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' OR shift = 'Initial' THEN quantity ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'OUT' AND shift != 'Initial' THEN quantity ELSE 0 END), 0)
    FROM transactions
    WHERE timestamp >= start_date AND timestamp <= end_date
    AND (material_id_param IS NULL OR material_id = material_id_param)
    AND (location_id_param IS NULL OR location_id = location_id_param)
    AND (shift_param IS NULL OR shift = ANY(shift_param));
END;
$$;

-- 7. USER MANAGEMENT (ADMIN ONLY)

CREATE OR REPLACE FUNCTION get_users_list() RETURNS TABLE (id UUID, email VARCHAR, role TEXT, last_sign_in_at TIMESTAMPTZ, created_at TIMESTAMPTZ) SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; RETURN QUERY SELECT au.id, au.email::VARCHAR, COALESCE(au.raw_user_meta_data->>'role', 'viewer'), au.last_sign_in_at, au.created_at FROM auth.users au ORDER BY au.created_at DESC; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_by_admin(email_input TEXT, password_input TEXT, role_input TEXT) RETURNS VOID SECURITY DEFINER AS $$
DECLARE new_id UUID := gen_random_uuid();
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, role, aud, created_at, updated_at) VALUES (new_id, email_input, crypt(password_input, gen_salt('bf')), NOW(), jsonb_build_object('role', role_input), jsonb_build_object('role', role_input, 'provider', 'email', 'providers', array['email']), 'authenticated', 'authenticated', NOW(), NOW()); INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES (gen_random_uuid(), new_id, jsonb_build_object('sub', new_id, 'email', email_input), 'email', new_id::TEXT, NOW(), NOW(), NOW()); END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_role(target_user_id UUID, new_role TEXT) RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; UPDATE auth.users SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role)), raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role)) WHERE id = target_user_id; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_password_by_admin(target_user_id UUID, new_password TEXT) RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = target_user_id; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID) RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; DELETE FROM auth.users WHERE id = target_user_id; END; $$ LANGUAGE plpgsql;

-- 8. DATABASE MAINTENANCE
CREATE OR REPLACE FUNCTION recalculate_all_material_stocks() RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; UPDATE materials SET stock = 0 WHERE id IS NOT NULL; WITH calc AS (SELECT material_id, SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) as qty FROM transactions GROUP BY material_id) UPDATE materials m SET stock = c.qty FROM calc c WHERE m.id = c.material_id; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_database_rpc(locations_json jsonb, materials_json jsonb, transactions_json jsonb) RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; ALTER TABLE transactions DISABLE TRIGGER trg_sync_stock; TRUNCATE transactions, materials, locations CASCADE; IF locations_json IS NOT NULL THEN INSERT INTO locations SELECT * FROM jsonb_populate_recordset(null::locations, locations_json); END IF; IF materials_json IS NOT NULL THEN INSERT INTO materials SELECT * FROM jsonb_populate_recordset(null::materials, materials_json); END IF; IF transactions_json IS NOT NULL THEN INSERT INTO transactions SELECT * FROM jsonb_populate_recordset(null::transactions, transactions_json); END IF; ALTER TABLE transactions ENABLE TRIGGER trg_sync_stock; PERFORM recalculate_all_material_stocks(); END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_db_stats() RETURNS TABLE (schema_name text, table_name text, row_count bigint, total_size text) SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; RETURN QUERY SELECT schemaname::text, relname::text, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_total_db_size() RETURNS text SECURITY DEFINER AS $$
BEGIN RETURN pg_size_pretty(pg_database_size(current_database())); END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION consolidate_transactions_rpc(admin_pic text) RETURNS VOID SECURITY DEFINER AS $$
DECLARE r RECORD; BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; CREATE TEMP TABLE t_stock AS SELECT id, stock FROM materials WHERE stock > 0; TRUNCATE transactions CASCADE; FOR r IN SELECT * FROM t_stock LOOP INSERT INTO transactions (material_id, type, quantity, shift, notes, pic, timestamp) VALUES (r.id, 'IN', r.stock, 'Initial', 'Consolidation Reset', admin_pic, NOW()); END LOOP; DROP TABLE t_stock; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clear_all_data_rpc(admin_pic text) RETURNS VOID SECURITY DEFINER AS $$
BEGIN IF NOT is_admin() THEN RAISE EXCEPTION 'Access Denied'; END IF; TRUNCATE transactions CASCADE; UPDATE materials SET stock = 0 WHERE id IS NOT NULL; END; $$ LANGUAGE plpgsql;

-- 9. SEED DATA
INSERT INTO app_settings (key, value) VALUES ('app_version', '1.1.4') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('shift_mode', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('decimal_mode', 'auto') ON CONFLICT (key) DO NOTHING;