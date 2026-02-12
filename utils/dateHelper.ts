
/**
 * Calculates the default Transaction Date and Shift based on business rules.
 * Rule:
 * - Day changes at 07:00 AM (Administrative Day).
 */
export const getCurrentShiftAndDate = () => {
    // Ambil mode shift dari settings
    const settings = JSON.parse(localStorage.getItem('app_display_settings') || '{}');
    const shiftMode = settings.shiftMode || '2'; // Default 2 shift

    const now = new Date();
    const currentHour = now.getHours();

    let effectiveDate = new Date(now);
    let shift = '1';

    if (shiftMode === '3') {
        // --- LOGIKA 3 SHIFT ---
        // S1: 07:00 - 14:59
        // S2: 15:00 - 22:59
        // S3: 23:00 - 06:59 (Ganti hari jam 07:00)

        if (currentHour < 7) {
            // Dini hari (sebelum jam 7 pagi) dianggap Shift 3 Kemarin
            effectiveDate.setDate(effectiveDate.getDate() - 1);
            shift = '3';
        } else if (currentHour >= 23) {
            // Jam 11 malam keatas dianggap Shift 3 Hari Ini
            shift = '3';
        } else if (currentHour >= 15) {
            // Jam 3 sore - 11 malam dianggap Shift 2
            shift = '2';
        } else {
            // Jam 7 pagi - 3 sore dianggap Shift 1
            shift = '1';
        }
    } else {
        // --- LOGIKA 2 SHIFT (Default) ---
        // S1: 07:00 - 15:59
        // S2: 16:00 - 06:59 (Ganti hari jam 07:00)

        if (currentHour < 7) {
            effectiveDate.setDate(effectiveDate.getDate() - 1);
            shift = '2';
        } else if (currentHour >= 16) {
            shift = '2';
        } else {
            shift = '1';
        }
    }

    // Format date as YYYY-MM-DD manually to avoid UTC issues
    const year = effectiveDate.getFullYear();
    const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
    const day = String(effectiveDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    return { date: dateString, shift };
};

/**
 * Membuat timestamp ISO string dari operational date dan jam saat ini.
 * Menghindari masalah timezone dengan menggunakan UTC hours.
 *
 * @param operationalDate - Tanggal operational (YYYY-MM-DD) dari getCurrentShiftAndDate()
 * @returns ISO string timestamp yang benar untuk disimpan ke database
 */
export const createOperationalTimestamp = (operationalDate: string): string => {
    const now = new Date();
    const [year, month, day] = operationalDate.split('-').map(Number);

    // Buat Date dengan jam saat ini, menggunakan UTC untuk menghindari timezone shift
    const timestamp = new Date(Date.UTC(
        year,
        month - 1, // JavaScript months are 0-indexed
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
    ));

    return timestamp.toISOString();
};
