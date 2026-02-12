
import React, { useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import Button from './Button';
import { CloseIcon, CheckCircleIcon } from '../../constants';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Define ChatIcon locally to avoid modifying constants file
const ChatIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

export interface ReceiptItem {
    name: string;
    quantity: number;
    unit: string;
    location: string;
    notes?: string;
    type?: string; // 'IN' or 'OUT' for mixed receipts
    date?: string; // Specific date for this item
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: ReceiptItem[];
    type: 'IN' | 'OUT' | 'MIXED';
    date: string; // Main date (or generation date for mixed)
    shift?: string;
    pic: string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, items, type, date, shift, pic }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    if (!isOpen) return null;

    const handleShare = async () => {
        if (!receiptRef.current) return;
        setIsSharing(true);

        try {
            // 1. Convert HTML to Blob (Image)
            const scrollHeight = receiptRef.current.scrollHeight;
            
            const blob = await toBlob(receiptRef.current, { 
                cacheBust: true, 
                skipFonts: true, 
                backgroundColor: '#ffffff',
                height: scrollHeight,
                style: {
                    height: 'auto',
                    maxHeight: 'none',
                    overflow: 'visible'
                }
            });
            
            if (!blob) throw new Error('Gagal generate gambar');

            const fileName = `Bukti_${type}_${new Date().getTime()}.png`;
            const shiftDisplay = shift ? shift.replace('Shift ', '') : '-';

            if (Capacitor.isNativePlatform()) {
                // --- NATIVE MOBILE LOGIC ---
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64data = reader.result as string;
                    const pureBase64 = base64data.split(',')[1];

                    const savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: pureBase64,
                        directory: Directory.Cache
                    });

                    await Share.share({
                        title: 'Bukti Laporan',
                        text: `BUKTI TRANSAKSI\n\nSHIFT : ${shiftDisplay}\nTANGGAL : ${date}\nPIC : ${pic}`,
                        url: savedFile.uri,
                    });
                };
            } else {
                // --- WEB BROWSER LOGIC ---
                if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })) {
                    await navigator.share({
                        files: [new File([blob], fileName, { type: blob.type })],
                        title: 'Bukti Laporan',
                        text: `BUKTI TRANSAKSI\n\nSHIFT : ${shiftDisplay}\nTANGGAL : ${date}\nPIC : ${pic}`,
                    });
                } else {
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = URL.createObjectURL(blob);
                    link.click();

                    const text = `*BUKTI TRANSAKSI*\n\nSHIFT : ${shiftDisplay}\nTANGGAL : ${date}\nPIC : ${pic}\n\n_Gambar terlampir_`;
                    const waLink = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(waLink, '_blank');
                }
            }

        } catch (error) {
            console.error('Error sharing receipt:', error);
            alert('Gagal membagikan struk. Coba lagi.');
        } finally {
            setIsSharing(false);
        }
    };

    // Determine Logic based on content
    const inItems = items.filter(i => i.type === 'IN');
    const outItems = items.filter(i => i.type === 'OUT');
    
    // Auto-detect display type
    let displayType = 'GABUNGAN';
    let typeColor = 'bg-blue-200';
    
    if (inItems.length > 0 && outItems.length > 0) {
        displayType = 'IN & OUT';
        typeColor = 'bg-blue-200';
    } else if (inItems.length > 0) {
        displayType = 'BARANG MASUK';
        typeColor = 'bg-green-200';
    } else if (outItems.length > 0) {
        displayType = 'BARANG KELUAR';
        typeColor = 'bg-orange-200';
    }

    // Helper to render a list of items without redundant badges
    const renderItems = (itemList: ReceiptItem[]) => (
        itemList.map((item, idx) => (
            <tr key={idx} className="align-top">
                <td className="pr-1 pb-1 pt-1">
                    <div className="font-bold text-black text-[11px] leading-tight">
                        {item.name}
                    </div>
                    <div className="text-[9px] text-gray-600 leading-tight">
                        {item.location} • {item.date}
                    </div>
                </td>
                <td className="text-right whitespace-nowrap text-black font-bold text-[11px] pt-1">
                    {item.quantity} {item.unit}
                </td>
            </tr>
        ))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        {type === 'MIXED' ? 'Bukti Gabungan' : 'Transaksi Berhasil'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* SCROLLABLE AREA */}
                <div className="p-4 max-h-[60vh] overflow-y-auto bg-slate-100 dark:bg-slate-900 flex justify-center">
                    {/* RECEIPT CARD (This is what gets screenshotted) */}
                    <div 
                        ref={receiptRef} 
                        className="bg-white p-6 shadow-md w-full max-w-[320px] relative"
                        style={{ fontFamily: 'Courier New, monospace', borderBottom: '2px dashed #cbd5e1', color: '#000000' }}
                    >
                        <div className="text-center mb-3 border-b-2 border-black pb-3">
                            <h2 className="text-xl font-bold uppercase tracking-widest text-black">BUKTI TRANSAKSI</h2>
                            <p className="text-[10px] mt-1 text-black">Storage Management App</p>
                        </div>

                        <div className="text-[10px] space-y-1 mb-3 text-black font-medium">
                            <div className="flex justify-between">
                                <span>TANGGAL</span>
                                <span className="font-bold">{date}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>PIC</span>
                                <span className="uppercase">{pic.split('@')[0]}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>TIPE</span>
                                <span className={`font-bold px-1 text-black ${typeColor}`}>
                                    {displayType}
                                </span>
                            </div>
                            {shift && (
                                <div className="flex justify-between">
                                    <span>SHIFT</span>
                                    <span>{shift.replace('Shift ', '')}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-dashed border-gray-400 py-1 mb-1 text-black">
                            <table className="w-full text-[10px]">
                                {/* SECTION: IN */}
                                {inItems.length > 0 && (
                                    <>
                                        <thead>
                                            <tr>
                                                <th colSpan={2} className="pt-2 pb-1 text-center font-bold text-black border-b border-dashed border-gray-300">
                                                    --- BARANG MASUK ---
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderItems(inItems)}
                                        </tbody>
                                    </>
                                )}

                                {/* Spacer if both exist */}
                                {inItems.length > 0 && outItems.length > 0 && (
                                    <tbody><tr><td colSpan={2} className="py-2"></td></tr></tbody>
                                )}

                                {/* SECTION: OUT */}
                                {outItems.length > 0 && (
                                    <>
                                        <thead>
                                            <tr>
                                                <th colSpan={2} className="pt-2 pb-1 text-center font-bold text-black border-b border-dashed border-gray-300">
                                                    --- BARANG KELUAR ---
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderItems(outItems)}
                                        </tbody>
                                    </>
                                )}
                            </table>
                        </div>

                        <div className="border-t-2 border-black pt-2 mb-4 text-black">
                            <div className="flex justify-between text-xs font-bold">
                                <span>TOTAL ITEM</span>
                                <span>{items.length}</span>
                            </div>
                        </div>

                        <div className="text-center text-[9px] text-gray-500">
                            *** TERIMA KASIH ***<br/>
                            Bukti ini sah digenerate oleh sistem
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                    <Button 
                        onClick={handleShare} 
                        isLoading={isSharing}
                        className="w-full !bg-green-600 hover:!bg-green-700 !flex !items-center !justify-center !gap-2"
                    >
                        <ChatIcon className="h-5 w-5" />
                        {isSharing ? 'Memproses...' : 'Kirim Bukti ke WhatsApp'}
                    </Button>
                    <button 
                        onClick={onClose}
                        className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
