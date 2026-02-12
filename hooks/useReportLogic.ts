import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Transaction, Material, Location } from '../types';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { downloadFile } from '../utils/fileHelper';
import { ReceiptItem } from '../components/ui/ReceiptModal';
import { useAuth } from '../hooks/useAuth';

interface EnrichedTransaction extends Transaction {
    material_name: string;
    material_unit: string;
    material_department: string | null;
    location_name: string | null;
}

export const useReportLogic = () => {
    const { user } = useAuth();
    
    const getTodayDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    const parseLocalDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    };

    // States
    const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Aggregation States (PENTING: Untuk menampung total seluruh data terfilter)
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);

    // Fetch Filters (Master Data Cached)
    const { data: materials = [] } = useQuery({ queryKey: ['materials_minimal'], queryFn: async () => {
        const { data } = await supabase.from('materials').select('id, name').order('name');
        return data as Material[] || [];
    }});
    
    const { data: locations = [] } = useQuery({ queryKey: ['locations_minimal'], queryFn: async () => {
        const { data } = await supabase.from('locations').select('id, name').order('name');
        return data as Location[] || [];
    }});
    
    // Filters
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [selectedMaterial, setSelectedMaterial] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['IN', 'OUT', 'INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_IN', 'RETURN_OUT']);
    const [selectedShifts, setSelectedShifts] = useState<string[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 30;

    // Receipt
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptItem[]>([]);
    const [receiptShift, setReceiptShift] = useState<string>('');
    const [receiptDate, setReceiptDate] = useState<string>('');

    // --- LOGIKA FILTER SQL REUSABLE ---
    const applyFilters = (query: any) => {
        if (startDate) {
            const sd = parseLocalDate(startDate);
            sd.setHours(0, 0, 0, 0);
            query = query.gte('timestamp', sd.toISOString());
        }
        if (endDate) {
            const ed = parseLocalDate(endDate);
            ed.setHours(23, 59, 59, 999);
            query = query.lte('timestamp', ed.toISOString());
        }
        if (selectedMaterial) query = query.eq('material_id', selectedMaterial);
        if (selectedLocation) query = query.eq('location_id', selectedLocation);
        
        // Filter Shift (Server-side if not empty)
        if (selectedShifts.length > 0) {
            query = query.in('shift', selectedShifts);
        }

        return query;
    };

    const processTransactionData = (data: any[]): EnrichedTransaction[] => {
        return data.map((trx: any) => {
            let displayType = trx.type;
            if (trx.shift === 'Transfer') displayType = trx.type === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
            else if (trx.shift === 'Return') displayType = trx.type === 'IN' ? 'RETURN_IN' : 'RETURN_OUT';
            else if (trx.shift === 'Initial') displayType = 'INITIAL';

            return { 
                ...trx, 
                type: displayType, 
                material_name: trx.materials?.name ?? 'Unknown', 
                material_unit: trx.materials?.unit ?? '', 
                material_department: trx.materials?.department ?? null, 
                location_name: trx.locations?.name ?? null 
            };
        });
    };

    const computeTotalsFallback = async () => {
        try {
            let totalsQuery = supabase
                .from('transactions')
                .select('type, quantity, shift');

            totalsQuery = applyFilters(totalsQuery);
            const { data, error } = await totalsQuery.limit(50000);
            if (error || !data) {
                console.error("Fallback totals error:", error);
                setTotalIn(0);
                setTotalOut(0);
                return;
            }

            let inTotal = 0;
            let outTotal = 0;

            for (const t of data as any[]) {
                let displayType = t.type;
                if (t.shift === 'Transfer') displayType = t.type === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
                else if (t.shift === 'Return') displayType = t.type === 'IN' ? 'RETURN_IN' : 'RETURN_OUT';
                else if (t.shift === 'Initial') displayType = 'INITIAL';

                if (selectedTypes.length > 0 && !selectedTypes.includes(displayType)) continue;

                if (t.type === 'IN' || t.shift === 'Initial') inTotal += Number(t.quantity) || 0;
                else if (t.type === 'OUT' && t.shift !== 'Initial') outTotal += Number(t.quantity) || 0;
            }

            setTotalIn(inTotal);
            setTotalOut(outTotal);
        } catch (err) {
            console.error("Fallback totals exception:", err);
            setTotalIn(0);
            setTotalOut(0);
        }
    };

    // --- FETCH UTAMA ---
    const fetchTrx = useCallback(async () => {
        setLoading(true);
        
        try {
            // 1. QUERY UNTUK TABEL (PAGINATED)
            let tableQuery = supabase
                .from('transactions')
                .select(`
                    id, timestamp, type, quantity, notes, shift, pic, material_id, location_id,
                    materials:material_id (name, unit, department),
                    locations:location_id (name)
                `, { count: 'exact' });

            tableQuery = applyFilters(tableQuery);
            
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const { data: tableData, count, error: tableError } = await tableQuery
                .order('timestamp', { ascending: false })
                .range(from, from + ITEMS_PER_PAGE - 1);

            if (tableError) throw tableError;
            if (tableData) {
                setTransactions(processTransactionData(tableData));
                setTotalCount(count || 0);
            }

            // 2. QUERY UNTUK TOTAL AKUMULASI (OPTIMIZED RPC)
            // Fix Date Parsing Logic: Ensure we send full day range in UTC
            let startLimit = null;
            let endLimit = null;

            if (startDate) {
                // Paksa set jam 00:00:00 waktu lokal, lalu convert ke UTC
                const sd = parseLocalDate(startDate);
                sd.setHours(0, 0, 0, 0);
                startLimit = sd.toISOString();
            }

            if (endDate) {
                // Paksa set jam 23:59:59 waktu lokal, lalu convert ke UTC
                const ed = parseLocalDate(endDate);
                ed.setHours(23, 59, 59, 999);
                endLimit = ed.toISOString();
            }

            console.log("RPC Params:", { startLimit, endLimit, selectedMaterial, selectedLocation, selectedShifts });

            const { data: rpcSum, error: rpcErr } = await supabase.rpc('get_report_summary', {
                start_date: startLimit, // Sekarang pasti valid ISO String
                end_date: endLimit,
                material_id_param: selectedMaterial || null,
                location_id_param: selectedLocation || null,
                shift_param: selectedShifts.length > 0 ? selectedShifts : null
            });

            if (rpcErr) {
                console.error("RPC Error:", rpcErr);
                await computeTotalsFallback();
            } else if (rpcSum && rpcSum.length > 0) {
                setTotalIn(rpcSum[0].total_in);
                setTotalOut(rpcSum[0].total_out);
            } else {
                await computeTotalsFallback();
            }
        } catch (e) {
            console.error("Fetch Trx Error:", e);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedMaterial, selectedLocation, selectedShifts, selectedTypes, currentPage]);

    useEffect(() => {
        fetchTrx();
    }, [fetchTrx]);

    // Realtime Listener
    useEffect(() => {
        const channel = supabase.channel('report_optimized_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTrx)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchTrx]);

    // Derived data for display filter (Type filter is client-side for flexibility)
    const filteredTransactions = useMemo(() => {
        return transactions.filter(trx => {
            if (selectedTypes.length > 0 && !selectedTypes.includes(trx.type)) return false;
            return true;
        });
    }, [transactions, selectedTypes]);

    const handleExportExcel = async () => {
        setLoading(true);
        let query = supabase
            .from('transactions')
            .select(`timestamp, type, quantity, notes, shift, pic, materials:material_id(name, unit), locations:location_id(name)`);
        
        query = applyFilters(query);
        const { data } = await query.limit(10000); // Limit keamanan excel

        if (data) {
            const exportData = data.map((t: any) => ({
                "Tanggal": new Date(t.timestamp).toLocaleString('id-ID'),
                "Nama Barang": t.materials?.name,
                "Lokasi": t.locations?.name || '-',
                "Tipe": t.type,
                "Kuantitas": t.quantity,
                "Satuan": t.materials?.unit,
                "Shift": t.shift,
                "PIC": t.pic || '-'
            }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Laporan");
            await downloadFile(`Laporan_Lengkap_${startDate}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
        }
        setLoading(false);
    };

    const handleGenerateReceipt = async () => {
        setLoading(true); // Indikator Full Fetch
        
        try {
            // PENTING: Ambil seluruh data yang sesuai filter saat ini (mengabaikan pagination)
            let fullQuery = supabase
                .from('transactions')
                .select(`
                    timestamp, type, quantity, notes, shift, pic,
                    materials:material_id (name, unit),
                    locations:location_id (name)
                `);
            
            fullQuery = applyFilters(fullQuery);
            const { data: allFilteredData, error } = await fullQuery.order('timestamp', { ascending: true });

            if (error) throw error;

            if (!allFilteredData || allFilteredData.length === 0) {
                alert("Tidak ada data untuk dibuatkan bukti.");
                return;
            }

            // Map data ke format Receipt
            const items: ReceiptItem[] = allFilteredData
                .filter(t => {
                    // Filter tipe manual jika di database tidak ter-filter sempurna
                    let displayType = t.type;
                    if (t.shift === 'Transfer') displayType = t.type === 'IN' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
                    else if (t.shift === 'Return') displayType = t.type === 'IN' ? 'RETURN_IN' : 'RETURN_OUT';
                    else if (t.shift === 'Initial') displayType = 'INITIAL';
                    return selectedTypes.includes(displayType);
                })
                .map((t: any) => {
                    // FIX: (Line 242-245) Handle Supabase potentially returning joined records as arrays.
                    // This often happens in standard Supabase clients when the relationship isn't explicitly defined as 1-to-1 in the metadata.
                    const mat = Array.isArray(t.materials) ? t.materials[0] : t.materials;
                    const loc = Array.isArray(t.locations) ? t.locations[0] : t.locations;

                    return {
                        name: mat?.name || 'Unknown',
                        quantity: t.quantity,
                        unit: mat?.unit || '',
                        location: loc?.name || '-',
                        type: (t.type === 'IN' || t.shift === 'Initial') ? 'IN' : 'OUT',
                        date: new Date(t.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric' })
                    };
                });

            if (items.length === 0) {
                alert("Data terpilih kosong setelah difilter tipe.");
                return;
            }

            setReceiptData(items);
            
            const shifts = Array.from(new Set(allFilteredData.map(t => t.shift)));
            setReceiptShift(shifts.length === 1 ? shifts[0] : 'Gabungan');
            
            const dates = allFilteredData.map(t => new Date(t.timestamp).getTime());
            const d1 = new Date(Math.min(...dates)).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit'});
            const d2 = new Date(Math.max(...dates)).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit'});
            setReceiptDate(d1 === d2 ? d1 : `${d1} - ${d2}`);
            
            setShowReceipt(true);
        } catch (err) {
            console.error("Receipt generation error:", err);
            alert("Gagal merangkum data laporan.");
        } finally {
            setLoading(false);
        }
    };

    return {
        materials, locations, loading, user,
        startDate, setStartDate, endDate, setEndDate,
        selectedMaterial, setSelectedMaterial, selectedLocation, setSelectedLocation,
        selectedTypes, setSelectedTypes, selectedShifts, setSelectedShifts,
        currentPage, setCurrentPage, ITEMS_PER_PAGE, totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
        filteredTransactions, paginatedTransactions: filteredTransactions,
        totalIn, totalOut, totalNet: totalIn - totalOut,
        showReceipt, setShowReceipt, receiptData, receiptShift, receiptDate,
        handleExportExcel, handleGenerateReceipt
    };
};
