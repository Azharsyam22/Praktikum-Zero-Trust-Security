const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const proxyRoutes = require('./routes/proxy');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
    console.log(`Headers:`, {
        authorization: req.headers['authorization'] ? 'Bearer ***' : 'none',
        'x-device-id': req.headers['x-device-id'] || 'none'
    });
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'API Gateway (PEP)',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Auth routes (tidak perlu token)
app.use('/auth', authRoutes);

// Proxy routes (butuh token dan policy check)
app.use('/', proxyRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// Start server
app.listen(config.port, () => {
    console.log('\n=================================');
    console.log('API GATEWAY (PEP) STARTED');
    console.log('=================================');
    console.log(`Port: ${config.port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\nPrinsip Zero Trust:`);
    console.log(`  - Never Trust, Always Verify`);
    console.log(`  - Least Privilege Access`);
    console.log(`  - Assume Breach`);
    console.log(`\nServices:`);
    console.log(`  - Service Nilai: ${config.services.nilai.url}`);
    console.log(`  - Service Transkrip: ${config.services.transkrip.url}`);
    console.log(`\nJam Akses Perubahan: ${config.accessTime.start} - ${config.accessTime.end}`);
    console.log('=================================\n');
});
