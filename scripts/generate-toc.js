const fs = require("fs");
const path = require("path");

const DIST_DIR = path.join(__dirname, "..", "dist");
const PAGES_DIR = path.join(DIST_DIR, "pages");
const INDEX_FILE = path.join(DIST_DIR, "index.html");

function extractPageData(filePath) {
    const html = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);

    // Extract page title from <h2>
    const titleMatch = html.match(/<h2>([^<]+)<\/h2>/);
    const title = titleMatch
        ? titleMatch[1].trim()
        : fileName.replace(".html", "");

    // Extract all <details id="..."><summary>...</summary> pairs
    const questions = [];
    const detailsRegex =
        /<details\s+id="([^"]+)"[^>]*>\s*<summary>([^<]+)<\/summary>/g;
    let match;

    while ((match = detailsRegex.exec(html)) !== null) {
        questions.push({
            id: match[1],
            question: match[2].trim(),
        });
    }

    return { fileName, title, questions };
}

function generateTocHtml(pages) {
    let html = "";

    for (const page of pages) {
        if (page.questions.length === 0) continue;

        html += `        <div class="toc-category">\n`;
        html += `            <h3><a href="pages/${page.fileName}">${page.title}</a></h3>\n`;
        html += `            <ul>\n`;

        for (const q of page.questions) {
            html += `                <li><a href="pages/${page.fileName}#${q.id}">${q.question}</a></li>\n`;
        }

        html += `            </ul>\n`;
        html += `        </div>\n`;
    }

    return html;
}

function main() {
    if (!fs.existsSync(PAGES_DIR)) {
        console.log("No pages directory found, skipping TOC generation.");
        return;
    }

    const pageFiles = fs
        .readdirSync(PAGES_DIR)
        .filter((f) => f.endsWith(".html"))
        .sort();

    if (pageFiles.length === 0) {
        console.log("No page files found, skipping TOC generation.");
        return;
    }

    // Extract data from each page
    const pages = pageFiles.map((f) =>
        extractPageData(path.join(PAGES_DIR, f))
    );

    // Generate TOC HTML
    const tocHtml = generateTocHtml(pages);

    // Read index.html and replace TOC section
    let indexHtml = fs.readFileSync(INDEX_FILE, "utf-8");

    const tocStartMarker = "<!-- TOC_START -->";
    const tocEndMarker = "<!-- TOC_END -->";

    const startIdx = indexHtml.indexOf(tocStartMarker);
    const endIdx = indexHtml.indexOf(tocEndMarker);

    if (startIdx === -1 || endIdx === -1) {
        console.error("TOC markers not found in index.html");
        process.exit(1);
    }

    indexHtml =
        indexHtml.slice(0, startIdx + tocStartMarker.length) +
        "\n" +
        tocHtml +
        "            " +
        indexHtml.slice(endIdx);

    fs.writeFileSync(INDEX_FILE, indexHtml, "utf-8");

    const totalQuestions = pages.reduce(
        (sum, p) => sum + p.questions.length,
        0
    );
    console.log(
        `TOC generated: ${pages.length} category(s), ${totalQuestions} question(s).`
    );
}

main();
