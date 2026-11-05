// Template: beeswarm. One dot per item along a value axis, packed so none overlap; for "where does
// this one sit among all of them" (a year among all years, a state among all states, a fund among
// its category). The value axis runs along the canvas's long side: horizontal on wide plots,
// vertical on tall ones.
//
// spec = {
//   v: { unit: "°C", dp: 0, sign: false, domain?: [lo, hi], zero?: 0 },
//   items: [{ id, value, role: "hero"|"compare"|"context", color?, label?: { value, name } }],
//   refLines?: [{ v, name }],
// }
// The swarm is fitted to its box: dot size within swarm_dot_min..max, then looser spacing, so it takes
// between swarm_fill_lo and swarm_fill_hi of the room across the value axis (lint checks ≥ 40%).
// Marks follow the grammar: small dots (at most swarm_dot_max), context dots as hairline rings so
// the distribution's shape does the work, named peers filled compare grey, the hero filled in its
// colour. Named items are labelled in a lane beside the swarm (vertical) or above it (horizontal):
// each label gets its own slot, in value order, with a leader at least leader_min long.
window.Templates = window.Templates || {};
window.Templates.beeswarm = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart beeswarm");
  svg.attr("data-fill", "shape");  // lint: the footprint is the distribution's shape
  const vertical = !F.side && plot.h > plot.w * 0.5;
  const items = [...spec.items].sort((a, b) => a.value - b.value);
  const data = d3.extent(items, (d) => d.value);
  let dpT = spec.v.dp ?? 0;
  const fmtTick = (t, last) => K.num(t, { dp: dpT, sign: spec.v.sign }) + (last ? spec.v.unit || "" : "");

  // Value axis along the long side, ticks covering the data.
  const tickLabelW = (list) => d3.max(list, (t) => textWidth(svg, fmtTick(t, true), fa));
  const refW = d3.max(spec.refLines || [], (r) => textWidth(svg, r.name, fl)) || 0;
  const vLen = vertical ? plot.h - fa.size * 1.2 : plot.w;
  const pre = K.ticks(...(spec.v.domain || data), vLen, vertical ? fa.size * K.AX.label_gap : tickLabelW(d3.ticks(...data, 6)) + sp("2xl"));
  dpT = K.tickDp(pre.ticks, dpT);
  const axisPad = vertical ? Math.max(tickLabelW(pre.ticks), refW) + gap("axis_label") : fa.size + gap("axis_label") + sp("xs");
  const v = d3.scaleLinear(pre.domain, vertical ? [plot.y + plot.h - fa.size * 0.6, plot.y + fa.size * 0.6] : [plot.x, plot.x + plot.w]);
  const s0 = vertical ? plot.x + axisPad : plot.y, s1 = vertical ? plot.x + plot.w : plot.y + plot.h - axisPad;

  // Label lane: labels go beside the dots they name, which are usually at the swarm's narrow tip,
  // so the swarm is first fitted to the whole box; a lane is reserved only when a label then has no
  // room (laneFits below), and the swarm is refitted to what the lane leaves.
  const lab = items.filter((it) => it.label).map((it) => K.labelSize(it.label.value, it.label.name));
  const laneSpan = lab.length ? (vertical ? d3.max(lab, (l) => l.w) : d3.max(lab, (l) => l.h)) + mk.leader_min + gap("leader_clear") : 0;
  const v0 = v.range();
  // Pack: each dot goes as close to the centre line as it can without coming nearer than f × its
  // diameter to a placed dot (f = 1 is a tight swarm; larger f spreads it, the position across the
  // swarm carries no value, so spacing is free to fit the box).
  const pack = (r, f = 1) => {
    const placed = [], clear = 2 * r * f + sp("2xs"), stepO = r * 0.5 * f;
    for (const it of items) {
      const pv = v(it.value);
      let best = null;
      for (let n = 0; n < 600 && best == null; n++) {
        for (const off of n === 0 ? [0] : [n * stepO, -n * stepO]) {
          if (placed.every((p) => Math.abs(p.pv - pv) >= clear || Math.hypot(p.pv - pv, p.off - off) >= clear)) { best = off; break; }
        }
      }
      placed.push({ it, pv, off: best });
    }
    return placed;
  };
  const extOf = (P, r) => d3.max(P, (p) => Math.abs(p.off)) * 2 + 2 * r;
  // Fit to the box: the largest dot (swarm_dot_min..max) whose tight swarm stays under
  // swarm_fill_hi_ratio of the room; then, if the swarm is still narrower than swarm_fill_lo_ratio,
  // loosen the spacing (up to swarm_gap_max_ratio) until it fills that share.
  const fillLo = mk.swarm_fill_lo_ratio ?? 0.5, fillHi = mk.swarm_fill_hi_ratio ?? 0.65, gapMax = mk.swarm_gap_max_ratio ?? 2;
  const fit = (reserve) => {
    const room = s1 - s0 - reserve;
    v.range(v0);
    let r, P, f = 1;
    for (r = mk.swarm_dot_max; r >= mk.swarm_dot_min; r -= 0.25 * mk.swarm_dot_min) { P = pack(r); if (extOf(P, r) <= fillHi * room) break; }
    if (r < mk.swarm_dot_min) throw new Error("LAYOUT: too many items for a legible swarm here");
    while (extOf(P, r) < fillLo * room && f < gapMax) { f = Math.min(gapMax, f + 0.1); const Q = pack(r, f); if (extOf(Q, r) > fillHi * room) break; P = Q; }
    if (extOf(P, r) > fillHi * room) f = Math.max(1, f - 0.1);
    // End dots sit exactly one radius inside the plot.
    v.range(vertical ? [plot.y + plot.h - Math.max(r, fa.size * 0.6), plot.y + Math.max(r, fa.size * 0.6)] : [plot.x + r, plot.x + plot.w - r]);
    P = pack(r, f);
    const ext = d3.max(P, (p) => Math.abs(p.off)) + r;
    // Swarm centre: in the middle of what the lane leaves (the lane takes the far side).
    const centre = vertical ? Math.max(s0 + ext + sp("s"), (s0 + s1 - reserve) / 2) : Math.min(s1 - ext - sp("s"), (s0 + reserve + s1) / 2);
    return { r, f, P, ext, centre };
  };
  // Where the lane would go for a fitted swarm, and whether every label fits inside the plot.
  const lanePlan = (L) => {
    const X = (p) => (vertical ? L.centre + p.off : p.pv), Y = (p) => (vertical ? p.pv : L.centre + p.off);
    const blocks = L.P.filter((p) => p.it.label).map((p) => ({ p, sz: K.labelSize(p.it.label.value, p.it.label.name) }));
    const near = (b, pos) => L.P.filter((q) => Math.abs((vertical ? Y(q) : X(q)) - pos) <= (vertical ? b.sz.h : b.sz.w) / 2 + L.r + sp("s")).concat([b.p]);
    if (!blocks.length) return { X, Y, blocks, placed: [], fits: true };
    if (vertical) {
      const placed = K.lane(blocks.map((b) => ({ b, target: Y(b.p), size: b.sz.h })), plot.y, plot.y + plot.h, sp("m"));
      const at = d3.max(placed, (it) => d3.max(near(it.b, it.pos), (q) => X(q))) + L.r + mk.leader_min + gap("leader_clear");
      return { X, Y, blocks, placed, at, fits: d3.max(placed, (it) => at + it.b.sz.w) <= plot.x + plot.w };
    }
    const placed = K.lane(blocks.map((b) => ({ b, target: X(b.p), size: b.sz.w })), plot.x, plot.x + plot.w, sp("xl"));
    const at = d3.min(placed, (it) => d3.min(near(it.b, it.pos), (q) => Y(q))) - L.r - mk.leader_min - gap("leader_clear");
    return { X, Y, blocks, placed, at, fits: at - d3.max(blocks, (b) => b.sz.h) >= plot.y };
  };
  let L = fit(0), plan = lanePlan(L);
  if (!plan.fits && laneSpan) { L = fit(laneSpan); plan = lanePlan(L); }
  const { r, P, ext, centre } = L;
  svg.attr("data-swarm", vertical ? "v" : "h");
  const X = (p) => (vertical ? centre + p.off : p.pv), Y = (p) => (vertical ? p.pv : centre + p.off);

  // Gridlines across the swarm only (not under the label lane), labels on the axis side; reference
  // lines dashed, named in the axis column like a tick (the tick they crowd is not labelled).
  const ax = g.append("g").attr("class", "axis").call((a) => K.axisMeta(a, data, pre.ticks));
  const refVs = (spec.refLines || []).map((rl) => rl.v);
  const lastT = d3.max(pre.ticks);
  // Gridlines run from the axis labels across the swarm. Vertical: not under the label lane beside it.
  // Horizontal: the full height (the lane above has knockouts), so the plot reads as one field.
  const across = (val) => vertical ? [s0, v(val), centre + ext + sp("s"), v(val)] : [v(val), s0, v(val), s1];
  const tickText = (val, str, f, fill) => {
    if (vertical) return K.text(ax, s0 - gap("axis_label"), v(val) + f.size * 0.35, str, f, fill, "end");
    // An end label that would pass the plot edge is anchored to the edge instead.
    const w = textWidth(svg, str, f), px = v(val), anchor = px - w / 2 < plot.x ? "start" : px + w / 2 > plot.x + plot.w ? "end" : "middle";
    return K.text(ax, anchor === "start" ? plot.x : anchor === "end" ? plot.x + plot.w : px, s1 + gap("axis_label") + f.size * 0.8, str, f, fill, anchor);
  };
  for (const t of pre.ticks) {
    const base = t === (spec.v.zero ?? 0), ln = across(t);
    ax.append("line").attr("class", base ? "baseline" : "grid").attr("x1", ln[0]).attr("y1", ln[1]).attr("x2", ln[2]).attr("y2", ln[3])
      .attr("stroke", base ? ink.baseline : ink.grid).attr("stroke-width", K.sw(base ? "baseline" : "grid"));
    const crowd = refVs.some((rv) => Math.abs(v(rv) - v(t)) < (vertical ? fa.size * 1.3 : tickLabelW(pre.ticks) + sp("s")));
    if (!crowd) tickText(t, fmtTick(t, t === lastT), fa, fa.color);
  }
  for (const rl of spec.refLines || []) {
    K.refLine(ax, ...across(rl.v));
    tickText(rl.v, rl.name, fl, fl.color);
  }

  // Dots: context rings, compare and hero filled; hero last so it sits on top.
  const fillOf = (it) => it.role === "context" ? C.surface : it.color || (it.role === "hero" ? C.line_hero : ink.compare);
  const strokeOf = (it) => (it.role === "context" ? ink.compare : C.surface);
  const order = { context: 0, compare: 1, hero: 2 };
  const dots = [];
  for (const p of [...P].sort((a, b) => order[a.it.role] - order[b.it.role])) {
    const ctx = p.it.role === "context";
    const c = g.append("circle").attr("cx", X(p)).attr("cy", Y(p)).attr("r", ctx ? r - K.sw("context") / 2 : r).attr("fill", fillOf(p.it))
      .attr("stroke", strokeOf(p.it)).attr("stroke-width", ctx ? K.sw("context") : null)
      .attr("data-id", p.it.id).attr("data-role", p.it.role);
    if (!ctx) c.attr("stroke-width", K.sw("context"));
    dots.push({ p, node: c.node() });
  }

  // Labels, from the lane plan: blocks spread along the value axis in value order so none touch, set
  // at one distance from the swarm (past the furthest dot near any of them, plus leader_min) so every
  // leader is long enough to see.
  if (!plan.fits) throw new Error(`LAYOUT: no room for the label lane ${vertical ? "beside" : "above"} the swarm`);
  if (vertical) for (const it of plan.placed) {
    const { p, sz } = it.b, top = it.pos - sz.h / 2, laneX = plan.at;
    const ty = Math.max(top + fs.size * 0.5, Math.min(Y(p), top + sz.h - fl.size * 0.5));
    const ang = Math.atan2(ty - Y(p), laneX - gap("leader_clear") - X(p));
    K.leader(g, [[X(p) + Math.cos(ang) * (r + gap("leader_clear")), Y(p) + Math.sin(ang) * (r + gap("leader_clear"))], [laneX - gap("leader_clear"), ty]]);
    K.label(g, laneX, top, p.it.label.value, p.it.label.name);
  }
  else for (const it of plan.placed) {
    const { p, sz } = it.b, left = it.pos - sz.w / 2, laneB = plan.at;
    const tx = Math.max(left, Math.min(X(p), left + sz.w));
    const ang = Math.atan2(laneB + gap("leader_clear") - Y(p), tx - X(p));
    K.leader(g, [[X(p) + Math.cos(ang) * (r + gap("leader_clear")), Y(p) + Math.sin(ang) * (r + gap("leader_clear"))], [tx, laneB + gap("leader_clear")]]);
    K.label(g, left, laneB - sz.h, p.it.label.value, p.it.label.name);
  }

  // Encoding: each dot's position on the value axis, recomputed; its colour from its role.
  const lv = K.lin(...v.domain(), ...v.range());
  K.assert("dot positions", dots.map(({ p, node }) => [p.it.id, node.getAttribute(vertical ? "cy" : "cx"), lv(p.it.value)]), 0.5);
  K.assert("dot colours", dots.map(({ p, node }) => [p.it.id, node.getAttribute("fill"), fillOf(p.it)]));
  return { v, r, vertical };
};
