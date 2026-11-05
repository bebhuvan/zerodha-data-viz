// Template: bump chart, ranks over time. For "climbed from 12th to 5th" stories: economies by size,
// companies by market value, states by income. Rank 1 is at the top. The hero line carries the
// series colour with a dot at every period; compare lines mid grey; the rest light context. Names sit
// at both ends, beside their rank (start names on the left, end names on the right), each pair
// "rank name" in the label role, the hero in the strong role.
//
// spec = {
//   periods: [numbers],                              // e.g. years, ascending
//   items: [{ id, name, role?: "hero"|"compare"|"context", color?, ranks: { [period]: rank } }],
//   top: 10,                                         // ranks shown; lines leave the chart below it
// }
window.Templates = window.Templates || {};
window.Templates.bump = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart bump");
  const P = spec.periods, N = spec.top;
  const first = P[0], last = P.at(-1);
  const fontOf = (it) => (it.role === "hero" ? fs : fl);
  const startOf = (it) => it.ranks[first], endOf = (it) => it.ranks[last];
  const startItems = spec.items.filter((it) => startOf(it) && startOf(it) <= N), endItems = spec.items.filter((it) => endOf(it) && endOf(it) <= N);
  const lab = (it, r) => `${r}  ${it.name}`;
  const leftW = d3.max(startItems, (it) => textWidth(svg, lab(it, startOf(it)), fontOf(it))) || 0;
  const rightW = d3.max(endItems, (it) => textWidth(svg, lab(it, endOf(it)), fontOf(it))) || 0;
  const bottom = plot.y + plot.h - fa.size - gap("axis_label");
  const y = d3.scalePoint(d3.range(1, N + 1), [plot.y + fs.size * 0.6, bottom - sp("s")]);
  if (y.step() < fs.size * 1.15) throw new Error(`LAYOUT: ${N} ranks leave ${y.step().toFixed(0)}px each`);
  svg.attr("data-row-pitch", y.step().toFixed(1));  // lint 'space': a rank row is a slot, not an empty band
  const x = d3.scaleLinear([first, last], [plot.x + leftW + gap("label_mark") * 2, plot.x + plot.w - rightW - gap("label_mark") * 2]);
  if (x.range()[1] - x.range()[0] < plot.w * 0.4) throw new Error("LAYOUT: end names leave too little width for the lines");

  // Faint guide lines at each rank, so a reader can follow a row across.
  for (let r = 1; r <= N; r++) g.append("line").attr("class", "grid").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("y1", y(r)).attr("y2", y(r))
    .attr("stroke", ink.grid).attr("stroke-width", K.sw("grid"));
  // Years along the bottom.
  for (const t of K.timeTicks(first, last, x.range()[1] - x.range()[0])) K.text(g, x(t.at), bottom + gap("axis_label") + fa.size * 0.8, t.label, fa, fa.color, "middle");

  const order = { context: 0, compare: 1, hero: 2 };
  const colorOf = (it) => it.color || (it.role === "hero" ? C.accent : it.role === "compare" ? ink.compare : ink.context);
  // Segments: consecutive periods both inside the top N (a line leaving the chart is cut, not squashed).
  const drawn = [];
  for (const it of [...spec.items].sort((a, b) => order[a.role || "context"] - order[b.role || "context"])) {
    const pts = P.map((p) => ({ p, r: it.ranks[p] })).map((d) => ({ x: x(d.p), y: d.r && d.r <= N ? y(d.r) : null }));
    const line = d3.line().defined((d) => d.y != null).x((d) => d.x).y((d) => d.y).curve(d3.curveBumpX);  // flat at each period, S-bends between: no overshoot
    const node = K.series(g, pts, line, it.role || "context", colorOf(it)).attr("data-id", it.id).node();
    drawn.push({ it, node });
    if (it.role === "hero") for (const d of pts) if (d.y != null) K.dot(g, d.x, d.y, colorOf(it), mk.dot_small);
  }
  // End labels, in rank order so they never collide (one rank per row).
  for (const it of startItems) { const f = fontOf(it); K.text(g, x(first) - gap("label_mark"), y(startOf(it)) + f.size * 0.35, lab(it, startOf(it)), f, it.role === "hero" ? C.ink : f.color, "end"); }
  for (const it of endItems) { const f = fontOf(it); K.text(g, x(last) + gap("label_mark"), y(endOf(it)) + f.size * 0.35, lab(it, endOf(it)), f, it.role === "hero" ? C.ink : f.color, "start"); }

  // Encoding: every item's drawn path passes through its first and last in-chart ranks.
  const ly = (r) => y.range()[0] + (r - 1) * y.step();
  const checks = [];
  for (const { it, node } of drawn) {
    const inN = P.filter((p) => it.ranks[p] && it.ranks[p] <= N);
    if (!inN.length) continue;
    const b = node.getBBox(), ys = inN.map((p) => ly(it.ranks[p]));
    checks.push([`${it.id} top`, b.y, Math.min(...ys)], [`${it.id} bottom`, b.y + b.height, Math.max(...ys)], [`${it.id} colour`, node.getAttribute("stroke"), colorOf(it)]);
  }
  K.assert("bump ranks", checks, 1.5);
  return { x, y, g, K };
};
