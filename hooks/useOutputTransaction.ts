
import { useState, useEffect, FormEvent, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Material, TransactionType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import { getCurrentShiftAndDate } from '../utils/dateHelper';
import { useQueryClient } from '@tanstack/react-query';

export interface PendingOutput {
    material_id: string;
    materialName?: string;
    materialUnit?: string;
    quantity: number;
    notes: string;
    date: string;
    shift: string;
    location_id: string;
    locationName?: string;
}

export interface StockAtLocation {
    location_id: string;
    location_name: string;
    stock_quantity: number;
    oldest_stock_date: string;
}

export interface HistoryTransaction {
    id: string;
    timestamp: string;
    material_id: string;
    location_id: string;
    quantity: number;
    shift: string;
    notes: string;
    pic?: string;
    materials: { name: string; unit: string };
    locations: { name: string };
}

export const useOutputTransaction = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [defaults, setDefaults] = useState(getCurrentShiftAndDate());

    // Data States
    const [materials, setMaterials] = useState<Material[]>([]);
    const [stockLocations, setStockLocations] = useState<StockAtLocation[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<PendingOutput[]>([]);
    
    // Form State
    const [formState, setFormState] = useState({
        selectedMaterial: '',
        quantity: '',
        notes: '',
        date: defaults.date,
        shift: defaults.shift,
        location: ''
    });

    // History & Filter States
    const [recentHistory, setRecentHistory] = useState<HistoryTransaction[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [filterDate, setFilterDate] = useState('');
    const [filterShift, setFilterShift] = useState('');
    
    // UI States
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Partial<HistoryTransaction> | null>(null);
    const [editForm, setEditForm] = useState({ date: '', shift: '', quantity: '', notes: '' });
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const ITEMS_PER_PAGE = 30;

    // --- Data Fetching ---

    const fetchMaterials = async () => {
        // --- SYNC GLOBAL SETTINGS ---
        try {
            const { data: sData } = await supabase.from('app_settings').select('key, value').in('key', ['shift_mode', 'decimal_mode']);
            if (sData) {
                const current = JSON.parse(localStorage.getItem('app_display_settings') || '{}');
                sData.forEach(s => current[s.key === 'shift_mode' ? 'shiftMode' : 'decimalMode'] = s.value);
                localStorage.setItem('app_display_settings', JSON.stringify(current));
                
                const newDefaults = getCurrentShiftAndDate();
                setDefaults(newDefaults);
                // Hanya update jika belum ada interaksi user
                setFormState(prev => prev.selectedMaterial === '' ? { ...prev, date: newDefaults.date, shift: newDefaults.shift } : prev);
            }
        } catch (e) {}

        const { data } = await supabase.from('materials').select('*').order('name');
        if (data) setMaterials(data as Material[]);
    };

    const fetchHistory = useCallback(async () => {
        let query = supabase
            .from('transactions')
            .select(`id, timestamp, material_id, location_id, quantity, shift, notes, pic, materials (name, unit), locations (name)`, { count: 'exact' })
            .eq('type', TransactionType.OUT)
            .neq('shift', 'Transfer').neq('shift', 'Return');
        
        if (filterDate) {
            const startDate = new Date(filterDate); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(filterDate); endDate.setHours(23, 59, 59, 999);
            query = query.gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString());
        }
        if (filterShift) query = query.eq('shift', `Shift ${filterShift}`);

        const from = (historyPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        const { data, count } = await query.order('timestamp', { ascending: false }).range(from, to);
        
        if (data) {
            setRecentHistory(data as unknown as HistoryTransaction[]);
            setHistoryTotal(count || 0);
        }
    }, [historyPage, filterDate, filterShift]);

    const fetchStockAtLocations = useCallback(async () => {
        if (!formState.selectedMaterial) {
            setStockLocations([]);
            return;
        }
        const { data, error } = await supabase.rpc('get_stock_by_location', { material_id_param: formState.selectedMaterial });
        if (!error && data) setStockLocations(data as StockAtLocation[]);
    }, [formState.selectedMaterial]);

    // --- Effects ---

    useEffect(() => { fetchMaterials(); }, []);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);
    
    useEffect(() => {
        if (!formState.selectedMaterial) {
            setStockLocations([]);
            setFormState(prev => ({ ...prev, location: '' }));
        } else {
            fetchStockAtLocations();
        }
    }, [formState.selectedMaterial, fetchStockAtLocations]);

    useEffect(() => {
        const channel = supabase.channel('output_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
                fetchHistory();
                fetchMaterials();
                fetchStockAtLocations();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchHistory, fetchStockAtLocations]);

    // --- Computed Values ---

    const currentMaterialDetails = materials.find(m => m.id === formState.selectedMaterial);
    const currentStockAtLocation = stockLocations.find(l => l.location_id === formState.location)?.stock_quantity ?? 0;
    const stockUsedInPending = pendingTransactions
        .filter(t => t.material_id === formState.selectedMaterial && t.location_id === formState.location)
        .reduce((sum, t) => sum + t.quantity, 0);
    const availableStock = currentStockAtLocation - stockUsedInPending;

    // --- Actions ---

    const handleAddToList = (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        const { selectedMaterial, quantity, date, shift, location, notes } = formState;

        if (!selectedMaterial || !quantity || !date || !shift || !location) {
            setMessage({ type: 'error', text: 'Silakan lengkapi tanggal, shift, barang, lokasi, dan kuantitas.' });
            return false;
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            setMessage({ type: 'error', text: 'Kuantitas harus berupa angka positif.' });
            return false;
        }

        if (qty > availableStock) {
            setMessage({ type: 'error', text: `Stok tidak mencukupi. Sisa stok di lokasi ini: ${availableStock.toFixed(2)} ${currentMaterialDetails?.unit}.` });
            return false;
        }
        
        const locationDetails = stockLocations.find(l => l.location_id === location);
        const newTransaction: PendingOutput = {
            material_id: selectedMaterial,
            materialName: currentMaterialDetails?.name,
            materialUnit: currentMaterialDetails?.unit,
            quantity: qty,
            notes: notes,
            date: date,
            shift: shift,
            location_id: location,
            locationName: locationDetails?.location_name,
        };

        setPendingTransactions([...pendingTransactions, newTransaction]);
        setFormState(prev => ({ ...prev, selectedMaterial: '', quantity: '', notes: '', location: '' }));
        return true;
    };

    const handleRemoveFromList = (index: number) => {
        setPendingTransactions(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveAll = async () => {
        if (pendingTransactions.length === 0) return;
        setIsLoading(true);
        setMessage(null);

        const transactionsToInsert = pendingTransactions.map(t => {
            const ts = new Date(t.date);
            const now = new Date();
            ts.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            return {
                material_id: t.material_id,
                type: TransactionType.OUT,
                quantity: t.quantity,
                notes: t.notes,
                timestamp: ts.toISOString(),
                shift: `Shift ${t.shift}`,
                pic: user?.email,
                location_id: t.location_id,
            };
        });

        const { error } = await supabase.from('transactions').insert(transactionsToInsert);

        if (error) {
            setIsLoading(false);
            setMessage({ type: 'error', text: `Gagal menyimpan data: ${error.message}` });
        } else {
            // Create detailed transaction log
            const transactionDetails = pendingTransactions.map(t => ({
                material_name: t.materialName,
                quantity: t.quantity,
                unit: materials.find(m => m.id === t.material_id)?.unit || '',
                shift: t.shift,
                pic: t.pic,
                notes: t.notes
            }));
            await logActivity(user, 'OUTPUT_TRANSACTION', JSON.stringify({
                action: `Created ${pendingTransactions.length} OUT transactions`,
                transactions: transactionDetails
            }, null, 2));

            // CRITICAL: Paksa refresh cache master
            await queryClient.invalidateQueries({ queryKey: ['materials'] });
            
            setMessage({ type: 'success', text: 'Semua transaksi berhasil disimpan!' });
            setPendingTransactions([]);
            await Promise.all([fetchMaterials(), fetchHistory()]);
            setFilterDate(''); setFilterShift(''); setHistoryPage(1); 
            setIsLoading(false);
        }
    };

    const handleDeleteTransaction = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        setMessage(null);

        try {
            // First, fetch the transaction details before deleting
            const { data: trxData } = await supabase
                .from('transactions')
                .select('*, materials(name, unit)')
                .eq('id', deleteId)
                .single();

            const { error: deleteError } = await supabase.from('transactions').delete().eq('id', deleteId);
            if (deleteError) throw deleteError;

            await queryClient.invalidateQueries({ queryKey: ['materials'] });

            // Log with full transaction details
            await logActivity(user, 'DELETE_TRANSACTION', JSON.stringify({
                action: 'Deleted OUT transaction',
                transaction: {
                    id: deleteId,
                    material_name: trxData?.materials?.name || 'Unknown',
                    quantity: trxData?.quantity,
                    unit: trxData?.materials?.unit || '',
                    type: trxData?.type,
                    shift: trxData?.shift,
                    timestamp: trxData?.timestamp,
                    pic: trxData?.pic,
                    notes: trxData?.notes
                }
            }, null, 2));

            setMessage({ type: 'success', text: 'Transaksi berhasil dihapus (Stok dikembalikan otomatis oleh sistem).' });

            fetchHistory();
            fetchMaterials();
            fetchStockAtLocations();

        } catch (error: any) {
            setMessage({ type: 'error', text: error.code === '42501' ? 'AKSES DITOLAK: Anda tidak memiliki izin.' : `Gagal menghapus: ${error.message}` });
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const handleUpdateTransaction = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingTransaction?.id) return;
        setIsLoading(true);
        
        const timestamp = new Date(editForm.date);
        const now = new Date();
        timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        const { error } = await supabase.from('transactions').update({
            quantity: parseFloat(editForm.quantity),
            timestamp: timestamp.toISOString(),
            shift: `Shift ${editForm.shift}`,
            notes: editForm.notes
        }).eq('id', editingTransaction.id);

        if (error) {
             setIsLoading(false);
             setMessage({ type: 'error', text: `Gagal mengupdate: ${error.message}` });
        } else {
             await queryClient.invalidateQueries({ queryKey: ['materials'] });

             // Get material details for logging
             const material = materials.find(m => m.id === editingTransaction.material_id);
             await logActivity(user, 'UPDATE_TRANSACTION', JSON.stringify({
                 action: 'Updated OUT transaction',
                 transaction: {
                     id: editingTransaction.id,
                     material_name: material?.name || 'Unknown',
                     old_quantity: editingTransaction.quantity,
                     new_quantity: parseFloat(editForm.quantity),
                     unit: material?.unit || '',
                     new_timestamp: timestamp.toISOString(),
                     old_timestamp: editingTransaction.timestamp,
                     shift: `Shift ${editForm.shift}`,
                     notes: editForm.notes
                 }
             }, null, 2));

             setMessage({ type: 'success', text: 'Transaksi berhasil diperbarui.' });
             setIsEditModalOpen(false); setEditingTransaction(null); fetchHistory(); fetchMaterials();
             setIsLoading(false);
        }
    };

    return {
        materials, stockLocations, pendingTransactions,
        formState, setFormState,
        availableStock, currentMaterialDetails,
        recentHistory, historyTotal, totalPages: Math.ceil(historyTotal / ITEMS_PER_PAGE),
        historyPage, setHistoryPage, filterDate, setFilterDate, filterShift, setFilterShift,
        isLoading, message,
        deleteId, setDeleteId, isDeleting,
        isEditModalOpen, setIsEditModalOpen, editingTransaction, setEditingTransaction, editForm, setEditForm,
        handleAddToList, handleRemoveFromList, handleSaveAll, handleDeleteTransaction, handleUpdateTransaction,
        user
    };
};
