
import React from 'react';
import { Link } from 'react-router-dom';
import { useDashboardLogic, TrendDataPoint, StockAlertMaterial, Location } from '../hooks/useDashboardLogic';
import Card from '../components/ui/Card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ReportIcon, InputIcon, OutputIcon, AlertIcon, TrendingUpIcon, ArchiveIcon, SettingsIcon, StockIcon, CalendarIcon } from '../constants';
import { formatNumber } from '../utils/formatHelper';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const isBarChart = payload[0].payload.masuk !== undefined;
        if (isBarChart) {
            const data = payload[0].payload as TrendDataPoint;
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-w-xs z-50 text-xs">
                    <p className="font-bold mb-2 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">{data.fullDate}</p>
                    <div className="mb-3">
                        <p className="flex items-center justify-between font-semibold text-green-600 dark:text-green-400 mb-1">
                            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>Barang Masuk</span>
                            <span>{formatNumber(data.masuk)}</span>
                        </p>
                        {data.detailsMasuk.length > 0 ? (
                            <ul className="pl-4 space-y-1 text-slate-600 dark:text-slate-400 border-l-2 border-slate-100 dark:border-slate-700 ml-1 max-h-32 overflow-y-auto scrollbar-thin">
                                {data.detailsMasuk.map((item, idx) => (<li key={idx} className="flex justify-between gap-4"><span className="truncate max-w-[140px]" title={item.name}>{item.name}</span><span className="font-mono">{formatNumber(item.quantity)}</span></li>))}
                            </ul>
                        ) : <p className="pl-4 text-slate-400 italic">Tidak ada data</p>}
                    </div>
                    <div>
                         <p className="flex items-center justify-between font-semibold text-red-600 dark:text-red-400 mb-1">
                            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>Barang Keluar</span>
                            <span>{formatNumber(data.keluar)}</span>
                        </p>
                         {data.detailsKeluar.length > 0 ? (
                            <ul className="pl-4 space-y-1 text-slate-600 dark:text-slate-400 border-l-2 border-slate-100 dark:border-slate-700 ml-1 max-h-32 overflow-y-auto scrollbar-thin">
                                {data.detailsKeluar.map((item, idx) => (<li key={idx} className="flex justify-between gap-4"><span className="truncate max-w-[140px]" title={item.name}>{item.name}</span><span className="font-mono">{formatNumber(item.quantity)}</span></li>))}
                            </ul>
                        ) : <p className="pl-4 text-slate-400 italic">Tidak ada data</p>}
                    </div>
                </div>
            );
        } else {
            return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 text-xs">
                    <p className="font-bold mb-2 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">{label}</p>
                    <ul className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <li key={index} className="flex items-center justify-between gap-4" style={{ color: entry.color }}>
                                <span className="font-medium">{entry.name}:</span>
                                <span className="font-mono font-bold">{formatNumber(entry.value)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
    }
    return null;
};

const Dashboard: React.FC = () => {
  const {
      filterType, setFilterType, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
      loading, kpiData, trendData, deptTrendData, deptKeys, departmentData,
      topMovers, topStock, recentTransactions, alertCounts, // Updated here
      modalData, setModalData, isCustomizeModalOpen, setIsCustomizeModalOpen, visibleWidgets,
      handleOpenModal, toggleWidget, isWidgetVisible, getTimeLabel, years, widgetsList
  } = useDashboardLogic();

  if (loading) {
      return (<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div></div>);
  }

  const getRecentActivitySpan = () => {
      const moversVisible = isWidgetVisible('top_movers');
      const stockVisible = isWidgetVisible('top_stock');
      if (moversVisible && stockVisible) return 'lg:col-span-1';
      if (!moversVisible && !stockVisible) return 'lg:col-span-3';
      return 'lg:col-span-2';
  };

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-4">
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <button onClick={() => setIsCustomizeModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors flex-shrink-0" title="Atur Dashboard">
                    <SettingsIcon className="h-5 w-5" />
                </button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 flex-shrink-0 hidden sm:block"></div>
                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-none">
                    <div className="relative flex-grow sm:flex-none min-w-[140px]">
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value as any)} 
                            className="w-full appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 pl-3 pr-8 rounded-md text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                        >
                            <option value="today">Hari Ini</option>
                            <option value="week">Minggu Ini</option>
                            <option value="month">Pilih Bulan</option>
                            <option value="year">Pilih Tahun</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                    {filterType === 'month' && (
                        <div className="relative flex-grow sm:flex-none min-w-[140px]">
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)} 
                                className="w-full appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors" 
                            />
                        </div>
                    )}
                    {filterType === 'year' && (
                        <div className="relative flex-grow sm:flex-none min-w-[100px]">
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))} 
                                className="w-full appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 pl-3 pr-8 rounded-md text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Quick Actions */}
            <div className="grid grid-cols-4 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <Link to="/input" className="flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"><InputIcon className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Masuk</span></Link>
                <Link to="/output" className="flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 transition-colors"><OutputIcon className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Keluar</span></Link>
                <Link to="/stock" className="flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"><StockIcon className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Stok</span></Link>
                <Link to="/report" className="flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"><ReportIcon className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Laporan</span></Link>
            </div>
        </div>
      </div>
      
      {/* KPI & Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isWidgetVisible('kpi_summary') && (
            <>
                <Card title={`Transaksi (${getTimeLabel()})`} value={kpiData?.transactionCount ?? 0} icon={<ReportIcon />} color="bg-blue-500" />
                <Card title={`Volume Masuk (${getTimeLabel()})`} value={formatNumber(kpiData?.volumeIn ?? 0)} icon={<InputIcon />} color="bg-green-500" />
                <Card title={`Volume Keluar (${getTimeLabel()})`} value={formatNumber(kpiData?.volumeOut ?? 0)} icon={<OutputIcon />} color="bg-orange-500" />
            </>
        )}
        {isWidgetVisible('alerts') && (
            <>
                <div onClick={() => handleOpenModal('min')} className="cursor-pointer"><Card title="Stok Dibawah Min" value={alertCounts.min_stock} icon={<AlertIcon />} color="bg-red-500" /></div>
                <div onClick={() => handleOpenModal('max')} className="cursor-pointer"><Card title="Stok Diatas Max" value={alertCounts.max_stock} icon={<TrendingUpIcon />} color="bg-yellow-500" /></div>
                <div onClick={() => handleOpenModal('empty_locations')} className="cursor-pointer"><Card title="Lokasi Kosong" value={alertCounts.empty_locations} icon={<ArchiveIcon />} color="bg-slate-500" /></div>
            </>
        )}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isWidgetVisible('chart_trends') && (
             <div className={`bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md ${!isWidgetVisible('chart_department') && !isWidgetVisible('chart_dept_trend') ? 'lg:col-span-2' : ''}`}>
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Tren Arus Barang ({getTimeLabel()})</h2>
                <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} /><XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} /><YAxis tick={{ fill: 'currentColor', fontSize: 12 }} /><Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} /><Legend /><Bar dataKey="masuk" fill="#10B981" name="Masuk" radius={[4, 4, 0, 0]} /><Bar dataKey="keluar" fill="#EF4444" name="Keluar" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
        )}
        {isWidgetVisible('chart_department') && (
             <div className={`bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md ${!isWidgetVisible('chart_trends') && !isWidgetVisible('chart_dept_trend') ? 'lg:col-span-2' : ''}`}>
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Distribusi Stok per Departemen</h2>
                <div className="h-80 w-full">{departmentData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={departmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{departmentData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(value: number) => formatNumber(value)} /><Legend layout="vertical" verticalAlign="middle" align="right" /></PieChart></ResponsiveContainer>) : (<div className="h-full flex items-center justify-center text-slate-400">Belum ada data stok.</div>)}</div>
            </div>
        )}
        {isWidgetVisible('chart_dept_trend') && (
             <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Tren Total Stok ({getTimeLabel()})</h2>
                <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={deptTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} /><XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 12 }} /><YAxis tick={{ fill: 'currentColor', fontSize: 12 }} /><Tooltip content={<CustomTooltip />} /><Legend />{deptKeys.map((dept, index) => (<Line key={dept} type="monotone" dataKey={dept} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />))}<Line type="monotone" dataKey="Total" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
            </div>
        )}
      </div>
      
      {/* Secondary Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isWidgetVisible('top_movers') && (
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md lg:col-span-1">
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Top 5 Barang Aktif</h2>
                <div className="space-y-4">{topMovers.length > 0 ? topMovers.map((item, index) => (<div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg"><div className="flex items-center gap-3 overflow-hidden"><span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${index < 3 ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</span><span className="truncate font-medium text-slate-700 dark:text-slate-200" title={item.name}>{item.name}</span></div><div className="text-right flex-shrink-0"><span className="block text-xs text-slate-500">{item.count} Trx</span><span className="block text-xs font-semibold">{formatNumber(item.quantity)} {item.unit}</span></div></div>)) : <p className="text-center py-4 text-slate-500">Tidak ada aktivitas.</p>}</div>
            </div>
        )}
        {isWidgetVisible('top_stock') && (
             <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md lg:col-span-1">
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Top 5 Stok Terbanyak</h2>
                <div className="space-y-4">{topStock.length > 0 ? topStock.map((item, index) => (<div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg"><div className="flex items-center gap-3 overflow-hidden"><span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${index < 3 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</span><span className="truncate font-medium text-slate-700 dark:text-slate-200" title={item.name}>{item.name}</span></div><div className="text-right flex-shrink-0"><span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{formatNumber(item.stock)} {item.unit}</span></div></div>)) : <p className="text-center py-4 text-slate-500">Data stok tidak tersedia.</p>}</div>
            </div>
        )}
        {isWidgetVisible('recent_activity') && (
            <div className={`bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md ${getRecentActivitySpan()}`}>
                <h2 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Aktivitas Terkini</h2>
                <div className="overflow-x-auto"><table className="min-w-full"><thead><tr><th className="text-left py-2 text-sm font-medium text-slate-500">Barang</th><th className="text-right py-2 text-sm font-medium text-slate-500">Aksi</th></tr></thead><tbody>{recentTransactions.length > 0 ? recentTransactions.map(t => (<tr key={t.id} className="border-t border-slate-200 dark:border-slate-700"><td className="py-3"><p className="font-medium text-slate-800 dark:text-white">{t.materials?.name ?? 'Barang Dihapus'}</p><p className="text-xs text-slate-500">{new Date(t.timestamp).toLocaleString('id-ID')}</p></td><td className={`py-3 text-right font-bold ${t.type === 'IN' ? 'text-green-500' : 'text-red-500'}`}>{t.type === 'IN' ? '+' : '-'} {formatNumber(t.quantity)}</td></tr>)) : <tr><td colSpan={2} className="text-center py-4 text-slate-500">Tidak ada transaksi terkini.</td></tr>}</tbody></table></div>
            </div>
        )}
      </div>
      {/* Modal Detail Alert */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{modalData.title}</h3>
              <button onClick={() => setModalData(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
               {modalData.loading ? (
                   <div className="flex justify-center py-8">
                       <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
                   </div>
               ) : (
                   <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Item / Lokasi</th>
                            <th className="px-4 py-3 text-right rounded-r-lg">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {modalData.items.length > 0 ? modalData.items.map((item: any, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                                <td className="px-4 py-3 text-right">
                                    {modalData.type === 'empty_locations' ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-600 dark:text-slate-200">Kosong</span>
                                    ) : (
                                        <span className={`font-mono font-bold ${modalData.type === 'min' ? 'text-red-500' : 'text-yellow-500'}`}>
                                            {formatNumber(item.stock)} <span className="text-xs text-slate-400 font-normal">{item.unit}</span>
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400 italic">Tidak ada data.</td></tr>
                        )}
                    </tbody>
                  </table>
               )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl flex justify-end">
                <button onClick={() => setModalData(null)} className="px-4 py-2 bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors text-sm font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Dashboard Modal */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Atur Dashboard</h3>
                    <button onClick={() => setIsCustomizeModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Pilih widget yang ingin ditampilkan:</p>
                    {widgetsList.map(widget => (
                        <label key={widget.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                            <input 
                                type="checkbox" 
                                checked={isWidgetVisible(widget.id)} 
                                onChange={() => toggleWidget(widget.id)}
                                className="w-5 h-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500 transition duration-150 ease-in-out"
                            />
                            <span className="text-slate-700 dark:text-slate-200 font-medium">{widget.label}</span>
                        </label>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 rounded-b-xl flex justify-end">
                    <button onClick={() => setIsCustomizeModalOpen(false)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium">Selesai</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
