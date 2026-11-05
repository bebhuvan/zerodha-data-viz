// Template: histogram of pre-binned counts (daily returns, ages, incomes). Bins sit edge to edge
// with a hairline gap; hero bins (the range the headline is about) take the series colour, the rest
// one grey. x labels sit on bin edges; pooled tails ("−5% or worse") are labelled under their bin.
// A bracket-free annotation names the hero range in open space; callouts mark single bins (a record day).
//
// spec = {
//   bins: [{ lo, hi, count, role?: "hero"|"context", label? }],   // ordered; label for pooled tails
//   x: { edges: [numbers to label], fmt: (v) => string },         // e.g. every 1 point, "−2%", "0", "+2%"
//   y: { unit: " days" },                                          // unit on the top tick
//   note?: { text, bin },                 // a sentence placed in open space near that bin (K.annotate)
//   callouts?: [{ bin, value, name, optional? }],                   // label pairs at a bin's top
// }
window.Templates = window.Templates || {};
window.Templates.histogram = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart histogram");
  const bins = spec.bins;
  const bottom = plot.y + plot.h - fa.size - gap("axis_label");
  const top = plot.y + fa.size * 0.4;
  const tk = K.ticks(0, d3.max(bins, (b) => b.count), bottom - top, undefined, [0, K.AX.y_cover]);
  const y = d3.scaleLinear(tk.domain, [bottom, top]);
  // The axis column is as wide as the numbers. A word unit (" days") on the top tick runs on past the
  // axis into the plot's top corner on a knockout, instead of widening the column for every tick.
  const fmtTick = (t) => Fmt.fmt(t, "int");
  const unit = spec.y?.unit || "", wordUnit = /[a-z]/i.test(unit);
  const gutterL = d3.max(tk.ticks, (t) => textWidth(svg, fmtTick(t) + (!wordUnit && t === d3.max(tk.ticks) ? unit : ""), fa)) + gap("axis_label");
  const x = d3.scaleBand(d3.range(bins.length), [plot.x + gutterL, plot.x + plot.w]).paddingInner(0.08).paddingOuter(0);
  if (x.bandwidth() < mk.min_mark) throw new Error(`LAYOUT: ${bins.length} bins leave ${x.bandwidth().toFixed(1)}px each`);
  K.yGrid(g, y, tk.ticks, { x0: x.range()[0], x1: x.range()[1], fmt: (t) => fmtTick(t) + (!wordUnit && t === d3.max(tk.ticks) ? unit : ""), zero: 0, data: [0, d3.max(bins, (b) => b.count)],
    hide: wordUnit ? [d3.max(tk.ticks)] : [] });
  if (wordUnit) {
    // One text: the number right-aligned with the other ticks, the unit running on past the axis.
    const tTop = d3.max(tk.ticks), lab = fmtTick(tTop) + unit, ux = x.range()[0] - gap("axis_label") - textWidth(svg, fmtTick(tTop), fa);
    const reach = ux + textWidth(svg, lab, fa) + sp("xs");
    // The bins under the unit must stay clear of it (the top row is empty in a histogram's corner).
    const under = bins.filter((b, i) => x(i) < reach && y(b.count) < y(tTop) + fa.size);
    if (under.length) throw new Error(`LAYOUT: the axis unit "${unit.trim()}" would sit on a bar`);
    K.textOver(g, ux, y(tTop) + fa.size * 0.35, lab, fa, fa.color, "start");
  }
  const fillOf = (b) => b.color || (b.role === "hero" ? C.accent : ink.context);
  const drawn = bins.map((b, i) => ({ b, i, node: K.bar(g, y(0), y(b.count), x(i) + x.bandwidth() / 2, x.bandwidth(), fillOf(b), false).node() }));
  g.append("line").attr("class", "baseline").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));

  // Edge labels: the boundary between two bins at value v; tails labelled under their bin.
  const edgeX = (v) => { const i = bins.findIndex((b) => Math.abs(b.lo - v) < 1e-9); return i < 0 ? null : x(i) - (x.step() - x.bandwidth()) / 2; };
  const ly = bottom + gap("axis_label") + fa.size * 0.8;
  const placed = [];
  // Labels stay inside the plot's width: an end label is anchored to the outer edge of its bin.
  const put = (cx, str, anchor = "middle") => {
    const w = textWidth(svg, str, fa), l = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
    const b = { l: l - sp("s"), r: l + w + sp("s") };
    if (l < x.range()[0] - 1 || l + w > x.range()[1] + 1 || placed.some((p) => b.l < p.r && p.l < b.r)) return;
    placed.push(b); K.text(g, anchor === "middle" ? cx : anchor === "start" ? l : l + w, ly, str, fa, fa.color, anchor);
  };
  bins.forEach((b, i) => { if (!b.label) return;
    const end = i === 0 ? "start" : i === bins.length - 1 ? "end" : "middle";
    put(end === "start" ? x(i) : end === "end" ? x(i) + x.bandwidth() : x(i) + x.bandwidth() / 2, b.label, end); });
  for (const v of spec.x.edges) { const ex = edgeX(v); if (ex != null) put(ex, spec.x.fmt(v)); }

  const boxes = drawn.map(({ node }) => { const r = node.getBBox(); return { l: r.x, r: r.x + r.width, t: r.y, b: r.y + r.height }; });
  const taken = [...boxes];
  const bounds = { l: x.range()[0], r: plot.x + plot.w, t: plot.y, b: bottom - sp("s") };
  for (const c of spec.callouts || []) {
    const i = c.bin, ax = x(i) + x.bandwidth() / 2, ay = y(bins[i].count), sz = K.labelSize(c.value, c.name);
    const at = Kit.place({ ax, ay, w: sz.w, h: sz.h, bounds, taken, pad: sp("s"), prefer: c.prefer || ["n", "ne", "nw"], step: sp("xs"), minD: gap("label_mark"), maxD: plot.h / 2,
      accept: (p) => !Kit.segHits(ax, ay, ...Kit.leaderTo(ax, ay, p.box, gap("leader_clear")), taken) });
    if (!at) { if (c.optional) continue; throw new Error(`LAYOUT: no clear space for the label "${c.name}"`); }
    taken.push(at.box);
    K.label(g, at.x, at.y, c.value, c.name);
    const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear"));
    K.leader(g, [[ax, ay - gap("leader_clear")], [ex, ey]]);
  }
  if (spec.note) {
    const i = spec.note.bin;
    K.annotate(g, { ax: x(i) + x.bandwidth() / 2, ay: y(bins[i].count), str: spec.note.text, maxW: Math.min(plot.w * 0.4, fl.size * 16),
      bounds, taken, prefer: ["e", "ne", "w", "nw"], optional: spec.note.optional });
  }

  const lyv = K.lin(...y.domain(), ...y.range());
  K.assert("bin heights", drawn.flatMap(({ b, i, node }) => { const r = node.getBBox();
    return [[`bin ${i} height`, r.height, Math.max(b.count ? mk.min_mark : 0, Math.abs(lyv(b.count) - lyv(0)))], [`bin ${i} colour`, node.getAttribute("fill"), fillOf(b)]]; }), 1.0);
  return { x, y, g, K };
};
