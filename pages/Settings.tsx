
import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { SettingsIcon, CheckCircleIcon, DatabaseIcon, CalendarIcon } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { logActivity } from '../services/auditLogger';
import { supabase } from '../services/supabase';

const Settings: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    // Default Settings
    const [displaySettings, setDisplaySettings] = useState({
        decimalMode: 'auto', 
        shiftMode: '2',      
        themePreference: 'system'
    });

    // 1. Ambil pengaturan dari Database saat halaman dibuka
    useEffect(() => {
        const fetchGlobalSettings = async () => {
            setFetching(true);
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['decimal_mode', 'shift_mode']);
                
                if (!error && data) {
                    const dbSettings: any = {};
                    data.forEach(item => {
                        if (item.key === 'decimal_mode') dbSettings.decimalMode = item.value;
                        if (item.key === 'shift_mode') dbSettings.shiftMode = item.value;
                    });
                    
                    const newSettings = { ...displaySettings, ...dbSettings };
                    setDisplaySettings(newSettings);
                    // Update cache lokal juga
                    localStorage.setItem('app_display_settings', JSON.stringify(newSettings));
                }
            } catch (e) {
                console.error("Gagal mengambil settings:", e);
            } finally {
                setFetching(false);
            }
        };

        fetchGlobalSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);

        try {
            // 2. Simpan ke Database (Global untuk semua user)
            const settingsToSave = [
                { key: 'shift_mode', value: displaySettings.shiftMode },
                { key: 'decimal_mode', value: displaySettings.decimalMode }
            ];

            const { error } = await supabase
                .from('app_settings')
                .upsert(settingsToSave, { onConflict: 'key' });

            if (error) throw error;

            // 3. Simpan ke localStorage (Lokal untuk sesi ini)
            localStorage.setItem('app_display_settings', JSON.stringify(displaySettings));
            
            await logActivity(user, 'UPDATE_SETTINGS_GLOBAL', `Admin updated global preferences (Shift Mode: ${displaySettings.shiftMode})`);
            
            setMessage({ type: 'success', text: 'Pengaturan global berhasil disimpan dan diterapkan ke seluruh pengguna!' });
            
            // Refresh untuk memicu ulang logika dateHelper
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            setMessage({ type: 'error', text: `Gagal menyimpan: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <SettingsIcon className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Pengaturan Global</h1>
                    <p className="text-sm text-slate-500 italic">Perubahan di sini akan berdampak pada seluruh staf.</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-md text-sm font-medium animate-bounce ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Format Display Card */}
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <DatabaseIcon className="h-5 w-5 text-primary-500" />
                        Format Angka & Stok
                    </h2>
                    <div className="space-y-4">
                        <Select 
                            id="decimal-mode" 
                            label="Format Desimal (Koma)" 
                            value={displaySettings.decimalMode}
                            onChange={(e) => setDisplaySettings({...displaySettings, decimalMode: e.target.value})}
                        >
                            <option value="auto">Otomatis (Sembunyikan jika nol)</option>
                            <option value="always">Selalu Tampilkan (Dua desimal: 120,00)</option>
                            <option value="none">Hanya Bulat (Tanpa desimal: 120)</option>
                        </Select>
                        <p className="text-xs text-slate-500 italic">
                            * Opsi ini mengatur cara angka ditampilkan di Dashboard & Laporan untuk semua orang.
                        </p>
                    </div>
                </div>

                {/* Shift Settings Card */}
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-orange-500" />
                        Operasional Shift
                    </h2>
                    <div className="space-y-4">
                        <Select 
                            id="shift-mode" 
                            label="Mode Shift Kerja" 
                            value={displaySettings.shiftMode}
                            onChange={(e) => setDisplaySettings({...displaySettings, shiftMode: e.target.value})}
                        >
                            <option value="2">Mode 2 Shift</option>
                            <option value="3">Mode 3 Shift</option>
                        </Select>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                            <p className="font-bold border-b border-slate-200 dark:border-slate-700 mb-1 pb-1 text-primary-600">Panduan Waktu Otomatis:</p>
                            {displaySettings.shiftMode === '3' ? (
                                <>
                                    <p>• <b>Shift 1:</b> 07:00 - 15:00</p>
                                    <p>• <b>Shift 2:</b> 15:00 - 23:00</p>
                                    <p>• <b>Shift 3:</b> 23:00 - 07:00 (H+1)</p>
                                </>
                            ) : (
                                <>
                                    <p>• <b>Shift 1:</b> 07:00 - 16:00</p>
                                    <p>• <b>Shift 2:</b> 16:00 - 07:00 (H+1)</p>
                                </>
                            )}
                            <p className="text-orange-600 font-medium pt-1 italic">* Pergantian hari administrasi tetap jam 07:00 pagi.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} isLoading={loading} className="w-full md:w-auto px-10 shadow-lg !bg-indigo-600 hover:!bg-indigo-700">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Terapkan untuk Semua User
                </Button>
            </div>
        </div>
    );
};

export default Settings;
