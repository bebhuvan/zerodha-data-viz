# Zerodha charts

An editorial chart system for economics, macro and markets: public data in, brand-compliant charts
out, in every social and web size. Built for Zerodha, Markets by Zerodha and Rainmatter newsletters,
blogs and social posts, and designed to be driven by any coding agent (Claude Code, Gemini CLI, Codex,
Cursor). Agents start with [AGENTS.md](AGENTS.md); people can too.

## Quick start

```
npm run setup                    # installs D3 and Playwright (needs Node 20+, Python 3.10+, Chrome)
npm run build                    # validate data, rebuild tidy tables and facts.json
npm run make -- india_growth     # render one chart in all nine formats, lint it, make a contact sheet
npm run test                     # the regression suite: every chart and every planted-defect fixture
```

No Chrome? `npx playwright install chromium` and set `ZVIZ_CHROME=bundled`.
Refresh data from the sources: `npm run fetch` (network; MOSPI is slow), then `npm run build`.

## What is in it

- **22 published charts** across CPI, El Niño, state inflation, the rupee, GDP, growth, the Nifty,
  the Sensex, gold and bonds: `output/zerodha/index.html` shows every chart in every format.
- **18 chart forms** (`pipeline/render/templates/`): lines (log scales, drawdowns, yield curves, target
  bands), columns, bars, histogram, range bars, ranked grid, bump, scatter, big number, beeswarm, bridge,
  ranked dots, slope, small multiples, calendar, waffle, stacked bars, tiles. Each documents its spec,
  adapts to the canvas and checks its own encoding.
- **A visual grammar in tokens** (`pipeline/design/themes/zerodha.json`): type roles, inks, spacing,
  marks and axes, from the Zerodha brand guide, enforced by a linter that reads the rendered SVG.
- **A data layer with provenance**: every raw file has its URL, fetch time and hash; every number a
  chart shows is in `facts.json` and every claim is re-checked in code.
- **Skills** (`skills/`): how to analyse data, choose a form, write the copy, get the finance right,
  build a chart, add a form, and review the result by eye.

## Where things are

```
AGENTS.md                    Instructions for agents (and the rules, in full). CLAUDE.md, GEMINI.md point here.
CHANGELOG.md                 What changed and why
skills/                      Agent-agnostic skills (markdown)
output/zerodha/              FINAL CHARTS: <format>/<chart>.{png,svg}, captions/<chart>.md, index.html
pipeline/fetch/              Fetchers (raw + manifest) and builders (tidy + facts, with checks)
pipeline/data/               raw/ snapshots, tidy/ tables and facts.json
pipeline/design/             themes/, formats.json, fonts/, brand/ (logo; the brand PDF is private)
pipeline/render/             renderer, frame, kit, templates/, charts/, sketches/
pipeline/qa/                 lint.mjs, lint_code.mjs, fixtures/, reports/ (regenerated)
pipeline/make.mjs            one command: render, lint, contact sheet, review prompt
briefs/, archive/            hand-offs and finished experiments
```

## Formats

| Format | Size | Use |
|---|---|---|
| instagram_portrait | 1080×1350 | Instagram feed, X portrait, LinkedIn portrait, Threads |
| square | 1080×1080 | YouTube community posts (1:1), Instagram square, LinkedIn square |
| story | 1080×1920 | Stories, Reels/Shorts covers, WhatsApp status |
| x_landscape | 1600×900 | X / Twitter |
| linkedin_landscape | 1200×627 | LinkedIn feed and link shares |
| youtube | 1920×1080 | Video frames, slides |
| blog | 1456×1456 | Substack and blog posts, inline square |
| blog_wide | 1456×1048 | Substack inline wide, post social preview |
| web | 760×720 | Web pages (the SVG scales to any width) |

A chart that cannot fit a format legibly is skipped, not squeezed; the renderer says why.

## Licence and brand

The code is the system; the Zerodha theme, logo and name are Zerodha's. The brand guide PDF is not
distributed (see `.gitignore`). To use the system for another brand, copy `editorial.json` or
`zerodha.json` in `pipeline/design/themes/`, change the tokens, and render with `--theme=<name>`.
