const { exec, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const distDir = path.join(ROOT, 'dist');
const srcDir = path.join(ROOT, 'src');
const PORT = 3000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
};

// Initial build
console.log('Building...');
execSync('npm run build', { stdio: 'inherit', cwd: ROOT });

// HTTP server
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath.endsWith('/')) urlPath += 'index.html';

    let filePath = path.join(distDir, urlPath);

    // Prevent path traversal
    if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end();
        return;
    }

    // If no extension and file doesn't exist, try with .html
    if (!path.extname(filePath)) {
        try {
            fs.accessSync(filePath);
        } catch {
            filePath += '.html';
        }
    }

    try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`\nServing at http://localhost:${PORT}`);
    console.log('Watching src/ for changes...\n');
});

// Watch and rebuild
let building = false;
let pendingBuild = false;

function rebuild() {
    if (building) {
        pendingBuild = true;
        return;
    }
    building = true;
    console.log('Rebuilding...');
    exec('npm run build', { cwd: ROOT }, (err, stdout, stderr) => {
        if (err) {
            console.error('Build failed');
            if (stderr) process.stderr.write(stderr);
        } else {
            console.log('Done. Refresh browser to see changes.');
        }
        building = false;
        if (pendingBuild) {
            pendingBuild = false;
            rebuild();
        }
    });
}

let timer = null;
fs.watch(srcDir, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(rebuild, 300);
});
