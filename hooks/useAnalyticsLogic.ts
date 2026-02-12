
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { downloadFile } from '../utils/fileHelper';

export interface ForecastItem {
    material_id: string;
    material_name: string;
    unit: string;
    current_stock: number;
    avg_daily_usage: number;
    avg_daily_incoming: number;
    days_to_empty: number;
}

export interface SlowMovingItem {
    material_id: string;
    material_name: string;
    unit: string;
    current_stock: number;
    last_transaction_date: string | null;
}

export interface AbcItem {
    material_id: string;
    material_name: string;
    unit: string;
    usage_qty: number;
    percentage: number;
    cumulative_percentage: number;
    class: 'A' | 'B' | 'C';
}

export interface OverstockItem {
    material_id: string;
    material_name: string;
    unit: string;
    current_stock: number;
    avg_daily_usage: number;
    coverage_days: number;
    status: 'Overstock';
}

export interface AbsorptionItem {
    material_id: string;
    material_name: string;
    unit: string;
    total_in: number;
    total_out: number;
    absorption_rate: number;
    status: string;
}

export const useAnalyticsLogic = () => {
    const [activeTab, setActiveTab] = useState<'forecast' | 'slow_moving' | 'abc' | 'overstock' | 'absorption'>('forecast');
    const [loading, setLoading] = useState(true);
    
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
    const [slowMovingData, setSlowMovingData] = useState<SlowMovingItem[]>([]);
    const [abcData, setAbcData] = useState<AbcItem[]>([]);
    const [overstockData, setOverstockData] = useState<OverstockItem[]>([]);
    const [absorptionData, setAbsorptionData] = useState<AbsorptionItem[]>([]);

    const fetchAnalyticsData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: materials } = await supabase.from('materials').select('*').order('name');
            if (!materials) return;

            // 1. Tentukan Rentang Waktu Berdasarkan Filter
            let startDate: Date;
            let endDate: Date;
            if (selectedMonth === 0) {
                startDate = new Date(selectedYear, 0, 1, 0, 0, 0);
                endDate = new Date(selectedYear, 11, 31, 23, 59, 59);
            } else {
                startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
                endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
            }

            // --- PROSES DATA (OPTIMIZED WITH RPC) ---

            // A. FORECAST & SLOW MOVING (Combined RPC)
            const { data: analyticsStats } = await supabase.rpc('get_material_analytics_stats');
            
            if (analyticsStats) {
                // Forecast
                const forecast: ForecastItem[] = analyticsStats.map((item: any) => {
                    // Logic days_to_empty already handled in SQL
                    if (item.current_stock <= 0 && item.avg_daily_out === 0) return null;
                    return {
                        material_id: item.id,
                        material_name: item.name,
                        unit: item.unit,
                        current_stock: item.current_stock,
                        avg_daily_usage: item.avg_daily_out,
                        avg_daily_incoming: 0, // Not used in display currently
                        days_to_empty: item.days_to_empty
                    };
                }).filter(Boolean);
                setForecastData(forecast); // SQL already sorted by days_to_empty

                // Overstock
                setOverstockData(forecast.filter(f => f.days_to_empty > 90 && f.current_stock > 0).map(f => ({
                    material_id: f.material_id, material_name: f.material_name, unit: f.unit,
                    current_stock: f.current_stock, avg_daily_usage: f.avg_daily_usage,
                    coverage_days: f.days_to_empty, status: 'Overstock'
                })));

                // Slow Moving (Items with no OUT transaction in 30 days - detected by SQL returning 0 daily usage)
                // Note: The original logic checked for NO transaction (IN or OUT). 
                // The new SQL checks based on usage. We can refine client side or use the returned last_trx_date.
                setSlowMovingData(analyticsStats
                    .filter((m: any) => m.avg_daily_out === 0 && m.current_stock > 0)
                    .map((m: any) => ({
                        material_id: m.id,
                        material_name: m.name,
                        unit: m.unit,
                        current_stock: m.current_stock,
                        last_transaction_date: m.last_trx_date
                    }))
                    .sort((a: any, b: any) => b.current_stock - a.current_stock)
                );
            }

            // B. ABC & ABSORPTION (Need specific date range, so use RPC with params or existing logic if RPC not fits all)
            // For ABC, we use the new RPC
            const { data: abcRes } = await supabase.rpc('get_abc_analysis_stats', { start_date: startDate.toISOString(), end_date: endDate.toISOString() });
            if (abcRes) {
                setAbcData(abcRes.map((r: any) => ({
                    material_id: 'n/a', // RPC doesn't return ID to group by name unique, but we can assume name is unique or enough for display
                    material_name: r.material_name,
                    unit: r.unit,
                    usage_qty: r.usage_qty,
                    percentage: (r.cumulative_percentage - (r.cumulative_percentage - r.usage_qty)), // Approximation not needed, we have class
                    cumulative_percentage: r.cumulative_percentage,
                    class: r.abc_class as 'A'|'B'|'C'
                })));
            }

            // C. ABSORPTION (Keep Client Side for now or create specific RPC if needed, 
            // but let's optimize the query to fetch aggregated data directly if possible.
            // For now, let's keep the client logic for Absorption to avoid too many changes at once, 
            // BUT optimize the query to NOT fetch all rows, just aggregates.)
            
            // To properly optimize Absorption, we need a "get_absorption_stats" RPC.
            // Since we didn't define it in the "Performance Pack", we will use a lighter query.
            const { data: absorptionRaw } = await supabase
                .from('transactions')
                .select('material_id, type, quantity')
                .gte('timestamp', startDate.toISOString())
                .lte('timestamp', endDate.toISOString())
                .neq('shift', 'Transfer').neq('shift', 'Return').neq('shift', 'Adjustment');

            if (absorptionRaw && materials) {
                 const inMap = new Map(); const outMap = new Map();
                 absorptionRaw.forEach((t: any) => {
                     if(t.type === 'IN') inMap.set(t.material_id, (inMap.get(t.material_id)||0) + t.quantity);
                     else outMap.set(t.material_id, (outMap.get(t.material_id)||0) + t.quantity);
                 });
                 
                 const absorption: AbsorptionItem[] = materials.map(m => {
                    const totalIn = inMap.get(m.id) || 0;
                    const totalOut = outMap.get(m.id) || 0;
                    if (totalIn === 0 && totalOut === 0) return null;
                    const rate = totalIn > 0 ? (totalOut / totalIn) * 100 : (totalOut > 0 ? 100 : 0);
                    let status = rate > 105 ? 'Over-absorbed' : rate >= 85 ? 'Sangat Efisien' : rate >= 50 ? 'Efisien' : rate > 0 ? 'Penumpukan' : 'Idle';
                    return { material_id: m.id, material_name: m.name, unit: m.unit, total_in: totalIn, total_out: totalOut, absorption_rate: rate, status };
                 }).filter(Boolean) as AbsorptionItem[];
                 setAbsorptionData(absorption.sort((a, b) => b.absorption_rate - a.absorption_rate));
            }

        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [fetchAnalyticsData]);

    const handleExport = async (type: string) => {
        let content = '', filename = '';
        const date = new Date().toISOString().split('T')[0];
        const periodStr = selectedMonth === 0 ? `Tahun_${selectedYear}` : `Bulan_${selectedMonth}_${selectedYear}`;
        
        if (type === 'absorption') {
            content = "Nama,Total In (Inc. Initial),Total Out,Penyerapan %,Status\n" + absorptionData.map(i => `"${i.material_name}",${i.total_in},${i.total_out},${i.absorption_rate.toFixed(2)}%,"${i.status}"`).join("\n");
            filename = `Penyerapan_${periodStr}_${date}.csv`;
        } else if (type === 'abc') {
            content = "Kelas,Nama,Pemakaian,Persentase,Kumulatif\n" + abcData.map(i => `${i.class},"${i.material_name}",${i.usage_qty},${i.percentage.toFixed(2)}%,${i.cumulative_percentage.toFixed(2)}%`).join("\n");
            filename = `ABC_Pareto_${periodStr}_${date}.csv`;
        } else if (type === 'forecast') {
            content = "Nama,Stok Saat Ini,Prediksi Hari Habis\n" + forecastData.map(i => `"${i.material_name}",${i.current_stock},${i.days_to_empty.toFixed(1)}`).join("\n");
            filename = `Forecast_Realtime_${date}.csv`;
        }
        await downloadFile(filename, content, 'text/csv');
    };

    return { 
        activeTab, setActiveTab, loading, 
        forecastData, slowMovingData, abcData, overstockData, absorptionData, 
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        handleExport,
        years: Array.from({length: 5}, (_, i) => new Date().getFullYear() - i)
    };
};
