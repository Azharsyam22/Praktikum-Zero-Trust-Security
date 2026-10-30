const db = require('./utils/db');
const bcrypt = require('bcryptjs');
const { 
    generateAccessToken, 
    generateRefreshToken, 
    generateServiceToken,
    verifyRefreshToken 
} = require('./utils/jwt');
const { logAccess } = require('./utils/audit-logger');
const config = require('./config');

/**
 * Policy Engine - Menangani autentikasi dan keputusan otorisasi (PE / PA)
 */

/**
 * Login user dan generate tokens
 */
async function login(username, password, deviceId, req) {
    // Cari user
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
        await logAccess({
            subjectType: 'user',
            subjectId: username,
            subjectRole: null,
            endpoint: '/auth/login',
            method: 'POST',
            deviceId: deviceId,
            result: 'deny',
            reason: 'User not found',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Invalid credentials');
    }

    // Verify password
    const passwordValid = bcrypt.compareSync(password, user.password);
    if (!passwordValid) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.id,
            subjectRole: user.role,
            endpoint: '/auth/login',
            method: 'POST',
            deviceId: deviceId,
            result: 'deny',
            reason: 'Invalid password',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Invalid credentials');
    }

    // Verify device
    const device = await db.get(
        'SELECT * FROM devices WHERE user_id = ? AND device_id = ?',
        [user.id, deviceId]
    );

    if (!device) {
        await logAccess({
            subjectType: 'user',
            subjectId: user.id,
            subjectRole: user.role,
            endpoint: '/auth/login',
            method: 'POST',
            deviceId: deviceId,
            result: 'deny',
            reason: 'Device not registered',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Device not registered');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
        sub: user.id,
        role: user.role,
        username: user.username
    });

    const refreshToken = generateRefreshToken({
        sub: user.id,
        role: user.role
    });

    // Simpan refresh token ke database (1 hari)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);

    await db.run(`
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
    `, [user.id, refreshToken, expiresAtStr]);

    await logAccess({
        subjectType: 'user',
        subjectId: user.id,
        subjectRole: user.role,
        endpoint: '/auth/login',
        method: 'POST',
        deviceId: deviceId,
        result: 'allow',
        reason: 'Login successful',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            nama: user.nama,
            nim: user.nim,
            nip: user.nip
        }
    };
}

/**
 * Refresh access token menggunakan refresh token
 */
async function refreshAccessToken(refreshToken, req) {
    let decoded;
    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
        await logAccess({
            subjectType: 'user',
            subjectId: null,
            subjectRole: null,
            endpoint: '/auth/refresh',
            method: 'POST',
            deviceId: null,
            result: 'deny',
            reason: 'Invalid refresh token signature or expired',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Invalid refresh token');
    }

    // Cek apakah refresh token ada di database dan belum di-revoke
    const tokenRecord = await db.get(`
        SELECT * FROM refresh_tokens
        WHERE token = ? AND revoked = 0 AND expires_at > NOW()
    `, [refreshToken]);

    if (!tokenRecord) {
        await logAccess({
            subjectType: 'user',
            subjectId: decoded.sub,
            subjectRole: decoded.role,
            endpoint: '/auth/refresh',
            method: 'POST',
            deviceId: null,
            result: 'deny',
            reason: 'Refresh token revoked or expired',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Refresh token revoked or expired');
    }

    // Get user info
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.sub]);

    if (!user) {
        throw new Error('User not found');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
        sub: user.id,
        role: user.role,
        username: user.username
    });

    await logAccess({
        subjectType: 'user',
        subjectId: user.id,
        subjectRole: user.role,
        endpoint: '/auth/refresh',
        method: 'POST',
        deviceId: null,
        result: 'allow',
        reason: 'Token refreshed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return {
        accessToken: newAccessToken
    };
}

/**
 * Logout - revoke refresh token (memeriksa kondisi belum dicabut)
 */
async function logout(refreshToken, req) {
    let decoded;
    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
        await logAccess({
            subjectType: 'unknown',
            subjectId: null,
            subjectRole: null,
            endpoint: '/auth/logout',
            method: 'POST',
            deviceId: null,
            result: 'deny',
            reason: 'Invalid refresh token',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Invalid refresh token');
    }

    // Cek apakah token masih aktif dan belum di-revoke
    const tokenRecord = await db.get(`
        SELECT * FROM refresh_tokens
        WHERE token = ? AND revoked = 0
    `, [refreshToken]);

    if (!tokenRecord) {
        await logAccess({
            subjectType: 'user',
            subjectId: decoded.sub,
            subjectRole: decoded.role,
            endpoint: '/auth/logout',
            method: 'POST',
            deviceId: null,
            result: 'deny',
            reason: 'Refresh token already revoked or not found',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Refresh token already revoked');
    }

    // Revoke token
    await db.run(`
        UPDATE refresh_tokens
        SET revoked = 1
        WHERE token = ?
    `, [refreshToken]);

    await logAccess({
        subjectType: 'user',
        subjectId: decoded.sub,
        subjectRole: decoded.role,
        endpoint: '/auth/logout',
        method: 'POST',
        deviceId: null,
        result: 'allow',
        reason: 'Logout successful',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return { success: true };
}

/**
 * Generate service token untuk Service Nilai
 */
async function generateServiceAuth(clientId, clientSecret, req) {
    if (clientId !== config.services.nilai.clientId || 
        clientSecret !== config.services.nilai.clientSecret) {
        await logAccess({
            subjectType: 'service',
            subjectId: clientId,
            subjectRole: 'service',
            endpoint: '/auth/service',
            method: 'POST',
            deviceId: null,
            result: 'deny',
            reason: 'Invalid client credentials',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        throw new Error('Invalid client credentials');
    }

    const serviceToken = generateServiceToken({
        sub: 'service-nilai',
        role: 'service',
        clientId: clientId
    });

    await logAccess({
        subjectType: 'service',
        subjectId: clientId,
        subjectRole: 'service',
        endpoint: '/auth/service',
        method: 'POST',
        deviceId: null,
        result: 'allow',
        reason: 'Service token issued',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return {
        serviceToken,
        expiresIn: '5m'
    };
}

module.exports = {
    login,
    refreshAccessToken,
    logout,
    generateServiceAuth
};
