
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { XIcon } from '../../constants';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const QRScannerModal: React.FC<QRScannerProps> = ({ onScanSuccess, onClose }) => {
    const [error, setError] = useState<string>('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isRunningRef = useRef<boolean>(false);

    useEffect(() => {
        const startScanner = async () => {
            try {
                // Ensure previous instance is stopped
                if (scannerRef.current) {
                    if (isRunningRef.current) {
                        await scannerRef.current.stop();
                        isRunningRef.current = false;
                    }
                    scannerRef.current.clear();
                }

                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    const cameraId = devices[devices.length - 1].id;
                    const html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;
                    
                    await html5QrCode.start(
                        cameraId, 
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        (decodedText) => {
                            stopScanner().then(() => onScanSuccess(decodedText));
                        },
                        (errorMessage) => {
                            // ignore
                        }
                    );
                    isRunningRef.current = true;
                } else {
                    setError('Kamera tidak ditemukan.');
                }
            } catch (err: any) {
                console.error("Camera Error:", err);
                setError('Gagal mengakses kamera. Pastikan izin kamera aktif di Pengaturan Aplikasi.');
            }
        };

        // Delay to ensure DOM is rendered
        const timer = setTimeout(startScanner, 100);

        return () => {
            clearTimeout(timer);
            // Critical cleanup: Stop camera when component unmounts
            stopScanner();
        };
    }, []);

    const stopScanner = async () => {
        if (scannerRef.current && isRunningRef.current) {
            try {
                isRunningRef.current = false;
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.warn("Stop scanner warning:", err);
            }
        }
    };

    const handleClose = async () => {
        await stopScanner();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col justify-center items-center">
            <div className="absolute top-4 right-4 z-[101]">
                <button onClick={handleClose} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/40">
                    <XIcon className="h-8 w-8" />
                </button>
            </div>
            
            <div className="w-full max-w-md px-4 text-center">
                <h2 className="text-white text-xl font-bold mb-4">Arahkan Kamera ke QR Code</h2>
                {error ? (
                    <div className="bg-red-500/80 text-white p-4 rounded-lg">{error}</div>
                ) : (
                    <div id="reader" className="bg-black rounded-lg overflow-hidden border-2 border-white/50 shadow-2xl w-full h-[400px]"></div>
                )}
                <p className="text-white/60 text-sm mt-4">Pastikan QR Code terlihat jelas dan terang.</p>
            </div>
        </div>
    );
};

export default QRScannerModal;
