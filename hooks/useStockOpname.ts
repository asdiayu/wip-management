
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location, TransactionType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import { getCurrentShiftAndDate } from '../utils/dateHelper';
import * as XLSX from 'xlsx';
import { downloadFile } from '../utils/fileHelper';

export interface InventoryItem {
    material_id: string;
    material_name: string;
    unit: string;
    system_stock: number;
    physical_stock: number | '';
    breakdown: { id: number, label: string, qty: number }[];
    has_breakdown: boolean;
    is_modified: boolean;
}

export interface DraftItem {
    material_id: string;
    qty: number;
    breakdown: { id: number, label: string, qty: number }[];
}

export const useStockOpname = () => {
    const { user } = useAuth();
    const isAdmin = user?.user_metadata?.role === 'admin';
    const defaults = getCurrentShiftAndDate();

    // Core State
    const [locations, setLocations] = useState<Location[]>([]);
    const [allMaterials, setAllMaterials] = useState<Material[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [date, setDate] = useState(defaults.date);
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Features State
    const [draftedLocations, setDraftedLocations] = useState<string[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
    const [tempBreakdown, setTempBreakdown] = useState<{ id: number, label: string, qty: number | string }[]>([]);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [manualMaterialId, setManualMaterialId] = useState('');
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; action: () => void; isWarning?: boolean } | null>(null);

    // --- Debounce ---
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // --- Init Fetch ---
    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: lData } = await supabase.from('locations').select('*').order('name');
            if (lData) setLocations(lData as Location[]);
            const { data: mData } = await supabase.from('materials').select('*').order('name');
            if (mData) setAllMaterials(mData as Material[]);
        };
        fetchInitialData();
    }, []);

    const materialOptions = useMemo(() => allMaterials.map(m => ({ value: m.id, label: m.name })), [allMaterials]);

    // --- Draft Status Listener ---
    useEffect(() => {
        const fetchDraftStatus = async () => {
            if (!date) return;
            const { data } = await supabase.from('audit_logs').select('details').eq('action', 'OPNAME_DRAFT').gte('timestamp', `${date}T00:00:00`).lte('timestamp', `${date}T23:59:59`);
            if (data) {
                const ids = (data as any[]).map(log => {
                    try { return (typeof log.details === 'string' ? JSON.parse(log.details) : log.details)?.location_id; } catch (e) { return null; }
                }).filter(Boolean);
                setDraftedLocations(Array.from(new Set(ids)));
            }
        };
        fetchDraftStatus();
        const interval = setInterval(fetchDraftStatus, 5000);
        return () => clearInterval(interval);
    }, [date]);

    // --- Load Stock Logic (OPTIMIZED WITH RPC) ---
    const loadLocationStock = async () => {
        if (!selectedLocation) return;
        setLoading(true); 
        setMessage(null);
        
        try {
            // 1. Ambil Summary Stok Sistem via RPC (Server-side Aggregation)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_location_stock_summary', { 
                target_location_id: selectedLocation 
            });

            if (rpcError) throw rpcError;

            const stockMap = new Map<string, number>();
            rpcData?.forEach((row: any) => {
                stockMap.set(row.material_id, parseFloat(row.stock_qty));
            });

            // 2. Ambil Draft Terakhir dari Audit Logs
            let draftMap = new Map<string, DraftItem>();
            const { data: draftLogs } = await supabase
                .from('audit_logs')
                .select('details')
                .eq('action', 'OPNAME_DRAFT')
                .ilike('details', `%"location_id":"${selectedLocation}"%`)
                .gte('timestamp', `${date}T00:00:00`)
                .lte('timestamp', `${date}T23:59:59`)
                .order('timestamp', { ascending: false })
                .limit(1);

            if (draftLogs?.[0]) {
                try {
                    const parsed = typeof draftLogs[0].details === 'string' ? JSON.parse(draftLogs[0].details) : draftLogs[0].details;
                    parsed.items?.forEach((item: DraftItem) => draftMap.set(item.material_id, item));
                } catch (e) {}
            }

            // 3. Gabungkan Data Sistem dan Data Draft
            const newList: InventoryItem[] = [];
            
            // Proses barang yang ada di sistem
            stockMap.forEach((sysQty, matId) => {
                // Tampilkan barang jika ada stok di sistem ATAU jika ada di draft (meskipun sistem nol)
                const mat = allMaterials.find(m => m.id === matId);
                if (mat) {
                    const draft = draftMap.get(matId);
                    newList.push({
                        material_id: matId, 
                        material_name: mat.name, 
                        unit: mat.unit, 
                        system_stock: sysQty,
                        physical_stock: draft ? draft.qty : '', 
                        breakdown: draft?.breakdown || [{ id: 1, label: 'Hitungan 1', qty: 0 }],
                        has_breakdown: !!draft?.breakdown, 
                        is_modified: !!draft
                    });
                    // Hapus dari draftMap karena sudah diproses
                    draftMap.delete(matId);
                }
            });

            // Proses sisa barang di draft yang TIDAK ada di ringkasan sistem lokasi tersebut
            draftMap.forEach((draftItem, matId) => {
                const mat = allMaterials.find(m => m.id === matId);
                if (mat) {
                    newList.push({
                        material_id: matId, 
                        material_name: mat.name, 
                        unit: mat.unit, 
                        system_stock: 0,
                        physical_stock: draftItem.qty, 
                        breakdown: draftItem.breakdown || [{ id: 1, label: 'Hitungan 1', qty: 0 }],
                        has_breakdown: !!draftItem.breakdown, 
                        is_modified: true
                    });
                }
            });

            setInventoryList(newList.sort((a, b) => a.material_name.localeCompare(b.material_name)));
            setCurrentPage(1);
        } catch (e: any) { 
            console.error("Load Stock Error:", e);
            setMessage({ type: 'error', text: 'Gagal memuat data: ' + e.message }); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { selectedLocation ? loadLocationStock() : setInventoryList([]); }, [selectedLocation]);

    // --- Handlers ---
    const handlePhysicalStockChange = useCallback((id: string, value: string) => {
        setInventoryList(prev => prev.map(item => item.material_id === id ? { ...item, physical_stock: value === '' ? '' : parseFloat(value), is_modified: true, has_breakdown: false } : item));
    }, []);

    const openCalculator = useCallback((item: InventoryItem) => {
        setActiveMaterialId(item.material_id);
        setTempBreakdown(item.has_breakdown ? JSON.parse(JSON.stringify(item.breakdown)) : [{ id: 1, label: 'Hitungan 1', qty: typeof item.physical_stock === 'number' ? item.physical_stock : 0 }]);
        setModalOpen(true);
    }, []);

    const saveBreakdown = () => {
        if (!activeMaterialId) return;
        const total = tempBreakdown.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
        setInventoryList(prev => prev.map(item => item.material_id === activeMaterialId ? { ...item, physical_stock: total, breakdown: tempBreakdown.map(r => ({ ...r, qty: Number(r.qty) || 0 })), has_breakdown: true, is_modified: true } : item));
        setModalOpen(false); setActiveMaterialId(null);
    };

    const handleSaveDraft = () => {
        if (!selectedLocation) return;
        const items = inventoryList.filter(i => typeof i.physical_stock === 'number').map(i => ({ material_id: i.material_id, qty: i.physical_stock as number, breakdown: i.breakdown }));
        if (items.length === 0) { setMessage({ type: 'error', text: 'Belum ada input.' }); return; }
        setSubmitting(true);
        logActivity(user, 'OPNAME_DRAFT', JSON.stringify({ location_id: selectedLocation, date, items, item_count: items.length }))
            .then(() => { setMessage({ type: 'success', text: 'Draft disimpan.' }); if (!draftedLocations.includes(selectedLocation)) setDraftedLocations([...draftedLocations, selectedLocation]); })
            .catch(() => setMessage({ type: 'error', text: 'Gagal simpan draft.' }))
            .finally(() => setSubmitting(false));
    };

    const handleFinalize = () => {
        if (!isAdmin) { alert("Akses Ditolak."); return; }
        setConfirmConfig({ title: "Finalisasi Opname?", message: `Proses ${draftedLocations.length} lokasi draft. Penyesuaian stok akan dibuat otomatis.`, action: performFinalize, isWarning: true });
        setConfirmModalOpen(true);
    };

    const performFinalize = async () => {
        setConfirmModalOpen(false); setSubmitting(true); setMessage(null);
        try {
            const { data: logs } = await supabase.from('audit_logs').select('details').eq('action', 'OPNAME_DRAFT').gte('timestamp', `${date}T00:00:00`).lte('timestamp', `${date}T23:59:59`).order('timestamp', { ascending: true });
            const locationDrafts = new Map<string, Map<string, DraftItem>>();
            logs?.forEach(log => { try { const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details; if(d.location_id) { const m = new Map(); d.items?.forEach((i: any) => m.set(i.material_id, i)); locationDrafts.set(d.location_id, m); } } catch{} });
            
            const { data: txs } = await supabase.from('transactions').select('material_id, location_id, type, quantity').in('location_id', Array.from(locationDrafts.keys()));
            const sysMap = new Map<string, number>();
            txs?.forEach(t => sysMap.set(`${t.location_id}|${t.material_id}`, (sysMap.get(`${t.location_id}|${t.material_id}`) || 0) + (t.type === 'IN' ? t.quantity : -t.quantity)));

            const adjs: any[] = [], report: any[] = [];
            locationDrafts.forEach((items, locId) => {
                const locName = locations.find(l => l.id === locId)?.name || locId;
                items.forEach((draft, matId) => {
                    const sys = sysMap.get(`${locId}|${matId}`) || 0;
                    const diff = draft.qty - sys;
                    report.push({ location: locName, material: allMaterials.find(m => m.id === matId)?.name, system: sys, physical: draft.qty, diff });
                    if (Math.abs(diff) > 0.0001) adjs.push({ material_id: matId, location_id: locId, type: diff > 0 ? TransactionType.IN : TransactionType.OUT, quantity: Math.abs(diff), shift: 'Adjustment', notes: `Opname: Fisik ${draft.qty} vs Sistem ${sys}`, timestamp: new Date().toISOString(), pic: user?.email });
                });
            });

            if (adjs.length > 0) await supabase.from('transactions').insert(adjs);
            const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report), "Result");
            await downloadFile(`Opname_Report_${date}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
            await logActivity(user, 'OPNAME_FINALIZE', `Finalized ${adjs.length} adjustments.`);
            setMessage({ type: 'success', text: `Selesai! ${adjs.length} penyesuaian dibuat.` });
            setDraftedLocations([]); loadLocationStock();
        } catch (e: any) { setMessage({ type: 'error', text: e.message }); } finally { setSubmitting(false); }
    };

    const handleAddManual = () => {
        if (!manualMaterialId) return;
        if (inventoryList.find(i => i.material_id === manualMaterialId)) { setMessage({ type: 'error', text: 'Barang sudah ada.' }); return; }
        const m = allMaterials.find(m => m.id === manualMaterialId);
        if (m) setInventoryList([{ material_id: m.id, material_name: m.name, unit: m.unit, system_stock: 0, physical_stock: '', breakdown: [{ id: 1, label: 'Hitungan 1', qty: 0 }], has_breakdown: false, is_modified: true }, ...inventoryList]);
        setAddModalOpen(false); setManualMaterialId('');
    };

    const filteredInventory = useMemo(() => inventoryList.filter(i => i.material_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())), [inventoryList, debouncedSearchQuery]);
    const paginatedInventory = useMemo(() => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredInventory, currentPage]);

    return {
        locations, allMaterials, materialOptions,
        selectedLocation, setSelectedLocation, date, setDate,
        searchQuery, setSearchQuery, loading, submitting, message,
        inventoryList, filteredInventory, paginatedInventory, currentPage, setCurrentPage, totalPages: Math.ceil(filteredInventory.length / ITEMS_PER_PAGE), ITEMS_PER_PAGE,
        draftedLocations, modalOpen, setModalOpen, activeMaterialId, tempBreakdown, setTempBreakdown,
        addModalOpen, setAddModalOpen, manualMaterialId, setManualMaterialId,
        confirmModalOpen, setConfirmModalOpen, confirmConfig,
        handlePhysicalStockChange, openCalculator, saveBreakdown, handleSaveDraft, handleFinalize, handleAddManual,
        isAdmin, activeMaterialName: allMaterials.find(m => m.id === activeMaterialId)?.name
    };
};
