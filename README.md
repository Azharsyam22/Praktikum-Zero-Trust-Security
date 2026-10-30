# Zero Trust Security — Sistem Nilai

**Tugas Praktikum Individu — Keamanan Informasi (KP70065004)**  
**Muhammad Azharuddiya Syam Ramadhan — 247006111168**  
**Informatika, Universitas Siliwangi**

---

## Prinsip Zero Trust yang Diterapkan

| Prinsip | Implementasi |
|---------|-------------|
| **Never Trust, Always Verify** | Setiap request diverifikasi token JWT + device ID |
| **Least Privilege** | Role-based + ownership-based access control |
| **Assume Breach** | Service hanya bisa diakses via gateway (gateway secret) |

---

## Arsitektur

```
Client (Postman)
      │
      ▼
API Gateway :3000  ←── Policy Engine (PE/PA)
  │         │                 │
  ▼         ▼           Audit Logger
Svc Nilai  Svc Transkrip
  :3001      :3002
  │              │
  └──────┬───────┘
         ▼
      MySQL DB
```

| Komponen | Port | Role NIST SP 800-207 |
|----------|------|----------------------|
| API Gateway | 3000 | PEP (Policy Enforcement Point) |
| Policy Engine | — | PE / PA (di dalam Gateway) |
| Service Nilai | 3001 | Resource |
| Service Transkrip | 3002 | Resource |

---

## Cara Menjalankan

### Prasyarat
- Node.js 18+
- MySQL (XAMPP / Laragon / MySQL standalone)

### 1. Install dependencies
```bash
npm install
```

### 2. Setup database (sekali saja)
```bash
npm run setup
npm run seed
```

### 3. Jalankan semua service
```bash
npm run dev
```

Atau jalankan terpisah di 3 terminal:
```bash
npm run gateway          # Terminal 1
npm run service-nilai    # Terminal 2
npm run service-transkrip # Terminal 3
```

---

## Akun & Device Default

| Username | Password | Role | Device ID | NIM/NIP |
|----------|----------|------|-----------|---------|
| admin | admin123 | admin | DEVICE-ADMIN-001 | — |
| dosen1 | dosen123 | dosen | DEVICE-DOSEN1-001 | 198501012010121001 |
| dosen2 | dosen123 | dosen | DEVICE-DOSEN2-001 | 199002152012122002 |
| mahasiswa1 | mhs123 | mahasiswa | DEVICE-MHS1-001 | 2021001 |
| mahasiswa2 | mhs123 | mahasiswa | DEVICE-MHS2-001 | 2021002 |
| mahasiswa3 | mhs123 | mahasiswa | DEVICE-MHS3-001 | 2021003 |

**Service credentials:**
- Client ID: `service-nilai-client`
- Client Secret: `service-client-secret-2024-very-secure`

---

## Endpoints

### Authentication
| Method | Endpoint | Akses |
|--------|----------|-------|
| POST | `/auth/login` | Semua (butuh X-Device-ID) |
| POST | `/auth/refresh` | Semua |
| POST | `/auth/logout` | Semua |
| POST | `/auth/service` | Service Nilai |

### Nilai
| Method | Endpoint | Role | Kondisi |
|--------|----------|------|---------|
| GET | `/nilai` | mahasiswa, dosen | Mahasiswa: nilai sendiri; Dosen: kelas diampu |
| PUT | `/nilai/:id` | dosen | Kelas diampu, belum final, jam 07:00–21:00 |
| POST | `/kelas/:id/finalisasi` | dosen | Kelas diampu, jam 07:00–21:00 |

### Transkrip
| Method | Endpoint | Role | Kondisi |
|--------|----------|------|---------|
| GET | `/transkrip/:nim` | mahasiswa, admin | Mahasiswa: NIM sendiri; Admin: semua |
| POST | `/transkrip/sinkron` | service | Hanya service token |

---

## Konfigurasi

Edit file `.env` untuk mengubah konfigurasi:

```env
# Jam akses update/finalisasi nilai (format HH:MM)
ACCESS_TIME_START=07:00
ACCESS_TIME_END=21:00

# Database MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=zero_trust_sistem_nilai
```

---

## Struktur Project

```
├── gateway/
│   ├── middleware/
│   │   ├── auth.js               # Verifikasi JWT token
│   │   ├── device-verification.js # Verifikasi X-Device-ID
│   │   └── time-based-access.js  # Cek jam akses
│   ├── routes/
│   │   ├── auth.js               # Endpoint /auth/*
│   │   └── proxy.js              # Policy checks + proxy ke service
│   ├── utils/
│   │   ├── audit-logger.js       # Catat semua keputusan akses
│   │   ├── db.js                 # Koneksi MySQL
│   │   └── jwt.js                # Generate & verify token
│   ├── config.js
│   ├── policy-engine.js          # Login, token management
│   └── server.js
│
├── services/
│   ├── nilai/
│   │   ├── middleware/verify-gateway.js  # Cek gateway secret + token
│   │   ├── routes/nilai.js               # GET/PUT nilai, finalisasi
│   │   ├── utils/
│   │   │   ├── db.js
│   │   │   ├── grade-calculator.js       # Hitung nilai akhir & huruf
│   │   │   └── jwt.js
│   │   ├── config.js
│   │   └── server.js
│   │
│   └── transkrip/
│       ├── middleware/verify-gateway.js  # Cek gateway secret + token
│       ├── routes/transkrip.js           # GET transkrip, sinkron
│       ├── utils/
│       │   ├── db.js
│       │   └── jwt.js
│       ├── config.js
│       └── server.js
│
├── database/
│   └── schema.sql
│
├── scripts/
│   ├── setup-database.js   # Buat database & tabel
│   ├── seed-data.js        # Insert data awal
│   └── dev.js              # Jalankan semua service
│
├── .env
├── .gitignore
├── package.json
├── README.md
└── ARCHITECTURE.md
```
