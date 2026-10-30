# Arsitektur Zero Trust - Sistem Nilai

## Diagram Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│                   (Mahasiswa / Dosen / Admin)                    │
│                                                                   │
│  Headers:                                                         │
│  - Authorization: Bearer <access_token>                           │
│  - X-Device-ID: <device_id>                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS (semua request)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              API GATEWAY (Port 3000) - PEP                       │
│  Role: Policy Enforcement Point (NIST SP 800-207)                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         POLICY ENGINE / POLICY ADMINISTRATOR             │    │
│  │                                                           │    │
│  │  • Autentikasi (login, refresh, logout)                  │    │
│  │  • Generate & Verify JWT Tokens                          │    │
│  │  • Device Verification                                   │    │
│  │  • Time-based Access Control                             │    │
│  │  • Role-based Policy Checks                              │    │
│  │  • Ownership Verification                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AUDIT LOGGER                                │    │
│  │  Log setiap keputusan: allow/deny + reason               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Forward Request dengan:                                          │
│  - Header: X-Gateway-Secret                                       │
│  - Header: Authorization (unchanged)                              │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
    ┌───────────▼──────────┐  ┌──────────▼───────────┐
    │ Service Nilai        │  │ Service Transkrip     │
    │ (Port 3001)          │  │ (Port 3002)           │
    │ Resource             │  │ Resource              │
    │                      │  │                       │
    │ • Verify Gateway     │  │ • Verify Gateway      │
    │   Secret             │  │   Secret              │
    │ • Re-verify Token    │  │ • Re-verify Token     │
    │ • GET /nilai         │  │ • GET /transkrip/:nim │
    │ • PUT /nilai/:id     │  │ • POST /transkrip/    │
    │ • POST /kelas/:id/   │  │   sinkron             │
    │   finalisasi         │  │                       │
    └──────────┬───────────┘  └───────────┬───────────┘
               │                          │
               │                          │
               │    Service-to-Service    │
               │    Call via Gateway      │
               │    (dengan service token)│
               └──────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     DATABASE          │
              │     (SQLite)          │
              │                       │
              │  • users              │
              │  • devices            │
              │  • refresh_tokens     │
              │  • kelas              │
              │  • nilai              │
              │  • transkrip          │
              │  • audit_logs         │
              └───────────────────────┘
```

## Flow Autentikasi

```
┌──────┐                    ┌─────────┐                 ┌──────────┐
│Client│                    │ Gateway │                 │ Database │
└──┬───┘                    └────┬────┘                 └────┬─────┘
   │                             │                           │
   │ POST /auth/login            │                           │
   │ + X-Device-ID               │                           │
   ├────────────────────────────►│                           │
   │                             │                           │
   │                             │ Verify credentials        │
   │                             ├──────────────────────────►│
   │                             │                           │
   │                             │ Verify device registered  │
   │                             ├──────────────────────────►│
   │                             │                           │
   │                             │ Generate access token     │
   │                             │ Generate refresh token    │
   │                             │                           │
   │                             │ Store refresh token       │
   │                             ├──────────────────────────►│
   │                             │                           │
   │                             │ Log access (allow)        │
   │                             ├──────────────────────────►│
   │                             │                           │
   │ { accessToken,              │                           │
   │   refreshToken }            │                           │
   │◄────────────────────────────┤                           │
   │                             │                           │
```

## Flow Request dengan Policy Check

```
┌──────┐    ┌─────────┐    ┌────────────┐    ┌─────────┐    ┌──────────┐
│Client│    │ Gateway │    │Policy Check│    │ Service │    │ Database │
└──┬───┘    └────┬────┘    └─────┬──────┘    └────┬────┘    └────┬─────┘
   │             │                │                │              │
   │ GET /nilai  │                │                │              │
   │ + Token     │                │                │              │
   │ + Device-ID │                │                │              │
   ├────────────►│                │                │              │
   │             │                │                │              │
   │             │ Verify Token   │                │              │
   │             ├────────────────┤                │              │
   │             │                │                │              │
   │             │ Verify Device  │                │              │
   │             ├───────────────────────────────────────────────►│
   │             │                │                │              │
   │             │ Check Policy   │                │              │
   │             │ (role, owner)  │                │              │
   │             ├───────────────►│                │              │
   │             │                │                │              │
   │             │                │ Read user data │              │
   │             │                ├───────────────────────────────►│
   │             │                │                │              │
   │             │◄───allow───────┤                │              │
   │             │                │                │              │
   │             │ Log (allow)    │                │              │
   │             ├───────────────────────────────────────────────►│
   │             │                │                │              │
   │             │ Forward +      │                │              │
   │             │ Gateway-Secret │                │              │
   │             ├───────────────────────────────►│              │
   │             │                │                │              │
   │             │                │                │ Verify       │
   │             │                │                │ Gateway      │
   │             │                │                │ Secret       │
   │             │                │                │              │
   │             │                │                │ Re-verify    │
   │             │                │                │ Token        │
   │             │                │                │              │
   │             │                │                │ Query Data   │
   │             │                │                ├─────────────►│
   │             │                │                │              │
   │             │                │                │◄─────────────┤
   │             │                │                │              │
   │             │◄───response────────────────────┤              │
   │             │                │                │              │
   │◄────────────┤                │                │              │
   │             │                │                │              │
```

## Flow Finalisasi & Sinkronisasi

```
┌──────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│Dosen │    │ Gateway │    │  Service │    │  Service  │    │ Database │
│      │    │         │    │  Nilai   │    │ Transkrip │    │          │
└──┬───┘    └────┬────┘    └────┬─────┘    └─────┬─────┘    └────┬─────┘
   │             │              │                 │               │
   │ POST /kelas/│              │                 │               │
   │ 1/finalisasi│              │                 │               │
   ├────────────►│              │                 │               │
   │             │              │                 │               │
   │             │ Policy Check │                 │               │
   │             │ (dosen owns  │                 │               │
   │             │  class)      │                 │               │
   │             ├─────────────────────────────────────────────────►
   │             │              │                 │               │
   │             │ Forward      │                 │               │
   │             ├─────────────►│                 │               │
   │             │              │                 │               │
   │             │              │ Update nilai    │               │
   │             │              │ SET is_final=1  │               │
   │             │              ├────────────────────────────────►│
   │             │              │                 │               │
   │             │              │ POST /auth/     │               │
   │             │              │ service         │               │
   │             │◄─────────────┤                 │               │
   │             │              │                 │               │
   │             │ service_token│                 │               │
   │             ├─────────────►│                 │               │
   │             │              │                 │               │
   │             │              │ POST /transkrip/│               │
   │             │              │ sinkron         │               │
   │             │              │ via Gateway     │               │
   │             ├──────────────┼────────────────►│               │
   │             │              │                 │               │
   │             │              │                 │ Verify service│
   │             │              │                 │ token         │
   │             │              │                 │               │
   │             │              │                 │ Insert/Update │
   │             │              │                 │ transkrip     │
   │             │              │                 ├──────────────►│
   │             │              │                 │               │
   │             │◄─────────────┼─────────────────┤               │
   │             │              │                 │               │
   │◄────────────┤              │                 │               │
   │             │              │                 │               │
```

## Komponen dan Tanggung Jawab

### 1. API Gateway (PEP - Policy Enforcement Point)

**Port**: 3000  
**Role**: Satu-satunya pintu masuk sistem

**Tanggung Jawab**:
- Menerima semua request dari client
- Autentikasi dengan JWT
- Verifikasi device terdaftar
- Melakukan policy checks (role, ownership, time)
- Menambahkan gateway secret ke header
- Mem-forward request ke service yang sesuai
- Mencatat audit log

**Middleware Chain**:
```
Request → authenticateToken → verifyDevice → requireRole 
       → policyCheck → checkAccessTime → addGatewaySecret 
       → proxy to service
```

### 2. Policy Engine / Policy Administrator

**Lokasi**: Di dalam Gateway  
**Role**: PE / PA (NIST SP 800-207)

**Tanggung Jawab**:
- Login dan generate tokens
- Refresh token management
- Logout dan revoke tokens
- Issue service tokens
- Membaca atribut dari database untuk policy decision

### 3. Service Nilai

**Port**: 3001  
**Role**: Resource

**Tanggung Jawab**:
- Mengelola data nilai dan kelas
- Memverifikasi gateway secret
- Re-verifikasi token
- Menolak direct access
- Memanggil Service Transkrip saat finalisasi (via gateway)

**Endpoints**:
- GET /nilai - Lihat nilai
- PUT /nilai/:id - Update nilai
- POST /kelas/:id/finalisasi - Finalisasi nilai

### 4. Service Transkrip

**Port**: 3002  
**Role**: Resource

**Tanggung Jawab**:
- Mengelola data transkrip mahasiswa
- Memverifikasi gateway secret
- Re-verifikasi token
- Menolak direct access
- Menerima sinkronisasi dari Service Nilai

**Endpoints**:
- GET /transkrip/:nim - Lihat transkrip
- POST /transkrip/sinkron - Sinkronisasi (service only)

### 5. Database

**Type**: SQLite  
**Role**: Resource

**Tables**:
- users - Data user (mahasiswa, dosen, admin)
- devices - Device terdaftar per user
- refresh_tokens - Refresh token yang aktif
- kelas - Data kelas
- nilai - Data nilai mahasiswa per kelas
- transkrip - Data transkrip mahasiswa
- audit_logs - Log semua akses

### 6. Audit Log

**Role**: Data Source

**Informasi yang Dicatat**:
- Timestamp
- Subject (user_id atau service name)
- Subject role
- Endpoint yang diakses
- HTTP method
- Device ID
- Result (allow/deny)
- Reason (alasan allow/deny)
- IP address
- User agent

## Prinsip Zero Trust yang Diterapkan

### 1. Never Trust, Always Verify ✓

**Implementasi**:
- Setiap request harus membawa access token yang valid
- Token diverifikasi di gateway
- Device ID diverifikasi terhadap database
- Token di-verify ulang di service
- Gateway secret harus ada untuk service accept request

**Code Locations**:
- `gateway/middleware/auth.js` - authenticateToken()
- `gateway/middleware/device-verification.js` - verifyDevice()
- `services/*/middleware/verify-gateway.js` - verifyGateway()

### 2. Least Privilege ✓

**Implementasi**:
- Role-based access control (mahasiswa, dosen, admin, service)
- Ownership verification (mahasiswa hanya data sendiri)
- Class ownership (dosen hanya kelas yang diampu)
- Time-based access (update hanya jam 07:00-21:00)
- Finalized grades tidak bisa diubah

**Code Locations**:
- `gateway/routes/proxy.js` - checkGetNilaiPolicy(), checkUpdateNilaiPolicy(), dll
- `gateway/middleware/time-based-access.js` - checkAccessTime()

### 3. Assume Breach ✓

**Implementasi**:
- Service tidak dapat diakses langsung dari luar
- Gateway secret required untuk semua service requests
- Defense in depth: gateway secret + token verification
- Service-to-service communication via gateway
- Audit logging untuk forensik

**Code Locations**:
- `services/*/middleware/verify-gateway.js` - Reject requests without gateway secret
- `services/nilai/routes/nilai.js` - Service-to-service via gateway

## Security Headers

### Request dari Client ke Gateway:
```
Authorization: Bearer <access_token>
X-Device-ID: <device_id>
Content-Type: application/json
```

### Request dari Gateway ke Service:
```
Authorization: Bearer <access_token>
X-Gateway-Secret: <gateway_secret>
Content-Type: application/json
```

### Service Token Request:
```
Authorization: Bearer <service_token>
X-Gateway-Secret: <gateway_secret>
Content-Type: application/json
```

## Token Types & Lifecycle

### 1. Access Token
- **Masa Berlaku**: 10 menit
- **Payload**: { sub: user_id, role: role, username: username }
- **Digunakan**: Semua user requests
- **Storage**: Client-side only

### 2. Refresh Token
- **Masa Berlaku**: 1 hari
- **Payload**: { sub: user_id, role: role }
- **Digunakan**: Refresh access token
- **Storage**: Database (dapat dicabut)

### 3. Service Token
- **Masa Berlaku**: 5 menit
- **Payload**: { sub: service_name, role: 'service', clientId: client_id }
- **Digunakan**: Service-to-service calls
- **Storage**: Not stored (short-lived)

## Network Isolation

```
┌────────────────────────────────────────┐
│         External Network               │
│  (Internet / Client Network)           │
└──────────────┬─────────────────────────┘
               │
               │ Port 3000 (HTTPS)
               │
┌──────────────▼─────────────────────────┐
│      DMZ - API Gateway                 │
│      (Public Facing)                   │
└──────────────┬─────────────────────────┘
               │
               │ Internal Network
               │ Gateway Secret Required
               │
┌──────────────▼─────────────────────────┐
│   Internal Services Network            │
│                                        │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Service Nilai│  │   Service    │   │
│  │ Port 3001    │  │  Transkrip   │   │
│  │ (Internal)   │  │  Port 3002   │   │
│  │              │  │  (Internal)  │   │
│  └──────┬───────┘  └───────┬──────┘   │
│         │                  │           │
│         └─────────┬────────┘           │
│                   │                    │
└───────────────────┼────────────────────┘
                    │
           ┌────────▼────────┐
           │    Database     │
           │   (Internal)    │
           └─────────────────┘
```

## Deployment Considerations

### Development
- Semua service di localhost
- SQLite database
- Logs ke console

### Production (Rekomendasi)
- Gateway di DMZ dengan public IP/domain
- Services di private subnet
- Database di private subnet
- Logs ke centralized logging (ELK, Splunk)
- Secrets di environment variables atau vault
- HTTPS dengan SSL certificate
- Rate limiting
- DDoS protection
- WAF (Web Application Firewall)

## Compliance & Audit

### NIST SP 800-207 Compliance

| Requirement | Implementation |
|-------------|----------------|
| Policy Enforcement Point | API Gateway |
| Policy Engine | Policy Engine in Gateway |
| Policy Administrator | Policy Engine (token management) |
| Continuous verification | Every request verified |
| Least privilege | Role + ownership checks |
| Device trust | Device verification |
| Data-centric security | Fine-grained access control |
| Monitoring | Audit logging |

### Audit Trail

Setiap akses tercatat dengan:
- WHO: subject_id, subject_role
- WHAT: endpoint, method
- WHEN: timestamp
- WHERE: device_id, ip_address
- WHY: reason
- RESULT: allow/deny

Data audit dapat digunakan untuk:
- Security monitoring
- Incident response
- Compliance reporting
- Forensic analysis
