
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { SparklesIcon, TrashIcon, AlertIcon } from '../constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Message {
    role: 'user' | 'model';
    content: string;
}

const PaperAirplaneIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const toolDeclarations = [
    {
        name: 'search_materials',
        description: 'Mencari master data barang di gudang berdasarkan kata kunci nama.',
        parameters: {
            type: 'OBJECT',
            properties: {
                keyword: { type: 'STRING', description: 'Nama barang atau fragmen nama yang dicari' }
            },
            required: ['keyword']
        }
    },
    {
        name: 'check_stock_per_location',
        description: 'Mengecek posisi stok barang tertentu tersebar di lokasi mana saja.',
        parameters: {
            type: 'OBJECT',
            properties: {
                item_name: { type: 'STRING', description: 'Nama spesifik barang yang ingin dilacak' }
            },
            required: ['item_name']
        }
    },
    {
        name: 'get_top_stocks',
        description: 'Melihat daftar barang dengan jumlah stok terbanyak (stok tertinggi) di seluruh gudang.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: { type: 'NUMBER', description: 'Jumlah barang yang ingin ditampilkan, default adalah 5.' }
            }
        }
    },
    {
        name: 'analyze_material_flow',
        description: 'Menganalisa riwayat transaksi barang untuk mengetahui kenapa stok banyak/sedikit dan memprediksi kapan stok habis.',
        parameters: {
            type: 'OBJECT',
            properties: {
                item_name: { type: 'STRING', description: 'Nama barang yang ingin dianalisa' }
            },
            required: ['item_name']
        }
    }
];

const systemInstruction = `Anda adalah "Warehouse Expert AI". Tugas Anda adalah memberikan analisa cerdas mengenai stok gudang.

KEMAMPUAN ANALISA ANDA:
1. Jika ditanya "Kenapa stok barang X banyak?", gunakan 'analyze_material_flow'. Lihat apakah ada pemasukan besar baru-baru ini atau karena barang jarang keluar.
2. Jika ditanya "Kapan stok habis?", hitung berdasarkan 'avg_daily_usage' yang diberikan oleh tool analisa.
3. Selalu bandingkan data pengeluaran (OUT) dan pemasukan (IN) 30 hari terakhir untuk memberikan kesimpulan.

ATURAN KETAT:
1. ZERO HALLUCINATION: Jangan mengarang angka atau tanggal transaksi.
2. Selalu sajikan data angka dalam Tabel Markdown agar mudah dibaca.
3. Gunakan Bahasa Indonesia yang sangat pintar, profesional, dan membantu.`;

const SmartAssistant: React.FC = () => {
    const { user } = useAuth();
    
    // Verifikasi Hak Akses: Hanya Admin dan Manager yang boleh masuk
    const userRole = user?.app_metadata?.role || user?.user_metadata?.role;
    const isAuthorized = userRole === 'admin' || userRole === 'manager';

    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: 'Halo! Saya Warehouse Expert AI. Saya bisa membantu Anda menganalisa pergerakan barang, memprediksi sisa hari stok, hingga mencari barang. Apa yang ingin Anda analisa hari ini?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Sedang berpikir...');
    const [debugError, setDebugError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, isLoading]);

    // PROTEKSI: Redirect ke Dashboard jika user tidak berwenang
    if (!isAuthorized) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleToolCall = async (fnCall: any) => {
        const { name, args } = fnCall;
        
        try {
            if (name === 'search_materials') {
                setLoadingMessage(`Mencari data "${args.keyword}"...`);
                const { data } = await supabase.from('materials').select('name, unit, stock, department').ilike('name', `%${args.keyword}%`).limit(10);
                return { result: data || [] };
            } 
            
            if (name === 'check_stock_per_location') {
                setLoadingMessage(`Melacak lokasi "${args.item_name}"...`);
                const { data: materials } = await supabase.from('materials').select('id, name, unit').ilike('name', `%${args.item_name}%`).limit(1);
                
                if (materials && materials.length > 0) {
                    const { data: stock } = await supabase.rpc('get_stock_by_location', { material_id_param: materials[0].id });
                    return { 
                        barang: materials[0].name, 
                        satuan: materials[0].unit,
                        rincian_lokasi: stock || [] 
                    };
                }
                return { error: 'Barang tidak ditemukan dalam database.' };
            }

            if (name === 'get_top_stocks') {
                const limitCount = parseInt(args.limit) || 5;
                setLoadingMessage(`Mengambil ${limitCount} stok terbanyak...`);
                const { data, error } = await supabase
                    .from('materials')
                    .select('name, stock, unit')
                    .order('stock', { ascending: false })
                    .limit(limitCount);
                
                if (error) throw error;
                return { 
                    keterangan: `Daftar ${limitCount} barang dengan stok tertinggi saat ini.`,
                    data_stok: data || [] 
                };
            }

            if (name === 'analyze_material_flow') {
                setLoadingMessage(`Menganalisa riwayat "${args.item_name}"...`);
                
                const { data: materials } = await supabase.from('materials').select('id, name, unit, stock').ilike('name', `%${args.item_name}%`).limit(1);
                if (!materials || materials.length === 0) return { error: "Barang tidak ditemukan." };
                
                const material = materials[0];
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('type, quantity, timestamp, notes, pic, shift')
                    .eq('material_id', material.id)
                    .gte('timestamp', thirtyDaysAgo.toISOString())
                    .order('timestamp', { ascending: false });

                let totalIn = 0;
                let totalOut = 0;
                const recentLogs = transactions?.slice(0, 5) || [];
                
                transactions?.forEach(t => {
                    if (t.type === 'IN') totalIn += t.quantity;
                    if (t.type === 'OUT') totalOut += t.quantity;
                });

                const avgDailyOut = totalOut / 30;
                const daysToEmpty = avgDailyOut > 0 ? (material.stock / avgDailyOut) : 9999;

                return {
                    informasi_barang: {
                        nama: material.name,
                        stok_saat_ini: material.stock,
                        satuan: material.unit
                    },
                    statistik_30_hari: {
                        total_masuk: totalIn,
                        total_keluar: totalOut,
                        rata_rata_keluar_per_hari: avgDailyOut.toFixed(2),
                        estimasi_stok_habis_dalam_hari: daysToEmpty === 9999 ? "Stok sangat aman (tidak ada pengeluaran signifikan)" : daysToEmpty.toFixed(1)
                    },
                    transaksi_terakhir: recentLogs,
                    kesimpulan_analisa: totalIn > totalOut ? "Stok meningkat dalam 30 hari terakhir." : "Stok menurun dalam 30 hari terakhir."
                };
            }
        } catch (err: any) {
            console.error("Tool Execution Error:", err);
            return { error: 'Terjadi kesalahan saat mengakses database gudang.' };
        }
        return { error: 'Fungsi tidak dikenal.' };
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;
        
        if (!isOnline) {
            setDebugError("Anda sedang offline. Pastikan HP terhubung ke internet.");
            return;
        }

        const userMsg = input.trim();
        setInput('');
        setDebugError(null);
        
        const newHistory = [...messages, { role: 'user', content: userMsg }];
        setMessages(newHistory as Message[]);
        setIsLoading(true);
        setLoadingMessage('Menghubungi AI Cloud...');

        try {
            let { data: aiResponse, error: fnError } = await supabase.functions.invoke('gemini', {
                body: {
                    contents: newHistory.map(m => ({
                        role: m.role,
                        parts: [{ text: m.content }]
                    })),
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: toolDeclarations }]
                }
            });

            if (fnError) {
                if (fnError.message.includes('fetch')) {
                    throw new Error("Gagal menghubungi server. Pastikan Edge Function sudah di-deploy.");
                }
                throw new Error(fnError.message || "Edge Function error");
            }

            if (!aiResponse || !aiResponse.candidates) {
                throw new Error("Respon AI kosong. Periksa API Key di Supabase Secrets.");
            }

            let aiParts = aiResponse.candidates[0].content.parts;
            let historyParts = newHistory.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            let iteration = 0;
            const MAX_ITERATIONS = 5;

            while (aiParts && aiParts.some((p: any) => p.functionCall) && iteration < MAX_ITERATIONS) {
                iteration++;
                const toolResults = [];
                historyParts.push({ role: 'model', parts: aiParts });

                for (const part of aiParts) {
                    if (part.functionCall) {
                        const result = await handleToolCall(part.functionCall);
                        toolResults.push({
                            functionResponse: {
                                name: part.functionCall.name,
                                response: result
                            }
                        });
                    }
                }

                setLoadingMessage('AI sedang menganalisa data gudang...');
                
                const { data: nextResponse, error: nextError } = await supabase.functions.invoke('gemini', {
                    body: {
                        contents: [
                            ...historyParts,
                            { role: 'user', parts: toolResults }
                        ],
                        systemInstruction: systemInstruction,
                        tools: [{ functionDeclarations: toolDeclarations }]
                    }
                });

                if (nextError) throw nextError;
                aiResponse = nextResponse;
                aiParts = aiResponse.candidates[0].content.parts;
                historyParts.push({ role: 'user', parts: toolResults });
            }

            const finalText = aiResponse?.candidates[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (finalText) {
                setMessages(prev => [...prev, { role: 'model', content: finalText }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', content: 'AI telah memproses data namun tidak memberikan jawaban teks.' }]);
            }

        } catch (err: any) {
            console.error("AI Assistant Error:", err);
            setDebugError(`Masalah: ${err.message}`);
            setMessages(prev => [...prev, { role: 'model', content: 'Maaf, saya kesulitan mengakses data saat ini. Mohon pastikan internet stabil dan server AI aktif.' }]);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] max-w-4xl mx-auto px-2">
            <div className="flex items-center justify-between mb-4 mt-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-xl text-primary-600 dark:text-primary-400">
                        <SparklesIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Smart Assistant</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Inventory AI Agent</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isOnline && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold animate-pulse">OFFLINE</span>
                    )}
                    <button 
                        onClick={() => {
                            if(window.confirm("Hapus riwayat chat?")) {
                                setMessages([{ role: 'model', content: 'Riwayat dibersihkan. Apa yang bisa saya bantu?' }]);
                                setDebugError(null);
                            }
                        }} 
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Bersihkan Chat"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {debugError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 shadow-sm">
                    <AlertIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-bold text-red-700 uppercase mb-1">Diagnosa Sistem:</p>
                        <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all leading-tight">
                            {debugError}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800/30 rounded-2xl shadow-inner p-4 space-y-4 border border-slate-200 dark:border-slate-700/50 mb-4 scrollbar-thin scroll-smooth">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[92%] sm:max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm transition-all
                            ${msg.role === 'user' 
                                ? 'bg-primary-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-600 rounded-bl-none'}`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto break-words">
                                {msg.role === 'user' ? (
                                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                                ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-700/50 px-4 py-3 rounded-2xl animate-pulse flex items-center gap-3">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 italic uppercase">{loadingMessage}</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} className="h-2" />
            </div>

            <form onSubmit={handleSend} className="relative pb-4">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isOnline ? "Tanya stok atau analisa barang..." : "Anda sedang offline..."} 
                    disabled={isLoading || !isOnline}
                    className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-primary-500 text-slate-900 dark:text-white pl-4 pr-14 py-4 rounded-2xl shadow-lg outline-none transition-all disabled:opacity-50 text-base"
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || isLoading || !isOnline}
                    className="absolute right-4 top-[14px] p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-xl shadow-md active:scale-95 transition-all"
                >
                    <PaperAirplaneIcon className="h-5 w-5" />
                </button>
            </form>
            <p className="mb-2 text-[9px] text-center text-slate-400 font-medium">
                AI menggunakan data transaksi 30 hari terakhir. Hasil bersifat estimasi.
            </p>
        </div>
    );
};

export default SmartAssistant;
