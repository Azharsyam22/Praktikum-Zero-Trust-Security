const express = require('express');
const router = express.Router();
const policyEngine = require('../policy-engine');

/**
 * POST /auth/login
 * Login dan dapatkan access token + refresh token
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const deviceId = req.headers['x-device-id'];

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        if (!deviceId) {
            return res.status(400).json({
                error: 'Device ID required',
                code: 'DEVICE_ID_REQUIRED',
                hint: 'Include X-Device-ID header'
            });
        }

        const result = await policyEngine.login(username, password, deviceId, req);
        res.json(result);
    } catch (error) {
        res.status(401).json({
            error: error.message,
            code: 'AUTH_FAILED'
        });
    }
});

/**
 * POST /auth/refresh
 * Refresh access token menggunakan refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token required',
                code: 'REFRESH_TOKEN_REQUIRED'
            });
        }

        const result = await policyEngine.refreshAccessToken(refreshToken, req);
        res.json(result);
    } catch (error) {
        res.status(401).json({
            error: error.message,
            code: 'REFRESH_FAILED'
        });
    }
});

/**
 * POST /auth/logout
 * Logout dan revoke refresh token
 */
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token required',
                code: 'REFRESH_TOKEN_REQUIRED'
            });
        }

        await policyEngine.logout(refreshToken, req);
        res.json({
            message: 'Logout successful'
        });
    } catch (error) {
        res.status(400).json({
            error: error.message,
            code: 'LOGOUT_FAILED'
        });
    }
});

/**
 * POST /auth/service
 * Generate service token untuk Service Nilai
 */
router.post('/service', async (req, res) => {
    try {
        const { clientId, clientSecret } = req.body;

        if (!clientId || !clientSecret) {
            return res.status(400).json({
                error: 'Client ID and secret required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        const result = await policyEngine.generateServiceAuth(clientId, clientSecret, req);
        res.json(result);
    } catch (error) {
        res.status(401).json({
            error: error.message,
            code: 'SERVICE_AUTH_FAILED'
        });
    }
});

module.exports = router;
