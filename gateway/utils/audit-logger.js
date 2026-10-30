const db = require('./db');

/**
 * Log setiap keputusan akses ke audit_logs
 */
async function logAccess({
    subjectType,    // 'user', 'service', atau 'unknown'
    subjectId,      // user_id atau service name
    subjectRole,    // role user atau 'service'
    endpoint,       // path yang diakses
    method,         // HTTP method
    deviceId,       // device ID (jika dari user)
    result,         // 'allow' atau 'deny'
    reason,         // alasan allow/deny
    ipAddress,      // IP address
    userAgent       // User agent
}) {
    try {
        await db.run(`
            INSERT INTO audit_logs (
                subject_type, subject_id, subject_role, endpoint, method,
                device_id, result, reason, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            subjectType || 'unknown',
            subjectId ? subjectId.toString() : null,
            subjectRole || null,
            endpoint,
            method,
            deviceId || null,
            result,
            reason,
            ipAddress || null,
            userAgent || null
        ]);

        // Log ke console juga untuk monitoring
        const statusTag = result === 'allow' ? '[ALLOW]' : '[DENY]';
        const timestamp = new Date().toISOString();
        console.log(
            `${statusTag} [${timestamp}] ${subjectType}:${subjectId || 'anon'} ${method} ${endpoint} - ${reason}`
        );
    } catch (error) {
        console.error('Error logging audit:', error.message);
    }
}

/**
 * Get recent audit logs
 */
async function getRecentLogs(limit = 50) {
    return await db.all(`
        SELECT * FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT ?
    `, [limit]);
}

/**
 * Get audit logs by user
 */
async function getLogsByUser(userId, limit = 50) {
    return await db.all(`
        SELECT * FROM audit_logs
        WHERE subject_id = ? AND subject_type = 'user'
        ORDER BY timestamp DESC
        LIMIT ?
    `, [userId.toString(), limit]);
}

module.exports = {
    logAccess,
    getRecentLogs,
    getLogsByUser
};
