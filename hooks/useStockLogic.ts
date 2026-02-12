
import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { downloadFile } from '../utils/fileHelper';

interface StockDetail {
    location_id: string;
    location_name: string;
    stock_quantity: number;
}

export const useStockLogic = () => {
    const queryClient = useQueryClient();
    
    // 1. Optimized Master Data Fetching (Using Cache)
    const { data: materials = [], isLoading: materialsLoading, refetch: refetchMaterials } = useQuery({
        queryKey: ['materials'],
        queryFn: async () => {
            const { data } = await supabase
                .from('materials')
                .select('id, name, stock, unit, department, machine_number')
                .order('name');
            return data as Material[] || [];
        }
    });

    const { data: locations = [], isLoading: locationsLoading } = useQuery({
        queryKey: ['locations'],
        queryFn: async () => {
            const { data } = await supabase
                .from('locations')
                .select('id, name')
                .order('name');
            return data as Location[] || [];
        }
    });

    // Filtering States
    const [isPending, startTransition] = useTransition();
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [locationStockMap, setLocationStockMap] = useState<Map<string, number>>(new Map());

    // UI States
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [detailLoading, setDetailLoading] = useState<string | null>(null);
    const [stockDetails, setStockDetails] = useState<Record<string, StockDetail[]>>({});
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        department: false,
        machine: false
    });

    const ITEMS_PER_PAGE = 50;

    const fetchLocationStock = useCallback(async () => {
        if (!selectedLocation) {
            setLocationStockMap(new Map());
            return;
        }
        
        // SERVER-SIDE AGGREGATION RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_location_stock_summary', { 
            target_location_id: selectedLocation 
        });

        const map = new Map<string, number>();
        if (!rpcError && rpcData) {
            rpcData.forEach((row: any) => map.set(row.material_id, row.stock_qty));
        }
        setLocationStockMap(map);
    }, [selectedLocation]);

    useEffect(() => {
        fetchLocationStock();
    }, [fetchLocationStock]);

    // Realtime Listener
    useEffect(() => {
        const channel = supabase.channel('stock_optimized_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => {
                refetchMaterials();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
                fetchLocationStock();
                refetchMaterials();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [refetchMaterials, fetchLocationStock]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        startTransition(() => setSearchQuery(val));
        setCurrentPage(1);
    };

    const handleRowClick = useCallback(async (materialId: string) => {
        setExpandedRow(prev => prev === materialId ? null : materialId);
        if (!stockDetails[materialId]) {
            setDetailLoading(materialId);
            const { data } = await supabase.rpc('get_stock_by_location', { material_id_param: materialId });
            if (data) setStockDetails(prev => ({ ...prev, [materialId]: data as StockDetail[] }));
            setDetailLoading(null);
        }
    }, [stockDetails]);

    const getDisplayedStock = useCallback((material: Material) => {
        return selectedLocation ? (locationStockMap.get(material.id) || 0) : (material.stock || 0);
    }, [selectedLocation, locationStockMap]);

    const uniqueDepartments = useMemo(() => {
        const depts = new Set(materials.map(m => m.department).filter(d => !!d));
        return Array.from(depts).sort();
    }, [materials]);

    const filteredMaterials = useMemo(() => {
        return materials.filter(material => {
            const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDepartment = selectedDepartment === '' || material.department === selectedDepartment;
            let matchesLocation = true;
            if (selectedLocation) {
                const stockInLoc = locationStockMap.get(material.id) || 0;
                matchesLocation = stockInLoc !== 0; 
            }
            return matchesSearch && matchesDepartment && matchesLocation;
        });
    }, [materials, searchQuery, selectedDepartment, selectedLocation, locationStockMap]);

    const paginatedMaterials = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredMaterials.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredMaterials, currentPage]);

    const totalFilteredStock = useMemo(() => {
        return filteredMaterials.reduce((sum, m) => sum + getDisplayedStock(m), 0);
    }, [filteredMaterials, getDisplayedStock]);

    // Dinamis menentukan satuan yang ditampilkan di header total
    const displayUnit = useMemo(() => {
        if (filteredMaterials.length === 0) return '';
        // Cek apakah semua item yang difilter punya satuan yang sama
        const units = new Set(filteredMaterials.map(m => m.unit.trim().toLowerCase()));
        if (units.size === 1) {
            // Jika cuma ada 1 jenis satuan, ambil satuan asli dari item pertama
            return filteredMaterials[0].unit;
        }
        // Jika campur, beri label umum
        return 'Item';
    }, [filteredMaterials]);

    const handleExportCsv = async () => {
        const headers = ["Nama Barang", "Departemen", "No Mesin", "Stok Total", "Satuan"];
        const rows = filteredMaterials.map(item => [
            `"${item.name}"`, `"${item.department || ''}"`, `"${item.machine_number || ''}"`,
            getDisplayedStock(item).toFixed(2), `"${item.unit}"`
        ].join(','));
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        await downloadFile(`Laporan_Stok_${new Date().toISOString().split('T')[0]}.csv`, csvContent, 'text/csv');
    };

    const handleExportExcel = async () => {
        const data = filteredMaterials.map(item => ({
            "Nama Barang": item.name, "Departemen": item.department || '', "No Mesin": item.machine_number || '',
            "Stok Total": parseFloat(getDisplayedStock(item).toFixed(2)), "Satuan": item.unit
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        worksheet['!cols'] = [{wch: 30}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 10}];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stok Barang");
        const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        await downloadFile(`Laporan_Stok_${new Date().toISOString().split('T')[0]}.xlsx`, excelBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
    };

    const handleCopyForWhatsApp = async () => {
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        let text = `*Rangkuman Stock*\nTgl : ${today}\n\n`;
        const grouped: Record<string, typeof filteredMaterials> = {};
        filteredMaterials.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            const dept = item.department ? item.department.trim().toUpperCase() : 'LAIN-LAIN';
            if (!grouped[dept]) grouped[dept] = [];
            grouped[dept].push(item);
        });
        Object.keys(grouped).sort().forEach(dept => {
            text += `*${dept}*\n`;
            grouped[dept].forEach(item => {
                text += `- ${item.name} : ${getDisplayedStock(item).toLocaleString('id-ID')} ${item.unit}\n`;
            });
            text += `\n`;
        });
        try { await navigator.clipboard.writeText(text); alert("Berhasil disalin ke Clipboard!"); } catch { alert("Gagal menyalin."); }
    };

    return {
        materials, locations, loading: materialsLoading || locationsLoading, isPending,
        inputValue, searchQuery, handleSearchChange,
        selectedDepartment, setSelectedDepartment,
        selectedLocation, setSelectedLocation,
        currentPage, setCurrentPage, ITEMS_PER_PAGE,
        expandedRow, detailLoading, stockDetails, handleRowClick,
        showColumnMenu, setShowColumnMenu, visibleColumns, setVisibleColumns,
        toggleColumn: (col: keyof typeof visibleColumns) => setVisibleColumns(prev => ({...prev, [col]: !prev[col]})),
        uniqueDepartments, filteredMaterials, paginatedMaterials, totalPages: Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE),
        getDisplayedStock, totalFilteredStock, displayUnit,
        handleExportCsv, handleExportExcel, handleCopyForWhatsApp
    };
};
