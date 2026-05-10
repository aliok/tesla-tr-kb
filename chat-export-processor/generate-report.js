const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "output");
const FAQ_FILE = path.join(OUTPUT_DIR, "faq-results.json");
const REPORT_FILE = path.join(OUTPUT_DIR, "faq-report.md");

function main() {
    if (!fs.existsSync(FAQ_FILE)) {
        console.error("faq-results.json not found. Run analyze-messages.js first.");
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(FAQ_FILE, "utf-8"));
    const topics = data.topics || [];

    // Group by category
    const byCategory = {};
    for (const t of topics) {
        const cat = t.category || "Genel";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(t);
    }

    // Sort categories by total count
    const categories = Object.entries(byCategory).sort(
        (a, b) =>
            b[1].reduce((s, t) => s + (t.count || 0), 0) -
            a[1].reduce((s, t) => s + (t.count || 0), 0)
    );

    let md = "# Tesla TR - SSS Raporu\n\n";
    md += `Toplam ${topics.length} konu tespit edildi.\n\n`;

    for (const [category, catTopics] of categories) {
        const catTotal = catTopics.reduce((s, t) => s + (t.count || 0), 0);
        md += `## ${category} (${catTopics.length} konu, ${catTotal} mesaj)\n\n`;

        // Sort by count within category
        catTopics.sort((a, b) => (b.count || 0) - (a.count || 0));

        for (let i = 0; i < catTopics.length; i++) {
            const t = catTopics[i];
            md += `### ${i + 1}. ${t.question} (${t.count || "?"} kez)\n\n`;

            if (t.answer) {
                md += `**Önerilen cevap:**\n${t.answer}\n\n`;
            }

            if (t.sources && t.sources.length > 0) {
                md += `**Kaynak:** ${t.sources.join(", ")}\n\n`;
            }

            md += `---\n\n`;
        }
    }

    fs.writeFileSync(REPORT_FILE, md, "utf-8");
    console.log(`Report written to ${REPORT_FILE}`);
    console.log(`${topics.length} topics across ${categories.length} categories`);
}

main();
