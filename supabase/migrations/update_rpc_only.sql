-- ==================================================================================
-- UPDATE RPC Laporan (Tanpa Reset Data)
-- Jalankan ini di Supabase SQL Editor untuk memperbaiki fitur Laporan yang 0
-- ==================================================================================

DROP FUNCTION IF EXISTS get_report_summary;

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
        COALESCE(SUM(CASE WHEN type = 'IN' OR shift = 'Initial' THEN quantity ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN type = 'OUT' AND shift != 'Initial' THEN quantity ELSE 0 END), 0) as total_out
    FROM transactions
    WHERE timestamp >= start_date AND timestamp <= end_date
    AND (material_id_param IS NULL OR material_id = material_id_param)
    AND (location_id_param IS NULL OR location_id = location_id_param)
    AND (shift_param IS NULL OR shift = ANY(shift_param));
END;
$$;
