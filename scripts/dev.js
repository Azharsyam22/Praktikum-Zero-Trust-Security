const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const services = [
    { name: 'Gateway     ', script: 'gateway/server.js',              color: '\x1b[36m' },
    { name: 'Svc Nilai   ', script: 'services/nilai/server.js',       color: '\x1b[32m' },
    { name: 'Svc Transkrip', script: 'services/transkrip/server.js', color: '\x1b[33m' }
];

console.log('\x1b[1m\n=== Zero Trust Sistem Nilai — Starting Services ===\x1b[0m\n');

services.forEach(({ name, script, color }) => {
    const proc = spawn('node', [path.join(root, script)], {
        cwd: root,
        env: process.env,
        shell: false
    });

    proc.stdout.on('data', data => {
        data.toString().split('\n').filter(Boolean).forEach(line => {
            process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
        });
    });

    proc.stderr.on('data', data => {
        data.toString().split('\n').filter(Boolean).forEach(line => {
            process.stdout.write(`\x1b[31m[${name} ERR]\x1b[0m ${line}\n`);
        });
    });

    proc.on('exit', code => {
        if (code !== null) {
            console.log(`${color}[${name}]\x1b[0m Exited (code ${code})`);
        }
    });
});

process.on('SIGINT', () => {
    console.log('\n\x1b[1mStopping all services...\x1b[0m');
    process.exit(0);
});
