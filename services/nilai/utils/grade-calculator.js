/**
 * Hitung nilai akhir dari komponen nilai
 * Bobot: Tugas 30%, UTS 30%, UAS 40%
 */
function calculateFinalGrade(tugas, uts, uas) {
    const nilaiAkhir = (tugas * 0.3) + (uts * 0.3) + (uas * 0.4);
    return Math.round(nilaiAkhir * 100) / 100; // 2 decimal places
}

/**
 * Konversi nilai angka ke huruf
 */
function convertToLetterGrade(nilaiAkhir) {
    if (nilaiAkhir >= 85) return 'A';
    if (nilaiAkhir >= 80) return 'A-';
    if (nilaiAkhir >= 75) return 'B+';
    if (nilaiAkhir >= 70) return 'B';
    if (nilaiAkhir >= 65) return 'B-';
    if (nilaiAkhir >= 60) return 'C+';
    if (nilaiAkhir >= 55) return 'C';
    if (nilaiAkhir >= 50) return 'C-';
    if (nilaiAkhir >= 45) return 'D';
    return 'E';
}

module.exports = {
    calculateFinalGrade,
    convertToLetterGrade
};
