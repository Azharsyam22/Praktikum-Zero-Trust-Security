const jwt = require('jsonwebtoken');
const config = require('../config');

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
    verifyAccessToken,
    verifyServiceToken
};
