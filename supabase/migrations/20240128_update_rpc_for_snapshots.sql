-- ============================================
-- UPDATE RPC FUNCTIONS FOR SNAPSHOTS SUPPORT
-- ============================================
-- Phase 3: Update RPC Functions (Reset-Safe)
--
-- This updates existing RPC functions to work with stock_snapshots table
-- All reset/consolidation functions now handle snapshots properly
--
-- Created: 2024-01-28
-- Dependencies: stock_snapshots table (must be created first)
--

-- ============================================
-- STEP 3.1: UPDATE CONSOLIDATE TRANSACTIONS RPC
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS consolidate_transactions_rpc(text);

-- Create new version with snapshot support
CREATE OR REPLACE FUNCTION consolidate_transactions_rpc(admin_pic text)
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_materials_count INTEGER;
    v_snapshots_count INTEGER;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 1. SAVE CURRENT SNAPSHOTS TO TEMP TABLE (stock per location)
    CREATE TEMP TABLE t_snapshots AS
        SELECT material_id, location_id, stock_quantity
        FROM stock_snapshots
        WHERE stock_quantity > 0;

    SELECT COUNT(DISTINCT material_id) INTO v_materials_count FROM t_snapshots;

    -- 2. DISABLE TRIGGER for performance
    -- This prevents 10,000+ trigger executions during reset
    ALTER TABLE stock_snapshots DISABLE TRIGGER USER;

    -- 3. RESET TRANSACTIONS
    TRUNCATE transactions CASCADE;

    -- 4. INSERT INITIAL TRANSACTIONS (from snapshots to preserve location)
    FOR r IN SELECT * FROM t_snapshots LOOP
        INSERT INTO transactions (material_id, type, quantity, shift, notes, pic, timestamp, location_id)
        VALUES (r.material_id, 'IN', r.stock_quantity, 'Initial', 'Consolidation Reset', admin_pic, NOW(), r.location_id);
    END LOOP;

    -- 4.5. RESET MATERIALS.STOCK TO 0 (to prevent double counting)
    UPDATE materials SET stock = 0 WHERE id IS NOT NULL;

    -- 5. REBUILD SNAPSHOTS FROM NEW DATA
    PERFORM populate_stock_snapshots();

    -- 5.5. UPDATE MATERIALS.STOCK FROM SNAPSHOTS (aggregate by location)
    WITH stock_by_material AS (
        SELECT material_id, SUM(stock_quantity) as total_stock
        FROM stock_snapshots
        GROUP BY material_id
    )
    UPDATE materials m SET stock = sbm.total_stock
    FROM stock_by_material sbm
    WHERE m.id = sbm.material_id;

    -- 6. RE-ENABLE TRIGGER
    ALTER TABLE stock_snapshots ENABLE TRIGGER USER;

    -- Cleanup
    DROP TABLE IF EXISTS t_snapshots;

    -- Get snapshot count for logging
    SELECT COUNT(*) INTO v_snapshots_count FROM stock_snapshots;

    RAISE NOTICE 'Consolidation completed: %s materials, %s snapshots rebuilt', v_materials_count, v_snapshots_count;
END; $$
LANGUAGE plpgsql;

-- ============================================
-- STEP 3.2: UPDATE CLEAR ALL DATA RPC
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS clear_all_data_rpc(text);

-- Create new version with snapshot cleanup
CREATE OR REPLACE FUNCTION clear_all_data_rpc(admin_pic text)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 1. TRUNCATE transactions
    TRUNCATE transactions CASCADE;

    -- 2. Reset all stock
    UPDATE materials SET stock = 0 WHERE id IS NOT NULL;

    -- 3. Clear snapshots
    TRUNCATE stock_snapshots;

    RAISE NOTICE 'All data cleared, snapshots reset';
END; $$
LANGUAGE plpgsql;

-- ============================================
-- STEP 3.3: UPDATE RECALCULATE STOCK RPC
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS recalculate_all_material_stocks();

-- Create new version with snapshot rebuild
CREATE OR REPLACE FUNCTION recalculate_all_material_stocks()
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
    v_materials_updated INTEGER;
    v_snapshots_count INTEGER;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    -- 1. Recalculate materials.stock from transactions
    UPDATE materials SET stock = 0 WHERE id IS NOT NULL;

    WITH calc AS (
        SELECT material_id, SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) as qty
        FROM transactions
        GROUP BY material_id
    )
    UPDATE materials m SET stock = c.qty
    FROM calc c
    WHERE m.id = c.material_id;

    GET DIAGNOSTICS v_materials_updated = ROW_COUNT;

    -- 2. REBUILD SNAPSHOTS for synchronization
    PERFORM populate_stock_snapshots();

    -- Get snapshot count for logging
    SELECT COUNT(*) INTO v_snapshots_count FROM stock_snapshots;

    RAISE NOTICE 'Stock recalculated: %s materials, %s snapshots rebuilt', v_materials_updated, v_snapshots_count;
END; $$
LANGUAGE plpgsql;

-- ============================================
-- STEP 3.4: UPDATE GET STOCK BY LOCATION RPC
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS get_stock_by_location(UUID);

-- Create new version - queries from snapshots table (SUPER FAST!)
CREATE OR REPLACE FUNCTION get_stock_by_location(material_id_param UUID)
RETURNS TABLE (location_id UUID, location_name TEXT, stock_quantity NUMERIC)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id as location_id,
        COALESCE(l.name, 'Unknown Location') as location_name,
        COALESCE(ss.stock_quantity, 0) as stock_quantity
    FROM locations l
    LEFT JOIN stock_snapshots ss
        ON ss.location_id = l.id
        AND ss.material_id = material_id_param
    WHERE COALESCE(ss.stock_quantity, 0) > 0  -- Only locations with stock
    ORDER BY l.name;
END; $$
LANGUAGE plpgsql;

-- ============================================
-- STEP 3.5: GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION consolidate_transactions_rpc(text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_all_data_rpc(text) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_material_stocks() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_by_location(UUID) TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show summary
SELECT
    'RPC Functions Updated for Snapshots' as implementation,
    NOW() as completed_at,
    'Updated functions:' as details,
    ARRAY[
        'consolidate_transactions_rpc - Rebuilds snapshots after reset',
        'clear_all_data_rpc - Clears snapshots',
        'recalculate_all_material_stocks - Rebuilds snapshots',
        'get_stock_by_location - Queries from snapshots (FAST!)'
    ] as functions_updated,
    'Ready for Phase 4: Testing' as next_step;
