// Template: bridge (horizontal waterfall). How a total got from A to B: the starting total, each
// part's change, the ending total. For "inflation fell from 5.2% to 1.3%: food did most of it",
// a fund's return split by holding, a budget deficit split by line item.
//
// spec = {
//   unit: "%", dp: 2,
//   start: { name, value, text },   // value drives geometry; text is the label shown (may be a published figure)
//   steps: [{ id, name, value, text, role: "hero"|"context", color?, note? }],
//   end:   { name, value, text },   // start.value + sum(steps) must equal end.value (checked)
// }
// Orientation follows the box: rows top to bottom while a row is no taller than grammar.mark.row_max;
// on taller plots (portrait, story, blog) the bridge turns into columns left to right, so the bars
// fill the box instead of floating in tall, empty rows.
// Rows run top to bottom in the order given. Totals are quiet grey bars from zero (the frame of
// the story); hero steps carry the colour; context steps are light grey. Each step floats from the
// running total, never thinner than the minimum mark; dashed reference-grey carries join the rows.
// A step's note is an annotation placed in the open space the waterfall leaves (usually below and
// right of the big step), so the dek does not have to carry it.
window.Templates = window.Templates || {};
window.Templates.bridge = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fl, fs, fv, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart bridge");
  const sum = spec.start.value + d3.sum(spec.steps, (s) => s.value);
  if (Math.abs(sum - spec.end.value) > 0.011) throw new Error(`ENCODING: bridge steps add to ${sum.toFixed(3)}, end is ${spec.end.value}`);

  let run = spec.start.value;
  const rows = [{ kind: "total", id: "start", ...spec.start, from: 0, to: spec.start.value }];
  for (const s of spec.steps) { rows.push({ kind: "step", ...s, from: run, to: run + s.value }); run += s.value; }
  rows.push({ kind: "total", id: "end", ...spec.end, from: 0, to: spec.end.value });

  // A step thinner than the minimum mark is drawn at the minimum; a grey one then takes compare grey,
  // since a 3px sliver of light grey would vanish.
  const tiny = (r) => Math.abs(x(r.to) - x(r.from)) < mk.min_mark;
  const colourOf = (r) => r.kind === "total" ? ink.total : r.color || (r.role === "hero" ? C.line_hero : tiny(r) ? ink.compare : ink.context);
  const strong = (r) => r.kind === "total" || r.role === "hero";
  const nameFont = (r) => (strong(r) ? fs : fl);
  if (!F.side && plot.h / rows.length > mk.row_max) {
    const out = columns();
    if (out) return out;
  }
  // Name column sized to its longest name; values sit at the outer end of each bar.
  const nameW = d3.max(rows, (r) => textWidth(svg, r.name, nameFont(r))) + gap("column") / 2;
  const valW = d3.max(rows, (r) => textWidth(svg, r.text, fv)) + gap("label_mark");
  const top = plot.y;
  const rowH = plot.h / rows.length;
  if (rowH < fs.size * 1.6) throw new Error(`LAYOUT: bridge rows ${Math.round(rowH)}px, need ${Math.round(fs.size * 1.6)}px`);
  const barH = Math.min(rowH * mk.bar_ratio, mk.bar_max);
  const lo = Math.min(0, d3.min(rows, (r) => Math.min(r.from, r.to))), hi = d3.max(rows, (r) => Math.max(r.from, r.to));
  // Totals carry their value inside the bar end, so only a step that reaches the top needs room
  // to its right; no gutter is kept for nothing.
  const needR = d3.max(rows.filter((r) => r.kind === "step" && r.to >= r.from && r.to >= hi - 1e-9), (r) => textWidth(svg, r.text, fv) + gap("label_mark")) || 0;
  const x = d3.scaleLinear([lo, hi], [plot.x + nameW + (lo < 0 ? valW : 0), plot.x + plot.w - needR]);

  // No value axis: every bar carries its own number, so gridlines would only add ink. The zero
  // line stays, as the floor the totals stand on.
  g.append("line").attr("class", "baseline").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top).attr("y2", plot.y + plot.h)
    .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));
  const bars = [], boxes = [];
  const textBox = (t) => { const b = t.node().getBBox(); return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; };
  rows.forEach((r, i) => {
    const cy = top + rowH * (i + 0.5);
    const x0 = x(Math.min(r.from, r.to)), x1 = x(Math.max(r.from, r.to));
    const b = K.bar(g, x(r.from), x(r.to), cy, barH, colourOf(r)).attr("data-id", r.id);
    bars.push({ r, node: b.node() });
    const bb = b.node().getBBox();
    boxes.push({ l: bb.x, r: bb.x + bb.width, t: bb.y, b: bb.y + bb.height });
    const f = nameFont(r);
    boxes.push(textBox(K.text(g, plot.x, cy + f.size * 0.35, r.name, f, f.color)));
    // Value at the bar's leading edge: right of a rise, left of a fall. A fall whose label would
    // cross the zero line or the names goes inside the bar's end when the bar has room.
    const up = r.to >= r.from, tw = textWidth(svg, r.text, fv), pad = gap("label_mark");
    let t;
    if (r.kind === "total" && x1 - x0 > tw + 2 * pad) t = K.text(g, x1 - pad, cy + fv.size * 0.35, r.text, fv, textOn(colourOf(r), C), "end");
    else {
      const bx0 = +bb.x, bx1 = bb.x + bb.width;
      const outsideOk = up || bx0 - pad - tw > x(0) + sp("xs") || (bx0 - pad - tw > plot.x + nameW && bx0 < x(0));
      if (!outsideOk && x1 - x0 > tw + 2 * pad) t = K.text(g, x0 + pad, cy + fv.size * 0.35, r.text, fv, textOn(colourOf(r), C), "start");
      else if (!outsideOk) t = K.text(g, bx1 + pad, cy + fv.size * 0.35, r.text, fv, fv.color, "start");
      else t = K.text(g, up ? bx1 + pad : bx0 - pad, cy + fv.size * 0.35, r.text, fv, fv.color, up ? "start" : "end");
    }
    boxes.push(textBox(t));
    // Carry line to the next row.
    if (i < rows.length - 1) {
      const nx = x(r.to);
      g.append("line").attr("class", "carry").attr("x1", nx).attr("x2", nx).attr("y1", cy + barH / 2).attr("y2", cy + rowH - barH / 2)
        .attr("stroke", ink.reference).attr("stroke-width", K.sw("leader")).attr("stroke-dasharray", F.T.leader_dash);
    }
  });

  // Notes on steps: annotations in the open space, clear of every bar, name and value. First choice
  // is beside the row's value label (no leader needed), then just under the bar, then anywhere open
  // nearby with a leader. A note that fits nowhere is dropped (it is extra, not the point).
  const carries = rows.slice(0, -1).map((r, i) => [[x(r.to), top + rowH * (i + 0.5)], [x(r.to), top + rowH * (i + 1.5)]]);
  const bounds = { l: plot.x + nameW, r: plot.x + plot.w, t: plot.y, b: plot.y + plot.h };
  rows.forEach((r, i) => {
    if (!r.note) return;
    const cy = top + rowH * (i + 0.5), bb = bars[i].node.getBBox(), vb = boxes[i * 3 + 2];
    const pad = gap("label_mark");
    // Each slot is tried at a comfortable measure (16 ems) and as one long line.
    const slots = [fs.size * 16, bounds.r - bounds.l].flatMap((mw) => {
      const maxW = Math.min(bounds.r - bounds.l, mw), sz = K.annotationSize(r.note, maxW);
      return [
        { l: Math.max(vb.r, bb.x + bb.width) + pad * 2, t: cy - sz.h / 2 },  // after the value, same row
        { l: bb.x + pad, t: cy + barH / 2 + pad },                             // under the bar
      ].map((o) => ({ ...o, r: o.l + sz.w, b: o.t + sz.h, maxW }));
    });
    const maxW = Math.min(bounds.r - bounds.l, fs.size * 16);
    const ok = slots.find((o) => o.l >= bounds.l && o.r <= bounds.r && o.t >= bounds.t && o.b <= bounds.b && Kit.clearOf(o, carries, boxes, sp("s")));
    if (ok) {
      F.textBlock(g.append("g").attr("class", "annotation"), r.note, K.fn, ok.l, ok.t - K.fn.size * 0.1, ok.maxW, K.fn.color);
      boxes.push(ok);
    } else K.annotate(g, { ax: bb.x + bb.width / 2, ay: cy + barH / 2, str: r.note, maxW, bounds, taken: boxes, lines: carries,
      prefer: ["se", "s", "e", "sw"], minD: sp("l"), maxD: rowH * 2.5, optional: true });  // within two rows of its bar
  });

  // Columns: the same bridge left to right, values above rises and below falls, names under the
  // columns (at most two lines). Returns null when the names do not fit, so rows are used instead.
  function columns() {
    const n = rows.length, colW = plot.w / n;
    const wrap = (str, f) => { const lines = [[]]; for (const w of str.split(" ")) { const t = [...lines.at(-1), w].join(" ");
      if (lines.at(-1).length && textWidth(svg, t, f) > colW - sp("s")) lines.push([w]); else lines.at(-1).push(w); } return lines.map((l) => l.join(" ")); };
    const names = rows.map((r) => wrap(r.name, nameFont(r)));
    if (d3.max(names, (l) => l.length) > 2 || d3.max(rows, (r) => textWidth(svg, r.text, fv)) > colW - sp("xs")) return null;
    const lineH = fs.size * 1.15, nameH = d3.max(names, (l) => l.length) * lineH + gap("axis_label");
    const valH = fv.size + gap("label_mark");
    // bar_max caps the weight of long horizontal bars; a column's width is its share of the slot,
    // and at least wide enough to hold a total's value inside it.
    const barW = Math.min(colW * 0.8, Math.max(colW * mk.bar_ratio, d3.max(rows, (r) => textWidth(svg, r.text, fv)) + 2 * sp("s")));
    const lo = Math.min(0, d3.min(rows, (r) => Math.min(r.from, r.to))), hi = d3.max(rows, (r) => Math.max(r.from, r.to));
    // Room above for a value only when a rising step reaches the top (totals carry theirs inside).
    const needTop = rows.some((r) => r.kind === "step" && r.to >= r.from && r.to >= hi - 1e-9);
    const y = d3.scaleLinear([lo, hi], [plot.y + plot.h - nameH - (lo < 0 ? valH : 0), plot.y + (needTop ? valH : 0)]);
    const tinyY = (r) => Math.abs(y(r.to) - y(r.from)) < mk.min_mark;
    const colourY = (r) => r.kind === "total" ? ink.total : r.color || (r.role === "hero" ? C.line_hero : tinyY(r) ? ink.compare : ink.context);
    g.append("line").attr("class", "baseline").attr("x1", plot.x).attr("x2", plot.x + plot.w).attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));
    const bars = [], boxes = [];
    const textBox = (t) => { const b = t.node().getBBox(); return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; };
    rows.forEach((r, i) => {
      const cx = plot.x + colW * (i + 0.5);
      const b = K.bar(g, y(r.from), y(r.to), cx, barW, colourY(r), false).attr("data-id", r.id);
      bars.push({ r, node: b.node() });
      const bb = b.node().getBBox(); boxes.push({ l: bb.x, r: bb.x + bb.width, t: bb.y, b: bb.y + bb.height });
      names[i].forEach((ln, j) => boxes.push(textBox(K.text(g, cx, plot.y + plot.h - nameH + gap("axis_label") + nameFont(r).size * 0.8 + j * lineH, ln, nameFont(r), nameFont(r).color, "middle"))));
      const up = r.to >= r.from, pad = gap("label_mark");
      let t;
      if (r.kind === "total" && bb.height > fv.size + 2 * pad) t = K.text(g, cx, bb.y + pad + fv.size * 0.8, r.text, fv, textOn(colourY(r), C), "middle");
      else if (up) t = K.text(g, cx, bb.y - pad, r.text, fv, fv.color, "middle");
      else t = K.text(g, cx, bb.y + bb.height + pad + fv.size * 0.8, r.text, fv, fv.color, "middle");
      boxes.push(textBox(t));
      if (i < n - 1) g.append("line").attr("class", "carry").attr("x1", cx + barW / 2).attr("x2", cx + colW - barW / 2).attr("y1", y(r.to)).attr("y2", y(r.to))
        .attr("stroke", ink.reference).attr("stroke-width", K.sw("leader")).attr("stroke-dasharray", F.T.leader_dash);
    });
    // Notes: annotations in the open space beside their column (the upper right, after a fall).
    const carries = rows.slice(0, -1).map((r, i) => [[plot.x + colW * (i + 0.5), y(r.to)], [plot.x + colW * (i + 1.5), y(r.to)]]);
    const bounds = { l: plot.x, r: plot.x + plot.w, t: plot.y, b: plot.y + plot.h - nameH };
    rows.forEach((r, i) => {
      if (!r.note) return;
      const bb = bars[i].node.getBBox(), vb = boxes[i * (2 + names[i].length) + 1 + names[i].length];
      // A rise is annotated above its value; a fall beside its upper part, where the space opens up.
      const up = r.to >= r.from;
      K.annotate(g, { ax: up ? bb.x + bb.width / 2 : bb.x + bb.width, ay: up ? vb.t : bb.y + Math.min(bb.height / 3, fs.size * 2), str: r.note,
        maxW: Math.min(plot.w / 2, fs.size * 14), bounds, taken: boxes, lines: carries, prefer: up ? ["n", "ne", "nw"] : ["e", "ne", "se"],
        minD: sp("l"), maxD: colW * 4, optional: true });
    });
    // Encoding: column ends from the data with plain arithmetic, under the same minimum-mark rule.
    const ly = K.lin(...y.domain(), ...y.range());
    K.assert("column ends", bars.flatMap(({ r, node }) => {
      const a = Math.min(ly(r.from), ly(r.to)), h = Math.abs(ly(r.to) - ly(r.from));
      const want = h < mk.min_mark ? [a + h / 2 - mk.min_mark / 2, mk.min_mark] : [a, h];
      return [[`${r.id} top`, node.getAttribute("y"), want[0]], [`${r.id} height`, +node.getAttribute("height"), want[1]]];
    }), 0.5);
    K.assert("column colours", bars.map(({ r, node }) => [r.id, node.getAttribute("fill"), colourY(r)]));
    svg.attr("data-bridge", "columns");
    return { y };
  }

  // Encoding: bar ends from the data with plain arithmetic (a step under the minimum mark is drawn
  // at the minimum, centred on its true position), and colour from role.
  const lx = K.lin(...x.domain(), ...x.range());
  K.assert("bar ends", bars.flatMap(({ r, node }) => {
    const a = lx(Math.min(r.from, r.to)), w = lx(Math.max(r.from, r.to)) - a;
    const want = w < mk.min_mark ? [a + w / 2 - mk.min_mark / 2, mk.min_mark] : [a, w];
    return [[`${r.id} start`, node.getAttribute("x"), want[0]], [`${r.id} width`, +node.getAttribute("width"), want[1]]];
  }), 0.5);
  K.assert("bar colours", bars.map(({ r, node }) => [r.id, node.getAttribute("fill"), colourOf(r)]));
  return { x };
};
