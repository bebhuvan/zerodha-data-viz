// Template: range bars, one row per group, from the worst to the best outcome, with the middle
// marked. For "how wide is the spread of outcomes" stories: rolling returns by holding period, a
// fund category's best and worst funds, forecasts' range. The hero row takes the series colour; the
// rest one grey. Ends are labelled with their values; the middle is a short dark tick.
// A value axis runs along the top with vertical hairlines; zero is the dark baseline.
//
// spec = {
//   rows: [{ id, name, lo, hi, mid, role?: "hero"|"context", color?, loLabel?, hiLabel? }],   // top to bottom
//   fmt: (v) => string,                // end labels
//   axis: { unit: "%", sign?: true },  // tick format; unit on the last tick
//   midName?: "median",                // named once, beside the first row's middle tick
//   note?: { text, row },              // a sentence in open space beside a row (K.annotate)
// }
window.Templates = window.Templates || {};
window.Templates.range_bars = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart range-bars");
  const rows = spec.rows;
  const fontOf = (r) => (r.role === "hero" ? fs : fl);
  const fillOf = (r) => r.color || (r.role === "hero" ? C.accent : ink.context);
  const nameW = d3.max(rows, (r) => textWidth(svg, r.name, fontOf(r)));
  const lab = (r, side) => (side === "lo" ? r.loLabel ?? spec.fmt(r.lo) : r.hiLabel ?? spec.fmt(r.hi));
  const loW = d3.max(rows, (r) => textWidth(svg, lab(r, "lo"), fontOf(r))), hiW = d3.max(rows, (r) => textWidth(svg, lab(r, "hi"), fontOf(r)));
  const axisRow = fa.size + gap("axis_label");
  const midRow = 0;
  const top = plot.y + axisRow + midRow;
  const rowH = (plot.y + plot.h - top) / rows.length;
  if (rowH < fs.size * 2) throw new Error(`LAYOUT: ${rows.length} rows leave ${rowH.toFixed(0)}px each`);
  // Rows taller than row_max would leave bars floating in air: turn the form on its side.
  if (rowH > mk.row_max) return columnsForm();
  const thick = Math.min(mk.bar_max, Math.max(mk.min_mark, rowH * mk.bar_ratio));
  const left = plot.x + nameW + gap("row_label") + loW + gap("label_mark"), right = plot.x + plot.w - hiW - gap("label_mark");
  const lo = Math.min(0, d3.min(rows, (r) => r.lo)), hi = Math.max(0, d3.max(rows, (r) => r.hi));
  const tk = K.ticks(lo, hi, right - left, textWidth(svg, "+100%", fa) + sp("2xl"));
  // Scale so the rightmost ink (a bar's end label, or the last gridline) meets the plot's right edge.
  const R = plot.x + plot.w, d0 = tk.domain[0];
  const scale = Math.min((R - left) / (tk.domain[1] - d0), ...rows.map((r) => (R - gap("label_mark") - textWidth(svg, lab(r, "hi"), fontOf(r)) - left) / (r.hi - d0)));
  const x = d3.scaleLinear(tk.domain, [left, left + scale * (tk.domain[1] - d0)]);
  const yOf = (i) => top + rowH * (i + 0.5);
  const unitT = (t) => K.num(t, { dp: K.tickDp(tk.ticks), sign: spec.axis?.sign && t !== 0 }) + (t === d3.max(tk.ticks) ? spec.axis?.unit || "" : "");
  K.xGrid(g, x, tk.ticks, { y0: top - midRow - sp("s"), y1: plot.y + plot.h, yLabel: plot.y + fa.size * 0.8, fmt: unitT, zero: 0,
    data: [d3.min(rows, (r) => r.lo), d3.max(rows, (r) => r.hi)] });
  const drawn = rows.map((r, i) => {
    const cy = yOf(i), f = fontOf(r), col = r.role === "hero" ? C.ink : f.color;
    const node = K.bar(g, x(r.lo), x(r.hi), cy, thick, fillOf(r), true).attr("data-id", r.id).node();
    g.append("line").attr("class", "mid").attr("x1", x(r.mid)).attr("x2", x(r.mid)).attr("y1", cy - thick / 2 - sp("xs")).attr("y2", cy + thick / 2 + sp("xs"))
      .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));
    K.text(g, plot.x + nameW, cy + f.size * 0.35, r.name, f, col, "end");
    K.textOver(g, x(r.lo) - gap("label_mark"), cy + f.size * 0.35, lab(r, "lo"), f, col, "end");
    K.textOver(g, x(r.hi) + gap("label_mark"), cy + f.size * 0.35, lab(r, "hi"), f, col, "start");
    return { r, node, cy };
  });
  // The middle tick is named once, just above the first row's tick.
  if (spec.midName) {
    const r0 = rows[0], w = textWidth(svg, spec.midName, fl), yy = yOf(0) - thick / 2 - sp("xs") - sp("s");
    K.textOver(g, Math.min(right - w / 2, Math.max(left + w / 2, x(r0.mid))), yy, spec.midName, fl, fl.color, "middle");
  }
  if (spec.note) {
    const d = drawn[spec.note.row], taken = drawn.map(({ node }) => { const b = node.getBBox(); return { l: b.x - hiW - gap("label_mark") * 2, r: b.x + b.width + hiW + gap("label_mark") * 2, t: b.y - sp("xs"), b: b.y + b.height + sp("xs") }; });
    K.annotate(g, { ax: x(d.r.hi) + hiW + gap("label_mark"), ay: d.cy, str: spec.note.text, maxW: Math.min(plot.w * 0.45, fl.size * 18),
      bounds: { l: left, r: plot.x + plot.w, t: top, b: plot.y + plot.h }, taken, prefer: ["s", "se", "n", "ne"], leader: false, optional: spec.note.optional });
  }
  const lx = K.lin(...x.domain(), ...x.range());
  return finish();
  function finish() { K.assert("range ends", drawn.flatMap(({ r, node, cy }) => { const b = node.getBBox();
    return [[`${r.id} lo`, b.x, lx(r.lo)], [`${r.id} hi`, b.x + b.width, lx(r.hi)], [`${r.id} row`, b.y + b.height / 2, cy], [`${r.id} colour`, node.getAttribute("fill"), fillOf(r)]]; }), 1.0);
  return { x, g, K }; }

  // Columns: one per group left to right, values up the y axis, names under the columns, the worst
  // value under its column's foot and the best above its top.
  function columnsForm() {
    const vH = fs.size + gap("label_mark");
    const bottom = plot.y + plot.h - (fs.size + gap("axis_label"));         // names row
    // Room for the end labels only where they would otherwise leave the plot.
    const yv = [0, ...rows.flatMap((r) => [r.lo, r.hi])];
    let top = plot.y + fa.size * 0.4, foot = bottom, y, ytk;
    for (let pass = 0; pass < 3; pass++) {
      ytk = K.ticks(d3.min(yv), d3.max(yv), foot - top, undefined, [K.AX.y_cover, K.AX.y_cover]);
      y = d3.scaleLinear(ytk.domain, [foot, top]);
      const over = plot.y - d3.min(rows, (r) => y(r.hi) - vH), under = d3.max(rows, (r) => y(r.lo) + vH) - bottom;
      if (over <= 0 && under <= 0) break;
      top += Math.max(0, over); foot -= Math.max(0, under);
    }
    const tickFmt = (t) => K.num(t, { dp: K.tickDp(ytk.ticks), sign: spec.axis?.sign && t !== 0 }) + (t === d3.max(ytk.ticks) ? spec.axis?.unit || "" : "");
    const gutterL = d3.max(ytk.ticks, (t) => textWidth(svg, tickFmt(t), fa)) + gap("axis_label");
    const xb = d3.scaleBand(rows.map((r) => r.id), [plot.x + gutterL, plot.x + plot.w]).paddingInner(1 - mk.bar_ratio).paddingOuter(0.1);
    const w = Math.min(xb.bandwidth(), mk.bar_max * 2);
    K.yGrid(g, y, ytk.ticks, { x0: xb.range()[0], x1: xb.range()[1], fmt: tickFmt, zero: 0, data: [d3.min(rows, (r) => r.lo), d3.max(rows, (r) => r.hi)] });
    const ly = K.lin(...y.domain(), ...y.range());
    const checks = [];
    rows.forEach((r) => {
      const cx = xb(r.id) + xb.bandwidth() / 2, f = fontOf(r), col = r.role === "hero" ? C.ink : f.color;
      const node = K.bar(g, y(r.lo), y(r.hi), cx, w, fillOf(r), false).attr("data-id", r.id).node();
      g.append("line").attr("class", "mid").attr("x1", cx - w / 2 - sp("xs")).attr("x2", cx + w / 2 + sp("xs")).attr("y1", y(r.mid)).attr("y2", y(r.mid))
        .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));
      K.textOver(g, cx, y(r.hi) - gap("label_mark"), lab(r, "hi"), f, col, "middle");
      K.textOver(g, cx, y(r.lo) + gap("label_mark") + f.size * 0.8, lab(r, "lo"), f, col, "middle");
      K.text(g, cx, plot.y + plot.h - f.size * 0.2, r.name, f, col, "middle");
      const b = node.getBBox();
      checks.push([`${r.id} hi`, b.y, ly(r.hi)], [`${r.id} lo`, b.y + b.height, ly(r.lo)], [`${r.id} colour`, node.getAttribute("fill"), fillOf(r)]);
    });
    if (spec.midName) {
      const r0 = rows[0], cx = xb(r0.id) + xb.bandwidth() / 2;
      K.textOver(g, cx + w / 2 + sp("s"), y(r0.mid) + fl.size * 0.35, spec.midName, fl, fl.color, "start");
    }
    K.assert("range ends", checks, 1.0);
    return { y, g, K };
  }
};
