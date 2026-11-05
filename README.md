# ExamPlan Studio

> **Universal interactive exam planner generator**

[![Deploy to GitHub Pages](https://github.com/MercuryDCD/ExamiPlanner/actions/workflows/pages.yml/badge.svg)](https://github.com/MercuryDCD/ExamiPlanner/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Live demo](https://mercurydcd.github.io/ExamiPlanner/)**

A lightweight generator and CLI that turns university exam lists or schedules into self-contained, interactive visual planners (a single `.html` file).

## Features

* **Universal:** supports multi-call systems (Italian *appelli*, e.g. UNIBO) and classic ones (ordinary/extraordinary sessions, midterms and finals), including subjects split into separately gradable modules.
* **Zero dependencies in the final output (*zero-build*):** the generated `.html` is fully standalone (Tailwind CSS via CDN + vanilla JavaScript). It works by double-clicking locally, embedded in Obsidian, or hosted on GitHub Pages.
* **Live conflict analysis:** exact time collisions, same-day congestion, critical turnarounds (< 24 h), backup (fallback) calls for the same module, and study-buffer metrics between exams.
* **Optimizer:** *Maximize spacing* (max-min buffer) and *difficulty-weighted* modes (per-module sliders from 1 to 5), plus a *Safety net* toggle that keeps later calls free as fallbacks.
* **Calendar and timeline:** 3-month interactive calendar, per-day planning (blocked / study day), chronological agenda, `.ics` export and Markdown summary.
* **Multi-session and i18n:** independent sessions persisted in `localStorage`; Spanish / English / Italian UI; dark and light mode.
* **AI-assisted import and drag & drop:** drop any `.json`, `.md` or `.txt` onto the browser. It extracts AI-generated ```` ```json ```` blocks (from exam photos, university portals or PDFs) and cleans comments and trailing commas. A ready-to-use prompt is in [`TEMPLATE_EXAMS.md`](TEMPLATE_EXAMS.md) and behind the "AI Prompt" button in the UI.

## Quick start

Requires Node.js ≥ 18 (uses `node:util` `parseArgs` and `node --test`). No `npm install` needed.

```bash
node src/cli.js -i schemas/examples/unibo_master_ai.json -o index.html
```

Then open `index.html` in any browser.

| Option | Description |
|---|---|
| `-i, --input <path>` | JSON or Markdown file with the exam calls (required) |
| `-o, --output <path>` | Output HTML file (default: `index.html`) |
| `-t, --template <path>` | Custom HTML template |
| `-h, --help` / `-v, --version` | Help / version |

Run the tests with `npm test`.

## Input format

Input is a normalized JSON document (`meta`, `subjects` → `modules` → `calls`, optional `presets`), validated against [`schemas/schedule_schema.json`](schemas/schedule_schema.json). See [`schemas/examples/`](schemas/examples/) for complete examples. Modules of the same subject with calls on the same `date` and `time` are treated as a single joint exam.

## Project structure

```text
├── templates/standalone_planner.html   # Master HTML template
├── schemas/
│   ├── schedule_schema.json            # JSON Schema
│   └── examples/                       # Example inputs
├── src/
│   ├── core/                           # Node.js: parser, analyzer, optimizer, generator
│   ├── client/                         # Browser modules inlined into the output
│   └── cli.js                          # CLI entry point
├── tests/                              # Unit and integration tests
├── TEMPLATE_EXAMS.md                   # AI prompt + schema to fill in
└── GEMINI.md                           # Architecture notes and assistant directives
```

Edit `src/` or `templates/`, then regenerate the deliverable with `npm run build:example`.

## Deployment (GitHub Pages)

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the tests, regenerates `index.html` and publishes it on every push to `main`. Requires **Settings → Pages → Source: GitHub Actions**.

## License

[MIT](LICENSE)
