# Brief 2: pick up the design overhaul, and be ambitious

28 Oct 2026. The session that ran `briefs/2026-10-28-design-overhaul.md` crashed at about 07:48 and its
transcript is lost. You are its replacement. Read that brief in full first. It still holds, including every
constraint. This file says what is already done, what is left, and raises the ambition.

The owner (Bhuvanesh, Zerodha) checks in from his phone. Send him before/after images of every big change as you go.
Keep going without asking unless a decision is genuinely his. If you sense your context filling up, write your
progress into `briefs/2026-10-28-design-audit.md` as you go, so a crash never loses work again.

## Already done (verify, don't redo)

- Platform size audit: `pipeline/design/platform-sizes.md`, with sources. `youtube_community` was dropped (YouTube says
  1:1, so it reuses `square`); `blog_wide` 1456x1048 added; a `crop` lint check for Instagram's 3:4 grid; X multi-image
  posts are avoided.
- Equal outer margins, landscape side column at 0.3 width with a smaller headline, right gutter removed from oni_lines,
  logo at 20k.
- A `space` metric in `pipeline/qa/lint.mjs` (chart_area, chart_w, header, margins, band) with thresholds in the theme's
  `rules.space`. All 40 outputs lint clean.
- Owner feedback saved in memory (`headline-no-clamping`): headlines run the full column width; fix only a lone last
  word by the smallest narrowing; keep negative tracking mild (−0.015em headline, −0.006em body).

## Left from brief 1

1. `pipeline/qa/fixtures/planted_space.svg` does not trigger the `space` check yet. Make it fire, and say what the
   planted-defect count is now.
2. The written audit `briefs/2026-10-28-design-audit.md` (not started).
3. The skills: chart-copy, chart-stats, chart-choice (not started). See brief 1 for what each must cover. chart-copy
   in one line: headlines a reader with no finance or stats background gets on first read; no clever, abstract or
   punning lines; same standard for the dek, notes and source line.
4. The chart library (not started).

## The new ask: rethink, don't just polish

Brief 1 was mostly about fixing what we have. The owner now wants more than incremental tweaks. For each of the
current stories, ask from scratch: what is the best way to show this data? Is there a new form, a new template, a
new composition that makes the point land harder and look better?

The stories, and the question for each:

- **CPI contributions** (`cpi_contrib`): food is pulling inflation down, and personal care (gold and silver) is holding
  it up. Stacked bars are the obvious answer. Could the story be told better: a diverging layout around zero, a
  two-panel "then vs now", a waterfall of the latest month, small multiples per component, an annotated line with
  the components as a strip below?
- **El Niño** (`oni_lines`, `oni_ridgeline`): 2026 is the strongest on record this early in the year. The spaghetti
  of grey lines is accurate but busy. Could a ranked strip of every year at this month, a percentile band with 2026
  on top, or a beeswarm of all years make the "on record" claim instantly visible?
- **State inflation** (`state_map`, `state_tiles`): Kerala is rising seven times as fast as India. The map is small and
  says little about magnitude. Could a ranked dot plot against the India line, a tile cartogram with values, or a
  map plus ranked strip do better?

For each story, sketch two or three serious alternatives, render them, and compare against the current version side
by side in your scratchpad. Choose the best on clarity first, then elegance. Promote the winners into the library as
reusable, data-agnostic templates: any future dataset with the same shape should drop straight in. Keep the old
version only if it still wins somewhere, and say where.

Then build out the library beyond these stories with forms Zerodha's content will need often: markets, the economy,
personal finance (for example slope, dumbbell, bump, beeswarm, waffle, small-multiple lines, ranked dot plot,
annotated timeline, range or uncertainty band, calendar heatmap). Each one should be well made rather than numerous.

### What "ambitious" means here

- **Opinionated design.** A clear house style someone could recognise without the logo: a consistent annotation
  voice, a consistent way of highlighting the one thing that matters, consistent use of the series colours, a
  grid and rhythm that feel deliberate. Write the style down as rules in CLAUDE.md and enforce what can be enforced
  in the linter.
- **Elegance.** Fewer marks doing more work. Thin, precise lines. Generous but purposeful white space. Typography that
  carries the hierarchy. Annotation written into the chart rather than bolted on.
- **New ways to show data**, when they are clearer than the default. A novel form must earn its place: a reader
  should get the point faster than with a bar or line chart, not slower.

### What it must not be

- **Gimmicky.** No 3D, no gradients, no decorative illustration, no chart junk, no unusual form for novelty's sake.
- **Off brand.** The Zerodha guide (`pipeline/design/brand/zerodha-brand-guidelines.pdf`) is binding: white ground,
  flat colours, Inter only, two core sizes plus the ±4px step, weights 600 and 400, approved text colours, no all caps,
  the official logo with 2x clear space. Ambition goes into composition, form and craft, not into breaking these. If a
  rule truly blocks a better chart, list it in the theme's `_deviations` with the reason and flag it to the owner.
  Don't bend it silently.
- **Misleading.** Every new form gets an independent encoding assertion. Numbers trace to `facts.json` by explicit
  key. No invented data.

## Finish with

The report at the end of `briefs/2026-10-28-design-audit.md`:
- for each story, the alternatives tried, with images, and which one won and why;
- the house style rules;
- the new templates;
- the skills;
- what is still weak;
- decisions that need the owner.

All three checks in CLAUDE.md must pass at the end.
