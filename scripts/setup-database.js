const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    console.log('[SETUP] Menghubungkan ke MySQL...');

    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT) || 3306,
            multipleStatements: true
        });

        const dbName = process.env.DB_NAME || 'zero_trust_sistem_nilai';

        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await conn.query(`USE \`${dbName}\``);
        console.log(`[OK] Database '${dbName}' siap.`);

        const tables = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('mahasiswa','dosen','admin') NOT NULL,
                nim VARCHAR(20) UNIQUE,
                nip VARCHAR(20) UNIQUE,
                nama VARCHAR(100) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS devices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                device_id VARCHAR(100) NOT NULL,
                device_name VARCHAR(100),
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, device_id)
            );

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                revoked TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS kelas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kode_kelas VARCHAR(20) UNIQUE NOT NULL,
                nama_matakuliah VARCHAR(100) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                dosen_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dosen_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS nilai (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kelas_id INT NOT NULL,
                mahasiswa_id INT NOT NULL,
                tugas FLOAT DEFAULT 0,
                uts FLOAT DEFAULT 0,
                uas FLOAT DEFAULT 0,
                nilai_akhir FLOAT DEFAULT 0,
                nilai_huruf VARCHAR(5),
                is_final TINYINT(1) DEFAULT 0,
                finalized_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (kelas_id) REFERENCES kelas(id),
                FOREIGN KEY (mahasiswa_id) REFERENCES users(id),
                UNIQUE(kelas_id, mahasiswa_id)
            );

            CREATE TABLE IF NOT EXISTS transkrip (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mahasiswa_id INT NOT NULL,
                kelas_id INT NOT NULL,
                kode_kelas VARCHAR(20) NOT NULL,
                nama_matakuliah VARCHAR(100) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                nilai_akhir FLOAT NOT NULL,
                nilai_huruf VARCHAR(5) NOT NULL,
                sks INT DEFAULT 3,
                synced_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (mahasiswa_id) REFERENCES users(id),
                FOREIGN KEY (kelas_id) REFERENCES kelas(id),
                UNIQUE(mahasiswa_id, kelas_id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                subject_type ENUM('user','service','unknown') NOT NULL,
                subject_id VARCHAR(100),
                subject_role VARCHAR(50),
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                device_id VARCHAR(100),
                result ENUM('allow','deny') NOT NULL,
                reason TEXT,
                ip_address VARCHAR(50),
                user_agent TEXT
            );
        `;

        await conn.query(tables);
        console.log('[OK] Semua tabel berhasil dibuat.');
        console.log('[DONE] Setup database selesai!');

    } catch (err) {
        console.error('[ERROR]', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setupDatabase();
