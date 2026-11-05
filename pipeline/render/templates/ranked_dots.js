// Template: ranked dot plot, and dumbbell when rows carry a "from" value. One row per item, sorted,
// a dot at its value, a reference line for the average or the country. For rankings where the
// distance matters more than the order (states, funds, sectors); the dumbbell shows a change
// between two dates without the clutter of a slope chart's crossing lines.
//
// spec = {
//   v: { unit: "%", dp: 1, sign: false },
//   rows: [{ id, name, short?, code?, value, from?, role: "hero"|"context", color?, valueText? }],
//                                   // short / code: narrower names, used only when full names leave no room
//   ref?: { value, name },          // vertical dashed line, e.g. India
//   fromName?, toName?,             // dumbbell key, e.g. "Dec 2024", "Dec 2025" (drawn on the top row)
//   note?: { id, text, leader? },   // an annotation set in the open space beside a row's dot; leader: false
//                                   // when it speaks about a group of rows rather than that one
//   stems?: true,                   // each dot on a stem from the reference: the ranking reads as distance
//                                   // from it, and the reference (not zero) is the chart's baseline
//   band?: { lo, hi },              // a shaded band (e.g. within two points of India), data-device "shaded"
//   showValues: "ends" | "hero" | "all",  // value labels beside the dots: hero rows plus the top and
//                                          // bottom row ("ends", the default), hero only, or every row
// }
// Values sit beside their dots, not in a separate column (a column of numbers repeats the dots).
// Names are right-aligned against the plot so each sits next to its row. The reference line is named
// in the axis row, like a tick. Ticks cover the data (K.ticks).
// Rows need 1.1 lines of label text; too short a canvas splits the ranking into two columns. Names step
// down (full, then short, then code) until one or two columns leave room for the dots, else LAYOUT. Rows
// whose value is labelled (hero, ends) keep their full name at every step: they are the ones the copy names.
// On a wide plot where the list would need two columns, the ranking turns on its side (rankedColumns): a
// column per row, in rank order left to right, stems up or down from the reference, codes under the axis.
window.Templates = window.Templates || {};
window.Templates.ranked_dots = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart ranked-dots");
  const rows = [...spec.rows].sort((a, b) => b.value - a.value);
  const dumb = rows.some((r) => r.from != null);
  const stemsWanted = !!(spec.stems && spec.ref && !dumb);
  const heroF = fs, ctxF = fl;
  const axisH = fa.size + gap("axis_label");
  const keyH = dumb ? fl.size + sp("l") : 0;
  const top = plot.y + axisH + keyH;
  // Rows at 1.1 lines of label text, in one column, or two (same scale) when the canvas is too short.
  const need = fl.size * 1.1, avail = plot.y + plot.h - top, colGap = gap("column");
  // Rows with a value label: the hero plus the top and bottom row ("ends"), the hero only, or every row.
  const show = spec.showValues || "ends";
  const labelled = (r, i) => show === "all" || r.role === "hero" || (show === "ends" && (i === 0 || i === rows.length - 1));
  const levels = ["name", "short", "code"].filter((lv, i) => i === 0 || rows.some((r) => r[lv]));
  let L = null, why = "";
  for (const lv of levels) {
    const nameOf = (r, i) => (labelled(r, i) ? r.name : r[lv] || r.name);
    const nameW = d3.max(rows, (r, i) => textWidth(svg, nameOf(r, i), r.role === "hero" ? heroF : ctxF)) + sp("l");
    const cols = rows.length * need > avail ? 2 : 1;
    const perCol = Math.ceil(rows.length / cols), rowH = avail / perCol, colW = (plot.w - colGap * (cols - 1)) / cols;
    if (rowH < need) { why = `${rows.length} rows need ${Math.round(need * perCol)}px per column, have ${Math.round(avail)}px`; break; }
    if (colW < nameW + sp("3xl") * 6) { why = `${cols} columns of ${Math.round(colW)}px leave no room for the dots`; continue; }
    L = { nameOf, nameW, cols, perCol, rowH, colW };
    break;
  }
  if ((!L || L.cols === 2) && plot.w > plot.h && stemsWanted) {
    try { return rankedColumns(); } catch (e) {
      if (!L || !String(e.message).includes("LAYOUT:")) throw e;
      g.selectAll("*").remove();  // the list still fits: draw that instead
    }
  }
  if (!L) throw new Error(`LAYOUT: ${why}`);
  const { nameOf, nameW, cols, perCol, rowH, colW } = L;

  const valueText = (r) => r.valueText ?? K.num(r.value, { dp: spec.v.dp ?? 1, sign: spec.v.sign }) + (spec.v.unit || "");
  const vals = rows.flatMap((r) => [r.value, r.from]).filter((v) => v != null);
  const data = d3.extent(vals);
  const valF = (r) => (r.role === "hero" ? K.fv : fl);
  // Room beside the extreme dots for their values.
  const maxValW = d3.max(rows.filter(labelled), (r) => textWidth(svg, valueText(r), valF(r))) + gap("label_mark");
  const span = [nameW + sp("s"), colW - maxValW];
  const [lo, hi] = d3.extent([...vals, ...(spec.ref ? [spec.ref.value] : []), 0]);
  const tk = K.ticks(lo, hi, span[1] - span[0], textWidth(svg, "−00%", fa) + sp("2xl"));
  const x0 = d3.scaleLinear(tk.domain, span);
  const ticks = tk.ticks;
  const dp = K.tickDp(ticks);
  const r0 = Math.min(mk.dot, rowH * 0.32);
  const fillOf = (r) => (r.role === "hero" ? r.color || C.line_hero : ink.compare);
  const stems = stemsWanted;
  const marks = [], stemMarks = [];
  let x;
  for (let ci = 0; ci < cols; ci++) {
    const cx0 = plot.x + ci * (colW + colGap);
    x = x0.copy().range(span.map((v) => cx0 + v));
    const colRows = rows.slice(ci * perCol, (ci + 1) * perCol);
    const yEnd = top + rowH * colRows.length;
    const yLabel = plot.y + fa.size * 0.8;
    // The reference is named in the axis row: centred on its line, or hung to one side of it, whichever
    // clears the tick labels; only when none does are the ticks it crowds left unlabelled.
    const refLab = spec.ref ? spec.ref.name : null, refW = refLab ? textWidth(svg, refLab, fl) : 0;
    const tickBox = (t) => { const w = textWidth(svg, K.num(t, { dp }) + (t === d3.max(ticks) ? spec.v.unit || "" : ""), fa); return [x(t) - w / 2, x(t) + w / 2]; };
    let refAnchor = "middle", hide = [];
    if (spec.ref) {
      const rx = x(spec.ref.value), span = { middle: [rx - refW / 2, rx + refW / 2], start: [rx - sp("xs"), rx - sp("xs") + refW], end: [rx + sp("xs") - refW, rx + sp("xs")] };
      const crowds = (a) => ticks.filter((t) => { const [l, r] = tickBox(t); return l < span[a][1] + sp("s") && span[a][0] < r + sp("s"); });
      refAnchor = ["middle", "start", "end"].find((a) => !crowds(a).length) || "middle";
      hide = crowds(refAnchor);
    }
    if (spec.band) g.append("rect").attr("class", "band").attr("data-device", "shaded")
      .attr("x", x(spec.band.lo)).attr("width", x(spec.band.hi) - x(spec.band.lo)).attr("y", top - sp("xs")).attr("height", yEnd - top + sp("xs")).attr("fill", ink.band);
    // With stems the reference is the baseline, so zero is an ordinary gridline.
    K.xGrid(g, x, ticks, { y0: top - sp("xs"), y1: yEnd, yLabel, data, hide, zero: stems ? NaN : 0,
      fmt: (t, last) => K.num(t, { dp, sign: spec.v.sign }) + (last ? spec.v.unit || "" : "") });
    if (spec.ref) {
      K.refLine(g, x(spec.ref.value), top - sp("xs"), x(spec.ref.value), yEnd);
      K.text(g, x(spec.ref.value) + { middle: 0, start: -sp("xs"), end: sp("xs") }[refAnchor], yLabel, refLab, fl, fl.color, refAnchor);
    }
    colRows.forEach((r, j) => {
      const i = ci * perCol + j, cy = top + rowH * (j + 0.5);
      const hero = r.role === "hero";
      K.text(g, cx0 + nameW - sp("l") + sp("s"), cy + (hero ? heroF : ctxF).size * 0.35, nameOf(r, i), hero ? heroF : ctxF, hero ? C.ink : C.ink2, "end");
      if (stems) {
        const st = g.append("line").attr("class", "stem").attr("x1", x(spec.ref.value)).attr("x2", x(r.value)).attr("y1", cy).attr("y2", cy)
          .attr("stroke", hero ? fillOf(r) : ink.context).attr("stroke-width", K.sw(hero ? "hero" : "compare")).attr("data-id", r.id);
        stemMarks.push({ r, node: st.node(), x });
      }
      if (r.from != null) {
        g.append("line").attr("x1", x(r.from)).attr("x2", x(r.value)).attr("y1", cy).attr("y2", cy)
          .attr("stroke", hero ? fillOf(r) : ink.context).attr("stroke-width", K.sw("compare"));
        g.append("circle").attr("class", "from").attr("cx", x(r.from)).attr("cy", cy).attr("r", r0 * 0.8).attr("fill", C.surface)
          .attr("stroke", hero ? fillOf(r) : ink.compare).attr("stroke-width", K.sw("baseline"));
      }
      const rr = hero ? mk.dot_hero : r0;
      const c = g.append("circle").attr("class", "dot").attr("cx", x(r.value)).attr("cy", cy).attr("r", rr).attr("fill", fillOf(r)).attr("data-id", r.id);
      marks.push({ r, node: c.node(), x });
      if (labelled(r, i)) {
        // Value on the outer side of the dot (right of the larger end), never across the reference line.
        const far = r.from != null ? Math.max(x(r.from), x(r.value)) : x(r.value);
        K.textOver(g, far + rr + gap("label_mark"), cy + valF(r).size * 0.35, valueText(r), valF(r), valF(r).color, "start");
      }
    });
    if (dumb && ci === 0) {
      const r = rows[0], cy = plot.y + axisH + keyH / 2;
      const lab = (px, s, anchor) => K.text(g, px, cy + fl.size * 0.35, s, fl, C.ink2, anchor);
      const xf = x(r.from), xt = x(r.value);
      lab(xf + (xf < xt ? -1 : 1) * (r0 + sp("s")), spec.fromName, xf < xt ? "end" : "start");
      lab(xt + (xt > xf ? 1 : -1) * (r0 + sp("s")), spec.toName, xt > xf ? "start" : "end");
    }
  }

  // The note: a sentence near its row's dot, in the space an outlier leaves (never across other dots),
  // and clear of the band, so its white knockout never cuts into the shading.
  if (spec.note) {
    const m = marks.find((d) => d.r.id === spec.note.id);
    if (!m) throw new Error(`ENCODING: note for ${spec.note.id}, which is not a row`);
    const cx = +m.node.getAttribute("cx"), cy = +m.node.getAttribute("cy");
    const taken = [...g.selectAll("text").nodes(), ...g.selectAll("circle").nodes()].map((n) => { const b = n.getBBox(); return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; });
    const xr = m.x.range();
    K.annotate(g, { ax: cx, ay: cy, str: spec.note.text, maxW: Math.min(xr[1] - xr[0], fs.size * 13), leader: spec.note.leader !== false,
      bounds: { l: spec.band ? m.x(spec.band.hi) + sp("s") : xr[0], r: plot.x + plot.w, t: top, b: plot.y + plot.h }, taken, prefer: ["e", "ne", "se"], minD: sp("2xl"), maxD: plot.h / 3, optional: true });
  }

  // Encoding: each dot's x from its value with plain arithmetic; rows in descending order; colour by role.
  K.assert("dot positions", marks.map(({ r, node, x }) => [r.id, node.getAttribute("cx"), K.lin(...x.domain(), ...x.range())(r.value)]), 0.5);
  K.assert("stems from the reference", stemMarks.flatMap(({ r, node, x }) => { const l = K.lin(...x.domain(), ...x.range());
    return [[`${r.id} from`, node.getAttribute("x1"), l(spec.ref.value)], [`${r.id} to`, node.getAttribute("x2"), l(r.value)]]; }), 0.5);
  K.assert("row order", marks.slice(1).map(({ r }, i) => [r.id, r.value <= marks[i].r.value, true]));
  K.assert("dot colours", marks.map(({ r, node }) => [r.id, node.getAttribute("fill"), fillOf(r)]));
  return { x };

  // The ranking on its side, for wide plots: rows become columns in rank order, each a stem from the
  // reference to its dot; the value axis runs up the left. Every column carries its code (or short name)
  // under the axis; the hero and the two ends also get the label pair beside their dots.
  function rankedColumns() {
    const show = spec.showValues || "ends";
    const labelled = (r, i) => show === "all" || r.role === "hero" || (show === "ends" && (i === 0 || i === rows.length - 1));
    const valueText = (r) => r.valueText ?? K.num(r.value, { dp: spec.v.dp ?? 1, sign: spec.v.sign }) + (spec.v.unit || "");
    const tag = (r) => r.code || r.short || r.name;
    const vals = rows.map((r) => r.value);
    const data = d3.extent(vals);
    const [lo, hi] = d3.extent([...vals, spec.ref.value, 0]);
    // Codes under the columns, staggered on two rows when one column is narrower than a code.
    const tagW = d3.max(rows, (r) => textWidth(svg, tag(r), fl)) + sp("xs");
    const axisW0 = Math.max(textWidth(svg, spec.ref.name, fl), textWidth(svg, "−00%", fa)) + gap("axis_label");
    const colW0 = (plot.w - axisW0) / rows.length;
    const tiers = colW0 >= tagW ? 1 : 2 * colW0 >= tagW ? 2 : 0;
    if (!tiers) throw new Error(`LAYOUT: columns of ${Math.round(colW0)}px, codes need ${Math.round(tagW / 2)}px even staggered`);
    const bottom = plot.y + plot.h - fl.size * (tiers === 2 ? 2.1 : 1) - gap("axis_label");
    const tk = K.ticks(lo, hi, bottom - plot.y - fa.size, fa.size * K.AX.label_gap, [K.AX.y_cover, K.AX.y_cover]);
    const dp = K.tickDp(tk.ticks);
    const fmtT = (t, last) => K.num(t, { dp, sign: spec.v.sign }) + (last ? spec.v.unit || "" : "");
    const refLab = spec.ref.name;
    const axisW = Math.max(d3.max(tk.ticks, (t) => textWidth(svg, fmtT(t, true), fa)), textWidth(svg, refLab, fl)) + gap("axis_label");
    const x = d3.scaleBand(rows.map((r) => r.id), [plot.x + axisW, plot.x + plot.w]).paddingInner(0);
    if (x.bandwidth() * tiers < tagW) throw new Error(`LAYOUT: columns of ${Math.round(x.bandwidth())}px, codes need ${Math.round(tagW / tiers)}px`);
    const y = d3.scaleLinear(tk.domain, [bottom - sp("s"), plot.y + fa.size * 0.6]);
    const x0 = x.range()[0], x1 = x.range()[1];
    if (spec.band) g.append("rect").attr("class", "band").attr("data-device", "shaded").attr("x", x0).attr("width", x1 - x0)
      .attr("y", y(spec.band.hi)).attr("height", y(spec.band.lo) - y(spec.band.hi)).attr("fill", ink.band);
    // The reference is named in the axis column like a tick; a tick it would crowd is not labelled.
    const ry = y(spec.ref.value);
    const hide = tk.ticks.filter((t) => Math.abs(y(t) - ry) < fa.size * 1.2);
    K.yGrid(g, y, tk.ticks, { x0, x1, fmt: fmtT, zero: NaN, data, hide });
    K.refLine(g, x0, ry, x1, ry);
    K.text(g, x0 - gap("axis_label"), ry + fl.size * 0.35, refLab, fl, fl.color, "end");
    const r0 = Math.min(mk.dot, x.bandwidth() * 0.3);
    const fillOf = (r) => (r.role === "hero" ? r.color || C.line_hero : ink.compare);
    const marks = [], stemMarks = [], taken = [];
    rows.forEach((r, i) => {
      const cx = x(r.id) + x.bandwidth() / 2, cy = y(r.value), hero = r.role === "hero";
      const st = g.append("line").attr("class", "stem").attr("x1", cx).attr("x2", cx).attr("y1", ry).attr("y2", cy)
        .attr("stroke", hero ? fillOf(r) : ink.context).attr("stroke-width", K.sw(hero ? "hero" : "compare")).attr("data-id", r.id);
      stemMarks.push({ r, node: st.node() });
      const rr = hero ? mk.dot_hero : r0;
      const c = g.append("circle").attr("class", "dot").attr("cx", cx).attr("cy", cy).attr("r", rr).attr("fill", fillOf(r)).attr("data-id", r.id);
      marks.push({ r, node: c.node() });
      K.text(g, cx, bottom + gap("axis_label") + fl.size * (0.8 + (tiers === 2 && i % 2 ? 1.1 : 0)), tag(r), fl, fl.color, "middle");
      if (labelled(r, i)) {
        // The pair beside the dot, on the side with room: right of the first columns, left of the last.
        const right = i < rows.length / 2, sz = K.labelSize(valueText(r), r.name);
        const lx = right ? cx + rr + gap("label_mark") : cx - rr - gap("label_mark");
        const ly = Math.max(plot.y, Math.min(cy - fs.size * 0.7, bottom - sp("s") - sz.h));
        K.label(g, lx, ly, valueText(r), r.name, { anchor: right ? "start" : "end", knockoutFill: ly + sz.h > y(spec.band?.hi ?? Infinity) && ly < y(spec.band?.lo ?? -Infinity) ? ink.band : C.surface });
        taken.push({ l: right ? lx : lx - sz.w, r: right ? lx + sz.w : lx, t: ly, b: ly + sz.h });
      }
    });
    // The note sits in the open space above the band, so its knockout never cuts the shading.
    if (spec.note) {
      const m = marks.find((d) => d.r.id === spec.note.id);
      if (!m) throw new Error(`ENCODING: note for ${spec.note.id}, which is not a row`);
      const boxes = [...taken, ...g.selectAll("circle").nodes().map((n) => { const b = n.getBBox(); return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; })];
      K.annotate(g, { ax: +m.node.getAttribute("cx"), ay: +m.node.getAttribute("cy"), str: spec.note.text, maxW: fs.size * 13, leader: spec.note.leader !== false,
        bounds: { l: x0, r: x1, t: plot.y, b: (spec.band ? y(spec.band.hi) : bottom) - sp("s") }, taken: boxes, prefer: ["n", "ne", "nw"], minD: sp("2xl"), maxD: plot.h, optional: true });
    }
    // Encoding: dot heights and stem ends from the values with plain arithmetic, columns in rank order, colours by role.
    const ly = K.lin(...y.domain(), ...y.range());
    K.assert("dot positions", marks.map(({ r, node }) => [r.id, node.getAttribute("cy"), ly(r.value)]), 0.5);
    K.assert("stems from the reference", stemMarks.flatMap(({ r, node }) => [[`${r.id} from`, node.getAttribute("y1"), ly(spec.ref.value)], [`${r.id} to`, node.getAttribute("y2"), ly(r.value)]]), 0.5);
    K.assert("column order", marks.slice(1).map(({ r, node }, i) => [r.id, r.value <= marks[i].r.value && +node.getAttribute("cx") > +marks[i].node.getAttribute("cx"), true]));
    K.assert("dot colours", marks.map(({ r, node }) => [r.id, node.getAttribute("fill"), fillOf(r)]));
    return { y };
  }
};
