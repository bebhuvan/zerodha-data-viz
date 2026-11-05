# Rendering-stack bake-off: D3 vs R/ggplot2

27 October 2026. Four charts, built twice from the same data, tokens, fonts and frame design, then run
through the same linter. Side-by-side images are in `out/compare/`.

## Verdict

**Use D3 (in TypeScript, rendered in headless Chrome) as the primary stack.** At the finish line R matched it
on static quality, but D3 got there in fewer attempts, gave finer typographic control, and is the only one of
the two that also serves interactive pages and video. R does not earn a second stack: nothing in this test
was easier in R once a shared frame existed.

## Scorecard

| | D3 | R / ggplot2 |
|---|---|---|
| Final quality at Instagram size | Equal; slightly better typography | Equal |
| Renders to a clean chart (4 charts) | 10 | 14 |
| Lines of code (frame + 4 charts) | 426 | 340 |
| Render time, 4 charts, SVG + 2x PNG | 4 s | 23 s |
| Mixed weights in one label ("**1997–98** peak +2.37°C") | Yes | No (ggrepel is plain text) |
| Letter-spacing on the kicker | Yes | No (grid has no tracking) |
| Wrong-but-plausible output that passed silently | 0 | 1 (Kerala greyed out by `scale_fill_stepsn`) |
| Interactive web / video from the same code | Yes | No |

The attempt count is biased **in R's favour**: D3 went first and absorbed the design iteration (the ridgeline
took three tries to find its form), and R then copied a settled design.

## Chart by chart

- **CPI contributions.** D3: two renders (an unquoted font name, a clipped label). R: four, mostly fighting
  ggrepel, which slid end labels onto the bars when it ran out of room inside the panel.
- **El Niño ridgeline.** D3: three renders, all design. R: four. Getting each ridge to sit in front of the
  one above meant 231 stacked ggplot layers (77 years × 3), because a ggplot layer cannot interleave with
  another per group. A crash (wrong spline type), a unit mistake, and labels that lost their second line.
- **State choropleth.** D3: three. It hit the classic polygon winding-order trap (the map drew as a
  hemisphere-sized wedge). R: three, including the worst bug of the test: Kerala, the headline state,
  rendered in the no-data grey. `sf` was smoother to work with than d3-geo.
- **Tile grid.** D3: two. R: three, with the same greyed-out Kerala and white-on-grey text.

## What the test proved about the system (more important than the stack choice)

1. **Geometry linting is necessary and not enough.** The linter (`qa/lint.mjs`) works on any SVG and checks
   text overlap, strike-through by lines, straddling mark edges, bounds, minimum size, WCAG contrast, and
   that every decimal on the chart matches a computed fact. It is tested against a fixture with seven
   planted defects (`qa/fixtures/planted.svg`), all caught. But the Kerala bug was **geometrically perfect
   and semantically wrong**. Only an **encoding assertion** (every mark's colour recomputed independently
   from its data value and the token bins) caught it. Both stacks now carry one, and both are proven to fail
   on a broken scale.
2. **One formatter, owned by the design system.** Madhya Pradesh is −0.25%. R printed −0.2, D3 −0.3. Number
   formatting cannot be left to each library.
3. **Tokens pay off immediately.** The contrast check found the `muted` ink was 4.17:1 (below 4.5:1); one
   token change fixed every chart in both stacks.
4. **Font family names must be quoted** in SVG (`"Source Serif 4"`): a name part starting with a digit
   silently falls back to Times.
5. **Source data needs its own gates.** MOSPI's API pages without a stable sort (rows repeat and vanish
   across pages), returns conflicting duplicate values for Jan–May 2013, and has no combined Housing index
   for Dec 2018–Sep 2019. The fetcher now slices queries to one page, logs conflicts, and the analysis
   drops conflicted months rather than picking a value. Contributions are checked to sum to published
   headline inflation every month (max gap 0.15 pts), and state YoY figures to match their index ratios.

## Caveats

- Observable Plot was installed but never used: every chart here was custom enough to need raw D3. Plot is
  still the right tool for the plain line/bar/scatter majority, which this test did not cover.
- The India boundary file (udit-001/india-maps-data, from DataMeet lineage) has **not** been verified
  against Survey of India. Do that before any map is published.
- The ridgeline is the wrong form for its own headline. "Ahead of 1997 and 2015 at this point" is a direct
  comparison, which overlaid June-to-May lines would show far better. It stayed in as the unusual-form stress test.
- The 2024-base CPI series is not on the MOSPI API yet, so CPI charts stop at December 2025 (2012 base).
- One builder, one run. Treat the attempt counts as indicative.

## Recommended next steps

1. Move the D3 frame, tokens, formatter and encoding assertion into a typed chart-spec package (spec in,
   SVG/PNG out), with Plot for standard forms and D3 modules for custom ones.
2. Promote the linter to a gate in the render command, plus a vision review of the PNG.
3. Verify or replace the India boundaries; add world maps (Natural Earth, India point-of-view).
4. Build connectors for the next sources (FRED, World Bank, OWID, Ember, RBI) with the same snapshot,
   manifest and conflict handling as the MOSPI fetcher.

## Addendum: refinement pass (Zerodha theme)

- A real labelling error got through every check: the El Niño dek printed 1982's value against 2015. Number tracing
  matches numbers to *some* fact; it needs to match them to the *named* fact the sentence claims. Fixed at source;
  binding facts by key is now the top QA gap.
- The state map's original diverging scale split near-zero states into blue and orange, inventing a north-south divide.
  A neutral ±1 point band fixed it. Encoding choices need the same scrutiny as the statistics.
