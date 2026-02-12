
import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useDatabaseManagement } from '../hooks/useDatabaseManagement';
import { ShieldCheckIcon, DatabaseIcon, TrashIcon, CalculatorIcon, CloudUploadIcon, AlertIcon } from '../constants';

const WarningIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const DatabaseManagement: React.FC = () => {
    const {
        loading, message, restoreFile, setRestoreFile, resetConfirmText, setResetConfirmText,
        resetMode, setResetMode, dbStats, totalDbSize, statsLoading, statsError,
        latestVersion, setLatestVersion, updateUrl, setUpdateUrl, apkFile, setApkFile,
        showSql, setShowSql, activeSqlTab, setActiveSqlTab, truncateTarget, setTruncateTarget,
        truncateConfirmInput, setTruncateConfirmInput, fetchDbStats, handleSaveVersion,
        handleRecalculateStock, handleBackup, handleRestore, handleReset, executeTruncate,
        getSqlContent, isRestoreConfirmOpen, setIsRestoreConfirmOpen, executeRestore
    } = useDatabaseManagement();

    return (
        <div className="space-y-8 pb-12">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Manajemen Database</h1>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
                <div className="flex items-start">
                    <WarningIcon />
                    <div>
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Perhatian!</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Tindakan di sini bersifat permanen. Lakukan backup sebelum mengubah data struktural.</p>
                    </div>
                </div>
            </div>

             {message && (
                <div className={`p-4 rounded-md text-sm font-bold shadow-md transition-all duration-300 ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {message.text}
                </div>
            )}
            
            {/* Database Stats */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                        <DatabaseIcon className="h-6 w-6 text-indigo-600 mr-2" />
                        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Statistik ({totalDbSize})</h2>
                    </div>
                    <button onClick={fetchDbStats} className="text-sm text-primary-600 hover:underline font-bold">Refresh</button>
                </div>
                
                {statsError ? (
                     <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 rounded-md text-sm flex items-center gap-2">
                        <AlertIcon className="h-5 w-5" />
                        <span>RPC Statistik belum di-setup. Silakan jalankan SQL di tab Helper.</span>
                     </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-3 text-left">Tabel</th>
                                    <th className="px-6 py-3 text-right">Baris</th>
                                    <th className="px-6 py-3 text-right">Ukuran</th>
                                    <th className="px-6 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {statsLoading ? (
                                    <tr><td colSpan={4} className="text-center py-4">Memuat data...</td></tr>
                                ) : dbStats.map((stat, idx) => (
                                    <tr key={idx} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">{stat.table_name}</td>
                                        <td className="px-6 py-3 text-right font-mono">{stat.row_count}</td>
                                        <td className="px-6 py-3 text-right font-mono">{stat.total_size}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button onClick={() => {setTruncateTarget(stat); setTruncateConfirmInput('');}} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="Kosongkan Tabel"><TrashIcon className="h-4 w-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* App Versioning & Update Control */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-l-4 border-primary-500 border-y border-r border-slate-200 dark:border-slate-700">
                <div className="flex items-center mb-6">
                    <CloudUploadIcon className="h-6 w-6 text-primary-600 mr-2" />
                    <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Pengaturan Versi & Update</h2>
                </div>
                
                {/* Info Bucket */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-1">
                        <ShieldCheckIcon className="h-4 w-4" />
                        Syarat Upload Berhasil:
                    </h4>
                    <ul className="text-xs text-blue-700 dark:text-blue-400 list-decimal ml-5 space-y-1">
                        <li>Buka <b>Supabase Dashboard &gt; Storage</b>.</li>
                        <li>Buat bucket baru bernama <b>app-releases</b>.</li>
                        <li>Atur bucket ke <b>Public</b>.</li>
                        <li>Jalankan SQL di tab <b>STORAGE</b> di bawah untuk mengatur izin RLS (hanya admin yang bisa upload).</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Input 
                        id="app_version" 
                        label="Versi Baru (Misal: 1.1.2)" 
                        value={latestVersion} 
                        onChange={e => setLatestVersion(e.target.value)} 
                        placeholder="Contoh: 1.1.2"
                    />
                    <Input 
                        id="update_url" 
                        label="Direct URL APK (Otomatis terisi jika upload)" 
                        value={updateUrl} 
                        onChange={e => setUpdateUrl(e.target.value)} 
                        placeholder="https://..."
                        disabled={!!apkFile}
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih File APK (.apk)</label>
                    <div className="flex items-center justify-center w-full">
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                            ${apkFile ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-slate-300 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <CloudUploadIcon className={`w-8 h-8 mb-3 ${apkFile ? 'text-green-500' : 'text-slate-400'}`} />
                                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                    {apkFile ? <span className="font-bold text-green-600">Terpilih: {apkFile.name}</span> : <><span className="font-semibold">Klik untuk pilih</span> APK baru</>}
                                </p>
                            </div>
                            <input type="file" className="hidden" accept=".apk" onChange={e => setApkFile(e.target.files?.[0] || null)} />
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    {apkFile && <button onClick={() => setApkFile(null)} className="px-4 py-2 text-sm text-red-600 hover:underline font-bold">Batal Pilih</button>}
                    <Button 
                        onClick={handleSaveVersion} 
                        isLoading={loading === 'version'} 
                        className="w-full md:w-auto font-bold"
                    >
                        Simpan & Publikasikan Update
                    </Button>
                </div>
            </div>

            {/* SQL Helper */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-6 rounded-xl shadow-md">
                <div className="flex items-center mb-4">
                    <ShieldCheckIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">SQL Helper & Permissions</h2>
                </div>
                
                {!showSql ? (
                    <Button onClick={() => setShowSql(true)} className="!bg-indigo-600 hover:!bg-indigo-700">Tampilkan SQL Penanganan Error</Button>
                ) : (
                    <div className="space-y-4">
                        <div className="flex overflow-x-auto space-x-2 border-b border-indigo-200 dark:border-indigo-800 pb-2 scrollbar-hide">
                            {['functions', 'security', 'storage', 'cleanup'].map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveSqlTab(tab as any)} 
                                    className={`px-4 py-2 text-xs font-black whitespace-nowrap rounded-t-lg transition-colors ${activeSqlTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-100 dark:text-slate-400 dark:hover:bg-indigo-900/50'}`}
                                >
                                    {tab.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <textarea 
                            readOnly 
                            className="w-full h-64 p-4 text-xs font-mono bg-black text-green-400 rounded-md border border-slate-800 focus:outline-none shadow-inner" 
                            value={getSqlContent()} 
                        />
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <p className="text-[10px] text-slate-500 italic">* Upload APK sekarang langsung ke Storage (tanpa Edge Function). Jalankan SQL di tab STORAGE untuk menghapus policy lama dan membuat policy baru.</p>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(getSqlContent()); alert('SQL Copied!'); }}
                                    className="flex-1 sm:flex-none px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-xs font-bold hover:bg-indigo-200"
                                >
                                    Copy SQL
                                </button>
                                <Button onClick={() => setShowSql(false)} className="w-auto !bg-slate-500 py-1.5 px-4 text-xs">Tutup</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Recalculate Stock */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-t-4 border-indigo-500 flex flex-col sm:flex-row justify-between items-center gap-4 border-x border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full"><CalculatorIcon className="h-6 w-6 text-indigo-600" /></div>
                    <div>
                        <h2 className="font-bold text-slate-700 dark:text-slate-200">Sinkronisasi Stok Master</h2>
                        <p className="text-xs text-slate-500">Hitung ulang stok fisik di tabel master berdasarkan histori transaksi.</p>
                    </div>
                </div>
                <Button onClick={handleRecalculateStock} isLoading={loading === 'recalc'} className="sm:w-auto !bg-indigo-600 px-8">Mulai Sinkron</Button>
            </div>

            {/* Backup / Restore / Reset Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
                    <h2 className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><DatabaseIcon className="h-5 w-5 text-green-500" /> Backup Data</h2>
                    <p className="text-xs text-slate-500">Simpan seluruh data ke file JSON lokal.</p>
                    <Button onClick={handleBackup} isLoading={loading === 'backup'} className="!bg-slate-700">Download Backup</Button>
                </div>
                
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
                    <h2 className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><CloudUploadIcon className="h-5 w-5 text-blue-500" /> Restore Data</h2>
                    <p className="text-xs text-slate-500">Unggah file JSON hasil backup.</p>
                    <input type="file" accept=".json" onChange={e => setRestoreFile(e.target.files?.[0] || null)} className="block w-full text-[10px] text-slate-500" />
                    <Button onClick={handleRestore} isLoading={loading === 'restore'} disabled={!restoreFile} className="!bg-blue-600">Restore Sekarang</Button>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border-2 border-red-500/20 dark:border-red-900/20 space-y-4">
                    <h2 className="font-bold text-red-600 flex items-center gap-2"><TrashIcon className="h-5 w-5" /> Reset Transaksi</h2>
                    <div className="flex gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={resetMode === 'keep_stock'} onChange={() => setResetMode('keep_stock')} /> Konsolidasi</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={resetMode === 'zero_stock'} onChange={() => setResetMode('zero_stock')} /> Nol-kan</label>
                    </div>
                    <Input id="resetC" label='Ketik "RESET DATA"' value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} />
                    <Button onClick={handleReset} isLoading={loading === 'reset'} disabled={resetConfirmText !== "RESET DATA"} className="!bg-red-600 hover:!bg-red-700">Hapus History</Button>
                </div>
            </div>

            {/* Restore Confirmation Modal */}
            {isRestoreConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 w-full max-w-sm shadow-2xl border-t-4 border-blue-500">
                        <div className="flex justify-center mb-4"><CloudUploadIcon className="h-12 w-12 text-blue-500" /></div>
                        <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-center text-lg">Konfirmasi Restore?</h3>
                        <p className="text-sm text-slate-500 mb-6 text-center">
                            PERINGATAN: Seluruh data saat ini (Barang, Lokasi, Transaksi) akan <span className="font-bold text-red-500">DIHAPUS TOTAL</span> dan diganti dengan data dari file backup.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setIsRestoreConfirmOpen(false)} className="flex-1 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 dark:text-slate-300 rounded-lg">BATAL</button>
                            <Button onClick={executeRestore} className="flex-1 !bg-blue-600">YA, RESTORE</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Truncate Modal */}
            {truncateTarget && (
                <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 w-full max-w-sm shadow-2xl border border-red-100 dark:border-red-900/30">
                        <div className="flex justify-center mb-4"><TrashIcon className="h-12 w-12 text-red-500" /></div>
                        <h3 className="font-bold text-red-600 mb-2 text-center text-lg">Kosongkan {truncateTarget.table_name}?</h3>
                        <p className="text-xs text-slate-500 mb-6 text-center">Seluruh data dalam tabel ini akan dihapus permanen.</p>
                        <Input id="tr" label={`Konfirmasi: Ketik "${truncateTarget.table_name}"`} value={truncateConfirmInput} onChange={e => setTruncateConfirmInput(e.target.value)} />
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setTruncateTarget(null)} className="flex-1 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-slate-700 rounded-lg">BATAL</button>
                            <Button onClick={executeTruncate} disabled={truncateConfirmInput !== truncateTarget.table_name} className="flex-1 !bg-red-600">HAPUS</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseManagement;
