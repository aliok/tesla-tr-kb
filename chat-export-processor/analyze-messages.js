require("dotenv").config({ path: __dirname + "/.env" });

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "output");
const BATCH_DIR = path.join(OUTPUT_DIR, "batch-results");
const MESSAGES_FILE = path.join(OUTPUT_DIR, "messages.json");

const BATCH_SIZE = 500;
const CONCURRENCY = 3;
const MAX_BATCHES = parseInt(process.env.MAX_BATCHES || "10", 10);

const SOURCE_LABELS = {
    A: "Legacy Model Y LR/P Sahipleri",
    B: "Legacy Model Y SR Sahipleri",
};

const PROVIDER = (process.env.CLAUDE_PROVIDER || "anthropic").toLowerCase();

const VERTEX_DEFAULTS = {
    map: "claude-3-5-haiku@20241022",
    reduce: "claude-sonnet-4@20250514",
};
const ANTHROPIC_DEFAULTS = {
    map: "claude-3-5-haiku-20241022",
    reduce: "claude-sonnet-4-20250514",
};
const DEFAULTS = PROVIDER === "vertex" ? VERTEX_DEFAULTS : ANTHROPIC_DEFAULTS;

const MAP_MODEL = process.env.MAP_MODEL || DEFAULTS.map;
const REDUCE_MODEL = process.env.REDUCE_MODEL || DEFAULTS.reduce;

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

function createClient() {
    if (PROVIDER === "vertex") {
        const { AnthropicVertex } = require("@anthropic-ai/vertex-sdk");
        return new AnthropicVertex({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            region: process.env.GOOGLE_CLOUD_REGION || "us-east5",
        });
    }

    const Anthropic = require("@anthropic-ai/sdk");
    return new Anthropic();
}

// ---------------------------------------------------------------------------
// Batching — keep sources separate
// ---------------------------------------------------------------------------

function createBatches(messages) {
    const bySource = {};
    for (const msg of messages) {
        const s = msg.source;
        if (!bySource[s]) bySource[s] = [];
        bySource[s].push(msg);
    }

    const batches = [];
    for (const [source, msgs] of Object.entries(bySource)) {
        for (let i = 0; i < msgs.length; i += BATCH_SIZE) {
            batches.push({
                source,
                label: SOURCE_LABELS[source] || source,
                messages: msgs.slice(i, i + BATCH_SIZE),
            });
        }
    }

    // Sort so we get A batches first, then B
    batches.sort((a, b) => a.source.localeCompare(b.source));

    // Number them
    return batches.map((b, i) => ({ ...b, index: i + 1 }));
}

// ---------------------------------------------------------------------------
// Map phase — identify topics per batch
// ---------------------------------------------------------------------------

function buildMapPrompt(batch) {
    const lines = batch.messages.map(
        (m) => `[${m.id}] ${m.from}: ${m.text}`
    );

    return `You are analyzing messages from a Turkish Tesla owners Telegram group.
Group/topic: "${batch.label}"

Below are ${batch.messages.length} messages from the group. Your job is to identify recurring questions and topics that people frequently ask about.

For each distinct topic you identify, provide:
- "topic": A short label in Turkish (e.g., "Şarj Süresi", "Garanti Kapsamı")
- "question": A canonical FAQ question in Turkish
- "count": How many messages in this batch relate to this topic
- "messageIds": Array of message IDs that relate to this topic

Focus on questions and informational topics useful for a FAQ/knowledge base.
Ignore greetings, chitchat, jokes, and off-topic messages.
A batch may have no useful topics — that's fine, return an empty array.

Return ONLY valid JSON, no markdown fences:
{"topics": [...]}

Messages:
${lines.join("\n")}`;
}

async function processBatch(client, batch) {
    const batchFile = path.join(
        BATCH_DIR,
        `batch-${String(batch.index).padStart(3, "0")}.json`
    );

    // Skip if already processed
    if (fs.existsSync(batchFile)) {
        console.log(`  Batch ${batch.index} already processed, skipping.`);
        return JSON.parse(fs.readFileSync(batchFile, "utf-8"));
    }

    const prompt = buildMapPrompt(batch);

    const response = await client.messages.create({
        model: MAP_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    let result;
    try {
        result = JSON.parse(text);
    } catch {
        // Try extracting JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
        } else {
            console.error(`  Batch ${batch.index}: Failed to parse response`);
            result = { topics: [] };
        }
    }

    const output = {
        batchIndex: batch.index,
        source: batch.source,
        label: batch.label,
        messageCount: batch.messages.length,
        topics: result.topics || [],
    };

    fs.writeFileSync(batchFile, JSON.stringify(output, null, 2), "utf-8");
    return output;
}

async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    let i = 0;

    async function next() {
        while (i < tasks.length) {
            const idx = i++;
            results[idx] = await tasks[idx]();
        }
    }

    const workers = [];
    for (let w = 0; w < Math.min(concurrency, tasks.length); w++) {
        workers.push(next());
    }
    await Promise.all(workers);
    return results;
}

// ---------------------------------------------------------------------------
// Reduce phase — consolidate topics across batches
// ---------------------------------------------------------------------------

function buildReducePrompt(batchResults) {
    const allTopics = [];
    for (const br of batchResults) {
        for (const t of br.topics) {
            allTopics.push({
                source: br.label,
                topic: t.topic,
                question: t.question,
                count: t.count,
            });
        }
    }

    return `You are consolidating FAQ topics extracted from a Turkish Tesla owners Telegram group.

Below are topic lists extracted from different batches of messages. Many topics overlap across batches.

Your job is to:
1. Merge duplicate/overlapping topics into single entries
2. Rank by total frequency (sum the counts)
3. For each final topic, provide:
   - "category": A category label in Turkish (e.g., "Şarj", "Satın Alma", "Garanti", "Bakım", "Yazılım", "Sigorta", "Genel")
   - "question": A canonical FAQ question in Turkish
   - "answer": A suggested answer in Turkish based on what the community commonly says. Keep it factual and helpful.
   - "count": Total count across all batches
   - "sources": Which groups this topic appeared in (array of group names)

Return the top 30 topics as valid JSON, no markdown fences:
{"topics": [...]}

Topic data from batches:
${JSON.stringify(allTopics, null, 2)}`;
}

async function reduceResults(client, batchResults) {
    const prompt = buildReducePrompt(batchResults);

    console.log("\nRunning reduce phase...");

    const response = await client.messages.create({
        model: REDUCE_MODEL,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    let result;
    try {
        result = JSON.parse(text);
    } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
        } else {
            console.error("Failed to parse reduce response");
            fs.writeFileSync(
                path.join(OUTPUT_DIR, "reduce-raw.txt"),
                text,
                "utf-8"
            );
            process.exit(1);
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const client = createClient();

    // Load messages
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
    console.log(`Loaded ${messages.length} messages`);

    // Create batches (sources kept separate)
    const allBatches = createBatches(messages);
    console.log(`Created ${allBatches.length} batches total`);

    const batches =
        MAX_BATCHES > 0 ? allBatches.slice(0, MAX_BATCHES) : allBatches;
    console.log(
        `Processing ${batches.length} batches (MAX_BATCHES=${MAX_BATCHES})`
    );

    // Ensure output dirs
    fs.mkdirSync(BATCH_DIR, { recursive: true });

    // Map phase
    console.log(`\nMap phase (model: ${MAP_MODEL}, concurrency: ${CONCURRENCY})`);
    const tasks = batches.map(
        (batch) => () =>
            processBatch(client, batch).then((result) => {
                console.log(
                    `  Batch ${batch.index} [${batch.source}]: ${result.topics.length} topics found`
                );
                return result;
            })
    );

    const batchResults = await runWithConcurrency(tasks, CONCURRENCY);

    const totalTopics = batchResults.reduce(
        (sum, r) => sum + r.topics.length,
        0
    );
    console.log(`\nMap phase done: ${totalTopics} topics across ${batches.length} batches`);

    // Reduce phase
    const faqResults = await reduceResults(client, batchResults);

    const faqFile = path.join(OUTPUT_DIR, "faq-results.json");
    fs.writeFileSync(faqFile, JSON.stringify(faqResults, null, 2), "utf-8");
    console.log(
        `\nReduce phase done: ${faqResults.topics?.length || 0} consolidated topics`
    );
    console.log(`Results written to ${faqFile}`);
}

main().catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
});
