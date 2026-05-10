const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const CHAT_EXPORTS_DIR = path.join(__dirname, "..", "chat-exports");
const OUTPUT_DIR = path.join(__dirname, "output");

const EXPORTS = [
    { dir: "ChatExport_2026-05-06_A", source: "A" },
    { dir: "ChatExport_2026-05-06_B", source: "B" },
];

function getMessageFiles(exportDir) {
    return fs
        .readdirSync(exportDir)
        .filter((f) => /^messages\d*\.html$/.test(f))
        .sort((a, b) => {
            // Sort numerically: messages.html (0), messages2.html (2), ...
            const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
            const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
            return numA - numB;
        });
}

function parseDate(dateTitle) {
    // Format: "17.07.2024 22:17:04 UTC+03:00"
    if (!dateTitle) return null;
    const m = dateTitle.match(
        /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+UTC([+-]\d{2}:\d{2})/
    );
    if (!m) return null;
    const [, day, month, year, time, tz] = m;
    return `${year}-${month}-${day}T${time}${tz}`;
}

function extractReplyToId(replyHtml) {
    if (!replyHtml) return null;
    const m = replyHtml.match(/GoToMessage\((\d+)\)/);
    return m ? m[1] : null;
}

function stripHtml(html) {
    // Replace <br> with newline, then strip remaining tags
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&laquo;/g, "\u00AB")
        .replace(/&raquo;/g, "\u00BB")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .trim();
}

function extractMessages(filePath, source) {
    const html = fs.readFileSync(filePath, "utf-8");
    const $ = cheerio.load(html);
    const messages = [];

    $("div.message.default").each((_, el) => {
        const $msg = $(el);

        // Get message ID
        const id = ($msg.attr("id") || "").replace("message", "");
        if (!id) return;

        // Get text content
        const $text = $msg.find("div.text");
        if ($text.length === 0) return;

        const textHtml = $text.html();
        if (!textHtml) return;

        const text = stripHtml(textHtml);
        if (!text) return;

        // Get date
        const dateTitle = $msg.find("div.date").attr("title") || "";
        const date = parseDate(dateTitle);

        // Get sender
        const from = $msg.find("div.from_name").text().trim();

        // Get reply-to
        const $reply = $msg.find("div.reply_to");
        const replyTo = extractReplyToId($reply.html());

        messages.push({ id, date, from, text, replyTo, source });
    });

    return messages;
}

function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    let allMessages = [];

    for (const { dir, source } of EXPORTS) {
        const exportDir = path.join(CHAT_EXPORTS_DIR, dir);
        if (!fs.existsSync(exportDir)) {
            console.log(`Skipping ${dir} (not found)`);
            continue;
        }

        const files = getMessageFiles(exportDir);
        console.log(`Processing ${dir}: ${files.length} files`);

        for (const file of files) {
            const filePath = path.join(exportDir, file);
            const messages = extractMessages(filePath, source);
            allMessages = allMessages.concat(messages);
            process.stdout.write(`  ${file}: ${messages.length} messages\n`);
        }
    }

    // Sort by date
    allMessages.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
    });

    const outputPath = path.join(OUTPUT_DIR, "messages.json");
    fs.writeFileSync(outputPath, JSON.stringify(allMessages, null, 2), "utf-8");

    console.log(`\nDone: ${allMessages.length} messages written to ${outputPath}`);
}

main();
