
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converts a Blob to a Base64 string.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        // remove "data:mime/type;base64," prefix to get pure base64
        resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Handles file download/sharing across Web and Capacitor platforms.
 * 
 * @param filename Name of the file (e.g., "report.csv")
 * @param data The file content (string, Blob) OR Base64 string if isBase64Data is true
 * @param mimeType The MIME type (e.g., "text/csv", "application/json")
 * @param isBase64Data Set to true if 'data' is already a Base64 string (common for XLSX/Images)
 */
export const downloadFile = async (
    filename: string, 
    data: string | Blob, 
    mimeType: string,
    isBase64Data: boolean = false
) => {
    
  if (Capacitor.isNativePlatform()) {
     // --- NATIVE (ANDROID/iOS) LOGIC ---
     try {
         let base64Data = '';

         if (isBase64Data && typeof data === 'string') {
             base64Data = data;
         } else if (typeof data === 'string') {
             // Assume text data (CSV, JSON), encode to Base64
             // UTF-8 Safe Encoding
             base64Data = btoa(unescape(encodeURIComponent(data)));
         } else if (data instanceof Blob) {
             base64Data = await blobToBase64(data);
         }

         // 1. Write file to the app's Cache directory
         const savedFile = await Filesystem.writeFile({
             path: filename,
             data: base64Data,
             directory: Directory.Cache,
         });

         // 2. Share the file (This opens the native "Share" or "Open With" dialog)
         // This allows users to save to Files, Google Drive, or send via WhatsApp
         await Share.share({
             title: 'Download File',
             text: `File: ${filename}`,
             url: savedFile.uri,
             dialogTitle: 'Simpan atau Bagikan File'
         });

     } catch (e: any) {
         console.error("Native download error:", e);
         alert("Gagal menyimpan/membagikan file: " + (e.message || e));
     }

  } else {
     // --- WEB BROWSER LOGIC ---
     try {
        let blob: Blob;

        if (isBase64Data && typeof data === 'string') {
            // Convert Base64 back to Blob for browser download
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: mimeType });
        } else if (data instanceof Blob) {
            blob = data;
        } else {
            // String data (CSV, JSON)
            blob = new Blob([data as string], { type: `${mimeType};charset=utf-8;` });
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
     } catch (e) {
         console.error("Web download error:", e);
         alert("Gagal mendownload file di browser.");
     }
  }
};
