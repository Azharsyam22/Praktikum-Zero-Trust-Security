require('dotenv').config();

module.exports = {
    port: process.env.GATEWAY_PORT || 3000,
    gatewaySecret: process.env.GATEWAY_SECRET,
    
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        serviceSecret: process.env.JWT_SERVICE_SECRET,
        accessExpiry: '10m',
        refreshExpiry: '1d',
        serviceExpiry: '5m'
    },
    
    services: {
        nilai: {
            url: `http://localhost:${process.env.SERVICE_NILAI_PORT || 3001}`,
            clientId: process.env.SERVICE_CLIENT_ID,
            clientSecret: process.env.SERVICE_CLIENT_SECRET
        },
        transkrip: {
            url: `http://localhost:${process.env.SERVICE_TRANSKRIP_PORT || 3002}`
        }
    },
    
    accessTime: {
        start: process.env.ACCESS_TIME_START || '07:00',
        end: process.env.ACCESS_TIME_END || '21:00'
    },
    
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'zero_trust_sistem_nilai',
        port: parseInt(process.env.DB_PORT) || 3306
    }
};
