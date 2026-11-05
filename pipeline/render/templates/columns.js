// Template: columns over an ordered x (years, months, categories), values above and below zero.
// The workhorse for "how much each year" (GDP growth, flows, annual returns). Hero columns carry the
// series colour; the rest are one grey. Columns are labelled sparingly: the callouts the story needs,
// as label pairs at the column's end, in open space (never on top of other columns).
//
// spec = {
//   bars: [{ x, value, role?: "hero"|"compare"|"context", color? }],   // in display order; x unique
//   x: { ticks?: [{ at: x, label }] },                 // default: x numeric (years) -> K.timeTicks; else every label that fits
//   y: { unit: "%", dp?: 0, sign?: false },            // tick format; unit on the top tick only
//   callouts?: [{ x, value, name, prefer?: [...], optional?: true }],
//   refLines?: [{ y, name }],                          // dashed, named in the axis column
// }
window.Templates = window.Templates || {};
window.Templates.columns = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart columns");
  const bars = spec.bars;
  if (new Set(bars.map((b) => b.x)).size !== bars.length) throw new Error("ENCODING: columns need unique x values");
  const vals = [0, ...bars.map((b) => b.value), ...(spec.refLines || []).map((r) => r.y)];
  const bottom = plot.y + plot.h - fa.size - gap("axis_label");
  const top = plot.y + fa.size * 0.4;
  const tk = K.ticks(d3.min(vals), d3.max(vals), bottom - top, undefined, [K.AX.y_cover, K.AX.y_cover]);
  const y = d3.scaleLinear(tk.domain, [bottom, top]);
  const dp = K.tickDp(tk.ticks, spec.y.dp ?? 0);
  const fmtTick = (t, isTop) => K.num(t, { dp, sign: spec.y.sign }) + (isTop ? spec.y.unit || "" : "");
  const refNames = (spec.refLines || []).map((r) => r.name);
  const gutterL = d3.max([...tk.ticks.map((t) => textWidth(svg, fmtTick(t, t === d3.max(tk.ticks)), fa)), ...refNames.map((n) => textWidth(svg, n, fl))]) + gap("axis_label");
  const x = d3.scaleBand(bars.map((b) => b.x), [plot.x + gutterL, plot.x + plot.w]).paddingInner(1 - mk.column_ratio).paddingOuter(0);
  const thick = Math.min(x.bandwidth(), mk.bar_max);
  if (thick < mk.min_mark) throw new Error(`LAYOUT: ${bars.length} columns leave ${thick.toFixed(1)}px each`);
  const cx = (v) => x(v) + x.bandwidth() / 2;

  K.yGrid(g, y, tk.ticks, { x0: x.range()[0], x1: x.range()[1], fmt: (t) => fmtTick(t, t === d3.max(tk.ticks)), zero: 0, data: d3.extent(bars, (b) => b.value) });
  for (const r of spec.refLines || []) {
    K.refLine(g, x.range()[0], y(r.y), x.range()[1], y(r.y));
    K.text(g, x.range()[0] - gap("axis_label"), y(r.y) + fl.size * 0.35, r.name, fl, fl.color, "end");
  }
  const fillOf = (b) => b.color || (b.role === "hero" ? C.accent : b.role === "compare" ? ink.compare : ink.context);
  // Callout labels sit above the gridlines but beneath the columns: a label's knockout may cut a
  // gridline, never shave the top of a column next to it (a cold read saw "stepped" tops on oni_years).
  const gLab = g.append("g").attr("class", "callouts");
  const drawn = bars.map((b) => ({ b, node: K.bar(g, y(0), y(b.value), cx(b.x), thick, fillOf(b), false).attr("data-x", b.x).node() }));
  // The zero line sits on top of the columns.
  g.append("line").attr("class", "baseline").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));

  // x labels: time ticks for numeric x, else as many category labels as fit.
  let xt = spec.x?.ticks;
  if (!xt) {
    if (bars.every((b) => typeof b.x === "number")) {
      const span = [bars[0].x, bars.at(-1).x];
      xt = K.timeTicks(span[0], span[1], cx(span[1]) - cx(span[0])).filter((t) => bars.some((b) => b.x === t.at));
    } else {
      const w = d3.max(bars, (b) => textWidth(svg, String(b.x), fa)) + sp("m");
      const every = Math.max(1, Math.ceil(w / x.step()));
      xt = bars.filter((_, i) => i % every === 0).map((b) => ({ at: b.x, label: String(b.x) }));
    }
  }
  for (const t of xt) K.text(g, cx(t.at), bottom + gap("axis_label") + fa.size * 0.8, t.label, fa, fa.color, "middle");

  // Callouts at column ends, clear of every column and each other.
  const boxes = drawn.map(({ node }) => { const r = node.getBBox(); return { l: r.x, r: r.x + r.width, t: r.y, b: r.y + r.height }; });
  const taken = [...boxes];
  const bounds = { l: x.range()[0], r: plot.x + plot.w, t: plot.y, b: bottom - sp("s") };
  const zeroLine = [[[x.range()[0], y(0)], [x.range()[1], y(0)]]];
  for (const c of spec.callouts || []) {
    const b = bars.find((d) => d.x === c.x);
    if (!b) throw new Error(`ENCODING: callout for missing column ${c.x}`);
    const ax = cx(b.x), ay = y(b.value), sz = K.labelSize(c.value, c.name);
    const prefer = c.prefer || (b.value >= 0 ? ["n", "ne", "nw", "e", "w"] : ["s", "se", "sw", "e", "w"]);
    const at = Kit.place({ ax, ay, w: sz.w, h: sz.h, bounds, lines: zeroLine, taken: taken.filter((t) => t !== boxes[bars.indexOf(b)]),
      pad: sp("s"), prefer, step: sp("xs"), minD: gap("label_mark"), maxD: plot.h / 2,
      accept: (p) => !Kit.segHits(ax, ay, ...Kit.leaderTo(ax, ay, p.box, gap("leader_clear")), taken.filter((t) => t !== boxes[bars.indexOf(b)])) });
    if (!at) { if (c.optional) continue; throw new Error(`LAYOUT: no clear space for the label "${c.name || c.value}"`); }
    taken.push(at.box);
    K.label(gLab, at.x, at.y, c.value, c.name);
    const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear"));
    K.leader(gLab, [[ax, ay + (b.value >= 0 ? -1 : 1) * gap("leader_clear")], [ex, ey]]);
  }

  // Encoding: every column's ends recomputed with plain arithmetic, and its colour by role.
  const ly = K.lin(...y.domain(), ...y.range());
  const checks = [];
  for (const { b, node } of drawn) {
    const r = node.getBBox(), want = Math.max(mk.min_mark, Math.abs(ly(b.value) - ly(0)));
    checks.push([`${b.x} height`, r.height, want], [`${b.x} centre`, r.x + r.width / 2, cx(b.x)], [`${b.x} colour`, node.getAttribute("fill"), fillOf(b)]);
    if (Math.abs(ly(b.value) - ly(0)) >= mk.min_mark) checks.push([`${b.x} end`, b.value >= 0 ? r.y : r.y + r.height, ly(b.value)]);
  }
  K.assert("column positions", checks, 1.0);
  return { x, y, g, K };
};
