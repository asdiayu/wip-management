
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AuditLog } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { downloadFile } from '../utils/fileHelper';
import { TrashIcon, AlertIcon } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';

const AuditLogs: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    
    // Cleanup State
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [retentionPeriod, setRetentionPeriod] = useState('30'); // Default 30 days
    const [isCleaning, setIsCleaning] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Helper to format JSON details nicely
    const formatDetail = (detail: string) => {
        try {
            const parsed = JSON.parse(detail);
            return <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">{JSON.stringify(parsed, null, 2)}</pre>;
        } catch (e) {
            return <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{detail}</div>;
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100); // Limit 100 for performance

        if (search) {
            query = query.or(`user_email.ilike.%${search}%,action.ilike.%${search}%,details.ilike.%${search}%`);
        }
        if (dateFilter) {
            const nextDay = new Date(dateFilter);
            nextDay.setDate(nextDay.getDate() + 1);
            query = query.gte('timestamp', new Date(dateFilter).toISOString())
                         .lt('timestamp', nextDay.toISOString());
        }

        const { data, error } = await query;
        if (!error && data) {
            setLogs(data as AuditLog[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [dateFilter]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleExport = async () => {
        const headers = ["Timestamp", "User", "Action", "Details"];
        const rows = logs.map(log => {
            return [
                `"${new Date(log.timestamp).toLocaleString('id-ID')}"`,
                `"${log.user_email}"`,
                `"${log.action}"`,
                `"${log.details.replace(/"/g, '""')}"`
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const filename = `Audit_Log_${new Date().toISOString().split('T')[0]}.csv`;
        await downloadFile(filename, csvContent, 'text/csv');
    };

    const handleCleanupLogs = async () => {
        setIsCleaning(true);
        setMessage(null);

        try {
            let cutoffDate = new Date();
            let deleteQuery = supabase.from('audit_logs').delete();

            if (retentionPeriod === 'all') {
                // Fix: Use a valid Nil UUID for the condition to prevent "invalid input syntax for type uuid" error.
                // Comparing id != Nil UUID is essentially "Where ID is not null", selecting all rows.
                deleteQuery = deleteQuery.neq('id', '00000000-0000-0000-0000-000000000000'); 
            } else {
                const days = parseInt(retentionPeriod);
                cutoffDate.setDate(cutoffDate.getDate() - days);
                deleteQuery = deleteQuery.lt('timestamp', cutoffDate.toISOString());
            }

            const { error } = await deleteQuery;

            if (error) throw error;

            await logActivity(user, 'CLEANUP_LOGS', `Deleted audit logs older than ${retentionPeriod} days`);
            
            setMessage({ type: 'success', text: 'Pembersihan log berhasil dilakukan.' });
            setShowCleanupModal(false);
            fetchLogs();
        } catch (error: any) {
            setMessage({ type: 'error', text: `Gagal membersihkan log: ${error.message}` });
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Audit Logs</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowCleanupModal(true)}
                        className="flex items-center px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 rounded-md text-sm font-medium transition-colors"
                    >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Bersihkan Log
                    </button>
                    <Button onClick={handleExport} disabled={logs.length === 0} className="w-auto !bg-slate-600">
                        Ekspor CSV
                    </Button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Input 
                        id="search" 
                        label="Cari (User, Action, Details)" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="Ketik untuk mencari..."
                    />
                    <Input 
                        id="date" 
                        label="Filter Tanggal" 
                        type="date" 
                        value={dateFilter} 
                        onChange={e => setDateFilter(e.target.value)} 
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Waktu</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={4} className="text-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500 mx-auto"></div></td></tr>
                            ) : logs.length > 0 ? logs.map(log => (
                                <tr 
                                    key={log.id} 
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(log.timestamp).toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        {log.user_email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${log.action.includes('LOGIN') ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 
                                              log.action.includes('DELETE') ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 
                                              log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 
                                              'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                        {log.details}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="text-center py-10 text-slate-500 dark:text-slate-400">Tidak ada log ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-xs text-slate-400 text-right">* Klik baris untuk melihat detail lengkap.</p>
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Detail Aktivitas</h3>
                                <p className="text-xs text-slate-500">{selectedLog.id}</p>
                            </div>
                            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                {new Date(selectedLog.timestamp).toLocaleString('id-ID')}
                            </span>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">User Email</label>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedLog.user_email}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Action Type</label>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedLog.action}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Details / Payload</label>
                                {formatDetail(selectedLog.details)}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <Button onClick={() => setSelectedLog(null)} className="w-auto">Tutup</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cleanup Modal */}
            {showCleanupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                            <AlertIcon className="h-6 w-6" />
                            <h3 className="text-lg font-bold">Bersihkan Log Lama</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            Tindakan ini akan menghapus riwayat aktivitas secara permanen untuk menghemat ruang database. 
                        </p>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Hapus log yang lebih tua dari:
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { val: '7', label: '7 Hari' },
                                    { val: '30', label: '30 Hari (1 Bulan)' },
                                    { val: '90', label: '90 Hari (3 Bulan)' },
                                    { val: 'all', label: 'SEMUA LOG (Reset Total)' }
                                ].map((opt) => (
                                    <label 
                                        key={opt.val}
                                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all
                                            ${retentionPeriod === opt.val 
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500' 
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <input 
                                            type="radio" 
                                            name="retention"
                                            value={opt.val}
                                            checked={retentionPeriod === opt.val}
                                            onChange={(e) => setRetentionPeriod(e.target.value)}
                                            className="h-4 w-4 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {opt.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => setShowCleanupModal(false)}
                                className="px-4 py-2 rounded-md text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium"
                            >
                                Batal
                            </button>
                            <Button 
                                onClick={handleCleanupLogs} 
                                isLoading={isCleaning} 
                                className="w-auto !bg-red-600 hover:!bg-red-700 focus:!ring-red-500"
                            >
                                Hapus Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
