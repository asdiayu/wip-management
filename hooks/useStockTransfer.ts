
import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location, TransactionType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import { getCurrentShiftAndDate } from '../utils/dateHelper';

interface StockAtLocation {
    location_id: string;
    location_name: string;
    stock_quantity: number;
}

export const useStockTransfer = () => {
    const { user } = useAuth();
    const defaults = getCurrentShiftAndDate();

    // Data State
    const [materials, setMaterials] = useState<Material[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [stockSourceLocations, setStockSourceLocations] = useState<StockAtLocation[]>([]);
    
    // Form State
    const [date, setDate] = useState(defaults.date);
    const [selectedMaterial, setSelectedMaterial] = useState('');
    const [sourceLocation, setSourceLocation] = useState('');
    const [destLocation, setDestLocation] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

    // Fetch Stock when Material Selected
    useEffect(() => {
        const fetchStockAtLocations = async () => {
            if (!selectedMaterial) {
                setStockSourceLocations([]);
                setSourceLocation('');
                return;
            }
            const { data, error } = await supabase.rpc('get_stock_by_location', { material_id_param: selectedMaterial });
            if (!error) setStockSourceLocations(data as StockAtLocation[]);
        };
        fetchStockAtLocations();
    }, [selectedMaterial]);

    const availableStock = stockSourceLocations.find(l => l.location_id === sourceLocation)?.stock_quantity ?? 0;
    const selectedMaterialUnit = materials.find(m => m.id === selectedMaterial)?.unit || 'Unit';
    const materialOptions = materials.map(m => ({ value: m.id, label: m.name }));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!selectedMaterial || !sourceLocation || !destLocation || !quantity || !date) {
            setMessage({ type: 'error', text: 'Mohon lengkapi semua form wajib.' });
            return;
        }

        if (sourceLocation === destLocation) {
            setMessage({ type: 'error', text: 'Lokasi Asal dan Tujuan tidak boleh sama.' });
            return;
        }

        const qtyVal = parseFloat(quantity);
        if (isNaN(qtyVal) || qtyVal <= 0) {
            setMessage({ type: 'error', text: 'Jumlah harus lebih dari 0.' });
            return;
        }

        if (qtyVal > availableStock) {
            setMessage({ type: 'error', text: `Stok di lokasi asal tidak cukup. Tersedia: ${availableStock}` });
            return;
        }

        setIsLoading(true);

        const timestamp = new Date(date);
        const now = new Date();
        timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        const isoTimestamp = timestamp.toISOString();
        
        const transactions = [
            {
                material_id: selectedMaterial,
                location_id: sourceLocation,
                type: TransactionType.OUT,
                quantity: qtyVal,
                timestamp: isoTimestamp,
                notes: `Mutasi ke: ${locations.find(l => l.id === destLocation)?.name}. ${notes}`,
                shift: 'Transfer',
                pic: user?.email
            },
            {
                material_id: selectedMaterial,
                location_id: destLocation,
                type: TransactionType.IN,
                quantity: qtyVal,
                timestamp: isoTimestamp,
                notes: `Mutasi dari: ${locations.find(l => l.id === sourceLocation)?.name}. ${notes}`,
                shift: 'Transfer',
                pic: user?.email
            }
        ];

        const { error } = await supabase.from('transactions').insert(transactions);

        setIsLoading(false);
        if (error) {
            setMessage({ type: 'error', text: `Gagal memproses mutasi: ${error.message}` });
        } else {
            await logActivity(user, 'STOCK_TRANSFER', `Transferred ${qtyVal} ${selectedMaterialUnit} from Loc ${sourceLocation} to Loc ${destLocation}`);
            setMessage({ type: 'success', text: 'Mutasi lokasi berhasil disimpan!' });
            
            // Reset fields
            setQuantity(''); setNotes('');
            setSelectedMaterial(''); setSourceLocation(''); setDestLocation('');
        }
    };

    return {
        materials, locations, stockSourceLocations, materialOptions,
        date, setDate, selectedMaterial, setSelectedMaterial,
        sourceLocation, setSourceLocation, destLocation, setDestLocation,
        quantity, setQuantity, notes, setNotes,
        isLoading, message, availableStock, selectedMaterialUnit,
        handleSubmit
    };
};
