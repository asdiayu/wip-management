
import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../services/supabase';
import { Material, Location } from '../types';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import * as XLSX from 'xlsx';

export const useMasterData = () => {
    const { user } = useAuth();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'materials' | 'locations'>('materials');

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentItem, setCurrentItem] = useState<Material | Location | null>(null);

    // Confirmation State
    const [deleteConfig, setDeleteConfig] = useState<{ id: string, type: 'materials' | 'locations', name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        const { data: mData } = await supabase.from('materials').select('*').order('name');
        if (mData) setMaterials(mData as Material[]);
        const { data: lData } = await supabase.from('locations').select('*').order('name');
        if (lData) setLocations(lData as Location[]);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenModal = (mode: 'add' | 'edit', item: Material | Location | null = null) => {
        setModalMode(mode);
        setCurrentItem(item);
        setModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteConfig) return;
        setIsDeleting(true);
        const { id, type, name } = deleteConfig;

        // Fetch full details before deleting
        let fullDetails: any = { name };
        if (type === 'materials') {
            const { data } = await supabase.from('materials').select('*').eq('id', id).single();
            if (data) fullDetails = data;
        } else if (type === 'locations') {
            const { data } = await supabase.from('locations').select('*').eq('id', id).single();
            if (data) fullDetails = data;
        }

        const { error } = await supabase.from(type).delete().eq('id', id);

        if (error) {
            console.error("Delete Error:", error);
            if (error.code === '23503') alert(`GAGAL MENGHAPUS:\n\nData "${name}" sedang digunakan dalam transaksi.`);
            else if (error.code === '42501') alert('AKSES DITOLAK: Anda tidak memiliki izin.');
            else alert(`Gagal menghapus: ${error.message}`);
        } else {
            await logActivity(user, `DELETE_${type.toUpperCase()}`, JSON.stringify({
                action: `Deleted ${type === 'materials' ? 'material' : 'location'}`,
                item: fullDetails
            }, null, 2));
            fetchData();
        }
        setIsDeleting(false); setDeleteConfig(null);
    };

    const saveMaterial = async (e: FormEvent, data: any) => {
        e.preventDefault(); setIsSubmitting(true);
        const payload = { ...data, min_stock: data.min_stock || null, max_stock: data.max_stock || null, default_location_id: data.default_location_id || null };
        if (modalMode === 'add') {
            await supabase.from('materials').insert([payload]);
            await logActivity(user, 'CREATE_MATERIAL', JSON.stringify({
                action: 'Created material',
                material: payload
            }, null, 2));
        } else {
            await supabase.from('materials').update(payload).eq('id', currentItem?.id);
            await logActivity(user, 'UPDATE_MATERIAL', JSON.stringify({
                action: 'Updated material',
                old_data: currentItem,
                new_data: payload
            }, null, 2));
        }
        setIsSubmitting(false); setModalOpen(false); fetchData();
    };

    const saveLocation = async (e: FormEvent, name: string) => {
        e.preventDefault(); setIsSubmitting(true);
        if (modalMode === 'add') {
            await supabase.from('locations').insert([{ name }]);
            await logActivity(user, 'CREATE_LOCATION', `Created ${name}`);
        } else {
            await supabase.from('locations').update({ name }).eq('id', currentItem?.id);
            await logActivity(user, 'UPDATE_LOCATION', `Updated ${name}`);
        }
        setIsSubmitting(false); setModalOpen(false); fetchData();
    };

    const importFromExcel = async (file: File) => {
        setIsImporting(true);
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                if (jsonData.length === 0) {
                    alert("File kosong!");
                    return;
                }

                if (activeTab === 'materials') {
                    // Mapping Bahasa Indonesia ke DB Key
                    const processed = jsonData.map(row => ({
                        name: row['Nama Barang'] || row['Nama'] || row['name'],
                        unit: row['Satuan'] || row['unit'] || 'pcs',
                        department: row['Departemen'] || row['department'] || null,
                        machine_number: row['No Mesin'] || row['machine_number'] || null,
                        min_stock: row['Min Stok'] || row['min_stock'] || null,
                        max_stock: row['Max Stok'] || row['max_stock'] || null,
                    })).filter(item => !!item.name);

                    const { error } = await supabase.from('materials').upsert(processed, { onConflict: 'name' });
                    if (error) throw error;
                    await logActivity(user, 'IMPORT_MATERIALS', `Imported ${processed.length} materials from Excel`);
                } else {
                    const processed = jsonData.map(row => ({
                        name: row['Nama Lokasi'] || row['Nama'] || row['name']
                    })).filter(item => !!item.name);

                    const { error } = await supabase.from('locations').upsert(processed, { onConflict: 'name' });
                    if (error) throw error;
                    await logActivity(user, 'IMPORT_LOCATIONS', `Imported ${processed.length} locations from Excel`);
                }

                alert("Import Berhasil!");
                fetchData();
            } catch (err: any) {
                console.error("Import error:", err);
                alert(`Gagal Import: ${err.message}`);
            } finally {
                setIsImporting(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const downloadTemplate = () => {
        let headers = [];
        let filename = "";
        
        if (activeTab === 'materials') {
            headers = [["Nama Barang", "Satuan", "Departemen", "No Mesin", "Min Stok", "Max Stok"]];
            filename = "Template_Import_Barang.xlsx";
        } else {
            headers = [["Nama Lokasi"]];
            filename = "Template_Import_Lokasi.xlsx";
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, filename);
    };

    return {
        materials, locations, loading, isImporting, activeTab, setActiveTab,
        modalOpen, setModalOpen, modalMode, currentItem, handleOpenModal,
        deleteConfig, setDeleteConfig, isDeleting, confirmDelete,
        isSubmitting, saveMaterial, saveLocation,
        importFromExcel, downloadTemplate
    };
};
