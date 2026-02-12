
import React, { useMemo } from 'react';
import Button from '../components/ui/Button';
import MultiSelect from '../components/ui/MultiSelect';
import ReceiptModal from '../components/ui/ReceiptModal';
import { ClipboardCheckIcon } from '../constants';
import { useReportLogic } from '../hooks/useReportLogic';

const TYPE_OPTIONS = [
    { value: 'INITIAL', label: 'Stok Awal (INITIAL)' },
    { value: 'IN', label: 'Barang Masuk (IN)' },
    { value: 'OUT', label: 'Barang Keluar (OUT)' },
    { value: 'TRANSFER_IN', label: 'Mutasi Masuk (TRF IN)' },
    { value: 'TRANSFER_OUT', label: 'Mutasi Keluar (TRF OUT)' },
    { value: 'RETURN_IN', label: 'Retur Customer (RET IN)' },
    { value: 'RETURN_OUT', label: 'Retur Supplier (RET OUT)' },
];

const Report: React.FC = () => {
    const {
        materials, locations, loading, user,
        startDate, setStartDate, endDate, setEndDate,
        selectedMaterial, setSelectedMaterial, selectedLocation, setSelectedLocation,
        selectedTypes, setSelectedTypes, selectedShifts, setSelectedShifts,
        currentPage, setCurrentPage, ITEMS_PER_PAGE, totalPages,
        filteredTransactions, paginatedTransactions, totalIn, totalOut, totalNet,
        showReceipt, setShowReceipt, receiptData, receiptShift, receiptDate,
        handleExportExcel, handleGenerateReceipt
    } = useReportLogic();

    // Dinamis Shift Options
    const shiftOptions = useMemo(() => {
        const saved = localStorage.getItem('app_display_settings');
        const mode = saved ? JSON.parse(saved).shiftMode || '2' : '2';
        
        const base = [
            { value: 'Shift 1', label: 'Shift 1' },
            { value: 'Shift 2', label: 'Shift 2' },
        ];
        
        if (mode === '3') base.push({ value: 'Shift 3', label: 'Shift 3' });
        
        return [
            ...base,
            { value: 'Initial', label: 'Initial' }, 
            { value: 'Transfer', label: 'Transfer' },
            { value: 'Return', label: 'Return' }, 
            { value: 'Adjustment', label: 'Adjustment' },
        ];
    }, []);

    const getTypeColor = (type: string) => {
        switch(type) {
            case 'IN': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
            case 'OUT': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
            case 'INITIAL': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
            case 'TRANSFER_IN': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200';
            case 'TRANSFER_OUT': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200';
            case 'RETURN_IN': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200';
            case 'RETURN_OUT': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <ReceiptModal isOpen={showReceipt} onClose={() => setShowReceipt(false)} items={receiptData} type="MIXED" date={receiptDate} pic={user?.email || 'User'} shift={receiptShift} />

            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Laporan Transaksi</h1>
                <div className="flex gap-2 w-full sm:w-auto">
                    {filteredTransactions.length > 0 && (
                        <Button onClick={handleGenerateReceipt} className="w-full sm:w-auto !bg-blue-600 hover:!bg-blue-700 !flex !items-center !justify-center !gap-2">
                            <ClipboardCheckIcon className="h-5 w-5" /> Bukti Gabungan ({filteredTransactions.length})
                        </Button>
                    )}
                    <Button onClick={handleExportExcel} disabled={filteredTransactions.length === 0} className="w-full sm:w-auto !bg-green-600 hover:!bg-green-700">Export Excel</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                    <div><label className="block text-sm font-medium mb-1">Dari Tanggal</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-md dark:border-slate-600" /></div>
                    <div><label className="block text-sm font-medium mb-1">Sampai Tanggal</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-md dark:border-slate-600" /></div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Barang</label>
                        <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-md dark:border-slate-600">
                            <option value="">Semua Barang</option>{materials.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lokasi</label>
                        <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-md dark:border-slate-600">
                            <option value="">Semua Lokasi</option>{locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MultiSelect label="Tipe Transaksi" options={TYPE_OPTIONS} selectedValues={selectedTypes} onChange={setSelectedTypes} placeholder="Semua Tipe" />
                    <MultiSelect label="Shift" options={shiftOptions} selectedValues={selectedShifts} onChange={setSelectedShifts} placeholder="Semua Shift" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-l-4 border-green-500">
                    <h3 className="text-sm font-medium text-slate-500">Total Masuk</h3><p className="text-2xl font-bold">{totalIn.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-l-4 border-red-500">
                    <h3 className="text-sm font-medium text-slate-500">Total Keluar</h3><p className="text-2xl font-bold">{totalOut.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-l-4 border-blue-500">
                    <h3 className="text-sm font-medium text-slate-500">Selisih Netto</h3><p className="text-2xl font-bold">{totalNet.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-4 text-left text-xs font-bold uppercase">Tanggal</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">Nama Barang</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">Kuantitas</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">Lokasi</th><th className="px-6 py-4 text-center text-xs font-bold uppercase">Tipe</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">Shift</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">PIC</th><th className="px-6 py-4 text-left text-xs font-bold uppercase">Catatan</th></tr></thead>
                        <tbody className="bg-white dark:bg-slate-800/30 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? <tr><td colSpan={8} className="text-center py-10">Loading...</td></tr> : paginatedTransactions.length > 0 ? paginatedTransactions.map((trx) => {
                                const isPositive = ['IN', 'TRANSFER_IN', 'RETURN_IN', 'INITIAL'].includes(trx.type);
                                return (
                                    <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(trx.timestamp).toLocaleString('id-ID')}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{trx.material_name}</td>
                                        <td className={`px-6 py-4 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{isPositive ? '+' : '-'} {trx.quantity.toLocaleString('id-ID')} <span className="text-xs text-slate-500">{trx.material_unit}</span></td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{trx.location_name || '-'}</td>
                                        <td className="px-6 py-4 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(trx.type)}`}>{trx.type}</span></td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{trx.shift}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{trx.pic || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{trx.notes || '-'}</td>
                                    </tr>
                                );
                            }) : <tr><td colSpan={8} className="text-center py-10 text-slate-500">Tidak ada data.</td></tr>}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="bg-white dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border rounded-md disabled:opacity-50">Sebelumnya</button>
                        <p className="text-sm self-center">Hal {currentPage} dari {totalPages}</p>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border rounded-md disabled:opacity-50">Berikutnya</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Report;
