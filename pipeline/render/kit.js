// House kit: the marks, axes, labels and checks every template shares, so every chart speaks
// one visual language. Loaded after frame.js. Usage inside a template: const K = Kit(F).
//
// The visual grammar, as code (theme "grammar" holds the values; CLAUDE.md has the rules in words):
// - Type roles: K.fs (label_strong), K.fl (label), K.fv (value), K.fa (axis), K.fn (annotation).
//   Each carries its colour; K.text defaults to it. Chart text is tabular (frame CSS).
// - Ink: K.ink.compare / total / context / context_fill / reference / baseline / leader / grid / band.
//   Only hero marks carry hue (series colour); everything else is one of these greys.
// - Spacing: K.sp("m") etc. (grammar.space steps × k) and K.gap("label_mark") (named uses). No other
//   pixel constants in templates (lint_code checks).
// - Marks: K.mk (grammar.mark × k where it is a length): bar ratio, minimum mark, dot sizes, leader minimum.
//   Strokes from theme.marks only: hero, compare, context, grid, baseline, leader (lint 'style').
// - Highlight: hero = series colour + strong label; compare = #9B9B9B; context = light grey, unlabelled.
// - Annotation: the label pair (value 600 ink, name 400 grey beneath), placed in open space or in a
//   lane, dashed deep-grey leader when not adjacent (never shorter than leader_min).
// - Axes: horizontal hairline gridlines only, zero line 1.5k, unit on the last tick, ticks from
//   K.ticks (cover the data, 3–6 of them, three label-heights apart). Reference lines dashed
//   reference grey, labelled in the axis column like a tick.
// - Every number goes through K.num (round half away from zero, true minus sign).
// Number and date formats: pure functions, usable before a Frame exists (chart copy) and inside
// templates (K.num and K.fmt are these same functions). One rounding rule for everything shown.
window.Fmt = (function () {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Round half away from zero (JS toFixed rounds binary floats, so 0.125 -> "0.13" is not
  // guaranteed); true minus; optional explicit plus; optional unit.
  function num(v, { dp = 2, sign = false, unit = "" } = {}) {
    const p = 10 ** dp, r = Math.sign(v) * Math.round(Math.abs(v) * p + 1e-9) / p;
    const s = Math.abs(r).toFixed(dp);
    return `${r < 0 ? "−" : sign && r > 0 ? "+" : ""}${s}${unit}`;
  }

  // Finance and economics formats, all through num (one rounding rule). kind:
  //   pct      5.22%            pp   +0.50 points (difference of two rates; sign by default)
  //   bps      47 bps           x    11.9x (a multiple)
  //   inr      ₹94.94           int  23,675 (Indian digit grouping: 1,23,45,678; for rupees and Indian counts)
  //   usd      $100,000         intl 100,000 (international grouping: foreign currencies and foreign counts)
  //   inr_cr   ₹3.96 lakh crore / ₹12,345 crore (input in crore)
  //   usd_tn   $3.96 trillion   level  23,675.30 (an index level, grouped)
  // opts: dp, sign. Units are words a reader knows; "pp", "bps" and "YoY" stay off headlines (chart-copy).
  const group = (s) => { const [i, d] = s.split("."); const last3 = i.slice(-3), rest = i.slice(0, -3);
    return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3 + (d ? "." + d : ""); };
  function fmt(v, kind = "num", { dp, sign } = {}) {
    const n = (d, sg = sign) => num(v, { dp: d, sign: sg });
    const grouped = (d, sg = sign) => { const s = n(d, sg), m = s.match(/^([−+]?)(.*)$/); return m[1] + group(m[2]); };
    switch (kind) {
      case "pct": return n(dp ?? 1) + "%";
      case "pp": return n(dp ?? 2, sign ?? true) + (Math.abs(v) === 1 ? " point" : " points");
      case "bps": return n(dp ?? 0, sign) + " bps";
      case "x": return n(dp ?? 1) + "x";
      case "inr": return (v < 0 ? "−" : "") + "₹" + grouped(dp ?? 2, false).replace(/^−/, "");
      case "int": return grouped(dp ?? 0);
      case "intl": { const t = n(dp ?? 0), m = t.match(/^([−+]?)(\d+)(\.\d+)?$/); return m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[3] || ""); }
      case "usd": return (v < 0 ? "−" : "") + "$" + fmt(Math.abs(v), "intl", { dp: dp ?? 0 });
      case "level": return grouped(dp ?? 2);
      case "inr_cr": return Math.abs(v) >= 1e5 ? `₹${num(v / 1e5, { dp: dp ?? 2, sign })} lakh crore` : `₹${grouped(dp ?? 0)} crore`;
      case "usd_tn": return `$${n(dp ?? 2)} trillion`;
      default: return n(dp ?? 2);
    }
  }

  // "2020-03-23" or "2020-03" -> decimal year (mid-day / mid-month), for numeric time axes.
  const decYear = (s) => { const [y, m = 1, d] = s.split("-").map(Number); if (d == null) return y + (m - 1) / 12;
    const t0 = Date.UTC(y, 0, 1), t1 = Date.UTC(y + 1, 0, 1); return y + (Date.UTC(y, m - 1, d) - t0) / (t1 - t0); };
  const monthName = (s, long = false) => { const [y, m, d] = s.split("-").map(Number);
    const L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${d ? d + " " : ""}${long ? L[m - 1] : MON[m - 1]} ${y}`; };
  return { num, fmt, group, decYear, monthName };
})();

window.Kit = function Kit(F) {
  const { num, fmt, group, decYear, monthName } = Fmt;
  const { svg, C, k, T } = F;
  const M = { hero: 3.5, compare: 2, context: 1, grid: 1, baseline: 1.5, leader: 1, halo: 3, dot: 5, ...(T.marks || {}) };
  const G = T.grammar || {};
  const SP = { "2xs": 2, xs: 4, s: 8, m: 12, l: 16, xl: 24, "2xl": 32, "3xl": 48, ...(G.space || {}) };
  const GAPS = G.gaps || {};
  const sp = (name) => { if (!(name in SP) || name.startsWith("_")) throw new Error(`GRAMMAR: no spacing step "${name}"`); return SP[name] * k; };
  const gap = (use) => sp(GAPS[use] || { label_mark: "s", value_name: "xs", leader_clear: "xs", axis_label: "m", row_label: "m",
    panel_x: "2xl", panel_y: "xl", column: "3xl", legend_item: "xl", section_min: "m" }[use]);
  const ink = { compare: C.line_mid, total: C.label, context: C.line_bg, context_fill: C.line_bg, reference: C.label, baseline: C.label,
    leader: C.leader, grid: C.grid, band: C.band, ...Object.fromEntries(Object.entries(G.ink || {}).filter(([n, v]) => !n.startsWith("_") && /^#/.test(v))) };
  const MK0 = { bar_ratio: 0.62, bar_max: 64, min_mark: 3, corner: 0, cell_corner: 2, cell_gap: 3, dot: M.dot, dot_hero: 6, dot_small: 3.5,
    swarm_dot_max: 34, swarm_dot_min: 4, leader_min: 16, halo: M.halo, ...(G.mark || {}) };
  // Lengths scale with k; ratios do not.
  const mk = Object.fromEntries(Object.entries(MK0).filter(([n]) => !n.startsWith("_")).map(([n, v]) => [n, n.endsWith("ratio") ? v : v * k]));
  const AX = { label_gap: 3, ticks_min: 3, ticks_max: 6, stretch_max: 0.5, y_cover: 1, touch: 0.1, ...(G.axis || {}) };
  const role = (key, fallback) => { const f = F.font(T.type[key] ? key : fallback); return f; };
  const fa = role("axis"), fl = role("label"), fs = role("label_strong"), fv = role("value", "label_strong"), fn = role("annotation", "label");
  const sw = (r) => M[r] * k;

  // Log-axis ticks: 1-2-5 per decade (or 1-3, or 1 only, or every other decade) so labels stay
  // label_gap label-heights apart. Domain stretches to the covering ticks. Returns { ticks, domain }.
  function logTicks(lo, hi, px, per = fa.size * AX.label_gap) {
    const d0 = Math.floor(Math.log10(lo)), d1 = Math.ceil(Math.log10(hi));
    for (const mant of [[1, 2, 5], [1, 3], [1], [1, "skip"]]) {
      const all = [];
      for (let d = d0 - 1; d <= d1 + 1; d++) {
        if (mant[1] === "skip") { if (d % 2 === 0) all.push(10 ** d); continue; }
        for (const m of mant) all.push(+(m * 10 ** d).toPrecision(6));
      }
      const below = all.filter((t) => t <= lo * (1 + 1e-9)).at(-1), above = all.filter((t) => t >= hi * (1 - 1e-9))[0];
      const ticks = all.filter((t) => t >= below && t <= above);
      // Ends: stretch to the covering tick when it is close (in log space, half a step); else pad the data
      // end by 4% of the range, so the outermost point never sits on the axis edge (no gridline is drawn
      // there, so the end need not be round).
      const ld = (t) => Math.log10(t);
      const minStep = d3.min(ticks.slice(1), (t, i) => ld(t) - ld(ticks[i])) || 1;
      const padL = 0.04 * (ld(hi) - ld(lo));
      const domain = [ld(lo) - ld(below) <= minStep / 2 ? below : 10 ** (ld(lo) - padL), ld(above) - ld(hi) <= minStep / 2 ? above : 10 ** (ld(hi) + padL)];
      const shown = ticks.filter((t) => t >= domain[0] * (1 - 1e-9) && t <= domain[1] * (1 + 1e-9));
      const pxPer = px / (ld(domain[1]) - ld(domain[0]));
      if (shown.length >= 2 && shown.length <= AX.ticks_max + 1 && d3.min(shown.slice(1), (t, i) => (ld(t) - ld(shown[i])) * pxPer) >= per) return { ticks: shown, domain };
    }
    return { ticks: [lo, hi], domain: [lo, hi] };
  }

  // Time ticks on a decimal-year axis: the smallest year step (1, 2, 5, 10, 20, 25, 50) whose labels
  // (full years, never '08) leave at least two label-widths of air; spans under three years use months.
  // Ticks sit on round years (multiples of the step). Returns [{ at, label }].
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function timeTicks(a, b, px, { minGap = sp("3xl") } = {}) {
    const wYear = textWidth(svg, "2000", fa) + minGap;
    if (b - a < 3) {
      const wMon = textWidth(svg, "Sep 2000", fa) + minGap;
      for (const step of [1, 2, 3, 6]) {
        const out = [];
        for (let m = Math.ceil(a * 12 - 1e-9); m <= b * 12 + 1e-9; m++) if (m % step === 0) out.push({ at: m / 12, label: `${MON[m % 12]} ${Math.floor(m / 12)}` });
        if (out.length >= 2 && (px * step) / 12 / (b - a) >= wMon) return out;
      }
    }
    for (const step of [1, 2, 5, 10, 20, 25, 50]) {
      if ((px * step) / (b - a) < wYear) continue;
      const out = [];
      for (let y = Math.ceil(a / step - 1e-9) * step; y <= b + 1e-9; y += step) out.push({ at: y, label: String(y) });
      if (out.length >= 2) return out;
    }
    return [{ at: Math.ceil(a), label: String(Math.ceil(a)) }, { at: Math.floor(b), label: String(Math.floor(b)) }];
  }
  // Decimals a tick list needs (0.5 steps need one), never fewer than asked for.
  const tickDp = (ticks, dp = 0) => Math.max(dp, ...ticks.map((t) => (String(+t.toFixed(6)).split(".")[1] || "").length));
  // Word hyphens become U+2010: Inter's tabular-figures feature (on for chart text) widens U+002D,
  // which spaces "10-year" out as "10 - year".
  const typo = (str) => String(str).replace(/(\w)-(?=\w)/g, "$1\u2010");
  const text = (g, x, y, str, f, fill = f.color || C.ink2, anchor = "start") => g.append("text").attr("x", x).attr("y", y)
    .attr("text-anchor", anchor).attr("font-family", f.family).attr("font-size", f.size).attr("font-weight", f.weight)
    .attr("fill", fill).text(typo(str));

  // Ticks that cover the data. The smallest round step (1, 2, 5 × 10^n; 2.5 × 10^n from 25 up) whose labels stay
  // label_gap label-heights apart (per px) and give at most ticks_max ticks; the domain stretches to
  // the next round tick when that costs at most stretch_max of a step; y axes pass [y_cover, y_cover]
  // (a full step) so the data never runs past a horizontal gridline. Returns { ticks, domain, step }.
  // stretch: how much of a step the domain may grow at each end, [low end, high end].
  // max: the most ticks allowed (theme axis.ticks_max); a chart may raise it by one when named reference
  // lines sit close to zero and the coarser step would push the zero label out (oni_band).
  function ticks(lo, hi, px, per = fa.size * AX.label_gap, stretch = [AX.stretch_max, AX.stretch_max], max = AX.ticks_max) {
    if (!(hi > lo)) return { ticks: [lo], domain: [lo, hi], step: 1 };
    const [sLo, sHi] = Array.isArray(stretch) ? stretch : [stretch, stretch];
    const e0 = Math.floor(Math.log10(hi - lo)) - 2;
    let roomiest = null;
    // 2.5 only from 25 up, so tick labels stay whole numbers (25, 250, 2,500; never 2.5 or 0.25).
    for (let e = e0; e <= e0 + 4; e++) for (const m of e >= 1 ? [1, 2, 2.5, 5] : [1, 2, 5]) {
      const step = m * 10 ** e, eps = step * 1e-9;
      let a = Math.ceil(lo / step - 1e-9) * step, b = Math.floor(hi / step + 1e-9) * step, dlo = lo, dhi = hi;
      // Data within `touch` of a step past a tick reads as touching that gridline: no extra step for it.
      const tch = Math.max(eps, AX.touch * step);
      if (a - lo > tch && lo - (a - step) <= sLo * step + eps) { a -= step; dlo = a; }
      if (hi - b > tch && b + step - hi <= sHi * step + eps) { b += step; dhi = b; }
      const n = Math.round((b - a) / step) + 1;
      if (n < 2 || a - dlo > step / 2 + eps || dhi - b > step / 2 + eps) continue;  // must cover the data
      const cand = { ticks: d3.range(n).map((i) => +(a + i * step).toFixed(10)), domain: [dlo, dhi], step, room: px * step / (dhi - dlo) };
      if (n <= max && cand.room >= per) return cand;
      if (!roomiest || cand.room > roomiest.room) roomiest = cand;
    }
    // Nothing gives full breathing room (a short panel): the covering set with the most room.
    return roomiest || { ticks: [lo, hi], domain: [lo, hi], step: hi - lo };
  }
  // Axis metadata for lint 'grammar': the data extent and the tick values, on the axis group.
  const axisMeta = (g, data, tk, scale) => g.attr("data-axis", `${data[0]} ${data[1]}`).attr("data-ticks", tk.join(" ")).attr("data-scale", scale === "log" ? "log" : null);
  // Gridlines with labels in the axis column at xLabel (right-aligned). ticks: numbers; fmt(t, isTop).
  // data: [lo, hi] of the values plotted, recorded for the coverage check.
  function yGrid(g0, y, ticks, { x0, x1, xLabel = x0 - gap("axis_label"), fmt = (t) => num(t, { dp: 0 }), zero = 0, data, hide = [], scale } = {}) {
    const g = g0.append("g").attr("class", "axis y");
    if (data) axisMeta(g, data, ticks, scale);
    const top = d3.max(ticks);
    for (const t of ticks) {
      const base = t === zero;
      g.append("line").attr("class", base ? "baseline" : "grid").attr("x1", x0).attr("x2", x1).attr("y1", y(t)).attr("y2", y(t))
        .attr("stroke", base ? ink.baseline : ink.grid).attr("stroke-width", sw(base ? "baseline" : "grid"));
      if (!hide.includes(t)) text(g, xLabel, y(t) + fa.size * 0.35, fmt(t, t === top), fa, fa.color, "end");
    }
    return g;
  }
  // Vertical-axis twin for horizontal layouts (ranked dots, strips): gridlines down, labels on top.
  function xGrid(g0, x, ticks, { y0, y1, yLabel = y0 - gap("axis_label"), fmt = (t) => num(t, { dp: 0 }), zero = 0, unitLast = true, data, hide = [], scale } = {}) {
    const g = g0.append("g").attr("class", "axis x");
    if (data) axisMeta(g, data, ticks, scale);
    const last = d3.max(ticks);
    for (const t of ticks) {
      const base = t === zero;
      g.append("line").attr("class", base ? "baseline" : "grid").attr("x1", x(t)).attr("x2", x(t)).attr("y1", y0).attr("y2", y1)
        .attr("stroke", base ? ink.baseline : ink.grid).attr("stroke-width", sw(base ? "baseline" : "grid"));
      if (!hide.includes(t)) text(g, x(t), yLabel, fmt(t, unitLast && t === last), fa, fa.color, "middle");
    }
    return g;
  }
  // A reference line (India average, El Niño threshold, a target): dashed, reference grey, one
  // weight everywhere. Its name is written by the caller in the axis column, like a tick.
  function refLine(g, x1, y1, x2, y2) {
    return g.append("line").attr("class", "ref").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
      .attr("stroke", ink.reference).attr("stroke-width", sw("leader")).attr("stroke-dasharray", T.leader_dash);
  }
  // A bar from v0 to v1 along one axis, never thinner than the minimum mark (a +0.01 step still shows).
  function bar(g, a0, a1, c0, thick, fill, horizontal = true) {
    const lo = Math.min(a0, a1), len = Math.max(mk.min_mark, Math.abs(a1 - a0));
    const at = Math.abs(a1 - a0) < mk.min_mark ? (a0 + a1) / 2 - len / 2 : lo;
    const r = g.append("rect").attr("class", "bar").attr("fill", fill).attr("rx", mk.corner).attr("data-min", Math.abs(a1 - a0) < mk.min_mark ? 1 : null);
    return horizontal ? r.attr("x", at).attr("width", len).attr("y", c0 - thick / 2).attr("height", thick)
      : r.attr("y", at).attr("height", len).attr("x", c0 - thick / 2).attr("width", thick);
  }
  // As many ticks as fit with room to breathe (labels at least 3 label-heights apart).
  const tickCount = (px, per = fa.size * AX.label_gap) => Math.max(2, Math.min(AX.ticks_max, Math.floor(px / per)));

  // A dashed leader; refuses to draw a stub shorter than leader_min (the label should then sit
  // against its mark, or move to a lane where the leader can be seen).
  function leader(g, pts) {
    const len = d3.sum(pts.slice(1), (p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    if (len < mk.leader_min - 0.01) return null;
    return g.append("path").attr("class", "leader").attr("d", d3.line()(pts)).attr("fill", "none")
      .attr("stroke", ink.leader).attr("stroke-width", sw("leader")).attr("stroke-dasharray", T.leader_dash);
  }

  // A series line by role. Hero lines get a white halo so they read in front of everything.
  // Dense series (more than one point per 2px, e.g. 19 years of daily closes) draw a hero at compare
  // weight without the halo: at full weight the wiggles merge into a ribbon.
  function series(g, pts, line, role, color, { dense = false } = {}) {
    const stroke = color || (role === "hero" ? C.line_hero : role === "compare" ? ink.compare : ink.context);
    if (role === "hero" && dense) return g.append("path").datum(pts).attr("class", `series ${role} dense`).attr("d", line).attr("fill", "none").attr("stroke", stroke)
      .attr("stroke-width", sw("compare")).attr("stroke-linejoin", "round").attr("data-role", role);
    if (role === "hero") g.append("path").datum(pts).attr("class", "halo").attr("d", line).attr("fill", "none")
      .attr("stroke", C.surface).attr("stroke-width", sw("hero") + 2 * sw("halo")).attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    return g.append("path").datum(pts).attr("class", `series ${role}`).attr("d", line).attr("fill", "none").attr("stroke", stroke)
      .attr("stroke-width", sw(role)).attr("stroke-linejoin", "round").attr("stroke-linecap", "round").attr("data-role", role);
  }
  function dot(g, x, y, color, r = mk.dot, ring = true) {
    return g.append("circle").attr("cx", x).attr("cy", y).attr("r", r).attr("fill", color)
      .attr("stroke", ring ? C.surface : null).attr("stroke-width", ring ? sp("2xs") : null);
  }

  // The house label: value (semibold, ink) and name (regular, grey). layout "stack" puts the name
  // under the value; "inline" puts it after. Returns { w, h } and draws when g is given.
  function labelSize(value, name, layout = "stack") {
    const vw = value ? textWidth(svg, value, fs) : 0, nw = name ? textWidth(svg, name, fl) : 0;
    return layout === "inline" ? { w: vw + (value && name ? sp("s") : 0) + nw, h: fs.size * 1.1 }
      : { w: Math.max(vw, nw), h: (value ? fs.size : 0) + (value && name ? gap("value_name") : 0) + (name ? fl.size : 0) };
  }
  // (x, y) is the top-left of the block for anchor start; top-right for end; top-centre for middle.
  // Labels written over the plot get a knockout: a surface-coloured box a few px larger than the
  // text, so gridlines and bands never run through the words (knockout: false to skip).
  function label(g, x, y, value, name, { layout = "stack", anchor = "start", knockout = true, knockoutFill = C.surface } = {}) {
    const box = labelSize(value, name, layout);
    if (knockout) {
      const l = anchor === "start" ? x : anchor === "end" ? x - box.w : x - box.w / 2, p = sp("xs");
      g.append("rect").attr("class", "knockout").attr("x", l - p).attr("y", y - p / 2).attr("width", box.w + 2 * p)
        .attr("height", box.h + p * 2.5).attr("fill", knockoutFill);
    }
    if (layout === "inline") {
      const t = g.append("text").attr("x", x).attr("y", y + fs.size * 0.8).attr("text-anchor", anchor)
        .attr("font-family", fs.family).attr("font-size", fs.size).attr("font-weight", fs.weight).attr("fill", C.ink);
      if (value) t.append("tspan").text(typo(value));  // word hyphens as U+2010, as text() does
      if (name) t.append("tspan").attr("dx", value ? sp("s") : 0).attr("font-size", fl.size).attr("font-weight", fl.weight)
        .attr("fill", C.ink2).text(typo(name));
      return box;
    }
    let yy = y;
    if (value) { text(g, x, yy + fs.size * 0.8, value, fs, C.ink, anchor); yy += fs.size + gap("value_name"); }
    if (name) text(g, x, yy + fl.size * 0.8, name, fl, C.ink2, anchor);
    return box;
  }

  // Annotation: a sentence of plain text (annotation role, wrapped to maxW) placed in open space
  // near the mark it explains, with a leader when it is not against the mark. Same placement
  // rules as labels (Kit.place). Returns the placed box, or null when optional and nowhere fits.
  function annotationSize(str, maxW) {
    const tmp = svg.append("g");
    F.textBlock(tmp, str, fn, 0, 0, maxW, fn.color);
    const n = F.textBlock.lines, w = tmp.node().getBBox().width;
    tmp.remove();
    return { w, h: (n - 1) * fn.size * fn.leading + fn.size, n };
  }
  // Annotations stay near their mark: no further than six leader-minimums away (a long leader
  // across the chart reads as a second chart).
  function annotate(g, { ax, ay, str, maxW, bounds, taken = [], lines = [], prefer = ["e", "se", "s", "ne", "n"], optional = false, minD, maxD = mk.leader_min * 6, leader: withLeader = true }) {
    // The leader may not cross other marks or labels (the mark it starts from does not count).
    const others = taken.filter((b) => !(ax >= b.l && ax <= b.r && ay >= b.t && ay <= b.b));
    const accept = (at) => { if (!withLeader) return true; const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear")); return !Kit.segHits(ax, ay, ex, ey, others); };
    // Full measure first, then narrower ones (taller blocks fit beside marks a wide one cannot).
    let at = null;
    for (const f of [1, 0.75, 0.55]) {
      const sz = annotationSize(str, maxW * f);
      at = Kit.place({ ax, ay, w: sz.w, h: sz.h, bounds, lines, taken, pad: sp("s"), prefer, step: sp("xs"), minD: minD ?? gap("label_mark"), maxD, accept });
      if (at) { maxW *= f; break; }
    }
    if (!at) { if (optional) return null; throw new Error(`LAYOUT: no open space for the annotation "${str.slice(0, 40)}"`); }
    const ga = g.append("g").attr("class", "annotation");
    // A knockout, so gridlines and reference lines never run through the words.
    ga.append("rect").attr("class", "knockout").attr("x", at.box.l - sp("xs")).attr("y", at.box.t - sp("xs"))
      .attr("width", at.box.r - at.box.l + 2 * sp("xs")).attr("height", at.box.b - at.box.t + 2 * sp("xs")).attr("fill", C.surface);
    F.textBlock(ga, str, fn, at.x, at.y - fn.size * 0.1, maxW, fn.color);
    const [ex, ey] = Kit.leaderTo(ax, ay, at.box, gap("leader_clear"));
    if (withLeader) leader(ga, [[ax, ay], [ex, ey]]);
    taken.push(at.box);
    return at.box;
  }

  // Label lane: positions along one axis for blocks of different sizes, each as close to its
  // target as possible, none closer than minGap to the next, all within [lo, hi]. Overlapping
  // blocks merge into clusters centred on their targets' mean. items: [{ target, size }] (centres);
  // sets .pos (centre) on each and returns them sorted.
  function lane(items, lo, hi, minGap) {
    const s = [...items].sort((a, b) => a.target - b.target);
    // A cluster is laid out end to end; its start is the least-squares fit of its items' targets.
    const fit = (its) => {
      let o = 0; const offs = its.map((it) => { const c = o + it.size / 2; o += it.size + minGap; return c; });
      const size = o - minGap, start = Math.max(lo, Math.min(hi - size, d3.mean(its, (it, i) => it.target - offs[i])));
      return { items: its, size, start, offs };
    };
    let cl = s.map((it) => fit([it]));
    for (let i = 1; i < cl.length;) {
      if (cl[i - 1].start + cl[i - 1].size + minGap > cl[i].start + 1e-6) { cl.splice(i - 1, 2, fit([...cl[i - 1].items, ...cl[i].items])); i = Math.max(1, i - 1); }
      else i++;
    }
    for (const c of cl) c.items.forEach((it, i) => { it.pos = c.start + c.offs[i]; });
    return s;
  }

  // A single line of text written over the plot, on a knockout (so gridlines never run through it).
  function textOver(g, x, y, str, f, fill = f.color, anchor = "start") {
    const w = textWidth(svg, str, f), p = sp("xs"), l = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    g.append("rect").attr("class", "knockout").attr("x", l - p).attr("y", y - f.size * 0.85 - p / 2).attr("width", w + 2 * p)
      .attr("height", f.size * 1.1 + p).attr("fill", C.surface);
    return text(g, x, y, str, f, fill, anchor);
  }

  // Binned legend for ramps (tiles, maps, calendars): equal swatches, thresholds at the joins, an
  // optional marker for a reference value (e.g. India) and an optional "No figure" key (a dashed
  // outline). Horizontal: a strip, marker above, "No figure" to the right (or below when narrow).
  // Vertical: a column, highest bin on top, thresholds right, marker left.
  // opts = { thresholds, colors, unit, marker?: { value, name }, nofig?: true, vertical?, maxW? }.
  // binLegendSize(opts) measures; binLegend(g, x, y, opts) draws and returns { x, y, w, h, bottom }.
  const tickOf = (o, t, i) => `${t < 0 ? "−" : t > 0 && o.sign ? "+" : ""}${Math.abs(t)}${i === o.thresholds.length - 1 ? o.unit || "" : ""}`;
  function binLegendSize(o) {
    const nofigW = o.nofig ? sp("2xl") + sp("s") + textWidth(svg, "No figure", fl) : 0;
    const markW = o.marker ? textWidth(svg, o.marker.name, fl) : 0;
    const thW = d3.max(o.thresholds, (t, i) => textWidth(svg, tickOf(o, t, i), fa));
    const n = o.colors.length;
    if (o.vertical) {
      const bh = Math.max(sp("xl"), fa.size * 1.3), sw = sp("xl");
      return { vertical: true, bh, sw, n, markW, w: Math.max(markW + sp("l") + sw + sp("s") + thW, markW + sp("l") + nofigW), h: n * bh + (o.nofig ? sp("l") + bh : 0) };
    }
    const sw = Math.max(sp("3xl"), Math.min(sp("3xl") * 1.75, (Math.min(o.maxW ?? Infinity, sp("3xl") * 18) - nofigW - sp("2xl")) / n));
    const stripW = n * sw, below = stripW + sp("2xl") + nofigW > (o.maxW ?? Infinity);
    const top = o.marker ? fl.size + sp("xs") + sp("xs") + sp("2xs") + sp("s") : 0;  // name, gap, marker triangle
    const h = top + sp("m") + sp("s") + fa.size + (below && o.nofig ? sp("l") + sp("m") : 0);
    return { vertical: false, sw, n, below, top, w: below ? Math.max(stripW, nofigW) : stripW + sp("2xl") + nofigW, h };
  }
  function binLegend(g0, x, y, o) {
    const L = binLegendSize(o);
    const g = g0.append("g").attr("class", "legend").attr("data-ramp", 1);
    const { thresholds: th, colors } = o;
    const nofigKey = (nx, ny) => {
      g.append("rect").attr("x", nx).attr("y", ny).attr("width", sp("2xl")).attr("height", sp("m")).attr("fill", C.surface)
        .attr("stroke", ink.compare).attr("stroke-width", sw("context")).attr("stroke-dasharray", `${sp("xs")} ${sp("xs")}`);
      text(g, nx + sp("2xl") + sp("s"), ny + sp("m") / 2 + fl.size * 0.36, "No figure", fl, fl.color);
    };
    // Where the marker value falls along the bins (0..n), interpolated inside its bin.
    const pos = (v) => { const b = th.filter((t) => v >= t).length; if (b === 0 || b === th.length) return b; return b + (v - th[b - 1]) / (th[b] - th[b - 1]); };
    const tri = sp("xs") + sp("2xs");  // marker triangle half-width
    if (L.vertical) {
      const sx = x + L.markW + sp("l");
      colors.forEach((c, i) => g.append("rect").attr("x", sx).attr("y", y + (L.n - 1 - i) * L.bh).attr("width", L.sw).attr("height", L.bh - sp("2xs")).attr("fill", c));
      th.forEach((t, i) => text(g, sx + L.sw + sp("s"), y + (L.n - 1 - i) * L.bh + fa.size * 0.36, tickOf(o, t, i), fa, fa.color));
      if (o.marker) {
        const iy = y + (L.n - pos(o.marker.value)) * L.bh;
        g.append("path").attr("d", `M${sx - sp("xs")},${iy}L${sx - sp("xs") - tri},${iy - tri}V${iy + tri}Z`).attr("fill", ink.baseline);
        text(g, sx - sp("xs") - tri - sp("xs"), iy + fl.size * 0.36, o.marker.name, fl, fl.color, "end");
      }
      if (o.nofig) nofigKey(sx, y + L.n * L.bh + sp("l") + (L.bh - sp("m")) / 2);
      return { x, y, w: L.w, h: L.h, bottom: y + L.h };
    }
    const top = y + L.top;
    colors.forEach((c, i) => g.append("rect").attr("x", x + i * L.sw).attr("y", top).attr("width", L.sw - sp("2xs")).attr("height", sp("m")).attr("fill", c));
    th.forEach((t, i) => text(g, x + (i + 1) * L.sw - sp("2xs") / 2, top + sp("m") + sp("s") + fa.size * 0.8, tickOf(o, t, i), fa, fa.color, "middle"));
    if (o.marker) {
      const ix = x + pos(o.marker.value) * L.sw;
      g.append("path").attr("d", `M${ix},${top - sp("xs")}L${ix - tri},${top - sp("xs") - tri}H${ix + tri}Z`).attr("fill", ink.baseline);
      text(g, ix, top - sp("xs") - tri - sp("s"), o.marker.name, fl, fl.color, "middle");
    }
    if (o.nofig) { if (L.below) nofigKey(x, top + sp("m") + sp("s") + fa.size + sp("l")); else nofigKey(x + L.n * L.sw + sp("2xl"), top); }
    return { x, y, w: L.w, h: L.h, bottom: y + L.h };
  }

  // Encoding assertions: recompute what each mark should be from the data, with plain arithmetic
  // rather than the d3 scale that drew it, and fail the render on any mismatch.
  const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  function assert(what, pairs, tol = 0.75) {
    const bad = pairs.filter(([id, got, want]) => typeof want === "number" ? !(Math.abs(+got - want) <= tol) : String(got).toLowerCase() !== String(want).toLowerCase());
    if (bad.length) throw new Error(`ENCODING: ${what} wrong for ${bad.slice(0, 4).map(([id, g, w]) => `${id} (${g} vs ${w})`).join(", ")}`);
    return pairs.length;
  }

  // Box overlap, and a box list that refuses colliding entries (for label placement).
  const hits = (a, b, pad = 0) => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;

  return { M, sw, sp, gap, ink, mk, AX, fmt, group, logTicks, timeTicks, decYear, monthName, binLegend, binLegendSize, textOver, annotate, annotationSize, lane, num, tickDp, text, ticks, axisMeta, yGrid, xGrid, refLine, bar, tickCount, leader, series, dot, label, labelSize, lin, assert, hits, fa, fl, fs, fv, fn };
};

// Pixel polylines and boxes: is a label box clear of every line and every taken box?
// lines: arrays of [x, y] in px (straight segments; pad covers smoothing between points).
window.Kit.clearOf = function (box, lines, taken = [], pad = 6) {
  for (const b of taken) if (box.l < b.r + pad && b.l < box.r + pad && box.t < b.b + pad && b.t < box.b + pad) return false;
  for (const pts of lines) {
    for (let i = 1; i < pts.length; i++) {
      const [xa, ya] = pts[i - 1], [xb, yb] = pts[i];
      if (ya == null || yb == null) continue;
      if (Math.max(xa, xb) < box.l - pad || Math.min(xa, xb) > box.r + pad) continue;
      const n = Math.max(2, Math.ceil(Math.hypot(xb - xa, yb - ya) / 3));
      for (let j = 0; j <= n; j++) {
        const x = xa + ((xb - xa) * j) / n, y = ya + ((yb - ya) * j) / n;
        if (x >= box.l - pad && x <= box.r + pad && y >= box.t - pad && y <= box.b + pad) return false;
      }
    }
  }
  return true;
};

// Find a spot for a label block of size {w, h} near an anchor point: rings of increasing distance,
// preferred directions first. Returns {x, y (top-left), box, d} or null. bounds: {l, r, t, b}.
// accept(at) may veto a spot (e.g. when its leader would cross another label).
window.Kit.place = function ({ ax, ay, w, h, bounds, lines = [], taken = [], pad = 6, prefer = ["ne", "n", "nw", "e", "w", "se", "s", "sw"], step = 6, maxD = 600, minD = 10, accept = null }) {
  const dir = { n: [0, -1], ne: [0.7, -0.7], e: [1, 0], se: [0.7, 0.7], s: [0, 1], sw: [-0.7, 0.7], w: [-1, 0], nw: [-0.7, -0.7] };
  for (let d = minD; d <= maxD; d += step) {
    for (const p of prefer) {
      const [dx, dy] = dir[p];
      const px = ax + dx * d, py = ay + dy * d;
      // The block hangs off the point on the side it moved to.
      let l = dx > 0.3 ? px : dx < -0.3 ? px - w : px - w / 2;
      let t = dy > 0.3 ? py : dy < -0.3 ? py - h : py - h / 2;
      // A block beside the point may slide along its side to stay inside the bounds (a point at
      // the top edge gets its label just below the edge, not nowhere).
      if (p === "e" || p === "w") t = Math.max(bounds.t, Math.min(t, bounds.b - h));
      if (p === "n" || p === "s") l = Math.max(bounds.l, Math.min(l, bounds.r - w));
      const box = { l, r: l + w, t, b: t + h };
      if (box.l < bounds.l || box.r > bounds.r || box.t < bounds.t || box.b > bounds.b) continue;
      if (!window.Kit.clearOf(box, lines, taken, pad)) continue;
      const at = { x: l, y: t, box, d, dir: p };
      if (accept && !accept(at)) continue;
      return at;
    }
  }
  return null;
};

// Ink or white text for a given fill, whichever has more WCAG contrast.
window.textOn = function (bg, C) {
  const lum = (hex) => {
    const c = d3.rgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const L = lum(bg);
  return 1.05 / (L + 0.05) > (L + 0.05) / (lum(C.ink) + 0.05) ? "#FFFFFF" : C.ink;  // grammar-ok: white is the brand's text colour on dark fills
};

// Responsive form: try each attempt (a function that calls Frame and a template) in order of
// preference and keep the first that fits this format. A LAYOUT error discards that attempt's
// SVG and moves on; any other error is real and propagates.
window.firstFit = function (attempts) {
  let last;
  for (const a of attempts) {
    const before = new Set(document.querySelectorAll("svg"));
    try { return a(); } catch (e) {
      for (const s of document.querySelectorAll("svg")) if (!before.has(s)) s.remove();
      if (!String(e.message).includes("LAYOUT:")) throw e;
      last = e;
    }
  }
  throw last;
};

// Leader from a point to the nearest edge of a label box (both ends in px).
window.Kit.leaderTo = function (ax, ay, box, gap = 6) {
  const ex = ax < box.l ? box.l - gap : ax > box.r ? box.r + gap : ax;
  const ey = ay < box.t ? box.t - gap * 0.7 : ay > box.b ? box.b + gap * 0.7 : (box.t + box.b) / 2;
  return [ex, ey];
};
// Does segment (x0,y0)-(x1,y1) pass through any of the boxes? Sampled every 2px.
window.Kit.segHits = function (x0, y0, x1, y1, boxes) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (boxes.some((b) => x > b.l && x < b.r && y > b.t && y < b.b)) return true;
  }
  return false;
};
