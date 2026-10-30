const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
    console.log('[SEED] Memulai seeding data awal...');

    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'zero_trust_sistem_nilai',
            port: parseInt(process.env.DB_PORT) || 3306
        });

        const hash = (p) => bcrypt.hashSync(p, 10);

        // Reset data
        console.log('[SEED] Reset data tabel...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const t of ['audit_logs','transkrip','nilai','kelas','devices','refresh_tokens','users']) {
            await conn.query(`TRUNCATE TABLE \`${t}\``);
        }
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // Users
        const users = [
            ['admin',      hash('admin123'), 'admin',     null,      null,               'Administrator Sistem'],
            ['dosen1',     hash('dosen123'), 'dosen',     null,      '198501012010121001','Dr. Budi Santoso, M.Kom'],
            ['dosen2',     hash('dosen123'), 'dosen',     null,      '199002152012122002','Siti Aminah, S.Kom, M.T'],
            ['mahasiswa1', hash('mhs123'),   'mahasiswa', '2021001', null,               'Ahmad Rizki'],
            ['mahasiswa2', hash('mhs123'),   'mahasiswa', '2021002', null,               'Dewi Lestari'],
            ['mahasiswa3', hash('mhs123'),   'mahasiswa', '2021003', null,               'Eko Prasetyo'],
        ];
        for (const u of users) {
            await conn.query('INSERT INTO users (username,password,role,nim,nip,nama) VALUES (?,?,?,?,?,?)', u);
        }
        console.log('[OK] Insert 6 users berhasil');

        // Devices (1 per user)
        const devices = [
            [1,'DEVICE-ADMIN-001','Admin Laptop'],
            [2,'DEVICE-DOSEN1-001','Dosen1 Laptop'],
            [3,'DEVICE-DOSEN2-001','Dosen2 Laptop'],
            [4,'DEVICE-MHS1-001','Mahasiswa1 Phone'],
            [5,'DEVICE-MHS2-001','Mahasiswa2 Phone'],
            [6,'DEVICE-MHS3-001','Mahasiswa3 Laptop'],
        ];
        for (const d of devices) {
            await conn.query('INSERT INTO devices (user_id,device_id,device_name) VALUES (?,?,?)', d);
        }
        console.log('[OK] Insert 6 devices terdaftar berhasil');

        // Kelas
        await conn.query("INSERT INTO kelas (kode_kelas,nama_matakuliah,semester,dosen_id) VALUES ('KP001-A','Keamanan Informasi','Ganjil 2024/2025',2)");
        await conn.query("INSERT INTO kelas (kode_kelas,nama_matakuliah,semester,dosen_id) VALUES ('KP002-B','Jaringan Komputer','Ganjil 2024/2025',3)");
        console.log('[OK] Insert 2 kelas berhasil');

        // Nilai
        const nilai = [
            [1,4,85,80,88,84.5,'A',0],
            [1,5,75,78,80,77.8,'B',0],
            [1,6,90,85,92,89,'A',0],
            [2,4,78,82,85,81.8,'A-',0],
            [2,5,88,85,90,87.8,'A',0],
            [2,6,0,0,0,0,null,0],
        ];
        for (const n of nilai) {
            await conn.query('INSERT INTO nilai (kelas_id,mahasiswa_id,tugas,uts,uas,nilai_akhir,nilai_huruf,is_final) VALUES (?,?,?,?,?,?,?,?)', n);
        }
        console.log('[OK] Insert 6 data nilai berhasil');

        console.log('\n[SUMMARY] Data awal berhasil disiapkan:');
        console.log('  - 1 Admin, 2 Dosen, 3 Mahasiswa');
        console.log('  - 2 Kelas kuliah (dosen berbeda)');
        console.log('  - 6 Device terdaftar (1 device per akun)');
        console.log('  - 6 Data nilai kelas');
        console.log('\n[KREDENSIAL AKUN]:');
        console.log('  admin      | admin123 | DEVICE-ADMIN-001');
        console.log('  dosen1     | dosen123 | DEVICE-DOSEN1-001');
        console.log('  dosen2     | dosen123 | DEVICE-DOSEN2-001');
        console.log('  mahasiswa1 | mhs123   | DEVICE-MHS1-001');
        console.log('  mahasiswa2 | mhs123   | DEVICE-MHS2-001');
        console.log('  mahasiswa3 | mhs123   | DEVICE-MHS3-001');

    } catch (err) {
        console.error('[ERROR]', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

seedDatabase();
