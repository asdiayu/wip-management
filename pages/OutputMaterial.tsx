
import React, { useMemo, useState } from 'react';
import { useOutputTransaction } from '../hooks/useOutputTransaction';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SearchableSelect from '../components/ui/SearchableSelect';
import Select from '../components/ui/Select';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import QRScannerModal from '../components/ui/QRScannerModal';
import { QrCodeIcon } from '../constants';

const OutputMaterial: React.FC = () => {
    const {
        materials, stockLocations, pendingTransactions,
        formState, setFormState,
        availableStock, currentMaterialDetails,
        recentHistory, historyTotal, totalPages,
        historyPage, setHistoryPage, filterDate, setFilterDate, filterShift, setFilterShift,
        isLoading, message,
        deleteId, setDeleteId, isDeleting,
        isEditModalOpen, setIsEditModalOpen, editingTransaction, setEditingTransaction, editForm, setEditForm,
        handleAddToList, handleRemoveFromList, handleSaveAll, handleDeleteTransaction, handleUpdateTransaction,
        user
    } = useOutputTransaction();

    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Ambil mode shift dari settings
    const shiftMode = useMemo(() => {
        const saved = localStorage.getItem('app_display_settings');
        return saved ? JSON.parse(saved).shiftMode || '2' : '2';
    }, []);

    const materialOptions = materials.map(m => ({ value: m.id, label: `${m.name} (Stok Total: ${m.stock.toFixed(2)})` }));

    const handleScanSuccess = (decodedText: string) => {
        setIsScannerOpen(false);
        const found = materials.find(m => m.id === decodedText);
        if (found) {
            setFormState(prev => ({...prev, selectedMaterial: found.id}));
        } else {
            alert(`Barang dengan ID "${decodedText}" tidak ditemukan atau stok kosong.`);
        }
    };

    const handleEditHistory = (trx: any) => {
        setEditingTransaction(trx);
        setEditForm({
            date: trx.timestamp.split('T')[0],
            shift: trx.shift.replace('Shift ', ''),
            quantity: trx.quantity.toString(),
            notes: trx.notes || ''
        });
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Output Barang Keluar</h1>
            
            {isScannerOpen && (
                <QRScannerModal 
                    onScanSuccess={handleScanSuccess} 
                    onClose={() => setIsScannerOpen(false)} 
                />
            )}

            <ConfirmationModal
                isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDeleteTransaction}
                title="Hapus Transaksi?" message="Apakah Anda yakin ingin menghapus transaksi keluar ini? Stok akan dikembalikan ke gudang secara otomatis."
                confirmLabel="Ya, Hapus" isDanger={true} isLoading={isDeleting}
            />

            <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md">
                <form onSubmit={handleAddToList} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input id="date" label="Tanggal Transaksi" type="date" value={formState.date} onChange={(e) => setFormState(prev => ({...prev, date: e.target.value}))} required />
                        <Select id="shift" label="Shift" value={formState.shift} onChange={(e) => setFormState(prev => ({...prev, shift: e.target.value}))} required>
                            <option value="1">Shift 1</option>
                            <option value="2">Shift 2</option>
                            {shiftMode === '3' && <option value="3">Shift 3</option>}
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <SearchableSelect id="material" label="Pilih Barang" options={materialOptions} value={formState.selectedMaterial} onChange={(value) => setFormState(prev => ({...prev, selectedMaterial: value}))} placeholder="Ketik nama barang..." />
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsScannerOpen(true)}
                                className="mb-[2px] p-2.5 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 focus:ring-2 focus:ring-primary-500"
                                title="Scan QR Code"
                            >
                                <QrCodeIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div>
                            <Select id="location" label="Lokasi (Stok Tertua Didahulukan)" value={formState.location} onChange={e => setFormState(prev => ({...prev, location: e.target.value}))} required disabled={!formState.selectedMaterial || stockLocations.length === 0}>
                                <option value="" disabled>Pilih Lokasi</option>
                                {stockLocations.map(l => (
                                    <option key={l.location_id} value={l.location_id}>
                                        {`${l.location_name} (Stok: ${l.stock_quantity.toFixed(2)}, Masuk: ${new Date(l.oldest_stock_date).toLocaleDateString('id-ID')})`}
                                    </option>
                                ))}
                                {formState.selectedMaterial && stockLocations.length === 0 && <option value="" disabled>Tidak ada stok di lokasi manapun</option>}
                            </Select>
                        </div>
                    </div>
                    {/* Rest of the form UI remains same... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                             <Input id="quantity" label="Kuantitas" type="number" step="0.01" placeholder="0.00" value={formState.quantity} onChange={(e) => setFormState(prev => ({...prev, quantity: e.target.value}))} required disabled={!formState.location} />
                            {formState.location && (
                               <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Stok tersedia di lokasi ini: <span className="font-semibold text-slate-700 dark:text-slate-200">{availableStock.toFixed(2)} {currentMaterialDetails?.unit}</span></p> 
                            )}
                       </div>
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan (Opsional)</label>
                            <div className="mt-1"><textarea id="notes" rows={2} className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" placeholder="Catatan penggunaan..." value={formState.notes} onChange={(e) => setFormState(prev => ({...prev, notes: e.target.value}))}></textarea></div>
                        </div>
                    </div>
                    <div className="flex justify-end"><Button type="submit" className="w-full sm:w-auto">Tambah ke Daftar</Button></div>
                </form>
            </div>

            {message && <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
            
            {pendingTransactions.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md border-2 border-primary-100 dark:border-primary-900">
                    <h2 className="text-xl font-semibold mb-4 text-primary-700 dark:text-primary-300">Daftar Antrian Simpan</h2>
                    <div className="overflow-x-auto -mx-6 sm:-mx-8 mb-4">
                       <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Barang</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lokasi</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kuantitas</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Catatan</th><th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Aksi</th></tr></thead>
                            <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                                {pendingTransactions.map((trx, index) => (
                                    <tr key={index}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{trx.materialName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.locationName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.quantity.toFixed(2)} {trx.materialUnit}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate">{trx.notes || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => handleRemoveFromList(index)} className="text-red-600 hover:text-red-900 font-semibold">Hapus</button></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Button onClick={handleSaveAll} isLoading={isLoading} className="w-full">Simpan Semua Transaksi</Button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md mt-8">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Riwayat Barang Keluar</h2>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="w-full md:w-auto"><input type="date" className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:bg-slate-800 dark:text-slate-100" value={filterDate} onChange={e => { setFilterDate(e.target.value); setHistoryPage(1); }} /></div>
                        <div className="w-full md:w-auto"><select className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:bg-slate-800 dark:text-slate-100" value={filterShift} onChange={e => { setFilterShift(e.target.value); setHistoryPage(1); }}><option value="">Semua Shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option>{shiftMode === '3' && <option value="3">Shift 3</option>}</select></div>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-6 sm:-mx-8">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Waktu Input</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Barang</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lokasi</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kuantitas</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Shift</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Catatan</th><th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Aksi</th></tr></thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {recentHistory.length > 0 ? recentHistory.map((trx) => {
                                const isAdmin = user?.user_metadata?.role === 'admin';
                                const isOwner = trx.pic === user?.email;
                                const canModify = isAdmin || (isOwner && new Date(trx.timestamp).toDateString() === new Date().toDateString());
                                return (
                                    <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(trx.timestamp).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{trx.materials?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.locations?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 dark:text-red-400">-{trx.quantity} {trx.materials?.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.shift}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate">{trx.notes || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{canModify ? <><button onClick={() => handleEditHistory(trx)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button><button onClick={() => setDeleteId(trx.id)} className="text-red-600 hover:text-red-900">Hapus</button></> : <span className="text-xs text-slate-400 italic">Terkunci</span>}</td>
                                    </tr>
                                );
                            }) : <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">Tidak ada data yang sesuai.</td></tr>}
                        </tbody>
                    </table>
                </div>

                 {historyTotal > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                        <div className="flex gap-2">
                            <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Sebelumnya</button>
                            <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Berikutnya</button>
                        </div>
                        <div className="hidden sm:block text-sm text-slate-500">Halaman {historyPage} dari {totalPages}</div>
                    </div>
                )}
            </div>

             {isEditModalOpen && editingTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Transaksi Keluar</h3><p className="text-sm text-slate-500">{editingTransaction.materials?.name}</p></div>
                        <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
                            <Input id="edit-date" label="Tanggal" type="date" value={editForm.date} onChange={e => setEditForm(prev => ({...prev, date: e.target.value}))} required />
                            <Select id="edit-shift" label="Shift" value={editForm.shift} onChange={e => setEditForm(prev => ({...prev, shift: e.target.value}))} required>
                                <option value="1">Shift 1</option>
                                <option value="2">Shift 2</option>
                                {shiftMode === '3' && <option value="3">Shift 3</option>}
                            </Select>
                            <Input id="edit-quantity" label="Kuantitas" type="number" step="0.01" value={editForm.quantity} onChange={e => setEditForm(prev => ({...prev, quantity: e.target.value}))} required />
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label><textarea className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 sm:text-sm" rows={2} value={editForm.notes} onChange={e => setEditForm(prev => ({...prev, notes: e.target.value}))}></textarea></div>
                            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-100 dark:border-yellow-900/50"><p className="text-xs text-yellow-700 dark:text-yellow-400">Perhatian: Mengubah kuantitas akan memperbarui stok saat ini.</p></div>
                            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Batal</button><Button type="submit" isLoading={isLoading} className="w-auto">Simpan</Button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutputMaterial;
