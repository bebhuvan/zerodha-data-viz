---
name: new-template
description: How to add a new chart form (template) to the Zerodha chart library in pipeline/render/templates/ so it obeys the visual grammar, adapts to all nine canvases, checks its own encoding and passes lint. Use when no existing template fits a story, when extending a template's spec, or when reviewing a template change.
---

# Adding a chart form

Templates are the library. Charts are short because templates carry the craft. A template is a
function `Templates.<name> = function (F, spec)` in `pipeline/render/templates/<name>.js`, loaded
automatically by the renderer.

## Before writing code

1. Name the job in `chart-choice`'s table and show that no existing form does it, or does it worse in
   a way you can state. Extending a template (a new `spec` option) beats a new template.
2. Sketch the form with real data in `pipeline/render/sketches/` and render it to your scratchpad:
   `node pipeline/render/render.mjs --dir=sketches --out=<scratchpad> --format=all <sketch>`.

## The contract (every template)

- **Spec documented at the top** of the file: every field, its type, its default, with an example.
- **Data-agnostic**: no dataset names, no copy, no colours chosen by name. Roles (`hero`, `compare`,
  `context`) pick inks; the caller passes the hero's series colour.
- **Grammar only from the kit**: `const K = Kit(F)`; spacing `K.sp("m")` / `K.gap("label_mark")`; marks
  `K.mk.*`; inks `K.ink.*`; strokes `K.sw(role)`; text roles `K.fa / fl / fs / fv / fn`; numbers
  `K.num` / `K.fmt`; ticks `K.ticks` / `K.logTicks` / `K.timeTicks`; gridlines `K.yGrid` / `K.xGrid`
  (pass `data` so lint can check tick coverage); labels `K.label`, `K.textOver`, `K.annotate`,
  `Kit.place`, `K.lane`; leaders `K.leader`. `node pipeline/qa/lint_code.mjs` rejects `N * k` and hex
  literals.
- **Measure, then place**: gutters and columns from `textWidth` of the actual labels; no fixed widths.
- **Fit or refuse**: when the form cannot be legible on the canvas, `throw new Error("LAYOUT: why")`.
  Better still, adapt first (turn horizontal rows into columns past `row_max`, step names down to short
  forms, try the other orientation) and refuse only when every adaptation fails.
- **Labels never ambiguous**: a label touches its mark or has a leader of at least `leader_min`; text on
  the plot gets a knockout; nothing straddles a fill edge.
- **Self-check**: end with `K.assert("what", [[id, got, want], ...])` recomputing positions and colours
  from the data with plain arithmetic (`K.lin`), not the d3 scale that drew them.
- **Lint metadata where it applies**: `data-axis` via the grid helpers, `data-device` on shaded or dashed
  marks the copy may name, `data-ramp` on binned colour ramps, `data-row-pitch` on rank layouts,
  `data-fixed-aspect` for maps and grids.

## Finishing

1. A published example chart in `pipeline/render/charts/` on real data, with a checked claim.
2. `node pipeline/make.mjs <example>`: clean in every format that renders; `LAYOUT:` skips justified.
3. `visual-review` on the contact sheet.
4. A row in `chart-choice`'s table and in `AGENTS.md`'s template list.
5. If you found a fault class while building it, fix it in the kit and add it to `visual-review`'s table.
6. `node pipeline/make.mjs --test` passes.
