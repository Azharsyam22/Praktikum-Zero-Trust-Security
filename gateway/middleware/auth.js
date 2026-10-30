const { verifyAccessToken, verifyServiceToken } = require('../utils/jwt');
const { logAccess } = require('../utils/audit-logger');

/**
 * Middleware untuk verifikasi Access Token atau Service Token
 * Menyimpan decoded token di req.user
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        await logAccess({
            subjectType: 'unknown',
            subjectId: null,
            subjectRole: null,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'No token provided',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(401).json({
            error: 'Access token required',
            code: 'TOKEN_REQUIRED'
        });
    }

    try {
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch {
            decoded = verifyServiceToken(token);
        }

        req.user = decoded;
        next();
    } catch (error) {
        await logAccess({
            subjectType: 'unknown',
            subjectId: null,
            subjectRole: null,
            endpoint: req.path,
            method: req.method,
            deviceId: req.headers['x-device-id'],
            result: 'deny',
            reason: 'Invalid or expired token',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
            error: 'Invalid or expired token',
            code: 'TOKEN_INVALID'
        });
    }
}

/**
 * Middleware untuk memeriksa apakah user memiliki role tertentu
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            await logAccess({
                subjectType: req.user.role === 'service' ? 'service' : 'user',
                subjectId: req.user.sub,
                subjectRole: req.user.role,
                endpoint: req.path,
                method: req.method,
                deviceId: req.headers['x-device-id'],
                result: 'deny',
                reason: `Role ${req.user.role} not allowed`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                requiredRoles: allowedRoles
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};
