// Template: small multiples of lines. One panel per series on a shared scale; each panel shows its
// own series in colour over the others in light grey, so every panel can be read alone and
// against the rest. For "which parts of the basket moved": food groups, sectors, states.
//
// spec = {
//   x: { domain: [a, b], ticks: [{ at, label }] },
//   y: { unit: "%", dp: 0, sign: false, zero: 0, domain? },
//   panels: [{ id, name, points: [{ x, y }], end: "text for the last value" }],
//   color?: series colour for every panel (default the accent blue),
//   refBand?: { lo, hi },  // optional shaded target range in every panel
//   key?: "how to read the panels",  // set in the first empty grid cell; a grid with empty cells needs one
//   dashLast?: true,  // the last step of each panel's own line is dashed: a provisional latest value (data-device)
//   others?: false,   // leave out the other panels' grey lines (few panels on one scale: the grey read as the panel's own past)
//   curve?: "linear", // straight joins for sparse points (quarters); default monotone
// }
// One shared y scale, stretched to round ticks that cover every panel's data; each panel's lines are
// clipped to its own box, so a spike in one series can never run out of the other panels. The
// panel's own series is drawn at compare weight (small panels need a lighter line than a full chart).
// Columns are chosen per canvas for the biggest panels between 1:1 and 2.5:1; panels smaller than about two lines
// of type in height throw LAYOUT.
window.Templates = window.Templates || {};
window.Templates.small_multiples = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart small-multiples");
  const n = spec.panels.length;
  const hue = spec.color || C.accent;
  const all = spec.panels.flatMap((p) => p.points.filter((d) => d.y != null).map((d) => d.y));
  const data = d3.extent(all);
  const [lo0, hi0] = spec.y.domain || d3.extent([...all, spec.y.zero ?? 0]);
  const fmtTick = (t, top, dp) => K.num(t, { dp, sign: spec.y.sign }) + (top ? spec.y.unit || "" : "");

  const gutL = textWidth(svg, fmtTick(Math.max(Math.abs(lo0), Math.abs(hi0)) * (lo0 < 0 ? -1 : 1), true, 0), fa) + gap("axis_label");
  const title1 = fs.size + sp("s"), title2 = fs.size * 1.15 + K.fv.size + sp("s"), axisH = fa.size + gap("axis_label"), gapX = gap("panel_x"), gapY = gap("panel_y");
  // Each panel's header (name, then latest value) must fit across it.
  const headW = d3.max(spec.panels, (p) => textWidth(svg, p.name, fs) + (p.end ? textWidth(svg, p.end, K.fv) + sp("l") : 0));
  // Narrow panels set the latest value under the name instead of beside it.
  const headW2 = d3.max(spec.panels, (p) => Math.max(textWidth(svg, p.name, fs), p.end ? textWidth(svg, p.end, K.fv) : 0));
  // Pick the column count that gives the biggest usable panels, at least the minimum size. A grid
  // with empty cells is allowed only when there is a key to put in them.
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    if (rows * cols > n && !spec.key) continue;
    const pw = (plot.w - gutL - gapX * (cols - 1)) / cols;
    const two = pw < headW;
    const titleH = two ? title2 : title1;
    const ph = (plot.h - axisH - rows * titleH - gapY * (rows - 1)) / rows;
    if (pw < sp("3xl") * 3 || ph < sp("3xl") + sp("2xl") || pw < (two ? headW2 : headW)) continue;
    // Biggest panels whose shape stays between 1:1 and 2.5:1 (a line chart wants width, but not a strip).
    // An empty cell is canvas with nothing in it: such a grid must beat a full one by 20%.
    const a = Math.min(pw, ph * 2.5) * Math.min(ph, pw) * (rows * cols > n ? 0.8 : 1);
    if (!best || a > best.score) best = { cols, rows, pw, ph, titleH, two, score: a };
  }
  if (!best) throw new Error(`LAYOUT: ${n} panels do not fit at a legible size`);
  const { cols, rows, pw, ph, titleH, two } = best;
  // Shared scale; it always stretches to a round top tick, so every panel is capped by a gridline
  // and the tallest spike ends on a labelled value instead of running into the titles.
  const tk = K.ticks(lo0, hi0, ph, fa.size * 2, [K.AX.y_cover, K.AX.y_cover]);  // labels only in the first column, so closer than the usual three label-heights
  const [lo, hi] = tk.domain;

  const marks = [];
  const line0 = (x, y) => d3.line().defined((d) => d.y != null).x((d) => x(d.x)).y((d) => y(d.y)).curve(spec.curve === "linear" ? d3.curveLinear : d3.curveMonotoneX);
  spec.panels.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const px = plot.x + gutL + c * (pw + gapX), py = plot.y + r * (ph + titleH + gapY) + titleH;
    const x = d3.scaleLinear(spec.x.domain, [px, px + pw]);
    const y = d3.scaleLinear([lo, hi], [py + ph, py]);
    const dp = K.tickDp(tk.ticks, spec.y.dp ?? 0);
    if (spec.refBand) g.append("rect").attr("x", px).attr("width", pw).attr("y", y(spec.refBand.hi)).attr("height", y(spec.refBand.lo) - y(spec.refBand.hi))
      .attr("fill", ink.band).attr("data-device", "shaded");
    K.yGrid(g, y, tk.ticks, { x0: px, x1: px + pw, xLabel: px - gap("axis_label"), zero: spec.y.zero ?? 0, data: c === 0 ? data : null,
      fmt: (t) => (c === 0 ? fmtTick(t, t === d3.max(tk.ticks), dp) : "") });
    // Clip to the panel (a hairline of slack for the stroke).
    const id = `clip-${String(p.id).replace(/\W/g, "")}-${i}`;
    g.append("clipPath").attr("id", id).append("rect").attr("x", px - sp("2xs")).attr("y", py - sp("2xs")).attr("width", pw + 2 * sp("2xs")).attr("height", ph + 2 * sp("2xs"));
    const gp = g.append("g").attr("clip-path", `url(#${id})`);
    const line = line0(x, y);
    if (spec.others !== false) for (const o of spec.panels) if (o !== p) K.series(gp, o.points, line, "context");
    // dashLast: the solid line stops one point early and a dashed step runs to the latest value.
    const own = p.points.filter((d) => d.y != null);
    const solidPts = spec.dashLast ? own.slice(0, -1) : p.points;
    const node = gp.append("path").datum(solidPts).attr("class", "series hero").attr("d", line).attr("fill", "none").attr("stroke", hue)
      .attr("stroke-width", K.sw("compare")).attr("stroke-linejoin", "round").attr("stroke-linecap", "round").attr("data-role", "hero").attr("data-id", p.id).node();
    const nodes = [node];
    if (spec.dashLast) nodes.push(gp.append("path").datum(own.slice(-2)).attr("class", "series hero").attr("d", d3.line().x((d) => x(d.x)).y((d) => y(d.y)))
      .attr("fill", "none").attr("stroke", hue).attr("stroke-width", K.sw("compare")).attr("stroke-dasharray", `${sp("s")} ${sp("xs")}`).attr("stroke-linecap", "butt")
      .attr("data-role", "hero").attr("data-id", `${p.id}_last`).attr("data-device", "dashed").node());
    marks.push({ p, nodes, x, y });
    const last = p.points.filter((d) => d.y != null).at(-1);
    K.dot(g, x(last.x), y(last.y), hue, mk.dot_small);
    // Title left, latest value right, on one line above the panel (or the value under the name when narrow).
    if (two) {
      K.text(g, px, py - titleH + sp("2xs") + fs.size * 0.8, p.name, fs, fs.color, "start");
      if (p.end) K.text(g, px, py - sp("s"), p.end, K.fv, K.fv.color, "start");
    } else {
      K.text(g, px, py - sp("s"), p.name, fs, fs.color, "start");
      if (p.end) K.text(g, px + pw, py - sp("s"), p.end, K.fv, K.fv.color, "end");
    }
    // x labels under the bottom panels; an inner label closer than sp("l") to the one before it or to the
    // last is dropped, so the first and last are always named (as in the lines template).
    if (r === rows - 1 || i + cols >= n) {
      const xl = spec.x.ticks.map((t) => {
        const w = textWidth(svg, t.label, fa), cx = x(t.at);
        const anchor = t.anchor || (cx - w / 2 < px ? "start" : cx + w / 2 > px + pw ? "end" : "middle");
        const at = anchor === "start" ? Math.max(px, cx - (t.anchor ? 0 : w / 2)) : anchor === "end" ? (t.anchor ? cx : Math.min(px + pw, cx + w / 2)) : cx;
        const l = anchor === "start" ? at : anchor === "end" ? at - w : at - w / 2;
        return { t, at, anchor, l, r: l + w };
      });
      const kept = xl.filter((b, j) => j === 0 || j === xl.length - 1);
      for (const b of xl.slice(1, -1)) {
        const prevR = d3.max(kept.filter((k) => k.l <= b.l), (k) => k.r) ?? -Infinity;
        if (b.l >= prevR + sp("l") && b.r + sp("l") <= xl.at(-1).l) kept.push(b);
      }
      for (const b of xl.filter((b) => kept.includes(b))) K.text(g, b.at, py + ph + gap("axis_label") + fa.size * 0.8, b.t.label, fa, fa.color, b.anchor);
    }
  });
  // The key goes in the first empty cell, as an annotation.
  if (rows * cols > n) {
    const c = n % cols, r = Math.floor(n / cols);
    const px = plot.x + gutL + c * (pw + gapX), py = plot.y + r * (ph + titleH + gapY) + titleH;
    F.textBlock(g.append("g").attr("class", "annotation key"), spec.key, K.fn, px, py - fs.size * 0.6, pw, K.fn.color);
  }

  // Encoding: each panel's line extent equals its data extent on the shared scale.
  const checks = [];
  for (const { p, nodes, x, y } of marks) {
    const pts = p.points.filter((d) => d.y != null), bs = nodes.map((nd) => nd.getBBox());
    const b = { x: d3.min(bs, (q) => q.x), y: d3.min(bs, (q) => q.y) };
    b.width = d3.max(bs, (q) => q.x + q.width) - b.x; b.height = d3.max(bs, (q) => q.y + q.height) - b.y;
    const lx = K.lin(...x.domain(), ...x.range()), ly = K.lin(...y.domain(), ...y.range());
    checks.push([`${p.id} top`, b.y, ly(d3.max(pts, (d) => d.y))], [`${p.id} bottom`, b.y + b.height, ly(d3.min(pts, (d) => d.y))],
      [`${p.id} left`, b.x, lx(d3.min(pts, (d) => d.x))], [`${p.id} right`, b.x + b.width, lx(d3.max(pts, (d) => d.x))]);
  }
  K.assert("panel lines", checks, 1.0);
  return { cols, rows };
};
