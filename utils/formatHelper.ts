
/**
 * Memformat angka ke format Indonesia (id-ID)
 * Jika angka bulat (misal 120), akan tampil "120"
 * Jika angka desimal (misal 120.5), akan tampil "120,5"
 * Maksimal desimal tetap 2 angka.
 */
export const formatNumber = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';

    // Ambil pengaturan dari localStorage (default: auto)
    const settings = JSON.parse(localStorage.getItem('app_display_settings') || '{}');
    const decimalMode = settings.decimalMode || 'auto';

    if (decimalMode === 'always') {
        return num.toLocaleString('id-ID', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    if (decimalMode === 'none') {
        return Math.round(num).toLocaleString('id-ID', {
            maximumFractionDigits: 0
        });
    }

    // Default 'auto': Sembunyikan desimal jika nilainya .00
    return num.toLocaleString('id-ID', {
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
};
