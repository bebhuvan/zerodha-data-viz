---
name: chart-choice
description: Pick the right chart form for a Zerodha / Markets by Zerodha / Rainmatter chart before writing any chart code. Use whenever a new chart, a new dataset, or a "how should we show this" question comes up in this project, and whenever a draft chart feels busy or the point does not land.
---

# Chart choice

The question is never "what chart can I make with this data". It is "what is the one thing the
reader should take away, and which form gets it into their head fastest". Write that one thing as a
plain sentence first (it becomes the headline; see the `chart-copy` skill). Then pick the form.

## The procedure (every chart, in this order)

1. **Claim.** One plain sentence with a verb, the headline's claim.
2. **Job.** Read it off the claim's verb with the table in Step 1 ("rose" is change, "highest of" is
   ranking, "N% of" is part-to-whole, "highest since" is record). The job names are in
   `pipeline/design/chart_forms.json`.
3. **Data shape.** How many items and periods; does it cross zero; does it span more than two orders of
   magnitude (log scale); how dense is it (a daily series, 33 states).
4. **Familiarity.** Take the most familiar form that makes the claim visible. Tiers, from
   `chart_forms.json`:
   - **familiar** (lines, columns, bars, big number): any newspaper reader reads them. Use freely.
   - **learnable** (slope, small multiples, stacked bars, waffle, ranked dots, histogram, scatter,
     tiles): readable once the chart says what a mark is. They need an explanation box.
   - **specialist** (beeswarm, bridge, bump, calendar, rank grid, range bars): most readers have never
     seen one. Use only when no familiar form makes the point, write down why, and add the box.
   Our readers meet charts in a feed, with no one to ask. A specialist form must earn its place.
5. **Record it.** The chart file's first line is the choice record; `lint_code` checks it against
   `chart_forms.json` (form matches the templates called, job is one the form does, tier is right,
   specialist forms give a reason, learnable and specialist forms pass `explain:`):

   ```js
   // Choice: claim "No El Niño since 1950 has been this strong this early" | job record | form columns | tier familiar
   // Choice: claim "Cheaper food did most of the work" | job decomposition | form bridge | tier specialist | not stacked_bars: two dates, and the reader needs each push, not the path
   ```
6. **Check after rendering.** The seven questions and the cold read (`skills/visual-review`). If a
   fresh reader misreads the marks, change the form before you polish the copy.

## Step 1: name the job

| The sentence says... | Job | First choice in our library | Second choice |
|---|---|---|---|
| X rose / fell / is the highest since... | change over time | `lines` (one hero series, rest context) | `small_multiples` if several series each matter |
| How much each year (growth, flows, annual returns) | amounts over time, often ± | `columns` (hero years in colour) | `lines` when there are hundreds of periods |
| X grew 12x / prices compound over decades | long compounding history | `lines` with `y.scale: "log"`, say "log scale" in the dek | indexed `lines` (rebased to 100) for several series |
| X is N% below its peak; how deep past falls went | drawdown | `lines` with `fill: true` (underwater chart) | `columns` of yearly worst falls |
| A moved from P to Q, and here is why | decomposition of a change | `bridge` | `stacked_bars` over time when the path matters too |
| X is the highest / lowest of all... (≤ 20 items) | ranking | `bars` (names and values, no axis) | `ranked_dots` when distance from a reference is the point |
| X is far ahead of / unlike the rest | position in a distribution | `bars` or `ranked_dots` (up to ~35 named items) | `beeswarm` only when there are too many items to name |
| Most days / most funds fall in this range | shape of a distribution | `histogram` (hero bins = the range) | `beeswarm` when each item matters |
| The longer you hold, the narrower the outcomes | range of outcomes per group | `range_bars` (worst, middle, best) | `beeswarm` per group |
| Which asset led each year; leadership rotates | ranks over periods, few items | `rank_grid` ("periodic table") | `bump` |
| X climbed from 12th to 5th | rank over time, many items | `bump` (hero line, end names) | `slope` for two dates only |
| Two measures for the same items (growth vs income) | relationship | `scatter` (log axis for incomes, sizes) | `ranked_dots` of the ratio when one number suffices |
| Yields by maturity, now vs then | a curve on a non-time axis | `lines` with `x.scale: "log"` and explicit ticks | `small_multiples` for many dates |
| X is N% of the whole | part to whole | `waffle` (2-4 named parts) | a single stacked bar; never a pie with more than 2 slices |
| Between two dates, these swapped places | change in rank or level, many items | `slope` | `ranked_dots` with `from` (dumbbell) |
| Every month of every year, at a glance | long history plus season | `calendar` | `lines` |
| Here, not there | geography | tile grid (`tiles`) | map (`state_map`, not publishable until the boundary is verified) |
| Now vs the range of the past | uncertainty / range | `lines` with `band` (envelope) | `beeswarm` of the same moment across years |
| Inside / outside a target | against a reference | `lines` with `refBand` (RBI 2–6%) | `calendar` binned on the target edges |
| The number today is the story | one number | `big_number` (figure, what it is, change, short history) | the number in the headline over a `lines` chart |

Every form in `pipeline/render/templates/` documents its `spec` at the top of the file, and has a
published example in `pipeline/render/charts/` (the file named in `AGENTS.md`'s template table).

If the sentence needs two jobs ("fell, and here is why"), make two charts or pick the job the
headline names. One chart, one job.

## Step 2: check the form earns its place

A form other than a plain bar or line chart must let the reader get the point **faster**, not just
look different. Test it: show the draft for five seconds and ask "what is this saying?" If the answer
is not the headline, change the form, not the colours.

What won in our own tests (28 Oct 2026, `briefs/2026-10-28-design-audit.md`):

- CPI: "inflation fell from 5.22% to 1.33%, food did it". The **bridge** beat stacked bars and
  contribution lines: one look gives both the size of the fall and who caused it. The stacked bars
  stay as the history view for wide formats.
- El Niño: "strongest on record this early". The **beeswarm** of every year at this season beat
  77 overlaid lines in our own review, then failed with a real reader (4 Nov 2026): a colleague read the
  sideways spread as data. **Columns by year** (`oni_years`) say the same thing in a form everyone
  knows: time runs left to right and 2026 is the tallest. Lesson: test a form on someone who has never
  seen it, not on the people who built it.
- State inflation: "Kerala is rising seven times as fast". **Ranked dots** against an India line
  beat the map: distance from India is the story, and a map shows place, not distance.

## Step 3: when it is not a chart

- One or two numbers: write them in the headline and dek, or use a big-number card. Do not draw a
  two-bar chart.
- A table is better when readers will look up their own row (fund returns, state-wise tax).
- A sentence is better when the data has no shape worth seeing.

## Step 4: when to use small multiples

Use them when each series has its own story and readers will compare shapes, not values at a point
(food vs fuel vs housing inflation). Rules: same scale on every panel (or say loudly that it is not),
each panel's own series in colour over the others in grey, 4 to 9 panels, titles on the panels, no
legend. If one series dwarfs the others, say so in the headline; that is often the point.

## Step 5: form per format

Every chart renders in nine formats. A form that cannot fit throws `LAYOUT:` and is skipped. When a
story needs every format, give the chart a fallback with `firstFit([...])` in kit.js: the first form
that fits is drawn (states: ranked dots on tall canvases, beeswarm on short ones). Never shrink type
to make a form fit.

## Never

- 3D, pies with more than two slices, donuts, radar, gauges, word clouds, dual y-axes (use two panels,
  or rebase both series to 100), area charts of series that do not add up, rainbow scales, candlesticks
  for a general audience (a close-price line says the same thing), stacked areas of more than three series.
- A legend when the lines or bars can be labelled directly.
- More than three highlight colours (lint `style` checks this).
- A diverging scale without a neutral middle, or a sequential scale for data that crosses zero.

## Growing the library: slowly

More forms are not the goal. The FT's Visual Vocabulary lists about 70; its desk makes most charts with
about ten. Every template has to obey the grammar on nine canvases, assert its own encoding, pass lint
and be maintained, and every specialist form is one more way for an agent to pick something clever over
something clear. Spend effort on making the familiar forms excellent (annotations, reading keys,
highlights) before adding forms.

A new template needs **two real stories waiting for it** and **a sketch showing the existing forms
fail them** (in `pipeline/render/sketches/`, rendered to a scratch folder). Candidates likely to pass
that test: a dumbbell or dot plot for before-and-after across many items (more familiar than a slope past
eight items), stacked area for composition over a long run, a table with sparklines for newsletters,
event annotations on `lines` (an extension, not a form), and a choropleth map once the India boundary
is verified. Give each a tier and its jobs in `chart_forms.json`.

## Adding a form to the library

See `skills/new-template/SKILL.md` for the full procedure. In short, a new template in `pipeline/render/templates/` must: take data-agnostic `spec` input; size everything
by `k` and measured text; throw `LAYOUT:` when it cannot fit; call `K.assert` with an independent
check of positions and colours; use the kit's roles, strokes, labels and `K.num`; ship with an example
chart in `pipeline/render/charts/` drawn from real data in `pipeline/data/tidy/`; and get a row in the
table above.
