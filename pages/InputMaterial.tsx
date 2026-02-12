
import React, { useRef, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SearchableSelect from '../components/ui/SearchableSelect';
import Select from '../components/ui/Select';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import QRScannerModal from '../components/ui/QRScannerModal';
import { ArchiveIcon, QrCodeIcon } from '../constants';
import { useInputTransaction } from '../hooks/useInputTransaction';

const InputMaterial: React.FC = () => {
    const {
        materials, locations, pendingTransactions, recentHistory, historyTotal, totalPages,
        formState, setFormState,
        historyPage, setHistoryPage, filterDate, setFilterDate, filterShift, setFilterShift,
        isLoading, message, deleteId, setDeleteId, isDeleting,
        isEditModalOpen, setIsEditModalOpen, editingTransaction, setEditingTransaction, editForm, setEditForm,
        handleAddToList, handleRemoveFromList, handleSaveAll, handleDeleteTransaction, handleUpdateTransaction,
        isAdmin, user
    } = useInputTransaction();

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const quantityInputRef = useRef<HTMLInputElement>(null);
    const materialInputRef = useRef<HTMLInputElement>(null);

    // Ambil mode shift dari settings
    const shiftMode = useMemo(() => {
        const saved = localStorage.getItem('app_display_settings');
        return saved ? JSON.parse(saved).shiftMode || '2' : '2';
    }, []);

    const onSubmit = (e: React.FormEvent) => {
        if (handleAddToList(e)) {
            setTimeout(() => materialInputRef.current?.focus(), 100);
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        setIsScannerOpen(false);
        // decodedText is the Material ID from QR
        const foundMaterial = materials.find(m => m.id === decodedText);
        
        if (foundMaterial) {
            setFormState(prev => ({
                ...prev, 
                selectedMaterial: foundMaterial.id,
                location: foundMaterial.default_location_id || prev.location
            }));
            // Auto focus to quantity after scan
            setTimeout(() => {
                quantityInputRef.current?.focus();
                quantityInputRef.current?.select();
            }, 300);
        } else {
            alert(`Barang dengan ID "${decodedText}" tidak ditemukan di database.`);
        }
    };

    const handleEditClick = (trx: any) => {
        setEditingTransaction(trx);
        setEditForm({
            date: trx.timestamp.split('T')[0],
            shift: trx.shift === 'Initial' ? 'Initial' : trx.shift.replace('Shift ', ''),
            location_id: trx.location_id || '',
            quantity: trx.quantity.toString(),
            notes: trx.notes || ''
        });
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-4 sm:space-y-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Input Barang Masuk</h1>

            {isScannerOpen && (
                <QRScannerModal 
                    onScanSuccess={handleScanSuccess} 
                    onClose={() => setIsScannerOpen(false)} 
                />
            )}

            <ConfirmationModal
                isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDeleteTransaction}
                title="Hapus Transaksi?" message="Apakah Anda yakin ingin menghapus riwayat transaksi ini? Stok akan dikembalikan secara otomatis."
                confirmLabel="Ya, Hapus" isDanger={true} isLoading={isDeleting}
            />

            <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md">
                {isAdmin && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-200"><ArchiveIcon className="h-5 w-5" /></div><div><h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">Mode Stok Awal?</h3><p className="text-xs text-blue-600 dark:text-blue-300">Centang ini jika Anda memasukkan saldo awal sistem.</p></div></div>
                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formState.isInitialStock} onChange={(e) => setFormState({...formState, isInitialStock: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div></label>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input id="date" label="Tanggal" type="date" value={formState.date} onChange={e => setFormState({...formState, date: e.target.value})} required />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Shift</label>
                            <select id="shift" className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-700" value={formState.isInitialStock ? 'Initial' : formState.shift} onChange={e => setFormState({...formState, shift: e.target.value})} disabled={formState.isInitialStock} required>
                                <option value="1">Shift 1</option>
                                <option value="2">Shift 2</option>
                                {shiftMode === '3' && <option value="3">Shift 3</option>}
                                {formState.isInitialStock && <option value="Initial">Saldo Awal</option>}
                            </select>
                        </div>
                        <Select id="location" label="Lokasi" value={formState.location} onChange={e => setFormState({...formState, location: e.target.value})} required>
                            <option value="" disabled>Pilih Lokasi</option>{locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                        </Select>
                    </div>
                    {/* Rest of the form remains same... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <SearchableSelect ref={materialInputRef} id="material" label="Pilih Barang (Enter untuk pindah)" options={materials.map(m => ({ value: m.id, label: m.name }))} value={formState.selectedMaterial} onChange={(value) => { const mat = materials.find(m => m.id === value); setFormState(prev => ({...prev, selectedMaterial: value, location: mat?.default_location_id || prev.location})); setTimeout(() => { quantityInputRef.current?.focus(); quantityInputRef.current?.select(); }, 50); }} placeholder="Ketik nama barang..." />
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
                             <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Kuantitas (Enter untuk simpan)</label>
                            <div className="mt-1"><input ref={quantityInputRef} id="quantity" type="number" step="0.01" placeholder="0.00" className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={formState.quantity} onChange={(e) => setFormState({...formState, quantity: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && onSubmit(e)} required /></div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan (Opsional)</label>
                        <div className="mt-1"><textarea id="notes" rows={2} className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" placeholder={formState.isInitialStock ? "Saldo Awal..." : "Catatan penerimaan..."} value={formState.notes} onChange={(e) => setFormState({...formState, notes: e.target.value})}></textarea></div>
                    </div>
                    <div className="flex justify-end"><Button type="submit" className="w-full sm:w-auto">Tambah ke Daftar</Button></div>
                </form>
            </div>
            {/* History section remains same, ensuring handleEditClick works with shiftMode... */}
            {message && <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}

            {pendingTransactions.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md border-2 border-primary-100 dark:border-primary-900">
                    <h2 className="text-xl font-semibold mb-4 text-primary-700 dark:text-primary-300">Daftar Antrian Simpan</h2>
                    <div className="overflow-x-auto -mx-6 sm:-mx-8 mb-4">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Tipe</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Barang</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Lokasi</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Kuantitas</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Catatan</th><th className="px-6 py-3 text-right text-xs font-medium text-slate-500">Aksi</th></tr></thead>
                            <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">{pendingTransactions.map((trx, index) => (<tr key={index}><td className="px-6 py-4 whitespace-nowrap text-sm">{trx.isInitial ? <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">STOK AWAL</span> : <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">MASUK</span>}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{trx.materialName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.locationName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.quantity.toFixed(2)} {trx.materialUnit}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate">{trx.notes || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => handleRemoveFromList(index)} className="text-red-600 hover:text-red-900 font-semibold">Hapus</button></td></tr>))}</tbody>
                        </table>
                    </div>
                    <Button onClick={handleSaveAll} isLoading={isLoading} className="w-full">Simpan Semua Transaksi</Button>
                </div>
            )}

             <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Riwayat Transaksi</h2>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="w-full md:w-auto"><input type="date" className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:bg-slate-800 dark:text-slate-100" value={filterDate} onChange={e => { setFilterDate(e.target.value); setHistoryPage(1); }} /></div>
                        <div className="w-full md:w-auto"><select className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm dark:bg-slate-800 dark:text-slate-100" value={filterShift} onChange={e => { setFilterShift(e.target.value); setHistoryPage(1); }}><option value="">Semua Shift</option><option value="1">Shift 1</option><option value="2">Shift 2</option>{shiftMode === '3' && <option value="3">Shift 3</option>}<option value="Initial">Saldo Awal</option></select></div>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-6 sm:-mx-8">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Waktu</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Tipe</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Barang</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Lokasi</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Qty</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Shift</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500">Catatan</th><th className="px-6 py-3 text-right text-xs font-medium text-slate-500">Aksi</th></tr></thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {recentHistory.length > 0 ? recentHistory.map((trx) => {
                                const canModify = isAdmin || (trx.pic === user?.email && new Date(trx.timestamp).toDateString() === new Date().toDateString());
                                return (
                                    <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(trx.timestamp).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{trx.shift === 'Initial' ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">INITIAL</span> : <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">IN</span>}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{trx.materials?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.locations?.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">+{trx.quantity} {trx.materials?.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{trx.shift}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate">{trx.notes || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{canModify ? <><button onClick={() => handleEditClick(trx)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button><button onClick={() => setDeleteId(trx.id)} className="text-red-600 hover:text-red-900">Hapus</button></> : <span className="text-xs text-slate-400 italic">Terkunci</span>}</td>
                                    </tr>
                                );
                            }) : <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">Tidak ada data yang sesuai.</td></tr>}
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
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 className="text-xl font-bold text-slate-900 dark:text-white">Edit Transaksi</h3><p className="text-sm text-slate-500">{editingTransaction.materials?.name}</p></div>
                        <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
                            <Input id="edit-date" label="Tanggal" type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} required />
                            {editForm.shift !== 'Initial' && (
                                <Select id="edit-shift" label="Shift" value={editForm.shift} onChange={e => setEditForm({...editForm, shift: e.target.value})} required>
                                    <option value="1">Shift 1</option>
                                    <option value="2">Shift 2</option>
                                    {shiftMode === '3' && <option value="3">Shift 3</option>}
                                </Select>
                            )}
                            <Select id="edit-location" label="Lokasi" value={editForm.location_id} onChange={e => setEditForm({...editForm, location_id: e.target.value})} required>{locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}</Select>
                            <Input id="edit-quantity" label="Kuantitas" type="number" step="0.01" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: e.target.value})} required />
                            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label><textarea className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 sm:text-sm" rows={2} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})}></textarea></div>
                            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Batal</button><Button type="submit" isLoading={isLoading} className="w-auto">Simpan</Button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InputMaterial;
