const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const router = express.Router();
const config = require('../config');
const { authenticateToken, requireRole } = require('../middleware/auth');
const verifyDevice = require('../middleware/device-verification');
const checkAccessTime = require('../middleware/time-based-access');
const db = require('../utils/db');
const { logAccess } = require('../utils/audit-logger');

/**
 * Helper untuk proxy — otomatis tambah Gateway Secret di setiap request ke service
 */
function createServiceProxy(targetUrl) {
    return createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        onProxyReq: (proxyReq, req) => {
            // Tambah gateway secret ke setiap request yang diteruskan
            proxyReq.setHeader('x-gateway-secret', config.gatewaySecret);
            // Fix body untuk POST/PUT agar tidak hilang saat di-proxy
            if (req.body && Object.keys(req.body).length > 0) {
                fixRequestBody(proxyReq, req);
            }
        }
    });
}

/**
 * Middleware untuk verifikasi ownership dan policy checks (Policy Enforcement Point)
 */

// Policy untuk GET /nilai
async function checkGetNilaiPolicy(req, res, next) {
    const user = req.user;

    if (user.role === 'mahasiswa') {
        req.query.mahasiswa_id = user.sub;
        req.url = `/nilai?mahasiswa_id=${user.sub}`;

        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'allow',
            reason: 'Mahasiswa accessing own grades',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return next();
    }

    if (user.role === 'dosen') {
        req.query.dosen_id = user.sub;
        req.url = `/nilai?dosen_id=${user.sub}`;

        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'allow',
            reason: 'Dosen accessing class grades',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return next();
    }

    await logAccess({
        subjectType: 'user',
        subjectId: user.sub,
        subjectRole: user.role,
        endpoint: req.path,
        method: req.method,
        deviceId: req.headers['x-device-id'],
        result: 'deny',
        reason: 'Role not allowed for this endpoint',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN'
    });
}

// Policy untuk PUT /nilai/:id
async function checkUpdateNilaiPolicy(req, res, next) {
    const user = req.user;
    const nilaiId = req.params.id;

    if (user.role !== 'dosen') {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Only dosen can update grades',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Only dosen can update grades',
            code: 'FORBIDDEN'
        });
    }

    // Cek apakah nilai ini ada di kelas yang diampu dosen
    const nilai = await db.get(`
        SELECT n.*, k.dosen_id
        FROM nilai n
        JOIN kelas k ON n.kelas_id = k.id
        WHERE n.id = ?
    `, [nilaiId]);

    if (!nilai) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Nilai not found',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(404).json({
            error: 'Nilai not found',
            code: 'NOT_FOUND'
        });
    }

    if (nilai.dosen_id !== parseInt(user.sub)) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Dosen can only update grades in their own classes',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'You can only update grades in your own classes',
            code: 'NOT_YOUR_CLASS'
        });
    }

    // Cek apakah nilai sudah difinalisasi
    if (nilai.is_final) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Cannot update finalized grades',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Cannot update finalized grades',
            code: 'GRADE_FINALIZED'
        });
    }

    await logAccess({
        subjectType: 'user',
        subjectId: user.sub,
        subjectRole: user.role,
        endpoint: req.path,
        method: req.method,
        deviceId: req.headers['x-device-id'],
        result: 'allow',
        reason: 'Dosen updating grade in own class',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    next();
}

// Policy untuk POST /kelas/:id/finalisasi
async function checkFinalisasiPolicy(req, res, next) {
    const user = req.user;
    const kelasId = req.params.id;

    if (user.role !== 'dosen') {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Only dosen can finalize grades',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Only dosen can finalize grades',
            code: 'FORBIDDEN'
        });
    }

    // Cek apakah kelas ini diampu oleh dosen ini
    const kelas = await db.get('SELECT * FROM kelas WHERE id = ?', [kelasId]);

    if (!kelas) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Kelas not found',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(404).json({
            error: 'Kelas not found',
            code: 'NOT_FOUND'
        });
    }

    if (kelas.dosen_id !== parseInt(user.sub)) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Dosen can only finalize their own classes',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'You can only finalize your own classes',
            code: 'NOT_YOUR_CLASS'
        });
    }

    await logAccess({
        subjectType: 'user',
        subjectId: user.sub,
        subjectRole: user.role,
        endpoint: req.path,
        method: req.method,
        deviceId: req.headers['x-device-id'],
        result: 'allow',
        reason: 'Dosen finalizing own class',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    next();
}

// Policy untuk GET /transkrip/:nim
async function checkGetTranskripPolicy(req, res, next) {
    const user = req.user;
    const nim = req.params.nim;

    if (user.role === 'mahasiswa') {
        const userRecord = await db.get('SELECT nim FROM users WHERE id = ?', [user.sub]);

        if (!userRecord || userRecord.nim !== nim) {
            await logAccess({
                subjectType: 'user',
                subjectId: user.sub,
                subjectRole: user.role,
                endpoint: req.path,
                method: req.method,
                deviceId: req.headers['x-device-id'],
                result: 'deny',
                reason: 'Mahasiswa can only view own transcript',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                error: 'You can only view your own transcript',
                code: 'FORBIDDEN'
            });
        }

        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'allow',
            reason: 'Mahasiswa viewing own transcript',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return next();
    }

    if (user.role === 'admin') {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'allow',
            reason: 'Admin viewing transcript',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return next();
    }

    await logAccess({
        subjectType: 'user',
        subjectId: user.sub,
        subjectRole: user.role,
        endpoint: req.path,
        method: req.method,
        deviceId: req.headers['x-device-id'],
        result: 'deny',
        reason: 'Role not allowed for this endpoint',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN'
    });
}

// Policy untuk POST /transkrip/sinkron
async function checkSinkronPolicy(req, res, next) {
    const user = req.user;

    // Hanya service token yang diizinkan
    if (user.role !== 'service') {
        await logAccess({
            subjectType: 'user',
            subjectId: user.sub,
            subjectRole: user.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Only service can sync transcript',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Only service can access this endpoint',
            code: 'SERVICE_ONLY'
        });
    }

    await logAccess({
        subjectType: 'service',
        subjectId: user.sub,
        subjectRole: user.role,
        endpoint: req.path,
        method: req.method,
        deviceId: null,
        result: 'allow',
        reason: 'Service syncing transcript',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    next();
}

// Routes untuk Service Nilai
router.get('/nilai',
    authenticateToken,
    verifyDevice,
    requireRole('mahasiswa', 'dosen'),
    checkGetNilaiPolicy,
    createServiceProxy(config.services.nilai.url)
);

router.put('/nilai/:id',
    authenticateToken,
    verifyDevice,
    requireRole('dosen'),
    checkAccessTime,
    checkUpdateNilaiPolicy,
    createServiceProxy(config.services.nilai.url)
);

router.post('/kelas/:id/finalisasi',
    authenticateToken,
    verifyDevice,
    requireRole('dosen'),
    checkAccessTime,
    checkFinalisasiPolicy,
    createServiceProxy(config.services.nilai.url)
);

// Routes untuk Service Transkrip
router.get('/transkrip/:nim',
    authenticateToken,
    verifyDevice,
    requireRole('mahasiswa', 'admin'),
    checkGetTranskripPolicy,
    createServiceProxy(config.services.transkrip.url)
);

router.post('/transkrip/sinkron',
    authenticateToken,
    checkSinkronPolicy,
    createServiceProxy(config.services.transkrip.url)
);

module.exports = router;
