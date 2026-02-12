
import React, { Fragment } from 'react';
import { Material } from '../types';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { EyeIcon, ClipboardCheckIcon, AlertIcon } from '../constants';
import { useStockLogic } from '../hooks/useStockLogic';
import { formatNumber } from '../utils/formatHelper';

interface StockDetail {
    location_id: string | null;
    location_name: string;
    stock_quantity: number;
}

// 1. Memoized Row Component (Kept here for presentation logic)
const StockRow = React.memo(({ 
    item, 
    visibleColumns, 
    displayedStock, 
    onRowClick, 
    isExpanded, 
    colSpan,
    detailLoading,
    details,
    selectedLocation
}: {
    item: Material;
    visibleColumns: { department: boolean; machine: boolean };
    displayedStock: number;
    onRowClick: (id: string) => void;
    isExpanded: boolean;
    colSpan: number;
    detailLoading: boolean;
    details: StockDetail[] | undefined;
    selectedLocation: string;
}) => {
    return (
        <Fragment>
            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isExpanded ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => onRowClick(item.id)} className="text-primary-600 dark:text-primary-400 hover:underline focus:outline-none font-semibold text-left">
                        {item.name}
                    </button>
                </td>
                {visibleColumns.department && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{item.department || '-'}</td>
                )}
                {visibleColumns.machine && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{item.machine_number || '-'}</td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900 dark:text-white">
                    {formatNumber(displayedStock)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{item.unit}</span>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <td colSpan={colSpan} className="p-4">
                        {detailLoading ? (
                            <div className="flex justify-center items-center py-6">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                                <span className="ml-3 text-sm text-slate-500">Menghitung rincian lokasi...</span>
                            </div>
                        ) : details && details.length > 0 ? (
                            <div className="pl-6 bg-white dark:bg-slate-800/40 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                                <h4 className="font-bold text-sm mb-4 text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2">Rincian Stok per Lokasi:</h4>
                                <table className="min-w-full">
                                    <thead>
                                        <tr>
                                            <th className="text-left py-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lokasi</th>
                                            <th className="text-right py-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Jumlah Stok</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {details.map((detail, idx) => (
                                            <tr key={detail.location_id || idx} className={detail.location_id === selectedLocation ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}>
                                                <td className="py-2 text-sm text-slate-700 dark:text-slate-200 flex items-center">
                                                    {!detail.location_id && <AlertIcon className="h-3 w-3 text-yellow-500 mr-2" />}
                                                    {detail.location_name}
                                                </td>
                                                <td className="py-2 text-sm text-right text-slate-800 dark:text-slate-100 font-mono font-bold">{formatNumber(detail.stock_quantity)} {item.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                                    <span className="text-xs text-slate-500 italic">Total Terverifikasi:</span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatNumber(details.reduce((sum, d) => sum + d.stock_quantity, 0))} {item.unit}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                                <AlertIcon className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm font-medium">Stok master tersedia ({formatNumber(displayedStock)}), namun tidak terdeteksi di histori lokasi.</p>
                                <p className="text-xs opacity-60">Gunakan Sinkronisasi di menu Database jika selisih permanen.</p>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </Fragment>
    );
});

const Stock: React.FC = () => {
    const {
        locations, loading, isPending,
        inputValue, handleSearchChange,
        selectedDepartment, setSelectedDepartment,
        selectedLocation, setSelectedLocation,
        currentPage, setCurrentPage, ITEMS_PER_PAGE,
        expandedRow, detailLoading, stockDetails, handleRowClick,
        showColumnMenu, setShowColumnMenu, visibleColumns, toggleColumn,
        uniqueDepartments, filteredMaterials, paginatedMaterials, totalPages,
        getDisplayedStock, totalFilteredStock, displayUnit,
        handleExportCsv, handleExportExcel, handleCopyForWhatsApp
    } = useStockLogic();

    const activeColSpan = 2 + (visibleColumns.department ? 1 : 0) + (visibleColumns.machine ? 1 : 0);

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Stok Barang</h1>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button onClick={handleCopyForWhatsApp} disabled={filteredMaterials.length === 0} className="w-full sm:w-auto !bg-teal-600 hover:!bg-teal-700 focus:!ring-teal-500">
                        <ClipboardCheckIcon className="h-5 w-5 mr-2" />
                        Copy WA
                    </Button>
                    <Button onClick={handleExportCsv} disabled={filteredMaterials.length === 0} className="w-full sm:w-auto !bg-slate-600 hover:!bg-slate-700 focus:!ring-slate-500">
                        Ekspor ke CSV
                    </Button>
                    <Button onClick={handleExportExcel} disabled={filteredMaterials.length === 0} className="w-full sm:w-auto !bg-green-600 hover:!bg-green-700 focus:!ring-green-500">
                        Ekspor ke Excel
                    </Button>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
                        <div className="flex flex-col md:flex-row gap-4 w-full lg:flex-1">
                            <div className="w-full md:flex-1">
                                <Input id="search" label="Cari Barang" type="text" placeholder="Ketik nama barang..." value={inputValue} onChange={handleSearchChange} />
                                {isPending && <p className="text-xs text-slate-400 mt-1">Memfilter...</p>}
                            </div>
                            <div className="w-full md:w-48">
                                <Select id="location" label="Filter Lokasi" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
                                    <option value="">Semua Lokasi</option>
                                    {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                                </Select>
                            </div>
                            <div className="w-full md:w-48">
                                <Select id="department" label="Filter Departemen" value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                                    <option value="">Semua Departemen</option>
                                    {uniqueDepartments.map(dept => (<option key={dept as string} value={dept as string}>{dept as string}</option>))}
                                </Select>
                            </div>
                            
                            <div className="relative flex items-end">
                                <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="flex items-center justify-center px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none" title="Atur Kolom Tabel"><EyeIcon className="h-5 w-5 mr-2" /><span className="hidden sm:inline">Atur Kolom</span></button>
                                {showColumnMenu && (
                                    <div className="absolute top-full right-0 left-0 sm:left-auto mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-20 p-2">
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">Tampilkan Kolom:</p>
                                        <label className="flex items-center p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"><input type="checkbox" checked={visibleColumns.department} onChange={() => toggleColumn('department')} className="rounded text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-slate-700 dark:text-slate-200">Departemen</span></label>
                                        <label className="flex items-center p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"><input type="checkbox" checked={visibleColumns.machine} onChange={() => toggleColumn('machine')} className="rounded text-primary-600 focus:ring-primary-500" /><span className="ml-2 text-sm text-slate-700 dark:text-slate-200">No Mesin</span></label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="w-full lg:w-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-6 py-2 flex flex-col items-center lg:items-end justify-center min-w-[200px]">
                             <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Stok ({selectedLocation ? 'Lokasi' : 'Global'})</span>
                             <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatNumber(totalFilteredStock)}</span>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{displayUnit}</span>
                             </div>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Nama Barang</th>
                                {visibleColumns.department && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Departemen</th>}
                                {visibleColumns.machine && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">No Mesin</th>}
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">{selectedLocation ? 'Stok (Lokasi)' : 'Stok Total'}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={activeColSpan} className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto"></div></td></tr>
                            ) : paginatedMaterials.length > 0 ? paginatedMaterials.map(item => (
                                <StockRow 
                                    key={item.id}
                                    item={item}
                                    visibleColumns={visibleColumns}
                                    displayedStock={getDisplayedStock(item)}
                                    onRowClick={handleRowClick}
                                    isExpanded={expandedRow === item.id}
                                    colSpan={activeColSpan}
                                    detailLoading={detailLoading === item.id}
                                    details={stockDetails[item.id]}
                                    selectedLocation={selectedLocation}
                                />
                            )) : (
                                <tr><td colSpan={activeColSpan} className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada barang yang cocok dengan pencarian.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="bg-white dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">Sebelumnya</button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">Berikutnya</button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div><p className="text-sm text-slate-700 dark:text-slate-400">Menampilkan <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> sampai <span className="font-medium text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredMaterials.length)}</span> dari <span className="font-medium text-slate-900 dark:text-white">{filteredMaterials.length}</span> hasil</p></div>
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
        </div>
    );
};

export default Stock;
