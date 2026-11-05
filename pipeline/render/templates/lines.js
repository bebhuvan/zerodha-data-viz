// Template: lines over a numeric x (time as decimal years or month positions).
// One or two hero series in colour, named peers in mid grey, the rest as light context; an optional
// envelope band (range of past values), reference band (a target range) and reference lines.
// Labels are written onto the chart: end labels for named series, callouts with leaders for points
// the story needs. Any dataset of the same shape drops in.
//
// spec = {
//   x: { domain: [a, b], ticks?: [{ at, label }], scale?: "log" },  // no ticks: K.timeTicks on decimal years; log x needs ticks (maturities)
//   y: { unit: "%", dp: 0, sign: false, domain?: [lo, hi], zero: 0 | null, scale?: "log",
//        tick?: (t, isTop) => string, hug?: true,
//        ticksMax?: 7 },  // one more tick than the theme allows, at most: for named reference lines near zero
//                         // that would otherwise push the zero label out at the coarser step     // hug: the domain stretches at most a quarter step (short histories)                   // log: 1-2-5 ticks, no zero line (say "log scale" in the dek)
//   series: [{ id, role: "hero"|"compare"|"context", color?, curve?: "monotone"|"linear"|"step",
//              points: [{ x, y }]  (y null = gap), end?: { value, name },
//              fill?: true }],                            // area between the line and zero (drawdowns), pale grey
//              dashed?: true,                             // estimates, not observations: dashed at the role's weight (data-device)
//              dots?: true                                // a dot on every point: sparse observations (survey years),
//                                                         // so a short run between two surveys reads as data, not a leader
//   shade?: [{ from, to, name }],                         // periods (recessions, crises): pale columns named at the top
//   band?: { points: [{ x, lo, hi }], name },          // envelope, light fill behind the lines
//   refBand?: { lo, hi, name, from? },                   // target range (from x = from), named inside the band
//   refLines?: [{ y, name }],                            // dashed, labelled in the axis column like a tick; a name
//                                                        // that crowds the zero label moves just clear of it
//   callouts?: [{ x, y, value, name, prefer?: ["ne", ...], dot?: true, optional?: true,
//                near?: true }],                         // name may be [long, short]: variants tried in order                         // near: beside its point (within 3xl) or not at all, never on a long leader
// }
window.Templates = window.Templates || {};
window.Templates.lines = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart lines");
  const all = spec.series.flatMap((s) => s.points.filter((p) => p.y != null));
  const log = spec.y.scale === "log";
  if (log && all.some((p) => p.y <= 0)) throw new Error("ENCODING: a log axis cannot show zero or negative values");
  const shades = spec.shade || [];
  const yVals = [...all.map((p) => p.y), ...spec.series.filter((s) => s.fill).map(() => spec.y.zero ?? 0), ...(spec.band ? spec.band.points.flatMap((p) => [p.lo, p.hi]) : []),
    ...(spec.refBand ? [spec.refBand.lo, spec.refBand.hi] : []), ...(spec.refLines || []).map((r) => r.y), ...(spec.y.zero != null ? [spec.y.zero] : [])];
  let dpT;
  const fmtTick = spec.y.tick || ((t, top) => (log ? K.fmt(t, "int", { dp: dpT ?? 0 }) : K.num(t, { dp: dpT ?? spec.y.dp ?? 0, sign: spec.y.sign })) + (top ? spec.y.unit || "" : ""));

  // Axis column: widest tick or reference label.
  const refNames = (spec.refLines || []).map((r) => r.name).filter(Boolean);  // the band is named inside itself
  const bottom = plot.y + plot.h - fa.size - gap("axis_label");

  // End labels: a right gutter only when two or more named series end there; a single end label
  // becomes a callout instead (a gutter for one label is wasted width).
  const ends = spec.series.filter((s) => s.end);
  const gutter = ends.length >= 2;
  const endW = gutter ? d3.max(ends, (s) => K.labelSize(s.end.value, s.end.name).w) + gap("label_mark") : 0;
  let y, x, gutterL;
  const build = (top) => {
    // Ticks cover the data; the domain stretches to a round tick only when that costs at most half a step.
    const [lo, hi] = spec.y.domain || d3.extent(yVals);
    const tk = log ? K.logTicks(lo, hi, bottom - top) : K.ticks(lo, hi, bottom - top, undefined, spec.y.hug ? [0.25, 0.25] : [K.AX.y_cover, K.AX.y_cover], Math.min((spec.y.ticksMax ?? K.AX.ticks_max), K.AX.ticks_max + 1));  // the outer gridlines cap the data
    y = (log ? d3.scaleLog : d3.scaleLinear)(spec.y.domain || tk.domain, [bottom, top]);
    const ticks = tk.ticks.filter((t) => t >= y.domain()[0] - 1e-9 && t <= y.domain()[1] + 1e-9);
    dpT = K.tickDp(ticks, spec.y.dp ?? 0);
    gutterL = d3.max([...ticks.map((t) => textWidth(svg, fmtTick(t, t === d3.max(ticks)), fa)), ...refNames.map((n) => textWidth(svg, n, fl))]) + gap("axis_label");
    x = (spec.x.scale === "log" ? d3.scaleLog : d3.scaleLinear)(spec.x.domain, [plot.x + gutterL, plot.x + plot.w - endW]);
    return ticks;
  };
  // Shaded periods are named in a row above the plot, so the names never sit on the lines.
  const shadeRow = shades.length ? fl.size + sp("s") : 0;
  let ticks = build(plot.y + shadeRow + fa.size * 0.4);  // just room for the top tick label to centre on its line
  dpT = K.tickDp(ticks, spec.y.dp ?? 0);

  // Shaded periods, then the reference band (behind everything), then the envelope, then gridlines.
  for (const sh of shades) {
    const x0 = Math.max(x.range()[0], x(sh.from)), x1 = Math.min(x.range()[1], x(sh.to));
    g.append("rect").attr("class", "shade").attr("x", x0).attr("width", Math.max(mk.min_mark, x1 - x0)).attr("y", y.range()[1]).attr("height", y.range()[0] - y.range()[1])
      .attr("fill", ink.band).attr("data-device", "shaded");
    if (sh.name) K.text(g, x0, plot.y + fl.size * 0.8, sh.name, fl, fl.color, x0 + textWidth(svg, sh.name, fl) > x.range()[1] ? "end" : "start");
  }
  if (spec.refBand) {
    const bx0 = x(spec.refBand.from ?? spec.x.domain[0]);
    g.append("rect").attr("class", "ref-band").attr("x", bx0).attr("width", x.range()[1] - bx0)
      .attr("y", y(spec.refBand.hi)).attr("height", y(spec.refBand.lo) - y(spec.refBand.hi)).attr("fill", ink.band).attr("data-device", "shaded");
  }
  if (spec.band) {
    g.append("path").datum(spec.band.points).attr("class", "band").attr("fill", ink.band).attr("data-device", "shaded")
      .attr("d", d3.area().x((d) => x(d.x)).y0((d) => y(d.lo)).y1((d) => y(d.hi)).curve(d3.curveMonotoneX));
  }
  // Ticks that would crowd a reference label are dropped (the reference reads like a tick itself), except
  // zero: the zero label always stays, and a reference name that crowds it moves away from zero just far
  // enough to clear it, still beside its own dashed line (oni_band: El Niño and La Niña at ±0.5°C).
  const zeroT = log ? null : spec.y.zero ?? 0, clearY = fa.size * 1.3;
  const refYs = (spec.refLines || []).map((r) => r.y);
  const shown = ticks.filter((t) => t === zeroT || refYs.every((r) => Math.abs(y(t) - y(r)) > clearY));
  const refLabelY = (r) => {
    if (zeroT == null || !ticks.includes(zeroT)) return y(r.y);
    const d = y(r.y) - y(zeroT);
    return Math.abs(d) >= clearY ? y(r.y) : y(zeroT) + Math.sign(d || -1) * clearY;
  };
  const dataY = d3.extent(all, (p) => p.y);
  K.yGrid(g, y, ticks, { x0: x.range()[0], x1: x.range()[1], fmt: (t) => fmtTick(t, t === d3.max(ticks)), zero: log ? NaN : spec.y.zero ?? 0,
    data: dataY, hide: ticks.filter((t) => !shown.includes(t)), scale: log ? "log" : null });
  for (const r of spec.refLines || []) {
    K.refLine(g, x.range()[0], y(r.y), x.range()[1], y(r.y));
    K.text(g, x.range()[0] - gap("axis_label"), refLabelY(r) + fl.size * 0.35, r.name, fl, fl.color, "end");
  }

  const curves = { monotone: d3.curveMonotoneX, linear: d3.curveLinear, step: d3.curveStepAfter };
  const order = { context: 0, compare: 1, hero: 2 };
  const drawn = [];
  // Area fills (drawdowns) sit under every line.
  const y0v = spec.y.zero ?? 0;
  for (const s of spec.series.filter((s) => s.fill)) {
    g.append("path").datum(s.points.filter((p) => p.y != null)).attr("class", "area").attr("fill", ink.context_fill)
      .attr("d", d3.area().x((d) => x(d.x)).y0(y(y0v)).y1((d) => y(d.y)).curve(curves[s.curve || "monotone"]));
  }
  for (const s of [...spec.series].sort((a, b) => order[a.role] - order[b.role])) {
    const line = d3.line().defined((d) => d.y != null).x((d) => x(d.x)).y((d) => y(d.y)).curve(curves[s.curve || "monotone"]);
    const p = K.series(g, s.points, line, s.role, s.color, { dense: s.points.length > (x.range()[1] - x.range()[0]) / 2 });
    p.attr("data-id", s.id);
    if (s.dashed) p.attr("stroke-dasharray", `${sp("s")} ${sp("xs")}`).attr("stroke-linecap", "butt").attr("data-device", "dashed");
    drawn.push({ s, node: p.node() });
  }
  // Observation dots (sparse series): hero dots in the series colour, others in their line's grey.
  for (const s of spec.series.filter((s) => s.dots)) {
    const col = s.color || (s.role === "hero" ? C.line_hero : s.role === "compare" ? ink.compare : ink.context);
    for (const p of s.points.filter((p) => p.y != null))
      K.dot(g, x(p.x), y(p.y), col, s.role === "hero" ? mk.dot : mk.dot_small).attr("class", "obs-dot").attr("data-role", s.role);
  }
  // End dots on hero series.
  for (const s of spec.series.filter((s) => s.role === "hero")) {
    const e = s.points.filter((p) => p.y != null).at(-1);
    K.dot(g, x(e.x), y(e.y), s.color || C.line_hero, mk.dot);
  }

  // Every line in pixels, for label placement.
  const linesPx = spec.series.map((s) => s.points.map((p) => [x(p.x), p.y == null ? null : y(p.y)]));
  if (spec.band) { linesPx.push(spec.band.points.map((p) => [x(p.x), y(p.hi)])); }
  // Labels must also stay off the baseline and reference lines.
  for (const yy of [spec.y.zero ?? 0, ...(spec.refLines || []).map((r) => r.y)])
    if (yy >= y.domain()[0] && yy <= y.domain()[1]) linesPx.push([[x.range()[0], y(yy)], [x.range()[1], y(yy)]]);
  const taken = [];
  // The target band is named inside itself, just under its top edge (or over its bottom edge), at the
  // first spot from its left end that is clear of every line; a tick-like label in the axis column
  // read as a value and pushed the real tick out.
  if (spec.refBand?.name) {
    const nm = spec.refBand.name, w = textWidth(svg, nm, fl), pad = sp("s"), bx0 = x(spec.refBand.from ?? spec.x.domain[0]);
    const rows = [y(spec.refBand.hi) + pad, y(spec.refBand.lo) - pad - fl.size];
    let spot = null;
    for (let lx = bx0 + pad; !spot && lx + w <= x.range()[1] - pad; lx += sp("s"))
      for (const ty of rows) {
        const box = { l: lx, r: lx + w, t: ty, b: ty + fl.size };
        if (clearOfLines(box, linesPx.map((pts) => pts.filter((p) => p[1] != null).map(([px, py]) => ({ x: px, y: py }))), (v) => v, (v) => v, sp("xs"))) { spot = box; break; }
      }
    if (!spot) spot = { l: bx0 + pad, r: bx0 + pad + w, t: rows[0], b: rows[0] + fl.size };
    K.text(g, spot.l, spot.t + fl.size * 0.8, nm, fl, fl.color, "start");  // on the band, no white knockout
    taken.push(spot);
  }
  const bounds = { l: x.range()[0], r: plot.x + plot.w, t: plot.y, b: bottom - sp("s") };

  if (gutter) {
    const items = ends.map((s) => { const e = s.points.filter((p) => p.y != null).at(-1); const sz = K.labelSize(s.end.value, s.end.name);
      return { s, sz, target: y(e.y) - sz.h / 2 }; });
    const placed = dodge(items, 0, plot.y, bottom - sp("s"));  // positions, then spread by real heights
    placed.sort((a, b) => a.target - b.target);
    for (let i = 1; i < placed.length; i++) placed[i].pos = Math.max(placed[i].pos, placed[i - 1].pos + placed[i - 1].sz.h + sp("s"));
    const lx = x.range()[1] + gap("label_mark");
    for (const it of placed) K.label(g, lx, it.pos, it.s.end.value, it.s.end.name);
  }
  // Is a box wholly inside a filled area (true), wholly outside (false) or across its edge (null)?
  const fills = spec.series.filter((s) => s.fill).map((s) => s.points.filter((p) => p.y != null));
  const inFill = (b) => {
    if (!fills.length) return false;
    const pad = sp("xs"), xs = d3.range(7).map((i) => b.l - pad + ((b.r - b.l + 2 * pad) * i) / 6);
    let inside = 0, outside = 0;
    for (const pts of fills) for (const px of xs) {
      const xv = x.invert(px), i = d3.bisector((d) => d.x).left(pts, xv);
      if (i <= 0 || i >= pts.length) { outside += 2; continue; }
      const a = pts[i - 1], c = pts[i], t = (xv - a.x) / (c.x - a.x || 1), yy = y(a.y + (c.y - a.y) * t), z = y(y0v);
      const [top, bot] = [Math.min(yy, z), Math.max(yy, z)];
      for (const py of [b.t - pad, b.b + pad]) (py >= top && py <= bot ? inside++ : outside++);
    }
    return outside === 0 ? true : inside === 0 ? false : null;
  };
  const callouts = [...(spec.callouts || [])];
  if (!gutter && ends.length === 1) {
    const s = ends[0], e = s.points.filter((p) => p.y != null).at(-1);
    callouts.unshift({ x: e.x, y: e.y, value: s.end.value, name: s.end.name, prefer: ["n", "nw", "w", "sw", "s", "ne", "e", "se"], dot: false });  // east last: a line that stops mid-plot has room there
  }
  // Is a box wholly inside the envelope band (true), wholly outside it (false) or across its edge (null)?
  const inBand = (b) => {
    if (!spec.band) return false;
    const at = (px) => { const xv = x.invert(px), pts = spec.band.points, i = Math.max(1, d3.bisector((d) => d.x).left(pts, xv));
      const a = pts[Math.min(i, pts.length - 1) - 1], c = pts[Math.min(i, pts.length - 1)], t = c.x === a.x ? 0 : Math.max(0, Math.min(1, (xv - a.x) / (c.x - a.x)));
      return [y(a.hi + (c.hi - a.hi) * t), y(a.lo + (c.lo - a.lo) * t)]; };
    const pad = sp("xs"), xs = d3.range(5).map((i) => b.l - pad + ((b.r - b.l + 2 * pad) * i) / 4);
    const ins = xs.flatMap((px) => { const [top, bot] = at(px); return [b.t - pad >= top && b.b + pad <= bot, b.b + pad < top || b.t - pad > bot]; });
    const inside = ins.filter((_, i) => i % 2 === 0).every(Boolean), outside = ins.filter((_, i) => i % 2 === 1).every(Boolean);
    return inside ? true : outside ? false : null;
  };
  for (const c of callouts) {
    const names = Array.isArray(c.name) ? c.name : [c.name];  // name variants, longest first
    let layout = "stack", nm = names[0], sz;
    const ax = x(c.x), ay = y(c.y);
    // A spot is refused when its leader would cut through a label already placed, or through a data line
    // (a leader across another series reads as pointing at it). Segments that touch the anchor are its own line.
    const near = sp("s");
    const cross = (x1, y1, x2, y2, x3, y3, x4, y4) => {
      const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
      if (!d) return false;
      const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
      return t > 0 && t < 1 && u >= 0 && u <= 1;
    };
    const cutsLine = (ex, ey) => linesPx.some((pts) => pts.some((p, i) => {
      const q = pts[i + 1];
      if (!q || p[1] == null || q[1] == null) return false;
      if (Math.hypot(p[0] - ax, p[1] - ay) < near || Math.hypot(q[0] - ax, q[1] - ay) < near) return false;
      return cross(ax, ay, ex, ey, p[0], p[1], q[0], q[1]);
    }));
    let strict = true;  // first pass: leaders clear of data lines; last resort: as before (labels never cut, lines may be)
    const accept = (at) => { const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear")); return !Kit.segHits(ax, ay, ex, ey, taken) && !(strict && cutsLine(ex, ey)) && inBand(at.box) !== null && inFill(at.box) !== null; };
    const placeAt = () => Kit.place({ ax, ay, w: sz.w, h: sz.h, bounds, lines: linesPx, taken, pad: sp("s"), prefer: c.prefer, step: sp("xs"), minD: gap("label_mark"), maxD: c.near ? sp("3xl") : plot.h, accept });
    const tryAs = (n, l) => { nm = n; layout = l; sz = K.labelSize(c.value, n, l); return placeAt(); };
    // For each name variant: the stacked pair, then one line (value, then name), which fits shallow gaps;
    // all with leaders clear of data lines.
    let at = null;
    for (const n of names) { at = tryAs(n, "stack") || (c.value && n ? tryAs(n, "inline") : null); if (at) break; }
    // Still nothing: the stacked pair on a leader that may cross a line, which beats an unnamed line.
    if (!at) { strict = false; for (const n of names) { at = tryAs(n, "stack"); if (at) break; } }
    if (!at && c.optional) continue;  // a nice-to-have label is dropped where it cannot fit cleanly
    if (!at) throw new Error(`LAYOUT: no clear space for the label "${names[0] || c.value}"`);
    taken.push(at.box);
    const anchor = "start";
    const leaderFrom = linesPx.length;
    // A label sits wholly on the shaded band or wholly off it, with a knockout of the same colour
    // as what it sits on, so it never reads as a white sticker on the band.
    K.label(g, at.x, at.y, c.value, nm, { layout, anchor, knockoutFill: inBand(at.box) ? ink.band : inFill(at.box) ? ink.context_fill : C.surface });
    // Leader from the block's nearest edge to the point, when the block is not right next to it.
    // Leader from the point to the block's nearest edge, when it is long enough to see (K.leader refuses stubs).
    const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear"));
    const ang = Math.atan2(ey - ay, ex - ax), r0 = mk.dot_small + gap("leader_clear");
    if (K.leader(g, [[ax + Math.cos(ang) * r0, ay + Math.sin(ang) * r0], [ex, ey]])) linesPx.push([[ax, ay], [ex, ey]]);  // later labels keep off it
    if (c.dot) K.dot(g, ax, ay, ink.leader, mk.dot_small, false);
  }

  // Time ticks by default; the first and last labels are kept inside the plot. An edge label pulled inside
  // can crowd its neighbour (long quarter names on 16:9): an inner label closer than sp("l") to the one before
  // it or to the last label is dropped, so the ends (where the data starts and stops) are always named.
  const xt = spec.x.ticks || K.timeTicks(spec.x.domain[0], spec.x.domain[1], x.range()[1] - x.range()[0]);
  const xl = xt.map((t) => {
    const w = textWidth(svg, t.label, fa), cx = x(t.at);
    const anchor = t.anchor || (cx - w / 2 < plot.x ? "start" : cx + w / 2 > plot.x + plot.w ? "end" : "middle");
    const at = anchor === "start" ? Math.max(plot.x, cx - w / 2) : cx;
    const l = anchor === "start" ? at : anchor === "end" ? at - w : at - w / 2;
    return { t, at, anchor, l, r: l + w };
  });
  const kept = xl.filter((b, i) => i === 0 || i === xl.length - 1);
  for (const b of xl.slice(1, -1)) {
    const prevR = d3.max(kept.filter((k) => k.l <= b.l), (k) => k.r) ?? -Infinity, last = xl.at(-1);
    if (b.l >= prevR + sp("l") && b.r + sp("l") <= last.l) kept.push(b);
  }
  for (const b of xl.filter((b) => kept.includes(b)))
    K.text(g, b.at, bottom + gap("axis_label") + fa.size * 0.8, b.t.label, fa, fa.color, b.anchor === "start" ? "start" : b.anchor);

  // Encoding: each series' drawn extent must equal its data extent mapped with plain arithmetic.
  const lx = spec.x.scale === "log" ? ((v) => K.lin(Math.log10(spec.x.domain[0]), Math.log10(spec.x.domain[1]), ...x.range())(Math.log10(v))) : K.lin(...spec.x.domain, ...x.range());
  const ly = log ? ((v) => K.lin(Math.log10(y.domain()[0]), Math.log10(y.domain()[1]), ...y.range())(Math.log10(v))) : K.lin(...y.domain(), ...y.range());
  const checks = [];
  for (const { s, node } of drawn) {
    const pts = s.points.filter((p) => p.y != null), b = node.getBBox();
    checks.push([`${s.id} left`, b.x, lx(d3.min(pts, (p) => p.x))], [`${s.id} right`, b.x + b.width, lx(d3.max(pts, (p) => p.x))],
      [`${s.id} top`, b.y, ly(d3.max(pts, (p) => p.y))], [`${s.id} bottom`, b.y + b.height, ly(d3.min(pts, (p) => p.y))],
      [`${s.id} colour`, node.getAttribute("stroke"), s.color || (s.role === "hero" ? C.line_hero : s.role === "compare" ? C.line_mid : C.line_bg)]);
  }
  K.assert("line positions", checks, 1.0);
  return { x, y, g, K };
};
