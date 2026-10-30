const express = require('express');
const router = express.Router();
const db = require('../utils/db');

/**
 * GET /transkrip/:nim
 * Ambil transkrip mahasiswa berdasarkan NIM
 * - Mahasiswa: hanya transkrip sendiri (sudah divalidasi oleh gateway)
 * - Admin: bisa akses semua transkrip
 */
router.get('/transkrip/:nim', async (req, res) => {
    try {
        const nim = req.params.nim;
        const user = req.user;

        // Ambil data mahasiswa
        const mahasiswa = await db.get(
            'SELECT * FROM users WHERE nim = ? AND role = ?',
            [nim, 'mahasiswa']
        );

        if (!mahasiswa) {
            return res.status(404).json({
                error: 'Mahasiswa not found',
                code: 'NOT_FOUND'
            });
        }

        // Ambil transkrip
        const transkrip = await db.all(`
            SELECT *
            FROM transkrip
            WHERE mahasiswa_id = ?
            ORDER BY semester DESC, nama_matakuliah
        `, [mahasiswa.id]);

        // Hitung statistik
        let totalSks = 0;
        let totalNilaiXSks = 0;

        transkrip.forEach(item => {
            const sks = item.sks || 3;
            totalSks += sks;
            const nilaiAngka = convertLetterToNumber(item.nilai_huruf);
            totalNilaiXSks += nilaiAngka * sks;
        });

        const ipk = totalSks > 0 ? (totalNilaiXSks / totalSks).toFixed(2) : 0;

        console.log(`[OK] Transkrip diakses: NIM ${nim} oleh role ${user.role}`);

        res.json({
            success: true,
            mahasiswa: {
                nim: mahasiswa.nim,
                nama: mahasiswa.nama
            },
            statistik: {
                total_sks: totalSks,
                ipk: parseFloat(ipk),
                total_matakuliah: transkrip.length
            },
            transkrip: transkrip
        });
    } catch (error) {
        console.error('Error fetching transkrip:', error);
        res.status(500).json({
            error: 'Failed to fetch transkrip',
            code: 'FETCH_FAILED'
        });
    }
});

/**
 * POST /transkrip/sinkron
 * Sinkronisasi nilai dari Service Nilai ke Transkrip
 * Hanya bisa dipanggil oleh Service Nilai dengan service token
 */
router.post('/transkrip/sinkron', async (req, res) => {
    try {
        const user = req.user;

        // Pastikan ini service token
        if (user.role !== 'service') {
            return res.status(403).json({
                error: 'Only service can access this endpoint',
                code: 'SERVICE_ONLY'
            });
        }

        const { grades } = req.body;

        if (!grades || !Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({
                error: 'Grades array required',
                code: 'MISSING_GRADES'
            });
        }

        console.log(`[INFO] Menyinkronkan ${grades.length} nilai ke transkrip...`);

        // Insert atau update transkrip menggunakan MySQL ON DUPLICATE KEY
        const upsertQuery = `
            INSERT INTO transkrip (
                mahasiswa_id, kelas_id, kode_kelas, nama_matakuliah,
                semester, nilai_akhir, nilai_huruf, sks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 3)
            ON DUPLICATE KEY UPDATE
                nilai_akhir = VALUES(nilai_akhir),
                nilai_huruf = VALUES(nilai_huruf)
        `;

        let syncedCount = 0;
        for (const grade of grades) {
            await db.run(upsertQuery, [
                grade.mahasiswa_id,
                grade.kelas_id,
                grade.kode_kelas,
                grade.nama_matakuliah,
                grade.semester,
                grade.nilai_akhir,
                grade.nilai_huruf
            ]);
            syncedCount++;
        }

        console.log(`[OK] Berhasil sinkron ${syncedCount} nilai ke transkrip`);

        res.json({
            success: true,
            message: 'Grades synced to transcript successfully',
            synced_count: syncedCount
        });
    } catch (error) {
        console.error('Error syncing transkrip:', error);
        res.status(500).json({
            error: error.message || 'Failed to sync transkrip',
            code: 'SYNC_FAILED'
        });
    }
});

/**
 * Helper: Konversi nilai huruf ke angka untuk perhitungan IPK
 */
function convertLetterToNumber(letter) {
    const map = {
        'A': 4.0,
        'A-': 3.7,
        'B+': 3.3,
        'B': 3.0,
        'B-': 2.7,
        'C+': 2.3,
        'C': 2.0,
        'C-': 1.7,
        'D': 1.0,
        'E': 0.0
    };
    return map[letter] || 0.0;
}

module.exports = router;
