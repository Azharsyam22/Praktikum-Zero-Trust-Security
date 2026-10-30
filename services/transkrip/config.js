require('dotenv').config();

module.exports = {
    port: process.env.SERVICE_TRANSKRIP_PORT || 3002,
    gatewaySecret: process.env.GATEWAY_SECRET,
    gatewayUrl: `http://localhost:${process.env.GATEWAY_PORT || 3000}`,
    
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        serviceSecret: process.env.JWT_SERVICE_SECRET
    },
    
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'zero_trust_sistem_nilai',
        port: parseInt(process.env.DB_PORT) || 3306
    }
};
