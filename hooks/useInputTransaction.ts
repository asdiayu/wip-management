
import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location, TransactionType } from '../types';
import { getCurrentShiftAndDate } from '../utils/dateHelper';
import { logActivity } from '../services/auditLogger';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export interface PendingInput {
    material_id: string;
    materialName?: string;
    materialUnit?: string;
    quantity: number;
    notes: string;
    date: string;
    shift: string;
    location_id: string;
    locationName?: string;
    isInitial: boolean;
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
    type: TransactionType;
    materials: { name: string; unit: string };
    locations: { name: string };
}

export const useInputTransaction = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [defaults, setDefaults] = useState(getCurrentShiftAndDate());

    // Data States
    const [materials, setMaterials] = useState<Material[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<PendingInput[]>([]);
    const [recentHistory, setRecentHistory] = useState<HistoryTransaction[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);

    // Form States
    const [formState, setFormState] = useState({
        selectedMaterial: '',
        quantity: '',
        notes: '',
        date: defaults.date,
        shift: defaults.shift,
        location: '',
        isInitialStock: false
    });

    // UI States
    const [historyPage, setHistoryPage] = useState(1);
    const [filterDate, setFilterDate] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    // Modal States
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Partial<HistoryTransaction> | null>(null);
    const [editForm, setEditForm] = useState({ date: '', shift: '', location_id: '', quantity: '', notes: '' });

    const ITEMS_PER_PAGE = 30;

    const fetchInitialData = async () => {
        // --- SYNC GLOBAL SETTINGS FIRST ---
        try {
            const { data: sData } = await supabase.from('app_settings').select('key, value').in('key', ['shift_mode', 'decimal_mode']);
            if (sData) {
                const current = JSON.parse(localStorage.getItem('app_display_settings') || '{}');
                sData.forEach(s => current[s.key === 'shift_mode' ? 'shiftMode' : 'decimalMode'] = s.value);
                localStorage.setItem('app_display_settings', JSON.stringify(current));
                
                // Update default state if settings changed
                const newDefaults = getCurrentShiftAndDate();
                setDefaults(newDefaults);
                setFormState(prev => ({ ...prev, date: newDefaults.date, shift: newDefaults.shift }));
            }
        } catch (e) {}

        const { data: mData } = await supabase.from('materials').select('*').order('name');
        if (mData) setMaterials(mData as Material[]);
        const { data: lData } = await supabase.from('locations').select('*').order('name');
        if (lData) setLocations(lData as Location[]);
    };

    const fetchHistory = async () => {
        let query = supabase.from('transactions').select(`id, timestamp, material_id, location_id, quantity, shift, notes, pic, type, materials (name, unit), locations (name)`, { count: 'exact' })
            .eq('type', TransactionType.IN)
            .neq('shift', 'Transfer').neq('shift', 'Return');
        
        if (filterDate) {
            const startDate = new Date(filterDate); startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(filterDate); endDate.setHours(23, 59, 59, 999);
            query = query.gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString());
        }
        if (filterShift) {
            query = filterShift === 'Initial' ? query.eq('shift', 'Initial') : query.eq('shift', `Shift ${filterShift}`);
        }

        const from = (historyPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        const { data, count } = await query.order('timestamp', { ascending: false }).range(from, to);
        
        if (data) {
            setRecentHistory(data as unknown as HistoryTransaction[]);
            setHistoryTotal(count || 0);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [historyPage, filterDate, filterShift]);

    useEffect(() => {
        const channel = supabase.channel('input_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchHistory)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [historyPage, filterDate, filterShift]);

    const handleAddToList = (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        const { selectedMaterial, quantity, date, shift, location, isInitialStock, notes } = formState;

        if (!selectedMaterial || !quantity || !date || (!isInitialStock && !shift) || !location) {
            setMessage({ type: 'error', text: 'Silakan lengkapi tanggal, lokasi, barang, dan kuantitas.' });
            return;
        }
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            setMessage({ type: 'error', text: 'Kuantitas harus berupa angka positif.' });
            return;
        }

        const materialDetails = materials.find(m => m.id === selectedMaterial);
        const locationDetails = locations.find(l => l.id === location);
        
        const newTransaction: PendingInput = {
            material_id: selectedMaterial,
            materialName: materialDetails?.name,
            materialUnit: materialDetails?.unit,
            quantity: qty,
            notes: (isInitialStock && !notes) ? 'Saldo Awal (Initial Stock)' : notes,
            date: date,
            shift: isInitialStock ? 'Initial' : shift,
            location_id: location,
            locationName: locationDetails?.name,
            isInitial: isInitialStock
        };

        setPendingTransactions([...pendingTransactions, newTransaction]);
        
        // Reset specific fields
        setFormState(prev => ({ ...prev, selectedMaterial: '', quantity: '', notes: '', location: '' }));
        return true; // Signal success
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
                type: TransactionType.IN,
                quantity: t.quantity,
                notes: t.notes,
                timestamp: ts.toISOString(),
                shift: t.shift === 'Initial' ? 'Initial' : `Shift ${t.shift}`,
                pic: user?.email,
                location_id: t.location_id,
            };
        });

        const { error } = await supabase.from('transactions').insert(transactionsToInsert);
        
        if (error) {
            setIsLoading(false);
            setMessage({ type: 'error', text: `Gagal menyimpan data: ${error.message}`});
        } else {
            // Create detailed transaction log
            const transactionDetails = pendingTransactions.map(p => ({
                material_name: materials.find(m => m.id === p.material_id)?.name || 'Unknown',
                quantity: p.quantity,
                unit: materials.find(m => m.id === p.material_id)?.unit || '',
                shift: p.shift,
                pic: p.pic,
                notes: p.notes
            }));
            await logActivity(user, 'INPUT_TRANSACTION', JSON.stringify({
                action: `Created ${pendingTransactions.length} transactions`,
                transactions: transactionDetails
            }, null, 2));

            // CRITICAL: Paksa refresh cache Master Barang agar Stok Total terupdate instan
            await queryClient.invalidateQueries({ queryKey: ['materials'] });
            
            setMessage({ type: 'success', text: 'Semua transaksi berhasil disimpan!'});
            setPendingTransactions([]);
            setFilterDate(''); setFilterShift(''); setHistoryPage(1); 
            
            await Promise.all([fetchHistory(), fetchInitialData()]);
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

            // Invalidate cache setelah hapus
            await queryClient.invalidateQueries({ queryKey: ['materials'] });

            // Log with full transaction details
            await logActivity(user, 'DELETE_TRANSACTION', JSON.stringify({
                action: 'Deleted IN transaction',
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

            setMessage({ type: 'success', text: 'Transaksi berhasil dihapus (Stok dikoreksi otomatis oleh sistem).' });

            fetchHistory();
            fetchInitialData(); 

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
            shift: editForm.shift === 'Initial' ? 'Initial' : `Shift ${editForm.shift}`,
            location_id: editForm.location_id,
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
                 action: 'Updated IN transaction',
                 transaction: {
                     id: editingTransaction.id,
                     material_name: material?.name || 'Unknown',
                     old_quantity: editingTransaction.quantity,
                     new_quantity: parseFloat(editForm.quantity),
                     unit: material?.unit || '',
                     new_timestamp: timestamp.toISOString(),
                     old_timestamp: editingTransaction.timestamp,
                     shift: editForm.shift === 'Initial' ? 'Initial' : `Shift ${editForm.shift}`,
                     location_id: editForm.location_id,
                     notes: editForm.notes
                 }
             }, null, 2));

             setMessage({ type: 'success', text: 'Transaksi berhasil diperbarui.' });
             setIsEditModalOpen(false); setEditingTransaction(null); 
             fetchHistory();
             setIsLoading(false);
        }
    };

    return {
        materials, locations,
        pendingTransactions,
        recentHistory, historyTotal, totalPages: Math.ceil(historyTotal / ITEMS_PER_PAGE),
        formState, setFormState,
        historyPage, setHistoryPage,
        filterDate, setFilterDate,
        filterShift, setFilterShift,
        isLoading, message,
        deleteId, setDeleteId, isDeleting,
        isEditModalOpen, setIsEditModalOpen,
        editingTransaction, setEditingTransaction,
        editForm, setEditForm,
        handleAddToList, handleRemoveFromList, handleSaveAll,
        handleDeleteTransaction, handleUpdateTransaction,
        isAdmin: user?.user_metadata?.role === 'admin',
        user
    };
};
