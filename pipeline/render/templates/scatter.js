// Template: scatter of two measures, one dot per item (countries, companies, funds). The one form
// with vertical gridlines too, since both positions are read. Hero dots are filled in the series
// colour and labelled with the label pair; compare dots are filled mid grey and named; context dots
// are smaller grey dots, named only where a name fits cleanly (optional). Hollow rings read as missing
// data, so no dot is drawn hollow. Axis titles sit at the top of
// the y axis and the end of the x axis, in the label role.
//
// spec = {
//   points: [{ id, x, y, name, role?: "hero"|"compare"|"context", value?: "7.6%", color?, optional? }],
//   x: { scale?: "log", title, tick: (t, isLast) => string },
//   y: { title, tick: (t, isTop) => string, zero?: 0 },
//   refLines?: [{ axis: "x"|"y", at, name }],     // e.g. the median; dashed, named at its end
// }
window.Templates = window.Templates || {};
window.Templates.scatter = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart scatter");
  const pts = spec.points, logX = spec.x.scale === "log";
  const top = plot.y + fl.size + sp("m");                         // y title row
  const bottom = plot.y + plot.h - (fa.size + gap("axis_label")) - (fl.size + sp("s"));  // x ticks row, x title row
  const yv = [...pts.map((p) => p.y), ...(spec.y.zero != null ? [spec.y.zero] : [])];
  const ytk = K.ticks(d3.min(yv), d3.max(yv), bottom - top, undefined, [K.AX.y_cover, K.AX.y_cover]);
  const y = d3.scaleLinear(ytk.domain, [bottom, top + fa.size * 0.4]);
  const yLabW = d3.max(ytk.ticks, (t) => textWidth(svg, spec.y.tick(t, t === d3.max(ytk.ticks)), fa)) + gap("axis_label");
  // The last x tick label is centred on its tick: keep half its width inside the plot.
  // Only a tick label at the very end of the domain needs half its width beyond the plot; ticks are
  // found first with a hairline margin, then again if the end tick is labelled there.
  const x0 = plot.x + yLabW, [xlo, xhi] = d3.extent(pts, (p) => p.x);
  const xTicks = (x1) => (logX ? K.logTicks : K.ticks)(xlo, xhi, x1 - x0, textWidth(svg, spec.x.tick(xhi, true), fa) * 2);
  let x1 = plot.x + plot.w - sp("s"), xtk = xTicks(x1);
  const endT = d3.max(xtk.ticks);
  if (Math.abs(endT - xtk.domain[1]) <= Math.abs(xtk.domain[1]) * 1e-9) { x1 = plot.x + plot.w - Math.max(sp("s"), textWidth(svg, spec.x.tick(endT, true), fa) / 2); xtk = xTicks(x1); }
  const x = (logX ? d3.scaleLog : d3.scaleLinear)(xtk.domain, [x0, x1]);
  K.yGrid(g, y, ytk.ticks, { x0, x1, fmt: (t) => spec.y.tick(t, t === d3.max(ytk.ticks)), zero: spec.y.zero ?? 0, data: d3.extent(pts, (p) => p.y) });
  K.xGrid(g, x, xtk.ticks.filter((t) => t >= x.domain()[0] * (1 - 1e-9) && t <= x.domain()[1] * (1 + 1e-9)), { y0: top, y1: bottom, yLabel: bottom + gap("axis_label") + fa.size * 0.8,
    fmt: (t) => spec.x.tick(t, t === d3.max(xtk.ticks)), zero: logX ? NaN : 0, data: [xlo, xhi], scale: logX ? "log" : null });
  K.text(g, plot.x, plot.y + fl.size * 0.8, spec.y.title, fl, fl.color, "start");
  K.text(g, x1, plot.y + plot.h - fl.size * 0.2, spec.x.title, fl, fl.color, "end");
  for (const r of spec.refLines || []) {
    if (r.axis === "y") { K.refLine(g, x0, y(r.at), x1, y(r.at)); K.textOver(g, x1, y(r.at) - sp("xs"), r.name, fl, fl.color, "end"); }
    else { K.refLine(g, x(r.at), top, x(r.at), bottom); K.textOver(g, x(r.at) + sp("xs"), top + fl.size, r.name, fl, fl.color, "start"); }
  }

  const order = { context: 0, compare: 1, hero: 2 };
  const colorOf = (p) => p.color || (p.role === "hero" ? C.accent : ink.compare);
  const rOf = (p) => (p.role === "hero" ? mk.dot_hero : (p.role || "context") === "context" ? mk.dot_small : mk.dot);
  const dots = [];
  for (const p of [...pts].sort((a, b) => order[a.role || "context"] - order[b.role || "context"])) {
    const cx = x(p.x), cy = y(p.y), r = rOf(p);
    const c = K.dot(g, cx, cy, colorOf(p), r, p.role === "hero");  // the white ring only separates the hero from what it covers
    c.attr("class", `dot ${p.role || "context"}`).attr("data-id", p.id);
    dots.push({ p, c, cx, cy, r });
  }
  // Labels: hero first, then compare, then context names where they fit.
  const taken = dots.map(({ cx, cy, r }) => ({ l: cx - r, r: cx + r, t: cy - r, b: cy + r }));
  const bounds = { l: x0, r: x1, t: top, b: bottom };
  for (const { p, cx, cy, r } of [...dots].sort((a, b) => order[b.p.role || "context"] - order[a.p.role || "context"])) {
    const role = p.role || "context";
    const value = role === "hero" ? p.value : null, sz = K.labelSize(value, p.name);
    const own = taken.find((b) => Math.abs((b.l + b.r) / 2 - cx) < 0.01 && Math.abs((b.t + b.b) / 2 - cy) < 0.01);
    const others = taken.filter((b) => b !== own);
    // Names without a leader must sit right beside their dot (east or west; named compare dots also just above or below), or the reader cannot tell
    // which dot they name; only the hero may move further out, on a leader.
    const near = role !== "hero";
    const at = Kit.place({ ax: cx, ay: cy, w: sz.w, h: sz.h, bounds, taken: others, pad: sp("xs"), prefer: near ? (role === "compare" ? ["e", "w", "n", "s"] : ["e", "w"]) : ["e", "w", "ne", "nw", "se", "sw", "n", "s"],
      step: sp("xs"), minD: r + sp("xs"), maxD: near ? r + sp("s") : r + mk.leader_min * 5,
      accept: (a) => !Kit.segHits(cx, cy, ...Kit.leaderTo(cx, cy, a.box, gap("leader_clear")), others) });
    if (!at) { if (role === "context" || p.optional) continue; throw new Error(`LAYOUT: no clear space for the label "${p.name}"`); }
    taken.push(at.box);
    if (role === "hero") K.label(g, at.x, at.y, value, p.name);
    else K.textOver(g, at.x, at.y + fl.size * 0.8, p.name, fl, role === "compare" ? C.ink2 : fl.color, "start");
    const [ex, ey] = Kit.leaderTo(cx, cy, at.box, gap("leader_clear")), ang = Math.atan2(ey - cy, ex - cx);
    K.leader(g, [[cx + Math.cos(ang) * (r + gap("leader_clear")), cy + Math.sin(ang) * (r + gap("leader_clear"))], [ex, ey]]);
  }
  // Encoding: every dot's centre recomputed with plain arithmetic.
  const lx = logX ? (v) => K.lin(Math.log10(x.domain()[0]), Math.log10(x.domain()[1]), x0, x1)(Math.log10(v)) : K.lin(...x.domain(), x0, x1);
  const ly = K.lin(...y.domain(), ...y.range());
  K.assert("dot positions", dots.flatMap(({ p, c }) => [[`${p.id} x`, +c.attr("cx"), lx(p.x)], [`${p.id} y`, +c.attr("cy"), ly(p.y)]]), 0.75);
  return { x, y, g, K };
};
