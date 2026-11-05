// Template: horizontal bars, one row per item, ranked. For "who is highest" comparisons across
// countries, sectors, funds, states. Every row carries its name (left, right-aligned against the
// plot) and its value (at the bar's end), so there is no axis: the numbers are the scale. Hero rows
// take the series colour and a semibold value; compare rows mid grey; the rest one light grey.
// A zero line is drawn when values cross zero or a bar starts there.
//
// spec = {
//   rows: [{ id, name, value, role?: "hero"|"compare"|"context", color?, valueLabel? }],
//   sort?: "desc" | "asc" | "none",       // default desc
//   fmt: (v) => string,                   // value labels (use Fmt.fmt); valueLabel overrides per row
//   refLine?: { value, name },            // e.g. the median or India; dashed, named at the top
// }
// Throws LAYOUT: when rows would be thinner than one label line plus air (use a dot plot or fewer rows).
window.Templates = window.Templates || {};
window.Templates.bars = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart bars");
  const rows = [...spec.rows];
  if ((spec.sort || "desc") === "desc") rows.sort((a, b) => b.value - a.value);
  if (spec.sort === "asc") rows.sort((a, b) => a.value - b.value);
  const fontOf = (r) => (r.role === "hero" ? fs : fl);
  const label = (r) => r.valueLabel ?? spec.fmt(r.value);
  const nameW = d3.max(rows, (r) => textWidth(svg, r.name, fontOf(r)));
  const valW = d3.max(rows, (r) => textWidth(svg, label(r), fontOf(r)));
  const refRow = spec.refLine ? fl.size + sp("s") : 0;
  const top = plot.y + refRow;
  // Bars sit flush with the top and bottom of the plot: pitch p with the first bar's top at `top`
  // and the last bar's bottom at the plot's foot, so no half-row of air opens above the first bar.
  const H = plot.y + plot.h - top, n = rows.length;
  let rowH = H / (n - 1 + mk.bar_ratio);
  let thick = rowH * mk.bar_ratio;
  if (thick > mk.bar_max) { thick = mk.bar_max; rowH = n > 1 ? (H - thick) / (n - 1) : H; }
  // Rows too thin to read: hand back to the caller.
  if (rowH < fs.size * 1.5) throw new Error(`LAYOUT: ${rows.length} rows leave ${rowH.toFixed(0)}px each`);
  thick = Math.max(mk.min_mark, thick);
  const lo = Math.min(0, d3.min(rows, (r) => r.value)), hi = Math.max(0, d3.max(rows, (r) => r.value));
  // Negative bars carry their value on the left, so the plot leaves room on both sides.
  const left = plot.x + nameW + gap("row_label") + (lo < 0 ? valW + gap("label_mark") : 0);
  const right = plot.x + plot.w - (hi > 0 ? valW + gap("label_mark") : 0);
  if (right - left < plot.w * 0.35) throw new Error("LAYOUT: names and values leave too little room for the bars");
  const x = d3.scaleLinear([lo, hi], [left, right]);
  const yOf = (i) => top + thick / 2 + rowH * i;
  const fillOf = (r) => r.color || (r.role === "hero" ? C.accent : r.role === "compare" ? ink.compare : ink.context);

  if (spec.refLine) {
    const rx = x(spec.refLine.value);
    K.refLine(g, rx, top, rx, plot.y + plot.h);
    const w = textWidth(svg, spec.refLine.name, fl);
    K.text(g, Math.min(right - w / 2, Math.max(left + w / 2, rx)), plot.y + fl.size * 0.8, spec.refLine.name, fl, fl.color, "middle");
  }
  const drawn = rows.map((r, i) => {
    const cy = yOf(i), f = fontOf(r);
    const node = K.bar(g, x(0), x(r.value), cy, thick, fillOf(r), true).attr("data-id", r.id).node();
    K.text(g, plot.x + nameW, cy + f.size * 0.35, r.name, f, r.role === "hero" ? C.ink : f.color, "end");
    const end = x(r.value) + (r.value >= 0 ? 1 : -1) * gap("label_mark");
    K.text(g, end, cy + f.size * 0.35, label(r), f, r.role === "hero" ? C.ink : f.color, r.value >= 0 ? "start" : "end");
    return { r, node, cy };
  });
  if (lo < 0) g.append("line").attr("class", "baseline").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top).attr("y2", plot.y + plot.h)
    .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));

  const lx = K.lin(lo, hi, left, right);
  const checks = drawn.flatMap(({ r, node, cy }) => {
    const b = node.getBBox(), len = Math.abs(lx(r.value) - lx(0));
    return [[`${r.id} length`, b.width, Math.max(mk.min_mark, len)], [`${r.id} row`, b.y + b.height / 2, cy], [`${r.id} colour`, node.getAttribute("fill"), fillOf(r)]];
  });
  K.assert("bar lengths", checks, 1.0);
  return { x, g, K };
};
