
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Material } from '../types';
import SearchableSelect from '../components/ui/SearchableSelect';
import Button from '../components/ui/Button';
import { downloadFile } from '../utils/fileHelper';
import { toPng } from 'html-to-image';

const QRCodeGenerator: React.FC = () => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchMaterials = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('materials').select('*').order('name');
            if (error) {
                console.error("Failed to fetch materials:", error);
            } else if (data) {
                setMaterials(data as Material[]);
            }
            setLoading(false);
        };
        fetchMaterials();
    }, []);

    const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
    const materialOptions = materials.map(m => ({ value: m.id, label: m.name }));

    const handleDownloadLabel = async () => {
        if (!selectedMaterial || !labelRef.current) return;
        setDownloading(true);
        
        try {
            // Generate Image from DOM Element
            const dataUrl = await toPng(labelRef.current, { cacheBust: true, backgroundColor: 'white' });
            
            // Convert DataURL to Blob for download helper
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const filename = `Label_${selectedMaterial.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            
            await downloadFile(filename, blob, 'image/png');
        } catch (error) {
            console.error('Error generating label:', error);
            alert('Gagal membuat label.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">QR Label Generator</h1>

            <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md space-y-6">
                <div className="max-w-md">
                    <SearchableSelect
                        id="material-select"
                        label="Pilih Barang"
                        options={materialOptions}
                        value={selectedMaterialId}
                        onChange={(value) => setSelectedMaterialId(value)}
                        placeholder={loading ? "Memuat barang..." : "Ketik untuk mencari barang..."}
                    />
                </div>

                {selectedMaterial && (
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col lg:flex-row gap-8 items-start">
                            {/* PREVIEW LABEL AREA */}
                            <div className="flex flex-col items-center gap-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Preview Label Cetak</h3>
                                
                                {/* Label Fisik yang akan di-capture */}
                                <div 
                                    ref={labelRef} 
                                    className="w-[350px] bg-white border-2 border-black p-6 flex flex-col items-center text-center shadow-lg"
                                >
                                    <h2 className="text-xl font-black text-black leading-tight mb-1">{selectedMaterial.name}</h2>
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">{selectedMaterial.department || 'GUDANG UMUM'}</p>
                                    
                                    <div className="border-4 border-black p-2 mb-4">
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedMaterial.id)}`}
                                            alt="QR"
                                            className="w-40 h-40 object-contain"
                                            crossOrigin="anonymous" // Penting untuk html-to-image
                                        />
                                    </div>

                                    <div className="w-full border-t-2 border-black pt-2 flex justify-between text-left">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">ID SYSTEM</p>
                                            <p className="text-xs font-mono font-bold text-black">{selectedMaterial.id.split('-')[0]}...</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">SATUAN</p>
                                            <p className="text-lg font-black text-black">{selectedMaterial.unit}</p>
                                        </div>
                                    </div>
                                    {selectedMaterial.machine_number && (
                                        <div className="w-full text-left mt-1">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">LOKASI / MESIN</p>
                                            <p className="text-sm font-bold text-black">{selectedMaterial.machine_number}</p>
                                        </div>
                                    )}
                                </div>

                                <Button onClick={handleDownloadLabel} isLoading={downloading} className="w-full sm:w-auto !bg-slate-800 hover:!bg-slate-900">
                                    Download Label (.PNG)
                                </Button>
                            </div>

                            {/* Info */}
                            <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800">
                                <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">Panduan Cetak</h4>
                                <ul className="list-disc ml-5 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                    <li>Label di samping didesain untuk ukuran kertas standar (Stiker A6 atau Thermal 100x150mm).</li>
                                    <li>Klik tombol <b>Download Label</b> untuk menyimpan gambar PNG.</li>
                                    <li>Buka gambar tersebut dan print dengan skala <b>"Fit to Page"</b> atau 100%.</li>
                                    <li>Tempel label pada fisik barang atau rak penyimpanan untuk memudahkan scan stock opname.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRCodeGenerator;
