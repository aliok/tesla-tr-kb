# Tesla TR Bilgi Bankası - Contributor Guide

## Project Overview

A mobile-first knowledge base for Tesla owners and enthusiasts in Turkey. The site is designed to be shared in Telegram groups — each question has a unique anchor URL so you can link directly to a specific Q&A.

**Tech stack:** HTML, CSS, TypeScript (frontend), jQuery (CDN), Node.js scripts (build tools), GitHub Actions (CI), Netlify (hosting).

## Dev Environment Setup

```bash
# Use the correct Node version
nvm install
nvm use

# Install dependencies
npm install

# Build the site (output goes to dist/)
npm run build

# Serve locally
npx serve dist
```

The build pipeline runs these steps in order:
1. `clean` — removes `dist/`
2. `copy` — copies HTML and CSS files from `src/` to `dist/`
3. `compile` — compiles TypeScript (`src/app.ts` → `dist/app.js`)
4. `generate-toc` — runs `scripts/generate-toc.js` to auto-generate the table of contents in `dist/index.html`

## Content Authoring Rules

### Anchor / ID Naming Conventions

Every `<details>` element **must** have a unique `id` attribute. This ID becomes the URL anchor (e.g., `pages/genel.html#neden-tesla`).

Rules:
- **kebab-case**, lowercase, ASCII-only (no Turkish special characters in IDs)
- Turkish character mapping: `ç→c`, `ğ→g`, `ı→i`, `ö→o`, `ş→s`, `ü→u`
- Keep IDs short but descriptive (max ~40 characters)
- Use a keyword that captures the question topic
- IDs must be unique within the page
- **Never change a published ID** — people share these URLs in Telegram and changing them would break existing links

Examples of good IDs:
- `neden-tesla`
- `sarj-suresi-ne-kadar`
- `garanti-kapsami`
- `ikinci-el-fiyatlar`

### Adding a New Category Page

1. Create a new `.html` file in `src/pages/`
2. Filename should be lowercase kebab-case (e.g., `satin-alma.html`, `sarj.html`)
3. Copy the structure from an existing page like `genel.html` as a template
4. Update the `<h2>` title — this becomes the category name in the TOC
5. The page will be automatically picked up by `generate-toc.js` during build

Page template structure:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KATEGORI ADI - Tesla TR Bilgi Bankası</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <header>
        <div class="container">
            <h1>Tesla TR Bilgi Bankası</h1>
            <nav><a href="../index.html">&larr; Ana Sayfa</a></nav>
        </div>
    </header>
    <main class="container">
        <h2>KATEGORI ADI</h2>

        <!-- Questions go here -->

    </main>
    <footer class="container">
        <p>Tesla TR Bilgi Bankası</p>
    </footer>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    <script src="../app.js"></script>
</body>
</html>
```

### Adding a New Question

Add a `<details>` block inside `<main>` on the appropriate category page:

```html
<details id="soru-id-buraya">
    <summary>Soru metni buraya?</summary>
    <div class="answer">
        <p>Cevap metni buraya.</p>
    </div>
</details>
```

Rules:
- Each `<details>` must have a unique `id` (see naming rules above)
- The `<summary>` contains the question text
- Answer content goes inside `<div class="answer">`
- Use `<p>`, `<ul>`, `<ol>`, `<a>`, `<strong>` tags inside the answer — keep it simple
- Place questions in a logical order within the page

### Content Formatting

- Write questions in `<summary>` as natural Turkish questions (with `?`)
- Keep answers concise and factual — no marketing language
- External links must use `target="_blank" rel="noopener noreferrer"`
- Each answer should be self-contained — don't reference other answers with "yukarıya bakınız"

### Page Ordering in the TOC

The TOC generator sorts pages **alphabetically by filename**. To control the order, prefix filenames with numbers:

```
src/pages/
├── 01-genel.html
├── 02-satin-alma.html
├── 03-sarj.html
└── 04-servis.html
```

## How TOC Generation Works

The script `scripts/generate-toc.js` runs during `npm run build`. It:

1. Reads all `.html` files from `dist/pages/`
2. Extracts the `<h2>` title from each page (used as category name)
3. Extracts all `<details id="..."><summary>...</summary>` pairs
4. Generates TOC HTML with links in the format `pages/filename.html#question-id`
5. Replaces content between `<!-- TOC_START -->` and `<!-- TOC_END -->` markers in `dist/index.html`

**Do not manually edit** the TOC section in `src/index.html`. It will be overwritten during build.

## CI / CD

- **GitHub Actions** runs `npm run build` on every push to `main` and on pull requests to validate the build
- **Netlify** auto-deploys from the `main` branch using the build command in `netlify.toml`
- The build must pass before merging PRs

## Project Structure

```
tesla-tr-kb/
├── .nvmrc                    # Node version (managed by nvm)
├── .gitignore
├── package.json              # Scripts and dev dependencies
├── tsconfig.json             # TypeScript config
├── netlify.toml              # Netlify deployment config
├── AGENTS.md                 # This file
├── .github/workflows/
│   └── ci.yml                # GitHub Actions CI workflow
├── scripts/
│   └── generate-toc.js       # TOC generation script (Node.js)
├── src/
│   ├── index.html            # Landing page with auto-generated TOC
│   ├── styles.css            # All styles (mobile-first)
│   ├── app.ts                # Frontend TypeScript (deep-linking, accordion UX)
│   └── pages/
│       └── genel.html        # Example category page
└── dist/                     # Build output (gitignored)
```
