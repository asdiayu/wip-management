-- ==================================================================================
-- FIX: recalculate_all_material_stocks (Used in Restore)
-- Run this in Supabase SQL Editor to fix the "UPDATE requires a WHERE clause" error.
-- ==================================================================================

CREATE OR REPLACE FUNCTION recalculate_all_material_stocks() RETURNS VOID SECURITY DEFINER AS $$
BEGIN 
    IF NOT is_admin() THEN 
        RAISE EXCEPTION 'Access Denied'; 
    END IF; 
    
    -- Fix: Add WHERE clause for safe update
    UPDATE materials SET stock = 0 WHERE id IS NOT NULL; 
    
    WITH calc AS (
        SELECT material_id, SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) as qty 
        FROM transactions 
        GROUP BY material_id
    ) 
    UPDATE materials m 
    SET stock = c.qty 
    FROM calc c 
    WHERE m.id = c.material_id; 
END; $$ LANGUAGE plpgsql;
