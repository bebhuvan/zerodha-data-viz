# Brief: design overhaul, platform sizes, and the skills library

Written 28 Oct 2026 by the previous session for a fresh Claude Code session. You have full permissions.
Work through this file top to bottom. The owner (Bhuvanesh, Zerodha) checks in from his phone, so
send him before/after images as you go and keep going unless a decision is genuinely his.

## Read first (in this order)

1. `CLAUDE.md` (project rules, brand rules, the checks that must keep passing, lessons learnt) and `README.md` (folder map, run commands).
2. The brand guide: `pipeline/design/brand/zerodha-brand-guidelines.pdf`. Read every page. The theme that encodes it is
   `pipeline/design/themes/zerodha.json`; its `_deviations` list every place we departed from the guide and why.
3. The current outputs: open `output/zerodha/index.html` and look at every PNG in `output/zerodha/*/`.
   5 charts x 9 formats, 38 images (state_tiles only fits instagram_portrait and blog).
4. The code: `pipeline/design/formats.json` (sizes), `pipeline/render/tokens.mjs`, `pipeline/render/frame.js`
   (header, footer, layout, label helpers), `pipeline/render/charts/*.js`, `pipeline/qa/lint.mjs`.
5. `archive/2026-10-27-stack-bakeoff/REPORT.md` for why D3 won. Do not reopen the stack question.

## What exists and what the owner thinks of it

The system works: data in, brand-compliant charts out in nine sizes, linted for overlap, bounds, contrast,
brand rules and number tracing. The owner's verdict is that it is correct but not yet beautiful. His recent
complaints, each fixed once, show the pattern: wasted space in the right gutter, a logo that was too big, a
landscape layout where the chart was too small and the headline too big, maps that render small, a tile grid
that looked odd, squiggly lines. Expect more of the same class. Your job is to find them all at once rather
than one per complaint.

The bar: FT, NYT, The Economist, Bloomberg, The Pudding. Editorial, typography-first, restrained, every chart
labelled, nothing overlapping. Inside the Zerodha brand, but with our own take: the brand fixes fonts,
colours and logo, not composition, rhythm or chart craft.

## Workstream 1: platform size audit (do this first; everything else depends on it)

For every format in `formats.json` and any platform we are missing (Threads, WhatsApp, Substack header/inline,
Instagram carousel, LinkedIn document/carousel posts, YouTube community posts, X single image vs multi-image),
establish the correct upload size and aspect ratio, and how the platform crops or displays it in feed on a phone
and on desktop.

- Prefer the platform's own help pages. Record every source with URL and date in
  `pipeline/design/platform-sizes.md`, marked official or third-party. Note any change since 2025
  (Instagram's grid moved to 3:4 previews; check whether that changes the feed post size we should use).
- YouTube community posts: our 1080x1080 is from third-party guides only, and the owner says the real size
  differs. Resolve this.
- Note what each platform crops in feed/grid previews, and add safe zones in `formats.json` where needed.
- Update `formats.json`, the README table and `used_for`. Add formats only if a platform genuinely needs a
  different shape; reuse one format across platforms that share a shape.

## Workstream 2: design overhaul (the main job)

Audit every chart in every format, then fix the system (frame, tokens, formats), not individual images. Write the
audit to `briefs/2026-10-28-design-audit.md`: one row per problem, with chart, format, what is wrong, and the
system-level fix.

Look specifically at:

- **Use of space.** Measure, don't eyeball. For every output compute the share of the canvas the plot occupies,
  empty bands wider than ~4% of the canvas, and gutters that hold a single label. Targets to start from (adjust with
  reasons): plot at least 55% of canvas area in stacked formats and 60% of width in side formats; no empty vertical band
  wider than one line of body text except deliberate margins; outer margins equal on all sides, about 5-7% of the short
  side. Add these as a lint check (`space`) with a planted defect in `pipeline/qa/fixtures/` that proves it fires.
- **Proportions per format.** Stacked formats: header (topper, headline, dek) should take no more than about a third of the
  height; headline at most 3 lines, dek at most 3 lines (shorten the copy rather than shrink the type). Side formats:
  header column 28-32% of width, headline at most 4 lines. Check that maps and tile grids scale to the space they are
  given (the maps currently render small in square and web).
- **Headline and dek styling.** Hierarchy, line height, letter spacing (Inter at display sizes wants slightly negative
  tracking), the gap between headline and dek, dek colour, the topper rule's size and position, and how the coloured dek
  underlines read. Stay within the brand: two core sizes on the 8px scale, a ±4px small step, weights 600 and 400, approved
  text colours, no all caps. If you believe a brand rule should bend, list it in `_deviations` with the reason and flag it
  to the owner. Don't bend it silently.
- **Chart craft.** Axis and gridline weight, tick density, label typography, annotation and leader style, end labels,
  legend placement, line weights, colour use, and the footer (source, notes, logo at 20k height with 2x clear space).
- **Elegance.** Once everything is correct, the remaining question is whether a designer at the FT would ship it.
  Be specific about what would make each chart sing, and do it.

Process: render, measure, look at every PNG yourself, fix in the system, re-render all, re-lint, repeat. Make contact
sheets (before/after) in your session scratchpad, never in the project. Send the owner before/after images of the
biggest changes as you go.

## Workstream 3: skills

Create project skills in `.claude/skills/<name>/SKILL.md` (with reference files where useful). Each must be concrete
enough that a future agent following it would not make the mistake. Write them in plain Indian English.

1. **chart-copy**: headlines, deks, notes, source lines and alt text. Rules: the headline states the finding in plain
   words a reader with no finance or stats background understands on first read. No clever, abstract or punning
   headlines. A number or concrete comparison where possible. The dek says what is measured, where, when and in what
   unit. Notes give method and caveats in one or two sentences. Source names the publisher and dataset. Include
   good/bad pairs drawn from Indian finance and economy topics, length limits per format, and a self-check list. Then
   apply it: rewrite the copy of the five existing charts if it falls short.
2. **chart-stats**: choosing and computing the right statistic, and avoiding statistical disasters. Cover at least:
   base effects and YoY vs MoM; index ratios vs averaging rates; contributions and weights; real vs nominal; per-capita
   and per-unit normalisation; CAGR vs average growth; log vs linear scales; seasonality; revisions and provisional data;
   survivorship and look-ahead bias; cherry-picked start dates; small samples; multiple comparisons and p-hacking;
   correlation vs causation; truncated axes; percentage of percentage; rounding. For each: the trap, an Indian data example,
   the correct method, and a check the pipeline can run. Link it to `build_tidy.py`-style validations.
3. **chart-choice**: which chart for which job (change over time, ranking, part-to-whole, distribution, relationship,
   geography, flow, uncertainty), when it is not a chart at all, and when to use small multiples. Map each job to forms
   in the library below.
4. **Chart library**: extend `pipeline/render/charts/` beyond the current five with reusable, data-agnostic forms with
   more creative styling, e.g. slope, dumbbell, bump, beeswarm, waffle, small-multiple lines, annotated timeline,
   range/uncertainty band, connected scatter, calendar heatmap, marimekko, hex/tile cartogram, sankey/flow. Each form gets:
   format handling (including `LAYOUT:` when it cannot fit), an independent encoding assertion, an example rendered from
   real data already in `pipeline/data/` or a fetched public source (never invented numbers), and a line in chart-choice.
   Quality over count: six excellent forms beat fifteen mediocre ones.

## Constraints (non-negotiable)

- Do not use sub-agents (Agent tool, forks, workflows). If you need parallel work, write another brief.
- Never print secrets or API keys.
- `output/` holds final charts only. Folder rules in CLAUDE.md apply.
- These must pass at the end of every round:
  ```
  node pipeline/qa/lint.mjs output/zerodha/*/*.svg                                  # all clean
  node pipeline/qa/lint.mjs --theme=editorial pipeline/qa/fixtures/planted.svg      # exactly 7 issues (update the count if you add planted defects, and say so)
  node pipeline/qa/lint.mjs archive/2026-10-27-stack-bakeoff/outputs/editorial/cpi_contrib.svg  # must fail brand
  ```
- Evidence over assurance: claim nothing you haven't checked on the rendered PNG. A passing lint is not a good chart.
- Generalise: every fix goes into frame/tokens/formats/helpers so all charts and formats benefit.
- Numbers on charts must trace to `facts.json` and be looked up by explicit key.
- The India map boundary is not verified against Survey of India. Don't mark map outputs publishable.
- Keep `CLAUDE.md`, `README.md` and the theme's `_deviations` current as you go.

## Finish with

A short report at the end of `briefs/2026-10-28-design-audit.md`: what changed, before/after for each chart in two
formats, the platform-size table with sources, the skills created, the new chart forms, what is still weak, and any
decision that needs the owner.
