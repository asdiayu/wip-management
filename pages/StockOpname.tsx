
import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { PlusIcon, TrashIcon, CalculatorIcon, ClipboardCheckIcon, CheckCircleIcon, AlertIcon, ArchiveIcon } from '../constants';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useStockOpname, InventoryItem } from '../hooks/useStockOpname';

// Optimized Row Component
const StockOpnameRow = React.memo(({ 
    item, 
    onStockChange, 
    onOpenCalculator 
}: { 
    item: InventoryItem; 
    onStockChange: (id: string, val: string) => void;
    onOpenCalculator: (item: InventoryItem) => void;
}) => {
    const physical = typeof item.physical_stock === 'number' ? item.physical_stock : 0;
    const diff = typeof item.physical_stock === 'number' ? physical - item.system_stock : 0;
    const isUncounted = item.physical_stock === '';
    
    let statusLabel = 'Belum Diisi';
    let statusClass = 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

    if (!isUncounted) {
        if (Math.abs(diff) < 0.0001) {
            statusLabel = 'Sesuai';
            statusClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        } else if (diff > 0) {
            statusLabel = 'Selisih Lebih';
            statusClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        } else {
            statusLabel = 'Selisih Kurang';
            statusClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        }
    }

    return (
        <tr className={`${item.is_modified ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
            <td className="px-6 py-4">
                <div className="text-sm font-bold text-slate-900 dark:text-white">{item.material_name}</div>
                <div className="text-xs text-slate-500">{item.unit}</div>
                {item.is_modified && <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Terisi</span>}
            </td>
            <td className="px-6 py-4 text-center">
                <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{item.system_stock.toFixed(2)}</span>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center justify-center gap-2">
                    <input
                        type="number"
                        className={`block w-32 px-3 py-2 text-right border rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm font-bold
                            ${item.is_modified 
                                ? 'border-blue-500 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300' 
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100'}`}
                        placeholder="0"
                        value={item.physical_stock}
                        onChange={(e) => onStockChange(item.material_id, e.target.value)}
                    />
                    <button 
                        onClick={() => onOpenCalculator(item)}
                        className={`p-2 rounded-md transition-colors ${item.has_breakdown ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}
                        title="Kalkulator Pallet"
                    >
                        <CalculatorIcon className="h-5 w-5" />
                    </button>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                {!isUncounted ? (
                    <span className={`font-bold ${diff === 0 ? 'text-green-600 dark:text-green-400' : diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </span>
                ) : (
                    <span className="text-slate-400">-</span>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                    {statusLabel}
                </span>
            </td>
        </tr>
    );
});

const StockOpname: React.FC = () => {
    const {
        locations, materialOptions, selectedLocation, setSelectedLocation, date, setDate,
        searchQuery, setSearchQuery, loading, submitting, message,
        inventoryList, filteredInventory, paginatedInventory, currentPage, setCurrentPage, totalPages, ITEMS_PER_PAGE,
        draftedLocations, modalOpen, setModalOpen, tempBreakdown, setTempBreakdown,
        addModalOpen, setAddModalOpen, manualMaterialId, setManualMaterialId,
        confirmModalOpen, setConfirmModalOpen, confirmConfig,
        handlePhysicalStockChange, openCalculator, saveBreakdown, handleSaveDraft, handleFinalize, handleAddManual,
        isAdmin, activeMaterialName
    } = useStockOpname();

    return (
        <div className="space-y-8 pb-24">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400">
                        <ClipboardCheckIcon className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Stock Opname</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Hitung stok fisik, simpan draft, dan finalisasi.</p>
                    </div>
                </div>
                {isAdmin && (
                    <Button onClick={handleFinalize} isLoading={submitting} disabled={draftedLocations.length === 0} className="w-full sm:w-auto !bg-indigo-600 hover:!bg-indigo-700 !py-3 !text-base shadow-lg">
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Selesaikan Opname & Update Stok
                    </Button>
                )}
            </div>

            {/* Setup Section */}
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input id="opname_date" label="Tanggal Opname" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Lokasi Gudang</label>
                        <select className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                            <option value="" disabled>-- Pilih Lokasi --</option>
                            {locations.map(l => { const isDrafted = draftedLocations.includes(l.id); return (<option key={l.id} value={l.id}>{l.name} {isDrafted ? '📝 [Draft]' : ''}</option>); })}
                        </select>
                        {selectedLocation && draftedLocations.includes(selectedLocation) && <p className="text-xs text-orange-500 mt-1 font-semibold flex items-center"><AlertIcon className="h-3 w-3 mr-1" /> Lokasi ini memiliki draft tersimpan.</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cari Barang di List</label>
                        <div className="flex gap-2">
                            <input type="text" className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ketik nama barang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            <button onClick={() => setAddModalOpen(true)} disabled={!selectedLocation} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm disabled:bg-slate-400 flex items-center"><PlusIcon className="h-5 w-5 mr-1" /><span className="hidden sm:inline">Manual</span></button>
                        </div>
                    </div>
                </div>
            </div>

            {message && <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}

            {/* Inventory List */}
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div></div>
                ) : paginatedInventory.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Nama Barang</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Stok Sistem</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Stok Fisik</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Selisih</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedInventory.map((item) => (
                                    <StockOpnameRow 
                                        key={item.material_id} 
                                        item={item} 
                                        onStockChange={handlePhysicalStockChange}
                                        onOpenCalculator={openCalculator}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">{selectedLocation ? "Tidak ada stok di lokasi ini. Tambahkan manual jika ada barang fisik." : "Pilih lokasi terlebih dahulu."}</div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="bg-white dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">Sebelumnya</button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">Berikutnya</button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div><p className="text-sm text-slate-700 dark:text-slate-400">Menampilkan <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> sampai <span className="font-medium text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredInventory.length)}</span> dari <span className="font-medium text-slate-900 dark:text-white">{filteredInventory.length}</span> hasil</p></div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"><span className="sr-only">Previous</span><svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                                        <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">Halaman {currentPage} dari {totalPages}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"><span className="sr-only">Next</span><svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Bottom Bar */}
            {inventoryList.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            Total Barang: <span className="font-bold text-slate-900 dark:text-white">{inventoryList.length}</span> | 
                            Diinput: <span className="font-bold text-green-600">{inventoryList.filter(i => i.is_modified).length}</span>
                        </div>
                        <Button onClick={handleSaveDraft} isLoading={submitting} className="w-full sm:w-auto !bg-slate-700 hover:!bg-slate-800">
                            <ArchiveIcon className="h-5 w-5 mr-2" />
                            Simpan Draft (Stok Belum Berubah)
                        </Button>
                    </div>
                </div>
            )}

            {/* Calculator Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
                         <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{activeMaterialName || 'Kalkulator'}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Rincian stok fisik untuk barang ini.</p>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-3">
                                {tempBreakdown.map((row, idx) => (
                                    <div key={row.id} className="flex gap-2 items-center">
                                        <input type="text" className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-sm" value={row.label} onChange={e => setTempBreakdown(prev => prev.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))} placeholder={`Pallet ${idx + 1}`} />
                                        <input type="number" className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 font-bold text-right" value={row.qty} onChange={e => setTempBreakdown(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value } : r))} placeholder="0" />
                                        <button onClick={() => setTempBreakdown(prev => prev.length === 1 ? [{...prev[0], qty: 0}] : prev.filter(r => r.id !== row.id))} className="p-2 text-red-500 hover:bg-red-50 rounded-md"><TrashIcon className="h-5 w-5" /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setTempBreakdown([...tempBreakdown, { id: Date.now(), label: `Pallet ${tempBreakdown.length + 1}`, qty: 0 }])} className="mt-4 text-sm text-primary-600 font-medium hover:underline flex items-center"><PlusIcon className="h-4 w-4 mr-1" /> Tambah Baris</button>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-slate-700 dark:text-slate-200">Total:</span>
                                <span className="text-xl font-bold text-primary-600">{tempBreakdown.reduce((sum, row) => sum + (Number(row.qty) || 0), 0).toFixed(2)}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 font-medium">Batal</button>
                                <Button onClick={saveBreakdown} className="flex-1">Gunakan Total Ini</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Manual Modal */}
            {addModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Tambah Barang Manual</h3>
                        <p className="text-sm text-slate-500 mb-6">Pilih barang yang ditemukan fisik tapi tidak ada di daftar sistem.</p>
                        <SearchableSelect id="manual-add" label="Cari Barang" options={materialOptions} value={manualMaterialId} onChange={setManualMaterialId} placeholder="Ketik nama barang..." />
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Batal</button>
                            <Button onClick={handleAddManual} disabled={!manualMaterialId} className="w-auto">Tambah ke List</Button>
                        </div>
                    </div>
                </div>
            )}

             {/* Confirmation Modal */}
             {confirmModalOpen && confirmConfig && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border-t-4 border-indigo-500">
                        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{confirmConfig.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmConfig.message}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-200">Batal</button>
                            <Button onClick={confirmConfig.action} className="w-auto !bg-indigo-600 hover:!bg-indigo-700">Ya, Proses Sekarang</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockOpname;
