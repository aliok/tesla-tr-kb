# Chat Export Processor - Plan

## Goal

Extract frequently asked questions from Telegram group chat exports to populate the knowledge base.

## Input

Two Telegram Desktop HTML exports in `chat-exports/`:

| Export | Group | Messages | Text size |
|--------|-------|----------|-----------|
| `ChatExport_2026-05-06_A` | Legacy Model Y LR/P Sahipleri | ~12K | ~2.8 MB |
| `ChatExport_2026-05-06_B` | Legacy Model Y SR Sahipleri | ~54K | ~11.4 MB |
| **Total** | | **~66K** | **~14 MB** |

Each export contains paginated `messages*.html` files in Telegram's standard HTML export format.

### Message HTML structure

```html
<div class="message default clearfix" id="message591026">
  <div class="body">
    <div class="pull_right date details" title="17.07.2024 22:17:04 UTC+03:00">22:17</div>
    <div class="from_name">Selcuk</div>
    <div class="reply_to details">In reply to <a href="...">this message</a></div>
    <div class="text">Message text here</div>
  </div>
</div>
```

Service messages (date headers, topic creation) use `class="message service"`.

## Processing Pipeline

### Step 1: Extract messages to JSON

**Script:** `extract-messages.js`

Parse all `messages*.html` files from both exports and produce a single JSON file with normalized messages:

```json
[
  {
    "id": "591026",
    "date": "2024-07-17T22:17:04+03:00",
    "from": "Selcuk",
    "text": "Message text here",
    "replyTo": "591024",
    "source": "A"
  }
]
```

- Use `cheerio` to parse HTML (reliable for this volume)
- Extract `div.text` content from `div.message.default` elements
- Strip HTML tags from message text, but preserve line breaks
- Parse the date from the `title` attribute of `div.date`
- Combine messages from both exports into one file, sorted by date
- Skip service messages (`class="message service"`)
- Skip messages that are only stickers, photos, or videos with no text

**Output:** `output/messages.json`

### Step 2: Analyze with Claude API (map-reduce)

~14 MB of text is ~3-4M tokens — far beyond a single 200K context window. We use a map-reduce strategy.

**Script:** `analyze-messages.js`

#### Map phase

1. Load `messages.json`
2. Split into batches of ~500 messages (fits comfortably within context)
3. Send each batch to Claude (Haiku for cost efficiency) with a prompt like:

   > You are analyzing messages from a Turkish Tesla owners Telegram group.
   > Identify recurring questions and topics people ask about.
   > For each topic you find, provide:
   > - A short topic label in Turkish
   > - A canonical FAQ question in Turkish
   > - Example messages from the batch that match this topic
   > - A count of how many messages in this batch relate to this topic
   > Return JSON.

4. Save each batch result to `output/batch-results/batch-NNN.json`
5. Process batches with concurrency (e.g., 5 parallel requests) and a rate limiter

#### Reduce phase

1. Load all batch results
2. Send the combined topic lists to Claude (Sonnet for better reasoning) with:

   > Here are FAQ topics identified from different batches of a Turkish Tesla Telegram group.
   > Merge duplicate/overlapping topics, rank by total frequency, and for each final topic provide:
   > - A canonical FAQ question in Turkish
   > - A suggested answer in Turkish (based on the common responses you saw)
   > - Total count across all batches
   > - A category label (e.g., "Sarj", "Satin Alma", "Garanti", "Genel")
   > Return the top 50 topics as JSON.

3. The reduce step may itself need batching if there are too many intermediate topics. In that case, do a hierarchical reduce (reduce in groups, then reduce the results).

**Output:** `output/faq-results.json`

```json
[
  {
    "category": "Sarj",
    "question": "Supercharger'da sarj ne kadar suruyor?",
    "answer": "Model Y LR icin %10'dan %80'e yaklasik 25-30 dakika surmektedir...",
    "count": 42,
    "sampleMessages": ["...", "...", "..."]
  }
]
```

### Step 3: Generate FAQ report

**Script:** `generate-report.js`

Convert `faq-results.json` into a human-readable Markdown report, grouped by category:

```markdown
# Tesla TR - SSS Raporu

## Sarj (12 soru)

### 1. Supercharger'da sarj ne kadar suruyor? (42 kez soruldu)

**Onerilen cevap:**
Model Y LR icin %10'dan %80'e yaklasik 25-30 dakika surmektedir...

**Ornek mesajlar:**
- "LR'de supercharger'da kac dakikada doluyor?"
- "Sarj suresi ne kadar arkadaslar?"

---

### 2. ...

## Satin Alma (8 soru)

### 1. ...
```

This report is the input for manually creating/updating KB pages.

**Output:** `output/faq-report.md`

## Tech

- Plain Node.js scripts (no TypeScript)
- `cheerio` for HTML parsing
- `@anthropic-ai/sdk` for Claude API calls
- Use the same `.nvmrc` as the main project
- Dependencies in a separate `package.json` inside `chat-export-processor/`
- `ANTHROPIC_API_KEY` environment variable for the Claude API

## Directory Structure

```
chat-export-processor/
├── PLAN.md               # This file
├── package.json
├── extract-messages.js
├── analyze-messages.js
├── generate-report.js
└── output/               # Generated files (gitignored)
    ├── messages.json
    ├── batch-results/
    │   ├── batch-001.json
    │   ├── batch-002.json
    │   └── ...
    ├── faq-results.json
    └── faq-report.md
```

## Usage

```bash
cd chat-export-processor
npm install

# Step 1: Extract messages from HTML exports
node extract-messages.js

# Step 2: Analyze with Claude API (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-... node analyze-messages.js

# Step 3: Generate readable report
node generate-report.js
```

## Cost Estimate

- ~66K messages in batches of 500 = ~132 batches
- Map phase (Haiku): ~132 calls, each ~2K input tokens + ~1K output = ~400K total tokens ≈ $0.10-0.20
- Reduce phase (Sonnet): 1-3 calls, ~50K input + ~10K output ≈ $0.30-0.50
- **Total estimate: under $1**

## Open Questions

1. **Anonymization** — The output files will contain usernames from the chat. Should we strip those before committing any output?
2. **Answer quality** — Claude's suggested answers in the reduce step are based on chat messages, not official sources. They should be reviewed and fact-checked before publishing to the KB.
