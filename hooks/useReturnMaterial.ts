
import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location, TransactionType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import { getCurrentShiftAndDate } from '../utils/dateHelper';

export const useReturnMaterial = () => {
    const { user } = useAuth();
    const defaults = getCurrentShiftAndDate();

    // Tabs & Data
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
    const [materials, setMaterials] = useState<Material[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    
    // Form
    const [date, setDate] = useState(defaults.date);
    const [selectedMaterial, setSelectedMaterial] = useState('');
    const [locationId, setLocationId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    
    // UI
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [availableStock, setAvailableStock] = useState(0);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            const { data: materialsData } = await supabase.from('materials').select('*').order('name');
            if (materialsData) setMaterials(materialsData as Material[]);
            const { data: locationsData } = await supabase.from('locations').select('*').order('name');
            if (locationsData) setLocations(locationsData as Location[]);
        };
        fetchData();
    }, []);

    // Check Stock for Supplier Return
    useEffect(() => {
        const checkStock = async () => {
            if (activeTab === 'supplier' && selectedMaterial && locationId) {
                const { data, error } = await supabase.rpc('get_stock_by_location', { material_id_param: selectedMaterial });
                if (!error && data) {
                    const locStock = (data as any[]).find(l => l.location_id === locationId);
                    setAvailableStock(locStock ? locStock.stock_quantity : 0);
                }
            }
        };
        checkStock();
    }, [activeTab, selectedMaterial, locationId]);

    const handleTabChange = (tab: 'customer' | 'supplier') => {
        setActiveTab(tab);
        setMessage(null);
        setQuantity('');
        setReason('');
        setLocationId(''); 
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!selectedMaterial || !locationId || !quantity || !date || !reason) {
            setMessage({ type: 'error', text: 'Mohon lengkapi semua form.' });
            return;
        }

        const qtyVal = parseFloat(quantity);
        if (isNaN(qtyVal) || qtyVal <= 0) {
            setMessage({ type: 'error', text: 'Jumlah harus lebih dari 0.' });
            return;
        }

        if (activeTab === 'supplier' && qtyVal > availableStock) {
             setMessage({ type: 'error', text: `Stok tidak cukup untuk diretur. Tersedia: ${availableStock}` });
             return;
        }

        setIsLoading(true);

        const timestamp = new Date(date);
        const now = new Date();
        timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        
        const transaction = {
            material_id: selectedMaterial,
            location_id: locationId,
            type: activeTab === 'customer' ? TransactionType.IN : TransactionType.OUT,
            quantity: qtyVal,
            timestamp: timestamp.toISOString(),
            notes: `[RETUR] ${reason}`,
            shift: 'Return',
            pic: user?.email
        };

        const { error } = await supabase.from('transactions').insert([transaction]);

        setIsLoading(false);
        if (error) {
            setMessage({ type: 'error', text: `Gagal menyimpan retur: ${error.message}` });
        } else {
            const actionType = activeTab === 'customer' ? 'RETURN_FROM_CUSTOMER' : 'RETURN_TO_SUPPLIER';
            const unit = materials.find(m => m.id === selectedMaterial)?.unit || 'Unit';
            await logActivity(user, actionType, `Processed return of ${qtyVal} ${unit} at Loc ${locationId}`);
            
            setMessage({ type: 'success', text: 'Data retur berhasil disimpan!' });
            setQuantity(''); setReason('');
            
            // Re-fetch stock if supplier
            if (activeTab === 'supplier') {
                 const { data } = await supabase.rpc('get_stock_by_location', { material_id_param: selectedMaterial });
                 if (data) {
                    const locStock = (data as any[]).find(l => l.location_id === locationId);
                    setAvailableStock(locStock ? locStock.stock_quantity : 0);
                 }
            }
        }
    };

    return {
        activeTab, handleTabChange,
        materials, locations, materialOptions: materials.map(m => ({ value: m.id, label: m.name })),
        date, setDate, selectedMaterial, setSelectedMaterial,
        locationId, setLocationId, quantity, setQuantity, reason, setReason,
        isLoading, message, availableStock,
        selectedMaterialUnit: materials.find(m => m.id === selectedMaterial)?.unit || 'Unit',
        handleSubmit
    };
};
