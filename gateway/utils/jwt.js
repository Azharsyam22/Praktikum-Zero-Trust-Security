const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate Access Token (10 menit)
 */
function generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessExpiry
    });
}

/**
 * Generate Refresh Token (1 hari)
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiry
    });
}

/**
 * Generate Service Token (5 menit) untuk komunikasi antar-service
 */
function generateServiceToken(payload) {
    return jwt.sign(payload, config.jwt.serviceSecret, {
        expiresIn: config.jwt.serviceExpiry
    });
}

/**
 * Verify Access Token
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, config.jwt.accessSecret);
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
}

/**
 * Verify Refresh Token
 */
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, config.jwt.refreshSecret);
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}

/**
 * Verify Service Token
 */
function verifyServiceToken(token) {
    try {
        return jwt.verify(token, config.jwt.serviceSecret);
    } catch (error) {
        throw new Error('Invalid or expired service token');
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateServiceToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyServiceToken
};
