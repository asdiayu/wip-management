-- ============================================
-- CHECK DATABASE DATA - DEBUGGING
-- ============================================
-- Run this in Supabase SQL Editor to check your data

-- 1. Check total transactions
SELECT 'TOTAL TRANSACTIONS' as info, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'TOTAL MATERIALS', COUNT(*) FROM materials
UNION ALL
SELECT 'TOTAL LOCATIONS', COUNT(*) FROM locations;

-- 2. Check transaction date range
SELECT
    'TRANSACTION DATE RANGE' as info,
    MIN(timestamp) as oldest_transaction,
    MAX(timestamp) as newest_transaction,
    COUNT(*) as total_transactions
FROM transactions;

-- 3. Check shift distribution
SELECT
    'SHIFT DISTRIBUTION' as info,
    shift,
    COUNT(*) as count
FROM transactions
GROUP BY shift
ORDER BY count DESC;

-- 4. Check if transactions will be filtered out
SELECT
    'FILTERED TRANSACTIONS' as info,
    COUNT(*) FILTER (WHERE shift IN ('Initial', 'Transfer', 'Return', 'Adjustment')) as will_be_filtered_out,
    COUNT(*) FILTER (WHERE shift IS NULL OR shift NOT IN ('Initial', 'Transfer', 'Return', 'Adjustment')) as will_be_included
FROM transactions;

-- 5. Sample transactions
SELECT
    'SAMPLE TRANSACTIONS (last 5)' as info,
    id,
    timestamp,
    type,
    quantity,
    shift,
    created_at
FROM transactions
ORDER BY timestamp DESC
LIMIT 5;

-- 6. Materials with stock
SELECT
    'MATERIALS WITH STOCK' as info,
    name,
    stock,
    unit,
    min_stock,
    max_stock,
    department
FROM materials
ORDER BY stock DESC
LIMIT 10;

-- 7. Test the analytics function with full date range
-- This will use ALL your data
SELECT get_dashboard_analytics(
    (SELECT MIN(timestamp) FROM transactions),
    (SELECT MAX(timestamp) FROM transactions)
);
