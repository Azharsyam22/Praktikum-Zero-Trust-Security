const express = require('express');
const config = require('./config');
const verifyGateway = require('./middleware/verify-gateway');
const nilaiRoutes = require('./routes/nilai');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Health check (tidak perlu gateway verification)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Service Nilai',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Semua routes lain harus melalui gateway
app.use(verifyGateway);
app.use('/', nilaiRoutes);

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
    console.log('SERVICE NILAI STARTED');
    console.log('=================================');
    console.log(`Port: ${config.port}`);
    console.log(`Role: Resource (NIST SP 800-207)`);
    console.log(`\nKeamanan:`);
    console.log(`  - Gateway Secret Verification`);
    console.log(`  - Token Re-verification`);
    console.log(`  - Direct Access Blocked`);
    console.log(`\nGateway: ${config.gatewayUrl}`);
    console.log('=================================\n');
});
