const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { calculateFinalGrade, convertToLetterGrade } = require('../utils/grade-calculator');
const config = require('../config');

/**
 * GET /nilai
 * Ambil daftar nilai
 * - Mahasiswa: hanya nilai sendiri (berdasarkan req.user.sub)
 * - Dosen: nilai semua mahasiswa di kelas yang diampu (berdasarkan req.user.sub)
 */
router.get('/nilai', async (req, res) => {
    try {
        const user = req.user;
        const targetMahasiswaId = req.query.mahasiswa_id || user.sub;
        const targetDosenId = req.query.dosen_id || user.sub;

        let query;
        let params = [];

        if (user.role === 'mahasiswa') {
            // Mahasiswa lihat nilai sendiri
            query = `
                SELECT 
                    n.*,
                    k.kode_kelas,
                    k.nama_matakuliah,
                    k.semester,
                    u.nama as nama_mahasiswa,
                    u.nim,
                    d.nama as nama_dosen
                FROM nilai n
                JOIN kelas k ON n.kelas_id = k.id
                JOIN users u ON n.mahasiswa_id = u.id
                JOIN users d ON k.dosen_id = d.id
                WHERE n.mahasiswa_id = ?
                ORDER BY k.semester DESC, k.nama_matakuliah
            `;
            params = [targetMahasiswaId];
        } else if (user.role === 'dosen') {
            // Dosen lihat nilai di kelas yang diampu
            query = `
                SELECT 
                    n.*,
                    k.kode_kelas,
                    k.nama_matakuliah,
                    k.semester,
                    u.nama as nama_mahasiswa,
                    u.nim
                FROM nilai n
                JOIN kelas k ON n.kelas_id = k.id
                JOIN users u ON n.mahasiswa_id = u.id
                WHERE k.dosen_id = ?
                ORDER BY k.kode_kelas, u.nama
            `;
            params = [targetDosenId];
        } else {
            return res.status(403).json({
                error: 'Access denied',
                code: 'FORBIDDEN'
            });
        }

        const nilai = await db.all(query, params);

        res.json({
            success: true,
            count: nilai.length,
            data: nilai
        });
    } catch (error) {
        console.error('Error fetching nilai:', error);
        res.status(500).json({
            error: 'Failed to fetch nilai',
            code: 'FETCH_FAILED'
        });
    }
});

/**
 * PUT /nilai/:id
 * Update nilai (hanya dosen, divalidasi oleh gateway & service)
 */
router.put('/nilai/:id', async (req, res) => {
    try {
        const nilaiId = req.params.id;
        const { tugas, uts, uas } = req.body;

        // Validasi input
        if (tugas === undefined && uts === undefined && uas === undefined) {
            return res.status(400).json({
                error: 'At least one grade component required',
                code: 'MISSING_GRADE_DATA'
            });
        }

        // Validasi range nilai (0-100)
        const validateGrade = (grade, name) => {
            if (grade !== undefined && (grade < 0 || grade > 100)) {
                throw new Error(`${name} must be between 0 and 100`);
            }
        };

        validateGrade(tugas, 'Tugas');
        validateGrade(uts, 'UTS');
        validateGrade(uas, 'UAS');

        // Ambil nilai saat ini
        const currentNilai = await db.get('SELECT * FROM nilai WHERE id = ?', [nilaiId]);

        if (!currentNilai) {
            return res.status(404).json({
                error: 'Nilai not found',
                code: 'NOT_FOUND'
            });
        }

        // Update komponen nilai
        const newTugas = tugas !== undefined ? parseFloat(tugas) : currentNilai.tugas;
        const newUts = uts !== undefined ? parseFloat(uts) : currentNilai.uts;
        const newUas = uas !== undefined ? parseFloat(uas) : currentNilai.uas;

        // Hitung nilai akhir
        const nilaiAkhir = calculateFinalGrade(newTugas, newUts, newUas);
        const nilaiHuruf = convertToLetterGrade(nilaiAkhir);

        // Update database
        await db.run(`
            UPDATE nilai
            SET tugas = ?,
                uts = ?,
                uas = ?,
                nilai_akhir = ?,
                nilai_huruf = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [newTugas, newUts, newUas, nilaiAkhir, nilaiHuruf, nilaiId]);

        // Ambil nilai yang sudah diupdate
        const updatedNilai = await db.get('SELECT * FROM nilai WHERE id = ?', [nilaiId]);

        console.log(`[OK] Nilai updated: ID ${nilaiId} - Final: ${nilaiAkhir} (${nilaiHuruf})`);

        res.json({
            success: true,
            message: 'Nilai updated successfully',
            data: updatedNilai
        });
    } catch (error) {
        console.error('Error updating nilai:', error);
        res.status(500).json({
            error: error.message || 'Failed to update nilai',
            code: 'UPDATE_FAILED'
        });
    }
});

/**
 * POST /kelas/:id/finalisasi
 * Finalisasi nilai untuk semua mahasiswa di kelas
 * Setelah finalisasi, panggil Service Transkrip untuk sinkronisasi via Gateway
 */
router.post('/kelas/:id/finalisasi', async (req, res) => {
    try {
        const kelasId = req.params.id;

        // Ambil info kelas
        const kelas = await db.get(`
            SELECT k.*, u.nama as nama_dosen
            FROM kelas k
            JOIN users u ON k.dosen_id = u.id
            WHERE k.id = ?
        `, [kelasId]);

        if (!kelas) {
            return res.status(404).json({
                error: 'Kelas not found',
                code: 'NOT_FOUND'
            });
        }

        // Ambil semua nilai di kelas ini
        const nilaiList = await db.all(`
            SELECT n.*, u.nama, u.nim
            FROM nilai n
            JOIN users u ON n.mahasiswa_id = u.id
            WHERE n.kelas_id = ?
        `, [kelasId]);

        if (nilaiList.length === 0) {
            return res.status(400).json({
                error: 'No grades found in this class',
                code: 'NO_GRADES'
            });
        }

        // Cek apakah ada nilai yang belum lengkap
        const incompleteGrades = nilaiList.filter(n => 
            n.nilai_akhir === 0 || n.nilai_huruf === null || n.nilai_huruf === ''
        );

        if (incompleteGrades.length > 0) {
            return res.status(400).json({
                error: 'Cannot finalize: some grades are incomplete',
                code: 'INCOMPLETE_GRADES',
                incompleteCount: incompleteGrades.length,
                incomplete: incompleteGrades.map(n => ({
                    nim: n.nim,
                    nama: n.nama
                }))
            });
        }

        // Finalisasi semua nilai
        await db.run(`
            UPDATE nilai
            SET is_final = 1,
                finalized_at = NOW()
            WHERE kelas_id = ?
        `, [kelasId]);

        console.log(`[INFO] Nilai finalized untuk kelas ${kelas.kode_kelas} (${nilaiList.length} mahasiswa)`);

        // Dapatkan service token dari Gateway untuk memanggil Service Transkrip
        console.log('[INFO] Request service token dari Gateway...');
        const tokenResponse = await fetch(`${config.gatewayUrl}/auth/service`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: config.service.clientId,
                clientSecret: config.service.clientSecret
            })
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to get service token');
        }

        const { serviceToken } = await tokenResponse.json();

        // Sinkronisasi ke Service Transkrip (melalui gateway)
        console.log('[INFO] Mengirim sinkronisasi ke Service Transkrip melalui Gateway...');
        
        const syncData = nilaiList.map(n => ({
            mahasiswa_id: n.mahasiswa_id,
            kelas_id: kelasId,
            kode_kelas: kelas.kode_kelas,
            nama_matakuliah: kelas.nama_matakuliah,
            semester: kelas.semester,
            nilai_akhir: n.nilai_akhir,
            nilai_huruf: n.nilai_huruf
        }));

        const syncResponse = await fetch(`${config.gatewayUrl}/transkrip/sinkron`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceToken}`
            },
            body: JSON.stringify({ grades: syncData })
        });

        if (!syncResponse.ok) {
            const errorData = await syncResponse.json();
            console.error('[ERROR] Sync to transkrip failed:', errorData);
            throw new Error('Failed to sync to transkrip service');
        }

        const syncResult = await syncResponse.json();
        console.log('[OK] Berhasil sinkron ke Service Transkrip:', syncResult);

        res.json({
            success: true,
            message: 'Grades finalized and synced to transcript service',
            kelas: {
                id: kelas.id,
                kode_kelas: kelas.kode_kelas,
                nama_matakuliah: kelas.nama_matakuliah
            },
            finalized_count: nilaiList.length,
            sync_result: syncResult
        });
    } catch (error) {
        console.error('Error finalizing grades:', error);
        res.status(500).json({
            error: error.message || 'Failed to finalize grades',
            code: 'FINALIZATION_FAILED'
        });
    }
});

module.exports = router;
