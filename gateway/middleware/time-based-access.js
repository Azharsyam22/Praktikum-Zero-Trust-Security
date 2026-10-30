const config = require('../config');
const { logAccess } = require('../utils/audit-logger');

/**
 * Middleware untuk memeriksa jam akses
 * Hanya untuk operasi perubahan/finalisasi nilai (07:00 - 21:00)
 */
async function checkAccessTime(req, res, next) {
    const [startHour, startMinute] = config.accessTime.start.split(':').map(Number);
    const [endHour, endMinute] = config.accessTime.end.split(':').map(Number);

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        await logAccess({
            subjectType: req.user?.role === 'service' ? 'service' : 'user',
            subjectId: req.user?.sub,
            subjectRole: req.user?.role,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: `Access outside allowed time (${config.accessTime.start}-${config.accessTime.end})`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Access denied outside allowed hours',
            code: 'OUTSIDE_ACCESS_HOURS',
            allowedHours: `${config.accessTime.start} - ${config.accessTime.end}`,
            currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
        });
    }

    next();
}

module.exports = checkAccessTime;
