# Zerodha chart system: guide for agents

This file is the canonical instruction set for any coding agent (Claude Code, Gemini CLI, Codex,
Cursor, Copilot) working in this repository. `CLAUDE.md` and `GEMINI.md` only point here. Read this
file fully before changing anything, then read the skill the task needs.

## What this is

A chart system for Zerodha, Markets by Zerodha (Daily Brief) and Rainmatter: newsletters, Substack and
blog posts, and social graphics. It turns public data into brand-compliant, editorial-grade charts in
nine canvas sizes, for economics, macro and markets. The bar is the FT, The Economist, Bloomberg and
Reuters graphics desks: one point per chart, stated in the headline, drawn so a reader gets it in five
seconds, with every number traceable to its source.

Stack: Python data layer (`pipeline/fetch/`), D3 rendered in headless Chrome via Playwright
(`pipeline/render/`), a Node linter that checks the rendered SVG (`pipeline/qa/`). Requirements:
Python 3.10+ (xarray and netCDF4 for the ERA5 build; cdsapi for its fetch), Node 20+, Google Chrome (or `npx playwright install chromium`; set `ZVIZ_CHROME=bundled`).
Setup: `cd pipeline/render && npm install`.

## The workflow (follow it for every chart)

1. **Question and data**: profile the data, find one true, robust, useful claim (`skills/data-analysis`).
2. **Numbers**: compute in `pipeline/fetch/build_*.py` with `check(...)` gates; every quoted number goes
   to `facts.json` under an explicit key (`skills/chart-stats`, `skills/finance-conventions`).
3. **Form**: claim, job, data shape, then the most familiar form that makes the point; write the choice
   record on the chart file's first line (`skills/chart-choice`, `pipeline/design/chart_forms.json`).
4. **Words**: plain headline, dek (sub-heading), explanation box, notes, source, with shorter variants
   (`skills/chart-copy`).
5. **Chart file**: `pipeline/render/charts/<name>.js`, data + copy + checked claim + one template call
   (`skills/new-chart`).
6. **Make**: `node pipeline/make.mjs <name>` renders all formats, lints, writes a contact sheet.
7. **Look**: answer the seven questions on the contact sheet, then run the cold read
   (`node pipeline/qa/cold_read.mjs <name>`) and fix what a fresh reader found confusing
   (`skills/visual-review`). Lint-clean is not done. Fix the class of fault, not the instance.
8. **Regression**: `node pipeline/make.mjs --test` before you finish.

## Skills (plain markdown, agent-agnostic; `.claude/skills`, `.gemini/skills`, `.agent/skills` link here)

| Skill | Read it when |
|---|---|
| `skills/new-chart/SKILL.md` | making any chart, start to finish |
| `skills/data-analysis/SKILL.md` | new data, or a chart without a clear point |
| `skills/finance-conventions/SKILL.md` | prices, returns, rates, money, GDP, inflation; formats, sources, compliance |
| `skills/chart-stats/SKILL.md` | any derived number: growth, CAGR, contributions, records, ratios |
| `skills/chart-choice/SKILL.md` | choosing the form; the job-to-template table |
| `skills/chart-copy/SKILL.md` | headline, dek, notes, source, labels, alt text |
| `skills/visual-review/SKILL.md` | after every render; critiquing a chart |
| `skills/new-template/SKILL.md` | adding or extending a chart form |

## Commands

```
python3 -I pipeline/fetch/fetch_all.py        # MOSPI CPI, NOAA ONI, boundaries (slow; network)
python3 -I pipeline/fetch/fetch_markets.py    # Yahoo, FRED, World Bank (network)
python3 -I pipeline/fetch/fetch_climate.py    # OWID: Copernicus ERA5 world temperature with NOAA ONI (network)
python3 -I pipeline/fetch/fetch_era5.py       # Copernicus CDS: ERA5 SST over the Niño 3.4 box (needs ~/.cdsapirc, cdsapi)
python3 -I pipeline/fetch/fetch_pip.py        # World Bank PIP: India poverty at $3.00/$4.20/$8.30 (release pinned)
python3 -I pipeline/fetch/build_tidy.py       # validate and rebuild tidy tables + facts.json
node pipeline/make.mjs <chart> [--format=all|a,b] [--dir=sketches --out=<scratch>]
node pipeline/make.mjs --all                  # every published chart
node pipeline/make.mjs --test                 # must pass before any hand-off
node pipeline/qa/cold_read.mjs <chart>        # a fresh `claude -p` or `gemini -p` reads the feed PNG cold (step 7)
```

`npm run make -- <chart>`, `npm run test`, `npm run build` (repo root) do the same.

## Checks that must keep passing (`make.mjs --test` runs them)

```
node pipeline/qa/lint.mjs output/zerodha/*/svg/*.svg                              # all clean
node pipeline/qa/lint.mjs --theme=editorial pipeline/qa/fixtures/planted.svg      # exactly 7 issues
node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_space.svg                  # exactly 6 space issues
node pipeline/qa/lint.mjs archive/2026-10-27-stack-bakeoff/outputs/editorial/cpi_contrib.svg  # must fail brand
node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_grammar.svg                # exactly 6 grammar issues
node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_swarm.svg                  # exactly 1 space issue
node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_headline.svg               # exactly 2 headline issues
node pipeline/qa/lint.mjs pipeline/qa/fixtures/planted_caps.svg                   # exactly 1 brand issue (EBITDA allowed)
node pipeline/qa/lint_code.mjs                                                     # 0 issues
node pipeline/qa/lint_code.mjs pipeline/qa/fixtures/planted_code.js               # exactly 5 issues
node pipeline/qa/lint_code.mjs pipeline/qa/fixtures/planted_choice.js             # exactly 4 choice issues
```

Never weaken a check to make a chart pass. If a check is wrong, fix it so it is right for every chart,
add a fixture that proves it still catches the fault, and say so in `CHANGELOG.md`.

## Where things are

```
AGENTS.md, CLAUDE.md, GEMINI.md   agent instructions (this file is the source of truth)
CHANGELOG.md                      what changed and why, newest first
skills/                           the skills above
output/<theme>/                   FINAL charts only: <chart>/ holds <chart>_<platform>_<w>x<h>.png, svg/<format>.svg
                                  and caption.md (headline, dek, explanation, notes, source, alt text); index.html
pipeline/fetch/                   fetchers (raw snapshots + manifest) and builders (tidy CSVs + facts.json)
pipeline/data/raw/                untouched responses; manifest.json has URL, time, sha256 per file
pipeline/data/tidy/               clean tables and facts.json (every number a chart may show)
pipeline/design/                  themes/ (brand rules, grammar tokens), formats.json (sizes), chart_forms.json
                                  (form tiers and jobs), fonts/, brand/
pipeline/render/                  render.mjs, tokens.mjs, frame.js (header/footer), kit.js (house marks)
pipeline/render/templates/        chart forms, each documenting its spec
pipeline/render/charts/           published charts; `_` files are shared helpers
pipeline/render/sketches/         alternatives; render to a scratch folder, never output/
pipeline/qa/                      lint.mjs (SVG), lint_code.mjs (source, choice records), cold_read.mjs,
                                  fixtures/, reports/ (regenerated)
pipeline/make.mjs                 render + lint + contact sheet + review prompt
briefs/                           hand-offs to fresh sessions and their reports
archive/                          finished experiments; nothing reads from here
```

Folder rules: `output/` holds final charts only (no scratch, debug or comparison images). Scratch work
goes in your session's scratch directory. Raw data is never edited by hand.

## The template library

| Template | Job | Example chart |
|---|---|---|
| `lines` | change over time; log y (`inr_long`), drawdown fill (`nifty_drawdown`), log x curve (`us_yield_curve`), target band (`cpi_timeline`), envelope (`oni_band`), survey dots and a break (`india_poverty`) | `cpi_timeline` |
| `columns` | amounts per period, ± zero; a record across years | `india_growth`, `oni_years` |
| `bars` | ranking with names and values, no axis | `big_growth` |
| `histogram` | shape of a distribution, hero range | `nifty_moves` |
| `range_bars` | worst / middle / best per group; turns to columns on tall canvases | `sensex_rolling` |
| `rank_grid` | "periodic table" of ranks per period | `asset_returns` |
| `bump` | rank over time | `gdp_rank` |
| `scatter` | two measures per item, log axes | `growth_income` |
| `big_number` | one figure, what it is, change, short history | `india_10y` |
| `beeswarm` | one item against a distribution (specialist: only when too many items to name) | `state_ranked` (short canvases); sketch `oni_swarm` |
| `bridge` | decomposition of a change | `cpi_bridge` |
| `ranked_dots` | distance from a reference, stems and bands | `state_ranked` |
| `slope` | two dates, many items | `cpi_slope` |
| `small_multiples` | several series, each its own story | `cpi_groups` |
| `calendar` | every month of every year | `cpi_calendar` |
| `waffle` | part of a whole | `cpi_basket` |
| `stacked_bars` | composition over time | `cpi_contrib` |
| `tiles` | geography as a tile grid | `state_tiles` |

## Brand: Zerodha (theme `pipeline/design/themes/zerodha.json`)

The brand guide PDF is private and is not in the public repository (`.gitignore`). Everything a chart
needs from it is in the theme, with each deviation and its reason in `_deviations`. The linter's `brand`
check enforces it.

- White ground, flat colours, no gradients or textures (missing data is a dashed outline).
- Inter only; two core sizes plus the guide's ±4px small step; weights 600 and 400; no all caps (acronyms in the theme's `brand.acronyms`, such as EBITDA, are allowed), so
  no kicker.
- Text colours only #222222, #424242, #666666, #888888 (white on dark fills).
- The official logo `pipeline/design/brand/zerodha-logo.svg`, embedded unaltered at 20k height with 2x
  clear space. Never redraw it.
- Header: a Zerodha-blue topper rule; dek keys `[[words|colorKey]]` underline words in their series colour.

## Visual grammar (values in the theme's `type` and `grammar`; enforced where marked)

- **Form tiers** (`pipeline/design/chart_forms.json`): familiar, learnable, specialist. Each chart file opens
  with a choice record; learnable and specialist forms carry an explanation box, specialist forms a written
  reason [lint_code choice].
- **Explanation box**: `explain:` in the Frame call, "**How to read this.** ..." in annotation type with a semibold
  ink lead-in, under a full-width hairline (#DDDDDD, no fill) below the chart (stacked) or under the dek (side). On stacked canvases notes shorten and then
  move to the caption before the box is dropped; where it cannot fit (most 16:9 canvases) it is in the caption only.

- **Type scale**: headline and body on the guide's 8-point scale, small = body − 4; headline about 1.5–1.75×
  body (40/24/20 on 1080px feed and story canvases; per format in `formats.json`). Never 2× or more.
- **Type roles**: headline; dek (#424242); label_strong and value (body 600 ink); label, axis, note,
  source (small 400 #666666); annotation (small 400 #424242); label_on_fill (small 600, white or ink on a
  fill). Nothing else [lint grammar]. Chart text uses tabular figures; word hyphens are U+2010 so tabular
  figures do not widen them (kit and frame do this).
- **Ink, loudest first**: hero = series colour; compare #9B9B9B; total #E3E3E3; context #DDDDDD; context
  fill #E8E8E8; reference #9B9B9B dashed; baseline/leader #424242; grid #EDEDED; band #F3F3F3 [lint grammar].
  Filled cells with white text use `accent_fill` #2A64A9 (contrast).
- **One loud thing**: only the hero carries hue; at most three hues per chart [lint style].
- **Strokes** from theme `marks`: hero 3.5, compare 2, context/grid/leader 1, baseline 1.5 (×k) [lint style].
  Dense heroes (over one point per 2px) draw at compare weight without a halo.
- **Spacing** only from 2/4/8/12/16/24/32/48 ×k [lint_code]; header, chart and footer at least
  `section_min` apart; no empty band over 1.25 dek lines, except one rank row in rank layouts and up to
  one tick step (`y_cover`) between data and an end gridline [lint space].
- **Labels**: the label pair (value 600 ink, name 400 grey beneath); on the data, in open space found by
  `Kit.place`, with a dashed deep-grey leader when not adjacent and a knockout; names without a leader
  sit beside their mark. A legend only when direct labels cannot work.
- **Axes**: horizontal hairline gridlines only (scatter adds vertical ones), zero line 1.5k #424242;
  unit on the top tick only; ticks cover the data, 2-6 of them, three label-heights apart [lint grammar];
  on y axes the data never runs past the outer gridline by more than a tenth of a step (`y_cover`, `touch`);
  steps are 1, 2, 5 × 10^n, plus 25, 250… for whole-number labels;
  log scales named in the dek; bars from zero.
- **Numbers**: one formatter (`Fmt.fmt` / `K.num`, round half away from zero), true minus; Indian
  grouping for rupees and Indian counts, international for dollars; every decimal shown exists in
  `facts.json` [lint numbers], looked up by explicit key.
- **Marks**: bars `bar_ratio` of their slot, never thinner than `min_mark`; rows past `row_max` turn
  to columns; bars fill ≥ 40% of their pitch [lint space]; leaders ≥ `leader_min`.
- **Headlines** are one plain statement, at most 13 words; no colon, semicolon, question, fronted figure
  ("At +2.16°C, ...") or "Even ..." [render COPY, theme `grammar.headline`]. Set at full column width, never
  narrowed; widows are fixed by copy variants; names in `grammar.no_break` never split [lint headline].
- **Copy** may name a device (dashed, outline, shaded, hatched) only when a mark carries `data-device`
  [render COPY check, lint grammar]. Claims of records, firsts, "only" and ratios are re-checked in chart
  code and throw `COPY:` when the data stops supporting them.
- **Every template asserts its own encoding** (`K.assert`, plain arithmetic, not the drawing scale).
- **Layout**: a headline variant that fits two lines beats a fuller one that needs three; the headline measure is
  never narrowed (the old widow fix did that and read as clamped). Outer margin 4.5% of the short side. Landscape canvases take a stacked header (headline and
  dek across the top) whenever it fits in 30% of the height (`header.stack_on_wide_max`); fixed-shape
  charts (waffles, tile maps: they pass `plotAspect`) keep the side column, where notes follow the dek.
  The source wraps at full width; when it would wrap early beside the logo, the logo takes its own line.
  Story canvases keep 250px top and bottom free of text (Instagram's profile row and reply bar); the safe zone
  is the margin on those edges, not added to it. A word unit on a y axis ("days") runs into the plot, so the
  axis column is only as wide as the numbers.
- **Space**: the chart fills its box; forms adapt to the canvas (`firstFit`, orientation switches,
  short names); a chart that cannot be legible on a canvas throws `LAYOUT:` and is skipped, never squeezed.

## Rules learnt the hard way

- Quote font families in SVG attributes (`"Inter"`), or Chrome silently uses Times.
- Look facts up by explicit key. A dek once said "2015 (+0.99°C)" using 1982's value because JS sorts
  numeric object keys; number tracing proves a number exists, not that it belongs to that label.
- Yahoo's chart API coarsens long histories (`range=max` turns daily into monthly and monthly into
  quarterly) and its monthly gold-futures bars skip months. Fetch with explicit `period1/period2`,
  check the returned granularity, check for missing months, and build month-ends from daily bars.
- FRED stalls requests with unfamiliar user agents; Python's default agent works.
- Never page the MOSPI API (unstable sort); slice queries to one page. It needs legacy TLS renegotiation.
- d3-geo needs clockwise exterior rings. The India boundary file is not verified against the Survey of
  India: no maps are published until it is (`state_map` stays in `sketches/`).
- Labels placed in empty space must be checked against data lines, other labels and leaders.
- Data marks get an independent encoding assertion: the linter cannot see a wrong colour.
- Inter's tabular figures widen U+002D: typeset word hyphens as U+2010.

## Chart design decisions (why the published charts look the way they do)

- Colour only the series the headline is about; fold the rest into one grey (CPI: food, personal care, everything else).
  Large context areas (stacks, waffles) take the paler fill grey #E8E8E8, so they never outweigh the colour.
- A waffle on a landscape canvas runs as a 20x5 strip under a stacked header when it fills the width; a square
  grid beside a header column left a fifth of the canvas empty.
- Small multiples prefer a full grid (no empty cell) and set the latest value under the name when panels are narrow.
- End labels are short (value, then name below) so the right gutter stays narrow.
- Reference-line labels (e.g. "El Niño" at +0.5°C) sit in the axis column like a tick, not in a right gutter; a
  shaded target band is named inside itself (in the axis column it read as a tick and displaced one);
  a gutter is only for labels on the data itself.
- Diverging maps get a neutral band (±1 point) so noise around zero does not read as a divide.
- Bridge totals are quiet grey; step notes are annotations in the open space, so the dek says only what is measured.
- Ranked dots label only the hero and the two ends beside their dots; the reference is named in the axis row.
  When distance from the reference is the claim, dots sit on stems from it (`stems`), zero is a plain gridline,
  and a cluster a note talks about is drawn as a shaded band (`band`). Names are right-aligned against the plot.
  Names step down (full, short, code) to fit; on wide plots a two-column list turns on its side (a column per row,
  codes under the axis), so the stems appear on every canvas.
- An outlier that is the headline's point keeps a linear axis (no breaks); explain crowding in a checked note instead.
- Calendar colours follow the meaning: inside the RBI band is grey, below blue, above orange.
- El Niño data (4 Nov): Copernicus ERA5, not NOAA's ONI. `build_era5_nino34.py` applies the ONI recipe to ERA5 sea-surface
  temperature (Niño 3.4 box, cos-latitude weights, fixed 1991–2020 base, three-month means) and gates it against NOAA
  (r ≥ 0.95). The fixed base ranks past El Niños differently (ERA5 peaks: 1997, 1982, 2026 so far, 2015; NOAA: 2015,
  1997, 2026, 1982), so `_oni_common.js` derives the comparison years from the data. `Oni({ source: "noaa" })` keeps the ONI.
- Lead charts after the 28 Oct rethink: CPI `cpi_bridge` (history view `cpi_contrib`), El Niño `oni_years`
  since 4 Nov (columns by year; the beeswarm `oni_swarm` went to `sketches/` after a colleague misread it;
  trajectory `oni_band`), states `state_ranked` (geography `state_tiles`). `state_map` lives in `sketches/`
  and stays out of `output/` until its boundary is checked against the Survey of India map. `oni_lines`, `oni_ridgeline` and the losing sketches are in `archive/2026-10-28-story-alternatives/`.
- Claims of records, firsts, "only" and ratios are re-checked in chart code and throw `COPY:` when the data
  stops supporting them (e.g. `cpi_timeline` found June 2017 under 2% and forced a truer headline).
- Markets charts (3 Nov 2026): price indices are labelled as such in notes; rupee returns for foreign
  assets use the same date's exchange rate; the asset grid fills gold (hero, orange), outlines the Nifty 50
  (compare, deep blue) and sets the rest as plain type on hairline row rules (tiles everywhere were noisy);
  fewer years with full names beat more years of "S&P" and "Bank"; rolling returns use columns on tall canvases so the narrowing with time is
  visible; the scatter names only countries a reader would look for and leaves the rest as small grey
  dots (hollow rings read as missing data).

## Writing (all copy and docs)

Plain, flowing English with Indian context. No AI patterns: no em-dash chains, no "not X but Y"
flourishes, no filler hedges. Sentence-case headlines: one plain statement with a verb, a number when it
is the point, no full stop, no questions, no puns, no clever constructions. See `skills/chart-copy`.
