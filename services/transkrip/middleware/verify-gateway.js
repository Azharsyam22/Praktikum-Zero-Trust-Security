const config = require('../config');
const { verifyAccessToken, verifyServiceToken } = require('../utils/jwt');

/**
 * Middleware untuk memverifikasi bahwa request berasal dari gateway
 * dan token valid
 * 
 * Zero Trust Principle: Assume Breach
 * Service tidak dapat diakses langsung, hanya melalui gateway
 */
function verifyGateway(req, res, next) {
    // 1. Cek Gateway Secret
    const gatewaySecret = req.headers['x-gateway-secret'];

    if (!gatewaySecret || gatewaySecret !== config.gatewaySecret) {
        console.warn('[SECURITY] Upaya akses langsung ditolak - gateway secret tidak valid');
        return res.status(403).json({
            error: 'Direct access forbidden',
            code: 'GATEWAY_REQUIRED',
            message: 'This service can only be accessed through the API Gateway'
        });
    }

    // 2. Cek dan verify token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token required',
            code: 'TOKEN_REQUIRED'
        });
    }

    try {
        // Coba verify sebagai access token dulu
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch {
            // Jika gagal, coba sebagai service token
            decoded = verifyServiceToken(token);
        }

        // Simpan decoded token di req untuk digunakan handler
        req.user = decoded;
        next();
    } catch (error) {
        console.warn('[SECURITY] Token tidak valid:', error.message);
        return res.status(403).json({
            error: 'Invalid or expired token',
            code: 'TOKEN_INVALID'
        });
    }
}

module.exports = verifyGateway;
