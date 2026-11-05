# Changelog

Newest first. Each entry: what changed, why, and what was checked.

## 5 Nov 2026: Quarterly results of listed companies (`earnings_growth`)

Owner asked for a headline chart of the Jul–Sep 2026 results (IndiaDataHub, all BSE-listed companies), with a
sector heatmap and a table to follow.
- Data: `import_idh.py` copies the six manual IndiaDataHub downloads (GROWTH and AGGREGATES tabs; revenue, EBITDA,
  PAT) untouched into `raw/` with sha256 and the download date. `build_earnings.py` writes `earnings_growth.csv` and
  `earn_*` facts. Gates: same quarters and rows in all six files; the 12 sectors in order; industries sum to their
  sector, and sectors to the total, in every quarter for all three measures; growth from the levels runs above
  IndiaDataHub's growth (theirs compares the same companies; the levels include new listings), so charts quote
  theirs. The latest quarter is flagged provisional from the data (its revenue level is far below the quarter
  before: only some companies had reported by 5 Nov).
- Chart: three panels on one scale (sales, EBITDA, net profit), the latest step dashed. Rejected, kept in
  `sketches/`: three lines on one plot (`earnings_three`, tangled; profit's 45% in 2023 squashed sales), two lines
  (`earnings_two`), sales alone (`earnings_sales`, the cleanest read; owner wanted EBITDA on the chart).
  Headline "fastest in three years" is checked for both the latest and the last complete quarter.
- `small_multiples`: `dashLast` (dashed provisional last step), `others: false` (no grey copies of the other panels;
  the cold read took them for the sales panel's own past), `curve: "linear"` (quarterly points), and x labels thinned
  like `lines`. `lines`: an inner x label closer than sp("l") to its neighbour or to the last label is dropped, so the
  first and last are always named (long quarter names collided on 16:9). Every other line chart re-rendered with the
  same text count on every canvas.
- Brand: `brand.acronyms` in the theme (EBITDA) is exempt from the all-caps check, at the owner's request; all-caps
  styling still fails. New fixture `planted_caps.svg` (EBITDA passes, SOURCE fails: exactly 1 brand issue) in `--test`.
- Cold read: CONFUSING (grey context lines, curves dipping between quarters) -> CLEAR; EBITDA glossed in the
  explanation box. `make.mjs --test` passes.

## 5 Nov 2026: India poverty chart from the World Bank PIP (`india_poverty`)

Owner asked for the latest Indian poverty numbers from the Poverty, Prosperity, and Planet Report 2026, with the
$8.30 line shown too.
- Data: `fetch_pip.py` pulls India's headcounts at $3.00, $4.20 and $8.30 a day (2021 PPP) from the PIP API, pinned to
  release `20260922_2021_01_02_PROD` (the one the report uses): survey years, plus PIP's lineup years for checking only.
  `build_poverty.py` writes `india_poverty.csv` and `india_pov_*` / `india_poor_*` facts; gates: national consumption
  surveys only, same years at every line, headcount rising with the line, and PIP's 2024 nowcast reproducing the
  report's India figures (33M, 216M and 1,143M poor; 2% at $3.00).
- Chart: lines over survey years, $3.00 as hero, $4.20 and $8.30 in grey. The line breaks between the NSS rounds
  (to 2011-12) and the new HCES (2022-23 on): no survey in between (PIP dropped the private CPHS estimates for 2015-21)
  and the HCES is not strictly comparable; the dek and note say so.
- `lines` template: `dots: true` draws a dot on every observation. Without it the two-survey HCES runs drew as short
  strokes that read as label leaders. Cold read: CONFUSING (grey lines mispaired across the gap) -> grey lines named
  at 2011-12 as well -> CLEAR. `make.mjs --test` passes.
- Same day, owner's follow-up: the survey gap is now bridged by PIP's own yearly estimates (lineup, interpolated from
  the surveys either side with national-accounts growth), drawn dashed (`lines` gains `dashed: true`, with
  `data-device`); and every line carries its rupee value at 2023-24 prices: line x PIP's PPP rate (₹19.47 per 2021 PPP
  dollar) x PIP's CPI for the 2023-24 survey (1.158), so $3.00 = ₹68, $4.20 = ₹95, $8.30 = ₹187 a day. Cold read: CLEAR.
- Dek now carries the people count (37 million, down from 344 million) instead of explaining the dashes; the dashed
  stretch is named on the chart ("World Bank estimates", "Estimates" where space is short, via `firstFit`), so canvases
  with no room for notes (X) still say what it is. PIP's own India chart was checked: it joins only comparable surveys
  and draws nothing across 2011-22, so dashed estimates are the middle course between that and a solid line.
- Owner asked for start, 2011-12 and end values on all three lines. The grey lines' labels exposed three faults in the
  `lines` template and kit, fixed for every chart:
  - Leaders could cut through other data lines (only labels were checked; AGENTS.md says lines too). Callouts now
    try for a spot whose leader is clear of data lines first, then an inline label, and only then the old placement
    (a crossed line beats an unnamed one: making it a hard refusal dropped `oni_band`'s 1997-98 label on three canvases).
  - New `near: true` on callouts: beside the point (within 3xl) or not at all, never on a long leader.
  - Inline labels (`K.label` layout "inline") skipped the U+2010 hyphen swap, so "1977-78" set with wide gaps.
  - A single end label turned callout now also tries east, for lines that stop mid-plot (`oni_band` square:
    "2026 so far" now sits on one line beside its end instead of on a leader through both grey lines).
  - Callout `name` may be a list of variants, longest first (india_poverty: "1977-78, $8.30 line", then "1977-78"),
    after the cold read found the grey lines were named only at their right ends.
  Re-rendered every `lines` chart (cpi_timeline, inr_long, nifty_drawdown, us_yield_curve, oni_band): all lint-clean.

## 4 Nov 2026 (night): El Niño charts on Copernicus ERA5; La Niña line on oni_band

Owner: "this chart with the La Niña label and also updated data ... Use Copernicus data, changes the result".
- Source: OWID mirrors Copernicus only for world surface temperature; its El Niño index is NOAA's ONI, and Copernicus
  Marine's Niño 3.4 series starts in 1993. So `fetch_era5.py` pulls ERA5 monthly SST over the Niño 3.4 box (5°N–5°S,
  170°W–120°W) from the Copernicus CDS, 1950 to September 2026 (October not served yet). `build_era5_nino34.py`:
  cos-latitude mean, anomaly against each month's 1991–2020 mean, centred three-month seasons; gates on box, gaps,
  range and agreement with NOAA (r = 0.965 over 915 seasons). Writes `era5_nino34.csv` and `era5n34_*` facts.
- The result changes: July–September 2026 is +2.57°C on ERA5 (NOAA +2.16°C), 0.60°C ahead of 1997 (+1.97°C); still a
  record for the season. By peak, ERA5 ranks 1997–98 (+2.71°C) and 1982–83 (+2.62°C) as the strongest, 2015–16 fourth
  (+2.56°C, below 2026 so far), so "1997 and 2015, the two strongest on record" would have been false. Comparison years
  are now derived from the data; oni_years names the season's runners-up from the data.
- NOAA has published August–October 2026 at +2.46°C; the NOAA file in the repo still ends at July–September and is now
  used only as the cross-check (refetch with fetch_all.py).
- oni_band: La Niña line at −0.5°C named in the axis column; dek and box in plain words; the zero label now always
  stays and a reference name that crowds it moves just clear (lines template); `y.ticksMax` lets a chart take one
  extra tick (kit `ticks` max parameter).
- Cold read of oni_band and oni_years: CLEAR. Still noted: El Niño and La Niña names in the axis column can read as
  values at first glance; 1997's later peak (+2.71°C in December) is above 2026 so far, which the headline's "by
  September" covers.
- Checked: 114 SVGs lint clean; `make.mjs --test` passes.

## 4 Nov 2026 (later): headline clamping fixed as a class; the explanation box loses its grey slab

Owner: "Headline clamping is a persistent issue" and "How to read grey box looks ugly". The clamping came from
the frame narrowing the headline measure to fix widows (and earlier, balancing): first lines ended at about 80%
of the column. Nothing measured it, so it came back three times (28 Oct, 3 Nov, 4 Nov). This round also brought
back the very headline flagged on 3 Nov.
- Frame: the headline is always set at full column width. It takes the first variant that wraps without a
  one-word last line (two lines before three), and only then accepts a widow. No narrowing code remains.
- Lint `headline` (new): a headline line is clamped when the next line's first word would have fitted on it
  (measured against the column, tagged `data-col` on the headline text); a one-word last line is flagged.
  Fixture `planted_headline.svg` (exactly 2 issues) is in `make.mjs --test`. A fill-share rule (88%) was tried
  first and dropped: it rejected ordinary ragged lines in the narrow 16:9 side column.
- Theme `grammar.no_break`: names that never split across lines (El Niño, La Niña, Nifty 50, S&P 500, state
  names); the frame binds them in all frame text and wraps only at ordinary spaces. "El / Niño" had split
  in the enso_warming headline and the oni deks.
- Copy: more variants for oni_years, oni_band ("No El Niño since 1950 was this strong by September", one
  line on feeds), cpi_timeline (its only headline ended on "months"), enso_warming.
- Explanation box: no fill. A full-width hairline (#DDDDDD) and the note set flush beneath it, semibold lead-in.
  With no notes it takes the notes' own position above the source (it had opened a 56px band on blog_wide).
  It is smaller, so on feeds the method note returns (oni_years shows "2026 values are provisional" again).
- tiles: spare height under a width-bound grid is taken up by cells up to 8% taller than wide, the rest split
  above and below (story had a 46px band either way).
- Checked: 23 charts, 114 SVGs lint clean, every headline measured; `make.mjs --test` passes (11 checks).

## 4 Nov 2026: charts a stranger can read: form tiers, explanation box, plain headlines, cold read

A colleague could not read the El Niño beeswarm (`oni_swarm`), which had passed lint and review: the sideways
spread of the dots looked like data. The owner asked for a logic to choose the right chart, clean headings with
"no clever bullshit", a sub-heading and an explanation box.
- Chart choice: `pipeline/design/chart_forms.json` gives every template a tier (familiar, learnable, specialist)
  and its jobs. Each chart file opens with a choice record (`// Choice: claim ... | job ... | form ... | tier ...`);
  `lint_code` check `choice` verifies the form matches the templates called, the job is one the form does, the
  tier is the strictest of the forms', specialist forms give a "not <form>: reason", and learnable and specialist
  forms pass an explanation box. New fixture `planted_choice.js` (exactly 4 issues) is in `make.mjs --test`.
  `skills/chart-choice` now opens with the procedure (claim, job, shape, familiarity, record, check) and a rule
  for growing the library slowly: two real stories and a failed sketch before a new template.
- El Niño: `oni_years` (columns by year, El Niño and La Niña lines named in the axis column) replaces the
  beeswarm as the lead. `oni_swarm` moved to `sketches/` as the beeswarm example; its output folder is gone.
- Explanation box: `Frame({ explain })`, "**How to read this.** ..." in annotation type on the band fill, with a
  semibold ink lead-in (`**...**` markup, type role label_on_fill). Stacked canvases put it under the chart and
  shorten, then drop, the notes before giving up the box; it needs the plot to keep half the inner height and
  lint's area minimum. Side layouts put it under the dek, ahead of notes. The caption always carries it.
  `explainBox: false` keeps it in the caption (state_tiles falls back to that on square). Written for all 13
  learnable and specialist charts plus oni_band, oni_years, enso_warming, nifty_drawdown and us_yield_curve.
  Result: on every feed, square and story canvas; most 16:9 canvases cannot fit it.
- Plain headlines: theme `grammar.headline` (13 words at most; no opening "At", "Even", "With", "As", "While",
  "Despite"; no `: ; ? ! —`), checked on every variant at render (COPY). Rewritten: asset_returns, cpi_basket,
  cpi_calendar, cpi_groups, cpi_slope, enso_warming, gdp_rank (drops the unchecked "as the rupee fell"),
  growth_income, india_growth, nifty_drawdown, nifty_moves, oni_band, oni_years, sensex_rolling. Checked claims
  unchanged. `skills/chart-copy` has the rules, worked examples and a section on the box.
- Cold read: `pipeline/qa/cold_read.mjs <chart>` copies the feed PNG into an empty folder and has a fresh
  `claude -p` (Read tool only) give the takeaway, what one mark means, what confused it, and a verdict; report
  in `qa/reports/coldread-<chart>.md`. On the swarm it named the sideways spread; on oni_years it found column
  tops looking "stepped".
- That fault was real: callout knockouts painted over the top pixels of thin columns. `columns` now draws
  callouts beneath the bars and above the grid. A scan of all published SVGs finds no other knockout over a bar.
- tiles: spare height too small for the legend is split above and below the grid (story had a 47px band).
- Docs: AGENTS.md (workflow, checks, output layout now per chart folder, tiers, box, headline rule, lead chart),
  new-chart (choice record, explain, output paths), visual-review (cold read; two fault rows).
- Checked: 23 charts, 114 SVGs lint clean (blog_wide state_tiles skipped as before); `make.mjs --test` passes.

## 3 Nov 2026 (night): first climate chart, enso_warming

- Data: `fetch_climate.py` pulls OWID's "Global temperature anomalies by El Niño and La Niña" (World series:
  Copernicus C3S ERA5 monthly surface temperature, °C against 1991–2020, with NOAA's ONI), plus its metadata,
  into the shared manifest. `build_climate.py` (called from `build_tidy.py`) checks contiguous months, a
  plausible range, the Copernicus citation, and OWID's ONI against NOAA CPC's own file in all 920 months;
  builds `era5_enso_annual.csv` (complete years 1951–2025, phase from the December–February ONI) and facts.
- Claim, re-checked under three phase definitions (DJF, prior October–March mean, calendar-year mean): the
  La Niña years 2021 (+0.27°C) and 2022 (+0.30°C) were warmer than 1998 (+0.02°C) and than every El Niño
  year before 2015. 1998 is an El Niño year by the turn-of-year conventions only; by calendar-year mean the
  1997–98 event nets out, which the build states rather than hides.
- Chart `enso_warming` (columns): El Niño years orange, La Niña blue, neutral grey; 1998 and 2021–22 labelled;
  2026 so far (+0.62°C, January to September) in the note. Caveat for readers: 2023 is coloured La Niña
  because its December–February ONI was negative; El Niño arrived mid-year.
- Frame: the space beside a keyed dek word now travels inside the neighbouring plain run, and header text carries
  `xml:space="preserve"`; some SVG viewers dropped whitespace-only tspans and showed "September,2026sits".
  No published SVG has a whitespace-only tspan now.
- oni_swarm, oni_band headline (owner: "clamped?"): "No El Niño since 1950 has been this strong / by September"
  left the first line at about 80% of the column (the widow fix pulled "by" down; no break of those words fills
  two lines). New copy leads with the number and fills both lines: "At +2.16°C by September, this El Niño is
  already stronger than any other since 1950"; same checked claim (rank 1 for the season).
- Checked: 9 formats lint clean; `make.mjs --test` passes.

## 3 Nov 2026 (evening): proportions, axes and the flagged charts, owner review

The owner found the type proportions off, the asset grid "off", stories not using the canvas, cpi_contrib
lacking beauty, an empty cell in cpi_groups, an odd y axis on cpi_timeline, a cramped headline-to-dek gap
and an odd scatter.
- Type scale (`formats.json`): headline and body on the guide's 8-point scale, headline 1.5–1.75x body (the
  guide: headings "noticeably larger ... but not so large that they overpower", progressions "not abrupt").
  Feed and story 48/24/20 to 40/24/20; x_landscape 48/28/24 to 48/32/28; linkedin 32/20/18 to 32/24/20;
  blog 56/28/24 to 56/32/28; web 32/16/14 to 24/16/14. Story tried 56/32/28 first: dense charts lost
  legibility (the asset grid dropped years and names, panels became strips), so it takes the feed scale.
- Frame: headline-to-dek gap `m` to `l`; a headline variant that fits two lines beats a fuller three-line one;
  the widow fix narrows at most 15% (growth_income had been narrowed ~30% and read as clamped).
- Axes (kit `ticks`): y axes stretch up to a full step (`grammar.axis.y_cover` 1), so the data never runs past
  the outer gridline (cpi_timeline's 2014 line poked above 8%); data within `touch` (0.1 step) is left
  touching its gridline; 25/250 steps join 1-2-5 for whole-number labels. Horizontal value axes keep the
  half-step rule (full cover padded the swarm with dead steps). Log axes pad 4% instead of ending on a dot.
  Lint `space` allows air up to `y_cover` of a step between data and an end gridline, as the rule now permits.
- lines: a shaded target band is named inside itself ("RBI's target band"), so the 4% tick returns.
- rank_grid: only the hero is filled; the compare item is an outlined white cell; full names in either
  orientation before short names (portrait now reads as year rows with "S&P 500", "Bank Nifty").
- small_multiples: titles may take two lines (value under name), a grid with an empty cell must beat a full
  one by 20%; cpi_groups is now 4x2 on square, 2x4 on story, on a 30% scale instead of 40%.
- scatter: context points are small filled grey dots (rings read as missing data); named compare points may
  label just above or below; the right gutter no longer reserves room for a $1,000,000 label never drawn.
- stacked_bars, waffle: context areas use `context_fill` #E8E8E8, so the grey stack no longer outweighs the colour.
- tiles: values step down to the on-fill label size before a canvas is skipped.
- Gallery: story previews overlay the profile row and reply bar over the 250px safe zones (toggle at the top),
  so the bands read as what a phone shows there.
- Story canvases: the 250px safe zone now replaces the outer margin on that edge instead of adding to it (about
  50px more canvas at each end); lint checks that nothing enters a safe zone and leaves those edges out of
  the equal-margins test.
- histogram: a word unit on the top tick ("1,250 days") no longer sets the axis column's width; the number
  aligns with the other ticks and the unit runs on into the plot's empty corner (LAYOUT if a bar is there).
- rank_grid (owner: "too noisy"): context entries are plain grey type with no tile, between hairline row
  rules, so gold's filled cells are the only shapes; `short: false` lets a chart try fewer periods before
  abbreviating (asset_returns: 18, 10, 8 years with full names, short names last; X landscape shows 2018–2025
  as "S&P 500", "Bank Nifty" rather than ten years of "S&P", "Bank"). Two-line cells need only 4px side room.
- waffle (owner: wasted space on X landscape): on landscape formats cpi_basket first tries a stacked header with
  a 20x5 strip the full width (Frame `layout: "stack"`, waffle `minFill` 0.85: only shapes spanning 85% of
  the width compete, and they must leave no band above or below); the side column with a square grid is the
  fallback (YouTube keeps it). Stacked formats keep the square grid.
- tiles: when the width holds the grid back, the legend goes under the grid instead of in a corner, so a tall
  canvas has no empty band below the map.
- Fixtures: planted_space, planted_grammar and planted_swarm headlines moved from 48px to 40px (the scale
  changed; size was not one of their planted defects); each still reports exactly its planted count.
- Checked: 22 charts, 196 SVGs lint clean; skips by design: linkedin_landscape and blog_wide state_tiles;
  `make.mjs --test` passes.

## 3 Nov 2026 (later): wasted canvas, owner review

The owner found landscape charts with a dead hole in the header column, a fixed-shape chart floating
away from its header, a source line wrapping early beside the logo, generous margins, and a heavy grid.
- Frame: landscape formats stack the header when it is short (`header.stack_on_wide_max` 0.3); fixed-shape
  charts keep the side column; in side layouts notes follow the dek; the source never wraps to make room
  for the logo (the logo drops to its own line, clear space kept). SVGs carry `data-layout`, which lint reads.
- Theme: outer margin 6% to 4.5% of the short side (lint range 3.5–6.5%; the planted fixtures were rendered at the old 6% and still report exactly their planted defects). Story safe zones 270/340px to
  Meta's 250/250px. Landscape formats' chart-area floor 0.5 for stacked headers.
- Templates: rank grid context cells on the palest grey; scatter keeps its last x label inside the plot;
  waffle picks the biggest grid (labels beside it when they fit), its legend starts at the grid's edge, and
  cpi_basket declares a square shape so the header column widens to meet the grid on wide canvases.
- Gallery: image links carry a render stamp, so a re-render shows without a hard refresh.
- Checked: all charts in all formats lint clean; `make.mjs --test` passes.

## 3 Nov 2026: finance and macro library, agent-agnostic docs

- Data: `fetch_markets.py` (Yahoo Finance indices and prices, FRED yields and rupee, World Bank GDP,
  growth, inflation, income) with provenance in the shared manifest; `build_markets.py` builds 11 tidy
  tables and ~1,700 facts with checks (gaps, granularity, one row per period, independent recomputation).
  Found and guarded: Yahoo coarsening `range=max`, missing gold-futures months, FRED stalling custom agents.
- Kit: `Fmt` (pure formatters: `pct`, `pp`, `bps`, `inr`, `inr_cr`, `int` with Indian grouping, `usd`,
  `intl`, `usd_tn`, `x`, dates), `K.logTicks`, `K.timeTicks`, dense-series rule, U+2010 hyphens.
- Templates: new `columns`, `bars`, `histogram`, `range_bars` (with column form), `rank_grid`, `bump`,
  `scatter`, `big_number`; `lines` gains log y, log x, auto time ticks, shaded periods, area fill.
- Charts: `inr_long`, `india_growth`, `big_growth`, `nifty_moves`, `nifty_drawdown`, `sensex_rolling`,
  `asset_returns`, `gdp_rank`, `growth_income`, `us_yield_curve`, `india_10y`; each with a checked claim.
- Theme: `accent_fill` #2A64A9 for filled cells with white text (contrast), listed in `_deviations`.
- Lint: log axes checked in log space; a bar's own end label is not a gutter label; rank layouts may
  leave one row pitch; air up to half a tick step between data and an end gridline is allowed (it is
  what the axis rule permits). All fixtures keep their exact counts.
- Tooling: `pipeline/make.mjs` (render, lint, contact sheet, review prompt; `--all`, `--test`);
  renderer falls back to bundled Chromium; Observable Plot dropped (unused).
- Docs: `AGENTS.md` is canonical; `CLAUDE.md` and `GEMINI.md` point to it; skills moved to `skills/`
  (linked from `.claude/skills`); new skills `new-chart`, `data-analysis`, `finance-conventions`,
  `visual-review`, `new-template`.
- Checked: 22 charts × 9 formats lint clean (one documented LAYOUT skip); `make.mjs --test` passes.

## Before 3 Nov 2026


- Stack: D3 rendered in headless Chrome (Playwright), Python data layer, Node linter. Chosen after the
  D3-vs-ggplot2 test in `archive/2026-10-27-stack-bakeoff/` (REPORT.md). R is retired; its code there is
  not maintained and expects the pre-theme `shared/tokens.json`.
- Zerodha brand guide applied: `pipeline/design/themes/zerodha.json` is the default theme. The old warm
  editorial look is `editorial.json` (kept for comparison).
- 28 Oct: house style written down (below) and enforced by lint `style`; chart forms are reusable templates
  (`pipeline/render/templates/`) on a shared kit (`pipeline/render/kit.js`); each story was redesigned from
  scratch (report: `briefs/2026-10-28-design-audit.md`). Skills: `.claude/skills/chart-copy`, `chart-stats`, `chart-choice`.
- 28 Oct (brief 3): the house style became a visual grammar in tokens (theme `type` roles and `grammar`: ink,
  space, gaps, mark, axis, devices), used by kit, frame and every template, and checked by lint `grammar` and
  `qa/lint_code.mjs`. Report: end of `briefs/2026-10-28-design-audit.md`.
- 28 Oct (final pass): bridge turns to columns on tall plots, swarms fit their box, states keep a linear axis with
  a checked note, cpi_contrib and state_tiles on templates (`stacked_bars`, `tiles`), lint parallel (~70 s for 98 files).
- 29 Oct (refinement 4): ranked dots on stems from the reference with a shaded band (states), swarms fit the whole box
  before reserving a label lane, smaller swarm dots, name-only end labels spaced off their neighbours; ranked
  dots turn to columns on wide plots, so state_ranked no longer falls back to the swarm.
- Next: TypeScript package, one command that renders + lints, and binding each number in text to a named fact.
