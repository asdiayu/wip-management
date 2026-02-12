
import React from 'react';
import { TrendingUpIcon, ArchiveIcon, AlertIcon, CheckCircleIcon, CalculatorIcon, CalendarIcon } from '../constants';
import Button from '../components/ui/Button';
import { useAnalyticsLogic } from '../hooks/useAnalyticsLogic';

const MONTHS = [
    { v: 0, l: 'Semua Bulan (Tahun Ini)' },
    { v: 1, l: 'Januari' }, { v: 2, l: 'Februari' }, { v: 3, l: 'Maret' },
    { v: 4, l: 'April' }, { v: 5, l: 'Mei' }, { v: 6, l: 'Juni' },
    { v: 7, l: 'Juli' }, { v: 8, l: 'Agustus' }, { v: 9, l: 'September' },
    { v: 10, l: 'Oktober' }, { v: 11, l: 'November' }, { v: 12, l: 'Desember' }
];

const Analytics: React.FC = () => {
    const { 
        activeTab, setActiveTab, loading, 
        forecastData, slowMovingData, abcData, overstockData, absorptionData, 
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        handleExport, years 
    } = useAnalyticsLogic();

    return (
        <div className="space-y-8 pb-12">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Analisa Data & Optimasi</h1>
            
            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('forecast')} className={`flex-1 min-w-[140px] py-4 flex justify-center items-center gap-2 transition-colors ${activeTab === 'forecast' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><TrendingUpIcon className="h-5 w-5" /> Forecast</button>
                    <button onClick={() => setActiveTab('absorption')} className={`flex-1 min-w-[140px] py-4 flex justify-center items-center gap-2 transition-colors ${activeTab === 'absorption' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b-2 border-green-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CalculatorIcon className="h-5 w-5" /> Penyerapan</button>
                    <button onClick={() => setActiveTab('abc')} className={`flex-1 min-w-[140px] py-4 flex justify-center items-center gap-2 transition-colors ${activeTab === 'abc' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CheckCircleIcon className="h-5 w-5" /> Pareto (ABC)</button>
                    <button onClick={() => setActiveTab('overstock')} className={`flex-1 min-w-[140px] py-4 flex justify-center items-center gap-2 transition-colors ${activeTab === 'overstock' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b-2 border-red-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><AlertIcon className="h-5 w-5" /> Overstock</button>
                    <button onClick={() => setActiveTab('slow_moving')} className={`flex-1 min-w-[140px] py-4 flex justify-center items-center gap-2 transition-colors ${activeTab === 'slow_moving' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-b-2 border-orange-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ArchiveIcon className="h-5 w-5" /> Slow Moving</button>
                </div>

                <div className="p-6 min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div></div>
                    ) : (
                        <>
                            {/* Header Filter (Hanya tampil di tab yang relevan dengan filter waktu) */}
                            {['absorption', 'abc', 'slow_moving'].includes(activeTab) && (
                                <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl gap-4 border border-slate-200 dark:border-slate-700">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 capitalize">
                                            Analisa {activeTab.replace('_', ' ')}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                            Periode Analisa: {selectedMonth === 0 ? `Tahun ${selectedYear}` : `${MONTHS.find(m => m.v === selectedMonth)?.l} ${selectedYear}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                        <div className="flex items-center gap-2 flex-1 sm:flex-none">
                                            <div className="relative">
                                                <select 
                                                    value={selectedMonth} 
                                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                                    className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none font-medium"
                                                >
                                                    {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                                </select>
                                                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400"><CalendarIcon className="h-4 w-4" /></div>
                                            </div>
                                            <select 
                                                value={selectedYear} 
                                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                                className="pl-3 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none font-bold"
                                            >
                                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <Button onClick={() => handleExport(activeTab)} className="flex-1 sm:flex-none !bg-slate-700 hover:!bg-slate-800 !px-4 text-xs font-bold uppercase tracking-wider">CSV</Button>
                                    </div>
                                </div>
                            )}

                            {/* TAB: ABSORPTION */}
                            {activeTab === 'absorption' && (
                                <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nama Barang</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total In*</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Out</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Rasio</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800/20 divide-y divide-slate-200 dark:divide-slate-700">
                                            {absorptionData.map(i => (
                                                <tr key={i.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{i.material_name}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">{i.total_in.toLocaleString('id-ID')}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">{i.total_out.toLocaleString('id-ID')}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-xs font-black ${i.absorption_rate > 100 ? 'text-blue-600' : i.absorption_rate > 80 ? 'text-green-600' : i.absorption_rate > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                {i.absorption_rate.toFixed(1)}%
                                                            </span>
                                                            <div className="w-16 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                                <div 
                                                                    className={`h-full transition-all duration-500 ${i.absorption_rate > 100 ? 'bg-blue-500' : i.absorption_rate > 80 ? 'bg-green-500' : i.absorption_rate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${Math.min(i.absorption_rate, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-[8px] font-bold tracking-tight uppercase border shadow-sm ${
                                                            i.status === 'Sangat Efisien' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                            i.status === 'Efisien' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            i.status === 'Penumpukan' ? 'bg-red-50 text-red-600 border-red-200' : 
                                                            i.status === 'Over-absorbed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                                            'bg-slate-50 text-slate-500 border-slate-200'
                                                        }`}>
                                                            {i.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* TAB: FORECAST (Real-time 30 days) */}
                            {activeTab === 'forecast' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-blue-800 dark:text-blue-200">Forecast Stok (Real-time)</h3>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 italic">Estimasi hari habis dihitung dari pemakaian nyata 30 hari terakhir.</p>
                                        </div>
                                        <Button onClick={() => handleExport('forecast')} className="w-auto !bg-blue-600 !px-4 text-xs font-bold uppercase">Export</Button>
                                    </div>
                                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nama Barang</th>
                                                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Stok Saat Ini</th>
                                                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Habis Dalam</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-slate-800/20 divide-y divide-slate-200 dark:divide-slate-700">
                                                {forecastData.map(i => (
                                                    <tr key={i.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{i.material_name}</td>
                                                        <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">{i.current_stock.toFixed(1)} {i.unit}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${i.days_to_empty < 7 ? 'bg-red-100 text-red-800' : i.days_to_empty < 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                                {i.days_to_empty > 365 ? '> 1 Tahun' : `${i.days_to_empty.toFixed(1)} Hari`}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB: ABC */}
                            {activeTab === 'abc' && (
                                <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Kelas</th>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Nama Barang</th>
                                                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Usage (Periode)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800/20 divide-y divide-slate-200 dark:divide-slate-700">
                                            {abcData.map(i => (
                                                <tr key={i.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-md text-[8px] font-black ${i.class === 'A' ? 'bg-green-100 text-green-800' : i.class === 'B' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>KELAS {i.class}</span></td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{i.material_name}</td>
                                                    <td className="px-6 py-4 text-right text-sm text-slate-500 dark:text-slate-300">{i.usage_qty.toFixed(1)} {i.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* TAB: OVERSTOCK */}
                            {activeTab === 'overstock' && (
                                <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Barang</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Stok Saat Ini</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Coverage</th>
                                                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800/20 divide-y divide-slate-200 dark:divide-slate-700">
                                            {overstockData.map(i => (
                                                <tr key={i.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{i.material_name}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-slate-500 dark:text-slate-300">{i.current_stock.toFixed(1)} {i.unit}</td>
                                                    <td className="px-6 py-4 text-center text-sm font-bold text-red-500">{i.coverage_days.toFixed(0)} Hari</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-50 text-red-600 border border-red-100 uppercase">Overstock</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {overstockData.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">Tidak ada barang terdeteksi Overstock (&gt;90 hari).</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* TAB: SLOW MOVING */}
                            {activeTab === 'slow_moving' && (
                                <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Barang Pantau (Zero Out)</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Stok Gudang</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aktivitas Terakhir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-800/20 divide-y divide-slate-200 dark:divide-slate-700">
                                            {slowMovingData.map(i => (
                                                <tr key={i.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{i.material_name}</td>
                                                    <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">{i.current_stock.toLocaleString('id-ID')} {i.unit}</td>
                                                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                                                        {i.last_transaction_date ? new Date(i.last_transaction_date).toLocaleDateString('id-ID') : 'Belum Ada Transaksi'}
                                                    </td>
                                                </tr>
                                            ))}
                                            {slowMovingData.length === 0 && <tr><td colSpan={3} className="text-center py-12 text-slate-400 text-sm italic">Semua barang memiliki pergerakan di periode ini.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
