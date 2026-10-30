const db = require('../utils/db');
const { logAccess } = require('../utils/audit-logger');

/**
 * Middleware untuk verifikasi device terdaftar
 * Hanya berlaku untuk user token (bukan service token)
 */
async function verifyDevice(req, res, next) {
    // Skip untuk service token
    if (req.user && req.user.role === 'service') {
        return next();
    }

    const deviceId = req.headers['x-device-id'];

    if (!deviceId) {
        await logAccess({
            subjectType: 'user',
            subjectId: req.user?.sub,
            subjectRole: req.user?.role,
            endpoint: req.path,
            method: req.method,
            deviceId: null,
            result: 'deny',
            reason: 'Device ID not provided',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(400).json({
            error: 'Device ID required',
            code: 'DEVICE_ID_REQUIRED',
            hint: 'Include X-Device-ID header'
        });
    }

    try {
        // Cek apakah device terdaftar untuk user ini
        const device = await db.get(`
            SELECT * FROM devices
            WHERE user_id = ? AND device_id = ?
        `, [req.user.sub, deviceId]);

        if (!device) {
            await logAccess({
                subjectType: 'user',
                subjectId: req.user.sub,
                subjectRole: req.user.role,
                endpoint: req.path,
                method: req.method,
                deviceId: deviceId,
                result: 'deny',
                reason: 'Device not registered',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                error: 'Device not registered for this user',
                code: 'DEVICE_NOT_REGISTERED'
            });
        }

        // Device valid, simpan di req untuk digunakan selanjutnya
        req.device = device;
        next();
    } catch (error) {
        console.error('Device verification error:', error);
        return res.status(500).json({
            error: 'Device verification failed',
            code: 'DEVICE_VERIFICATION_ERROR'
        });
    }
}

module.exports = verifyDevice;
