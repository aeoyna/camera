const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('Starting server setup...');

let options;
try {
    if (!fs.existsSync('server.pfx')) {
        throw new Error('server.pfx not found!');
    }
    options = {
        pfx: fs.readFileSync('server.pfx'),
        passphrase: 'pass'
    };
    console.log('Certificate loaded.');
} catch (e) {
    console.error('Failed to load certificate:', e.message);
    process.exit(1);
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

const server = https.createServer(options, (req, res) => {
    console.log(`${req.method} ${req.url}`);

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('404 File Not Found');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = 8443;
const IP = '0.0.0.0'; // Listen on all interfaces

server.on('error', (e) => {
    console.error('Server error:', e.message);
});

server.listen(PORT, IP, () => {
    console.log(`Server running at https://192.168.3.218:${PORT}/`);
    console.log(`Also accessible at https://localhost:${PORT}/`);
    console.log('Note: accept the security warning in your browser.');
});
