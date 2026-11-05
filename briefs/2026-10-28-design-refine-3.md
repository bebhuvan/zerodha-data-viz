# Brief 3: fix list, then a visual grammar and more beauty

28 Oct 2026. Session 2 (`briefs/2026-10-28-design-overhaul-2.md`) finished and wrote
`briefs/2026-10-28-design-audit.md`. Read both earlier briefs and that report first; every constraint in them
still holds (brand guide binding, no sub-agents, all four checks in CLAUDE.md pass, numbers traced by key,
generalise fixes, evidence on the rendered PNG). The skills `chart-copy`, `chart-stats`, `chart-choice` in
`.claude/skills/` apply to everything you touch.

The owner (Bhuvanesh) checks in from his phone. Send him before/after images as you go. Log progress in a new
section at the end of the audit file as you work, so a crash loses nothing.

The owner's reaction to session 2: the new forms are right, the craft is not there yet. The checker passing does
not mean a chart is finished. These were found by looking at the PNGs.

## Part 1: fix list (each one fixed in the system, not by nudging one image)

**cpi_bridge**
- Housing (+0.01) draws an invisible bar, so the row reads as empty. Give tiny steps a visible minimum mark (a short
  tick or hairline at the step) in the bridge template.
- The bars are heavy: two near-black totals and a big blue slab. Lighten the totals (or draw them as outlined or
  lighter grey bars) so food and personal care carry the colour and the weight.
- Portrait: a large empty area to the right below the food bar. X landscape: a big gap in the left column between
  the dek and the source. Headline runs to 4 lines in landscape.

**oni_swarm**
- The dots are big grey discs and read as a bubble cluster, the opposite of thin and precise. Smaller dots with a
  hairline outline or lighter fill; let the shape of the distribution do the work.
- 1997 and 2015 labels are cramped together with near-invisible leader stubs. Label placement must give each label
  its own clear lane with a visible leader, or label just one of them and fold the other into the dek.

**state_ranked**
- The note says "Dashed outline: no comparable figure" but this chart has no dashed outlines. Copy left over from the
  map. Make notes chart-specific; add a check that a note naming a visual device (dashed, outline, shaded, hatched)
  only appears when the chart draws it.
- "India 1.33%" at the bottom sits on the note text. Fix spacing in the template and make the lint catch it (it
  should have been an overlap or band failure).
- The right-hand value column repeats the dots. Either drop it and label only the ends and the highlighted rows, or
  make it the main read and lighten the dots. Pick one.
- The axis labels only 0 and 5% while the data runs to 9.5%. Ticks must cover the data range.

**Library sheets** (`briefs/2026-10-28-design-audit-img/library_1.png`, `library_2.png`)
- Slope: unlabelled left-side values (14.6, 8.6, 6.5 ...) mean nothing to the reader; the right-side label stack is
  cramped and tiny; a wide empty band between the two columns. Label both ends of every line you keep, or grey and
  unlabel the rest consistently.
- Small multiples: grey background lines appear to shoot out of the top of several panels near 2025 (personal care's
  spike drawn into every panel without clipping, or the y-domain not shared). Clip or share scales deliberately.
  Lines are jittery at this size; consider a lighter stroke. The empty ninth cell needs a purpose (legend or note) or
  a different grid.
- Calendar: 4-6% (inside the RBI band) is drawn in warning orange. Colour must follow the meaning: within the band
  should not look like a breach.

## Part 2: a visual grammar, and more beauty

Session 2 wrote house style rules. Turn them into a real visual grammar: a small, strict system that makes every
chart look like it came from one hand, and look good.

Define and implement, in `pipeline/design/` and the kit, with every value in tokens:

- **Type roles.** Headline, dek, chart label (strong and regular), axis, value label, annotation, note, source.
  Within the brand's two sizes, ±4px step and two weights, decide which role gets which size, weight and colour,
  and never deviate. Tabular figures for every number in a column or on an axis.
- **Ink hierarchy.** Exactly how dark each kind of mark is: highlight series, context series, totals, gridlines,
  axis lines, leaders, reference lines. Most marks should be light. One thing per chart is loud.
- **Highlight grammar.** One way to say "this is the point": the series colour plus a strong label, everything else
  in the same quiet grey. Same treatment in every template.
- **Annotation grammar.** One leader style, one label anatomy (value strong, name regular below or beside), one
  rule for where annotations sit, one way to mark a reference line (India average, El Niño threshold, RBI target).
- **Spacing scale.** A small set of spacing steps (multiples of k) used for every gap: header to chart, chart to
  note, label to mark, row gaps. No ad hoc pixel numbers left in templates.
- **Mark specs.** Line weights (highlight vs context), dot sizes, bar thickness relative to gaps, corner treatment,
  minimum visible mark size.
- **Grid and axes.** When gridlines appear, how light, tick density per format, axis labels only where needed,
  direct labels preferred over legends.
- **Composition.** Where the chart sits in the canvas, alignment of every element to a common left edge, and how
  side layouts balance the header column against the chart (no big empty gaps in the column).

Then push for beauty: go through every chart in two formats (instagram_portrait and x_landscape) and ask what
an FT or NYT graphics editor would change. Lighter, more precise, more air where it helps, tighter where it
doesn't. Typographic finesse: line height, number alignment, label rhythm. Remove anything that does not help the
reader. Keep everything within the Zerodha guide; no gimmicks.

Add lint checks for whatever in the grammar can be checked (spacing steps, ink levels, tick range covering data,
note devices present). Add planted defects that prove each fires.

## Finish with

Append to the audit file:
- the fix list with before and after for each item;
- the visual grammar, as a short spec with the token names;
- before and after for every lead chart in both formats;
- what is still weak.

Then update CLAUDE.md with the grammar's rules, in brief. All checks must pass.
