-- ==================================================================================
-- FIX: Missing clear_all_data_rpc
-- Run this in Supabase SQL Editor to fix the "Could not find function" error.
-- ==================================================================================

CREATE OR REPLACE FUNCTION clear_all_data_rpc(admin_pic text) RETURNS VOID SECURITY DEFINER AS $$
BEGIN 
    -- 1. Check Permission
    IF NOT is_admin() THEN 
        RAISE EXCEPTION 'Access Denied: Only Admins can reset data.'; 
    END IF; 

    -- 2. Wipe Transaction History
    -- TRUNCATE is faster than DELETE and doesn't fire row triggers
    TRUNCATE transactions CASCADE;
    
    -- 3. Reset Stock to 0
    -- Materials and Locations are PRESERVED (only stock becomes 0)
    UPDATE materials SET stock = 0 WHERE id IS NOT NULL;
    
END; $$ LANGUAGE plpgsql;
