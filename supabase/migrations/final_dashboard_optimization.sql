-- ============================================
-- DASHBOARD ANALYTICS FUNCTION - FINAL FIXED VERSION
-- ============================================
-- Run this in Supabase SQL Editor
-- All nested aggregate issues have been fixed

-- Drop existing function
DROP FUNCTION IF EXISTS get_dashboard_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS get_dashboard_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT);

-- Create the function
CREATE OR REPLACE FUNCTION get_dashboard_analytics(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_tz TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_kpi JSONB;
    v_daily_trend JSONB;
    v_daily_dept_changes JSONB;
    v_dept_distribution JSONB;
    v_alerts JSONB;
    v_top_movers JSONB;
    v_top_stock JSONB;
    v_debug_info JSONB;
BEGIN
    RAISE NOTICE 'Dashboard analytics: % to %', p_start_date, p_end_date;

    -- 1. KPI Summary
    SELECT jsonb_build_object(
        'transactionCount', COUNT(*),
        'volumeIn', COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0),
        'volumeOut', COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0)
    ) INTO v_kpi
    FROM transactions
    WHERE timestamp >= p_start_date AND timestamp <= p_end_date
    AND (shift IS NULL OR shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment'));

    -- 2. Daily Trend (Bar Chart)
    WITH daily_stats AS (
        SELECT
            (timestamp AT TIME ZONE p_tz)::date as trx_date,
            type,
            SUM(quantity) as total_qty
        FROM transactions
        WHERE timestamp >= p_start_date AND timestamp <= p_end_date
        AND (shift IS NULL OR shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment'))
        GROUP BY 1, 2
    ),
    daily_details AS (
        SELECT
            (t.timestamp AT TIME ZONE p_tz)::date as trx_date,
            t.type,
            m.name,
            SUM(t.quantity) as qty
        FROM transactions t
        JOIN materials m ON t.material_id = m.id
        WHERE t.timestamp >= p_start_date AND t.timestamp <= p_end_date
        AND (t.shift IS NULL OR t.shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment'))
        GROUP BY 1, 2, 3
    ),
    daily_top_items AS (
        SELECT
            trx_date,
            type,
            jsonb_agg(jsonb_build_object('name', name, 'quantity', qty) ORDER BY qty DESC) FILTER (WHERE qty > 0) as details
        FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY trx_date, type ORDER BY qty DESC) as rn
            FROM daily_details
        ) sub
        WHERE rn <= 5
        GROUP BY 1, 2
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', ds.trx_date,
            'type', ds.type,
            'total', ds.total_qty,
            'details', COALESCE(dti.details, '[]'::jsonb)
        )
    ) INTO v_daily_trend
    FROM daily_stats ds
    LEFT JOIN daily_top_items dti ON ds.trx_date = dti.trx_date AND ds.type = dti.type;

    -- 3. Daily Dept Changes (For Line Chart History) - FIXED: No nested aggregates
    WITH dept_changes AS (
        SELECT
            (t.timestamp AT TIME ZONE p_tz)::date as trx_date,
            t.type,
            COALESCE(m.department, 'Lainnya') as dept,
            SUM(t.quantity) as qty
        FROM transactions t
        JOIN materials m ON t.material_id = m.id
        WHERE t.timestamp >= p_start_date AND t.timestamp <= p_end_date
        AND (t.shift IS NULL OR t.shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment'))
        GROUP BY 1, 2, 3
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', trx_date,
            'type', type,
            'dept', dept,
            'qty', qty
        )
    ) INTO v_daily_dept_changes
    FROM dept_changes;

    -- 4. Department Distribution (Pie Chart)
    SELECT jsonb_agg(
        jsonb_build_object('name', COALESCE(department, 'Lainnya'), 'value', total_stock)
    ) INTO v_dept_distribution
    FROM (
        SELECT department, SUM(stock) as total_stock
        FROM materials
        GROUP BY department
    ) sub;

    -- 5. Alerts Counts - FIXED: Simplified nested query
    WITH location_usage AS (
        SELECT DISTINCT location_id
        FROM transactions
        WHERE location_id IS NOT NULL
        GROUP BY material_id, location_id
        HAVING SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) > 0
    )
    SELECT jsonb_build_object(
        'min_stock', COUNT(*) FILTER (WHERE min_stock IS NOT NULL AND stock <= min_stock),
        'max_stock', COUNT(*) FILTER (WHERE max_stock IS NOT NULL AND stock >= max_stock),
        'empty_locations', (
            SELECT COUNT(*)
            FROM locations l
            WHERE l.id NOT IN (SELECT location_id FROM location_usage)
        )
    ) INTO v_alerts
    FROM materials;

    -- 6. Top Movers
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', m.name,
            'count', sub.trx_count,
            'quantity', sub.total_qty,
            'unit', m.unit
        )
    ) INTO v_top_movers
    FROM (
        SELECT material_id, COUNT(*) as trx_count, SUM(quantity) as total_qty
        FROM transactions
        WHERE timestamp >= p_start_date AND timestamp <= p_end_date
        GROUP BY material_id
        ORDER BY trx_count DESC
        LIMIT 5
    ) sub
    JOIN materials m ON sub.material_id = m.id;

    -- 7. Top Stock
    SELECT jsonb_agg(
        jsonb_build_object('name', name, 'stock', stock, 'unit', unit)
    ) INTO v_top_stock
    FROM (
        SELECT name, stock, unit FROM materials ORDER BY stock DESC LIMIT 5
    ) sub;

    -- Build debug info
    v_debug_info = jsonb_build_object(
        'function_name', 'get_dashboard_analytics',
        'timestamp', NOW(),
        'date_range', jsonb_build_object('start', p_start_date, 'end', p_end_date),
        'records_found', COALESCE((v_kpi->>'transactionCount')::int, 0)
    );

    -- Final Result
    RETURN jsonb_build_object(
        'kpi', COALESCE(v_kpi, '{}'::jsonb),
        'trend', COALESCE(v_daily_trend, '[]'::jsonb),
        'dept_history', COALESCE(v_daily_dept_changes, '[]'::jsonb),
        'department', COALESCE(v_dept_distribution, '[]'::jsonb),
        'alerts', COALESCE(v_alerts, '{}'::jsonb),
        'top_movers', COALESCE(v_top_movers, '[]'::jsonb),
        'top_stock', COALESCE(v_top_stock, '[]'::jsonb),
        '_debug', v_debug_info
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO anon;

-- Verification
SELECT
    'get_dashboard_analytics' as function_name,
    'SUCCESSFULLY CREATED - All nested aggregates fixed' as status,
    NOW() as created_at;
