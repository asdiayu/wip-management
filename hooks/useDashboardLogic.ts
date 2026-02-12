
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location, Transaction } from '../types';

export type { Location };

export interface KpiData {
    transactionCount: number;
    volumeIn: number;
    volumeOut: number;
}

export interface TrendItemDetail {
    name: string;
    quantity: number;
}

export interface TrendDataPoint {
    date: string;
    fullDate: string;
    masuk: number;
    keluar: number;
    detailsMasuk: TrendItemDetail[];
    detailsKeluar: TrendItemDetail[];
}

export interface AlertCounts {
    min_stock: number;
    max_stock: number;
    empty_locations: number;
}

export interface ModalInfo {
    title: string;
    type: 'min' | 'max' | 'empty_locations';
    items: any[];
    loading?: boolean;
}

// ... Interfaces lainnya tetap sama ...
export interface TopMover {
    name: string;
    count: number;
    quantity: number;
    unit: string;
}

export interface TopStockItem {
    name: string;
    stock: number;
    unit: string;
}

export interface DepartmentData {
    name: string;
    value: number;
}

const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
};

const WIDGETS = [
    { id: 'kpi_summary', label: 'Ringkasan Transaksi (Cards)' },
    { id: 'alerts', label: 'Peringatan Stok (Min/Max/Kosong)' },
    { id: 'chart_trends', label: 'Grafik Tren Arus Barang (Bar)' },
    { id: 'chart_dept_trend', label: 'Grafik Tren Stok Total (Line)' }, // Simplified to Total only for performance
    { id: 'chart_department', label: 'Distribusi Stok per Departemen (Pie)' },
    { id: 'top_movers', label: 'Top 5 Barang Paling Aktif' },
    { id: 'top_stock', label: 'Top 5 Stok Terbanyak' },
    { id: 'recent_activity', label: 'Aktivitas Terkini' },
];

export const useDashboardLogic = () => {
    // Filter State
    const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'year'>('week');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Data States
    const [kpiData, setKpiData] = useState<KpiData | null>(null);
    const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
    const [deptTrendData, setDeptTrendData] = useState<any[]>([]);
    const [deptKeys, setDeptKeys] = useState<string[]>(['Total']); // FIXED: Added missing state
    const [alertCounts, setAlertCounts] = useState<AlertCounts>({ min_stock: 0, max_stock: 0, empty_locations: 0 });
    const [topMovers, setTopMovers] = useState<TopMover[]>([]);
    const [topStock, setTopStock] = useState<TopStockItem[]>([]);
    const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]); // Masih fetch terpisah agar ringan
    
    const [loading, setLoading] = useState(true);
    const [modalData, setModalData] = useState<ModalInfo | null>(null);
    
    // Customization State
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [visibleWidgets, setVisibleWidgets] = useState<string[]>(() => {
        const saved = localStorage.getItem('dashboard_widgets');
        return saved ? JSON.parse(saved) : WIDGETS.map(w => w.id);
    });

    const fetchData = useCallback(async () => {
        // 1. Calculate Date Range
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (filterType === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
            start.setDate(diff); 
            const endOfWeek = new Date(start);
            endOfWeek.setDate(start.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            end = endOfWeek;
        } else if (filterType === 'month') {
            const [y, m] = selectedMonth.split('-');
            start = new Date(parseInt(y), parseInt(m) - 1, 1);
            end = new Date(parseInt(y), parseInt(m), 0);
            end.setHours(23, 59, 59, 999);
        } else if (filterType === 'year') {
            start = new Date(selectedYear, 0, 1);
            end = new Date(selectedYear, 11, 31);
            end.setHours(23, 59, 59, 999);
        }

        try {
            console.log('[Dashboard] Fetching analytics from:', start.toISOString(), 'to', end.toISOString());

            // SINGLE RPC CALL - The Game Changer
            // IMPORTANT: Make sure you've run the SQL migration in Supabase SQL Editor!
            const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const { data: analytics, error } = await supabase.rpc('get_dashboard_analytics', {
                p_start_date: start.toISOString(),
                p_end_date: end.toISOString(),
                p_tz: userTz
            });

            if (error) {
                console.error('[Dashboard] ========== RPC ERROR ==========');
                console.error('[Dashboard] Error Message:', error.message);
                console.error('[Dashboard] Error Code:', error.code);
                console.error('[Dashboard] Error Details:', error.details);
                console.error('[Dashboard] Error Hint:', error.hint);
                console.error('[Dashboard] =================================');

                // Provide helpful error messages
                if (error.code === '42883') {
                    console.error('[Dashboard] ❌ FUNCTION DOES NOT EXIST!');
                    console.error('[Dashboard] Please run the SQL migration in Supabase SQL Editor:');
                    console.error('[Dashboard] File: supabase/migrations/20240128_dashboard_analytics_FINAL.sql');
                } else if (error.message.includes('permission')) {
                    console.error('[Dashboard] ❌ PERMISSION ERROR!');
                    console.error('[Dashboard] Check RLS policies in Supabase');
                } else {
                    console.error('[Dashboard] ❌ UNKNOWN ERROR!');
                    console.error('[Dashboard] Check Supabase logs for more details');
                }

                // Set empty data to prevent UI crash
                setKpiData({ transactionCount: 0, volumeIn: 0, volumeOut: 0 });
                setAlertCounts({ min_stock: 0, max_stock: 0, empty_locations: 0 });
                setTopMovers([]);
                setTopStock([]);
                setDepartmentData([]);
                setTrendData([]);
                setDeptTrendData([]);
                setRecentTransactions([]);
                return;
            }

            console.log('[Dashboard] ✅ Analytics received successfully!');
            console.log('[Dashboard] Data:', analytics);

            // Separate lightweight call for recent transactions list (UI only needs 5 rows)
            const { data: recentTrx, error: recentTrxError } = await supabase
                .from('transactions')
                .select('timestamp, type, quantity, materials(name)')
                .order('timestamp', { ascending: false })
                .limit(5);

            if (recentTrxError) {
                console.error('[Dashboard] Recent transactions error:', recentTrxError);
            }

            console.log('[Dashboard] Recent transactions:', recentTrx);

            if (analytics) {
                // 1. Set Direct Data
                console.log('[Dashboard] Setting KPI data:', analytics.kpi);
                console.log('[Dashboard] Setting alerts:', analytics.alerts);
                console.log('[Dashboard] Setting top movers:', analytics.top_movers);
                console.log('[Dashboard] Setting top stock:', analytics.top_stock);
                console.log('[Dashboard] Setting department data:', analytics.department);

                setKpiData(analytics.kpi);
                setAlertCounts(analytics.alerts);
                setTopMovers(analytics.top_movers);
                setTopStock(analytics.top_stock);
                setDepartmentData(analytics.department);
                setRecentTransactions(recentTrx || []);

                // 2. Process Trend Data (Bar Chart)
                // Analytics.trend is raw aggregation: [{date: '...', type: 'IN', total: 10, details: []}, ...]
                // Need to pivot to: [{date: '...', masuk: 10, keluar: 5, detailsMasuk: [], detailsKeluar: []}]
                
                const trendMap: Record<string, TrendDataPoint> = {};
                
                // Initialize map with empty dates in range (optional, for gaps) or just use returned data
                (analytics.trend || []).forEach((row: any) => {
                    const dateKey = row.date; // YYYY-MM-DD from SQL
                    if (!trendMap[dateKey]) {
                        const d = parseLocalDate(dateKey);
                        trendMap[dateKey] = {
                            date: filterType === 'year' ? d.toLocaleDateString('id-ID', { month: 'short' }) : d.getDate().toString(),
                            fullDate: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                            masuk: 0,
                            keluar: 0,
                            detailsMasuk: [],
                            detailsKeluar: []
                        };
                    }
                    if (row.type === 'IN') {
                        trendMap[dateKey].masuk = row.total;
                        trendMap[dateKey].detailsMasuk = row.details;
                    } else {
                        trendMap[dateKey].keluar = row.total;
                        trendMap[dateKey].detailsKeluar = row.details;
                    }
                });

                const finalTrendData = Object.entries(trendMap)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([, v]) => v);
                setTrendData(finalTrendData);

                // 3. Process Line Chart (Total Stock & Dept History)
                // Initialize Running Stock from Current Snapshot
                const runningDeptStock: Record<string, number> = {};
                let runningTotal = 0;

                (analytics.department || []).forEach((d: any) => {
                    runningDeptStock[d.name] = d.value;
                    runningTotal += d.value;
                });

                // Create lookup for Dept Changes: Map<Date, Map<Dept, NetChange>>
                const dailyDeptChangeMap: Record<string, Record<string, number>> = {};
                
                (analytics.dept_history || []).forEach((row: any) => {
                    const dKey = row.date;
                    if (!dailyDeptChangeMap[dKey]) dailyDeptChangeMap[dKey] = {};
                    
                    const change = row.type === 'IN' ? row.qty : -row.qty;
                    const deptName = row.dept;
                    dailyDeptChangeMap[dKey][deptName] = (dailyDeptChangeMap[dKey][deptName] || 0) + change;
                });

                // Also keep track of Global Daily Change (for Total Line redundancy check)
                const dailyGlobalChangeMap: Record<string, number> = {}; 
                (analytics.trend || []).forEach((row: any) => {
                    const change = row.type === 'IN' ? row.total : -row.total;
                    dailyGlobalChangeMap[row.date] = (dailyGlobalChangeMap[row.date] || 0) + change;
                });

                const historyLineData: any[] = [];
                
                // Loop BACKWARDS from today/end_date to start_date
                const loopCurrent = new Date(); 
                loopCurrent.setHours(0,0,0,0);
                const effectiveLoopStart = loopCurrent > end ? end : loopCurrent;
                
                const loopEnd = new Date(start);
                loopEnd.setHours(0,0,0,0);

                let safety = 0;
                let iterDate = new Date(effectiveLoopStart);

                while (iterDate >= loopEnd && safety < 400) {
                    const dateKey = iterDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
                    
                    // Snapshot for this day (End of Day Stock)
                    const d = new Date(iterDate);
                    historyLineData.push({
                        date: filterType === 'year' ? d.toLocaleDateString('id-ID', { month: 'short' }) : d.getDate().toString(),
                        fullDate: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                        Total: runningTotal,
                        ...runningDeptStock // Spread distinct department values
                    });

                    // Reverse calculation for previous day
                    // 1. Total
                    const changeTodayTotal = dailyGlobalChangeMap[dateKey] || 0;
                    runningTotal -= changeTodayTotal;

                    // 2. Per Dept
                    const daysChanges = dailyDeptChangeMap[dateKey] || {};
                    Object.entries(daysChanges).forEach(([dept, change]) => {
                        runningDeptStock[dept] = (runningDeptStock[dept] || 0) - change;
                    });

                    iterDate.setDate(iterDate.getDate() - 1);
                    safety++;
                }

                setDeptTrendData(historyLineData.reverse());
                setDeptKeys(Object.keys(runningDeptStock).filter(k => k !== 'Total')); // Register keys for chart lines
            }

        } catch (error) {
            console.error('[Dashboard] Fetch Error:', error);
            console.error('[Dashboard] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

            // Set empty data to prevent UI from hanging
            setKpiData({ transactionCount: 0, volumeIn: 0, volumeOut: 0 });
            setAlertCounts({ min_stock: 0, max_stock: 0, empty_locations: 0 });
            setTopMovers([]);
            setTopStock([]);
            setDepartmentData([]);
            setTrendData([]);
            setDeptTrendData([]);
            setRecentTransactions([]);
        }
    }, [filterType, selectedMonth, selectedYear]);

    useEffect(() => {
        console.log('[Dashboard] useEffect triggered, fetching data...');
        setLoading(true);
        fetchData()
            .finally(() => {
                console.log('[Dashboard] Data fetch completed');
                setLoading(false);
            });

        const channel = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
                console.log('[Dashboard] Realtime: transactions changed');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
                console.log('[Dashboard] Realtime: materials changed');
                fetchData();
            })
            .subscribe();

        return () => {
            console.log('[Dashboard] Cleanup: removing channel');
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    // Lazy Load Alert Details
    const handleOpenModal = async (type: 'min' | 'max' | 'empty_locations') => {
        let title = '';
        if (type === 'min') title = 'Barang di Bawah Stok Minimum';
        if (type === 'max') title = 'Barang Melebihi Stok Maksimum';
        if (type === 'empty_locations') title = 'Lokasi Kosong';

        setModalData({ title, type, items: [], loading: true });

        try {
            let data: any[] = [];
            if (type === 'min') {
                // Fixed: Cannot compare columns in Supabase filters, fetch all and filter in JS
                const { data: raw } = await supabase.from('materials').select('*');
                data = raw?.filter(m => m.min_stock !== null && m.stock <= m.min_stock) || [];
            } else if (type === 'max') {
                const { data: raw } = await supabase.from('materials').select('*');
                data = raw?.filter(m => m.max_stock !== null && m.stock >= m.max_stock) || [];
            } else if (type === 'empty_locations') {
                const { data: locs } = await supabase.from('locations').select('*');
                const { data: used } = await supabase.rpc('get_locations_with_stock');
                const usedSet = new Set(used?.map((u: any) => u.location_id));
                data = locs?.filter(l => !usedSet.has(l.id)) || [];
            }
            
            setModalData(prev => prev ? { ...prev, items: data, loading: false } : null);
        } catch (e) {
            console.error(e);
            setModalData(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const toggleWidget = (widgetId: string) => {
        const newWidgets = visibleWidgets.includes(widgetId) ? visibleWidgets.filter(id => id !== widgetId) : [...visibleWidgets, widgetId];
        setVisibleWidgets(newWidgets);
        localStorage.setItem('dashboard_widgets', JSON.stringify(newWidgets));
    };

    return {
        // State
        filterType, setFilterType,
        selectedMonth, setSelectedMonth,
        selectedYear, setSelectedYear,
        loading,
        kpiData,
        trendData,
        deptTrendData,
        deptKeys, // FIXED: Use actual state instead of hardcoded value
        departmentData,
        topMovers,
        topStock,
        recentTransactions,
        alertCounts, // Replaced explicit lists with counts
        modalData, setModalData,
        isCustomizeModalOpen, setIsCustomizeModalOpen,
        visibleWidgets,
        
        // Actions
        handleOpenModal,
        toggleWidget,
        isWidgetVisible: (id: string) => visibleWidgets.includes(id),
        getTimeLabel: () => {
            if (filterType === 'today') return 'Hari Ini';
            if (filterType === 'week') return 'Minggu Ini';
            if (filterType === 'month') return selectedMonth ? new Date(selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Bulan Ini';
            return `Tahun ${selectedYear}`;
        },
        years: Array.from({length: 5}, (_, i) => new Date().getFullYear() - i),
        widgetsList: WIDGETS
    };
};
