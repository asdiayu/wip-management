-- ============================================
-- STOCK SNAPSHOTS TABLE IMPLEMENTATION
-- ============================================
-- Phase 2: Create Snapshots Infrastructure
--
-- This creates the stock_snapshots table and supporting functions
-- to solve the Supabase 1000 rows limit problem for stock-per-location queries.
--
-- Created: 2024-01-28
-- Compatible with: Reset/Konsolidasi features
--

-- ============================================
-- STEP 2.1: CREATE SNAPSHOTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS stock_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    stock_quantity NUMERIC NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(material_id, location_id) -- Ensures 1 combination of material×location = 1 row
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_material ON stock_snapshots(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_location ON stock_snapshots(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_material_loc ON stock_snapshots(material_id, location_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_updated ON stock_snapshots(last_updated);

-- Add comment
COMMENT ON TABLE stock_snapshots IS 'Cache table for stock per location. Auto-updated via triggers after each transaction. Solves Supabase 1000 rows limit issue.';

-- ============================================
-- STEP 2.2: CREATE TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION trg_update_stock_snapshot()
RETURNS TRIGGER AS $$
DECLARE
    v_quantity NUMERIC;
BEGIN
    -- Calculate quantity change based on transaction type
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.type = 'IN') THEN
            v_quantity := NEW.quantity;
        ELSE
            v_quantity := -NEW.quantity;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- For transaction updates (rare)
        IF (OLD.type = 'IN' AND NEW.type = 'OUT') THEN
            v_quantity := -OLD.quantity - NEW.quantity;
        ELSIF (OLD.type = 'OUT' AND NEW.type = 'IN') THEN
            v_quantity := OLD.quantity + NEW.quantity;
        ELSE
            -- Same type, quantity changed
            IF (OLD.type = 'IN') THEN
                v_quantity := NEW.quantity - OLD.quantity;
            ELSE
                v_quantity := -(NEW.quantity - OLD.quantity);
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.type = 'IN') THEN
            v_quantity := -OLD.quantity;
        ELSE
            v_quantity := OLD.quantity;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- Skip if location_id is NULL (global transactions)
    IF TG_OP = 'DELETE' THEN
        IF OLD.location_id IS NULL THEN
            RETURN OLD;
        END IF;
    ELSE
        IF NEW.location_id IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Update or insert snapshot for this location
    IF TG_OP = 'DELETE' THEN
        INSERT INTO stock_snapshots (material_id, location_id, stock_quantity, last_transaction_at)
        VALUES (OLD.material_id, OLD.location_id, v_quantity, OLD.timestamp)
        ON CONFLICT (material_id, location_id)
        DO UPDATE SET
            stock_quantity = stock_snapshots.stock_quantity + v_quantity,
            last_transaction_at = GREATEST(stock_snapshots.last_transaction_at, OLD.timestamp),
            last_updated = NOW()
        WHERE stock_snapshots.material_id = EXCLUDED.material_id
            AND stock_snapshots.location_id = EXCLUDED.location_id;
    ELSE
        INSERT INTO stock_snapshots (material_id, location_id, stock_quantity, last_transaction_at)
        VALUES (NEW.material_id, NEW.location_id, v_quantity, NEW.timestamp)
        ON CONFLICT (material_id, location_id)
        DO UPDATE SET
            stock_quantity = stock_snapshots.stock_quantity + v_quantity,
            last_transaction_at = GREATEST(stock_snapshots.last_transaction_at, NEW.timestamp),
            last_updated = NOW()
        WHERE stock_snapshots.material_id = EXCLUDED.material_id
            AND stock_snapshots.location_id = EXCLUDED.location_id;
    END IF;

    -- Cleanup: Remove snapshots with stock = 0 (but keep for 1 day for history)
    DELETE FROM stock_snapshots
    WHERE stock_quantity = 0
        AND last_updated < NOW() - INTERVAL '1 day';

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END; $$ LANGUAGE plpgsql;

-- Attach trigger to transactions table
DROP TRIGGER IF EXISTS tr_stock_snapshot ON transactions;
CREATE TRIGGER tr_stock_snapshot
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_stock_snapshot();

-- ============================================
-- STEP 2.3: CREATE HELPER FUNCTIONS
-- ============================================

-- Function: Populate snapshots from existing transactions
CREATE OR REPLACE FUNCTION populate_stock_snapshots()
RETURNS TEXT AS $$
DECLARE
    v_snapshots INTEGER;
    v_start TIMESTAMPTZ;
    v_duration INTERVAL;
BEGIN
    v_start := NOW();

    -- Lock table to prevent concurrent updates during rebuild
    LOCK TABLE stock_snapshots IN EXCLUSIVE MODE;

    -- Clear existing data
    TRUNCATE stock_snapshots;

    -- Populate from current transactions
    INSERT INTO stock_snapshots (material_id, location_id, stock_quantity, last_transaction_at)
    SELECT
        material_id,
        location_id,
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0),
        MAX(timestamp)
    FROM transactions
    WHERE location_id IS NOT NULL
    GROUP BY material_id, location_id
    HAVING COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0) > 0;

    GET DIAGNOSTICS v_snapshots = ROW_COUNT;
    v_duration := NOW() - v_start;

    -- Log completion
    RAISE NOTICE 'Stock snapshots populated: % snapshots in %', v_snapshots, v_duration;

    RETURN format('✅ Rebuilt %s stock snapshots in %s', v_snapshots, v_duration);
END; $$ LANGUAGE plpgsql;

-- Function: Verify consistency between snapshots and materials.stock
CREATE OR REPLACE FUNCTION verify_stock_consistency()
RETURNS TABLE(
    mat_id UUID,
    mat_name TEXT,
    snapshot_stock NUMERIC,
    actual_stock NUMERIC,
    difference NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as mat_id,
        m.name as mat_name,
        COALESCE(ss.total, 0) as snapshot_stock,
        m.stock as actual_stock,
        ABS(COALESCE(ss.total, 0) - m.stock) as difference
    FROM materials m
    LEFT JOIN (
        SELECT material_id, SUM(stock_quantity) as total
        FROM stock_snapshots
        GROUP BY material_id
    ) ss ON ss.material_id = m.id
    WHERE ABS(COALESCE(ss.total, 0) - m.stock) > 0.01  -- Only show if difference > 0.01
    ORDER BY difference DESC;
END; $$ LANGUAGE plpgsql;

-- Function: Rebuild snapshots from master stock (for after reset)
CREATE OR REPLACE FUNCTION rebuild_stock_snapshots_from_master()
RETURNS VOID AS $$
BEGIN
    TRUNCATE stock_snapshots;

    INSERT INTO stock_snapshots (material_id, location_id, stock_quantity, last_transaction_at)
    SELECT
        m.id as material_id,
        l.id as location_id,
        (m.stock)::NUMERIC as stock_quantity,
        NOW() as last_transaction_at
    FROM materials m
    CROSS JOIN locations l
    WHERE m.stock > 0;

    RAISE NOTICE 'Stock snapshots rebuilt from master stock';
END; $$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2.4: GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION populate_stock_snapshots() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_stock_consistency() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_stock_snapshots_from_master() TO authenticated;
GRANT EXECUTE ON FUNCTION trg_update_stock_snapshot() TO authenticated;

-- ============================================
-- STEP 2.5: INITIAL POPULATION
-- ============================================

-- Run populate to build initial snapshots from existing transactions
SELECT populate_stock_snapshots();

-- Verify consistency
SELECT
    CASE WHEN COUNT(*) > 0 THEN '⚠️ WARNING: Found inconsistencies!'::text
    ELSE '✅ All stock data is consistent!'::text
END as status,
    COUNT(*) as inconsistent_count
FROM verify_stock_consistency();

-- ============================================
-- VERIFICATION
-- ============================================

-- Show summary
SELECT
    'Stock Snapshots Implementation' as implementation,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM stock_snapshots) as total_snapshots,
    (SELECT COUNT(*) FROM verify_stock_consistency()) as inconsistencies,
    'Ready for Phase 3: Update RPC Functions' as next_step
;

COMMENT ON FUNCTION populate_stock_snapshots() IS 'Populate/rebuild stock_snapshots table from transactions. Safe to run multiple times.';
COMMENT ON FUNCTION verify_stock_consistency() IS 'Check if stock_snapshots match materials.stock. Returns 0 rows = consistent.';
COMMENT ON FUNCTION rebuild_stock_snapshots_from_master() IS 'Rebuild snapshots from materials.stock. Used after reset operations.';
