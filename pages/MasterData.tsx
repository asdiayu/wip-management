
import React, { useState, useRef } from 'react';
import { Material, Location } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useMasterData } from '../hooks/useMasterData';
import { CloudUploadIcon, ArchiveIcon } from '../constants';

const MasterData: React.FC = () => {
    const {
        materials, locations, loading, isImporting, activeTab, setActiveTab,
        modalOpen, setModalOpen, modalMode, currentItem, handleOpenModal,
        deleteConfig, setDeleteConfig, isDeleting, confirmDelete,
        isSubmitting, saveMaterial, saveLocation,
        importFromExcel, downloadTemplate
    } = useMasterData();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importFromExcel(file);
            // Reset input so same file can be selected again
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const MaterialForm = () => {
        const item = currentItem as Material;
        const [form, setForm] = useState({
            name: item?.name || '', unit: item?.unit || '', department: item?.department || '',
            machine_number: item?.machine_number || '', default_location_id: item?.default_location_id || '',
            min_stock: item?.min_stock || '', max_stock: item?.max_stock || ''
        });

        return (
            <form onSubmit={(e) => saveMaterial(e, form)} className="space-y-4">
                <Input id="name" label="Nama Barang" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                <Input id="unit" label="Satuan" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} required placeholder="kg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="department" label="Departemen" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                    <Input id="machine" label="No Mesin" value={form.machine_number} onChange={e => setForm({...form, machine_number: e.target.value})} />
                </div>
                <Select id="default_loc" label="Lokasi Default" value={form.default_location_id} onChange={e => setForm({...form, default_location_id: e.target.value})}>
                    <option value="">Pilih Lokasi</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
                <div className="grid grid-cols-2 gap-4">
                    <Input id="min" label="Min Stok" type="number" step="0.01" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} />
                    <Input id="max" label="Max Stok" type="number" step="0.01" value={form.max_stock} onChange={e => setForm({...form, max_stock: e.target.value})} />
                </div>
                <div className="flex justify-end gap-4 pt-6">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Batal</button>
                    <Button type="submit" isLoading={isSubmitting} className="w-auto">Simpan</Button>
                </div>
            </form>
        );
    };

    const LocationForm = () => {
        const [name, setName] = useState((currentItem as Location)?.name || '');
        return (
            <form onSubmit={(e) => saveLocation(e, name)} className="space-y-4">
                <Input id="name" label="Nama Lokasi" value={name} onChange={e => setName(e.target.value)} required />
                <div className="flex justify-end gap-4 pt-6">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Batal</button>
                    <Button type="submit" isLoading={isSubmitting} className="w-auto">Simpan</Button>
                </div>
            </form>
        );
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Master Data</h1>
            
            {isImporting && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary-600 mb-4"></div>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Sedang Mengimport Data...</p>
                        <p className="text-sm text-slate-500 italic mt-1">Mohon tunggu sejenak</p>
                    </div>
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 sm:p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{modalMode === 'add' ? 'Tambah' : 'Edit'} {activeTab === 'materials' ? 'Barang' : 'Lokasi'}</h3>
                        {activeTab === 'materials' ? <MaterialForm /> : <LocationForm />}
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteConfig} onClose={() => setDeleteConfig(null)} onConfirm={confirmDelete}
                title="Hapus Data?" message={`Yakin hapus "${deleteConfig?.name}"?`}
                confirmLabel="Ya, Hapus" isDanger={true} isLoading={isDeleting}
            />
            
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl">
                 <div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex border-b border-slate-200 dark:border-slate-700">
                        {['materials', 'locations'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                {tab === 'materials' ? 'Barang' : 'Lokasi'}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <button 
                            onClick={downloadTemplate}
                            className="flex-1 lg:flex-none px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Template Excel
                        </button>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".xlsx, .xls" 
                            onChange={handleFileChange}
                        />
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors shadow-sm"
                        >
                            <CloudUploadIcon className="h-4 w-4 mr-2" />
                            Import Excel
                        </button>

                        <Button onClick={() => handleOpenModal('add')} className="flex-1 lg:flex-none w-auto">
                            Tambah {activeTab === 'materials' ? 'Barang' : 'Lokasi'}
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama</th>
                                {activeTab === 'materials' && <><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Satuan</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Departemen</th></>}
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? <tr><td colSpan={4} className="text-center py-10">Loading...</td></tr> : 
                            (activeTab === 'materials' ? materials : locations).map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                                    {activeTab === 'materials' && <><td className="px-6 py-4 text-sm text-slate-500">{item.unit}</td><td className="px-6 py-4 text-sm text-slate-500">{item.department || '-'}</td></>}
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                                        <button onClick={() => handleOpenModal('edit', item)} className="text-primary-600 hover:text-primary-900">Edit</button>
                                        <button onClick={() => setDeleteConfig({ id: item.id, type: activeTab, name: item.name })} className="text-red-600 hover:text-red-900">Hapus</button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && (activeTab === 'materials' ? materials : locations).length === 0 && <tr><td colSpan={4} className="text-center py-10 text-slate-500">Tidak ada data.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MasterData;
