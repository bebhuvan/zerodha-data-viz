# Story alternatives that lost (28 Oct 2026)

Chart code kept for reference; nothing in the pipeline reads it. Why each lost is in
`briefs/2026-10-28-design-audit.md`. The sketches use templates from `pipeline/render/templates/` and
helpers from `pipeline/render/charts/_*.js`; to re-render one, copy it into `pipeline/render/sketches/`
and run `node render.mjs --dir=sketches --out=<scratch>`.

- `oni_lines.js`: every year since 1950 overlaid (the previous publishable El Niño chart). Lost to the beeswarm.
- `oni_ridgeline.js`: ridgeline of every year. Stylised; peaks read as flat bands. Lost.
- `cpi_lines.js`: contributions as four lines. Lines tangle; lost to the bridge.
- `states_ranked.js`, `states_swarm.js`: the two forms now combined in `charts/state_ranked.js` via `firstFit`.
- `states_dumbbell.js`: Dec 2024 to Dec 2025 per state. A different story (change, not level); dots too close to read.
