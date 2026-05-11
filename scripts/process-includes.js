const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const partialsDir = path.join(__dirname, '..', 'src', 'partials');

// 1. Read all partial files from src/partials/ (not dist/)
const partials = {};
for (const file of fs.readdirSync(partialsDir)) {
    if (file.endsWith('.html')) {
        const name = file.replace('.html', '');
        partials[name] = fs.readFileSync(path.join(partialsDir, file), 'utf8');
    }
}

console.log(`Loaded partials: ${Object.keys(partials).join(', ')}`);

// 2. Find all HTML files in dist (recursively)
function findHtmlFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findHtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

const htmlFiles = findHtmlFiles(distDir);

// 3. Process each HTML file
for (const filePath of htmlFiles) {
    const relDir = path.relative(distDir, path.dirname(filePath));
    const root = relDir ? relDir.split(path.sep).map(() => '..').join('/') + '/' : '';

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const [name, partial] of Object.entries(partials)) {
        const marker = `<!-- INCLUDE:${name} -->`;
        if (content.includes(marker)) {
            content = content.replace(marker, partial.replace(/\{\{ROOT\}\}/g, root));
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Processed: ${path.relative(distDir, filePath)}`);
    }
}
