// Template: ranked grid ("periodic table" of returns). One slot per period; within it the items are
// stacked best to worst, each a cell with its name and value. The eye follows one colour (the hero
// item) across the periods to see it rise and fall; everything else is plain grey type with no tile.
// At most two hues, and only the hero is filled: a compare item is an outlined white cell in its colour,
// so the eye has one loud thing to follow and a second, quieter one (two solid hues made a checkerboard).
//
// spec = {
//   items: [{ key, name, short?, role?: "hero"|"compare"|"context", color? }],
//   periods: [{ id, label }],                   // in order
//   value: (periodId, key) => number | null,    // null: item absent that period
//   fmt: (v) => string,                         // cell values, e.g. "+71%"
//   ends?: { best: "Best", worst: "Worst" },    // names of the two ends of the rank axis
//   short?: false,                              // refuse short names (throw LAYOUT) so the caller can show fewer periods
// }
// Orientation follows the canvas: periods run across on wide plots, down on tall ones. Cells hold
// "name value" on one line when it fits, else two lines; names step down to `short`. Throws LAYOUT:
// when even that does not fit (the chart should then show fewer periods).
window.Templates = window.Templates || {};
window.Templates.rank_grid = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C, T } = F;
  const { fa, fl, sp, gap, ink, mk } = K;
  const fo = F.font(T.type.label_on_fill ? "label_on_fill" : "label_strong");
  const g = svg.append("g").attr("class", "chart rank-grid");
  const P = spec.periods, n = spec.items.length;
  const hueOf = (it) => it.color || (it.role === "hero" ? C.accent : ink.compare);
  // Context entries are plain text on the ground, no tile: sixty grey tiles made the grid noisy, and the
  // hero's filled cells should be the only shapes on the page.
  const fillOf = (it) => (it.role === "hero" ? hueOf(it) : C.surface);
  const strokeOf = (it) => (it.role === "compare" ? hueOf(it) : null);
  const ends = spec.ends || { best: "Best", worst: "Worst" };
  const periodW = d3.max(P, (p) => textWidth(svg, p.label, fa));
  const endW = Math.max(textWidth(svg, ends.best, fa), textWidth(svg, ends.worst, fa));
  const pad = sp("s"), gapC = mk.cell_gap;
  const cellFont = (it) => (it.role === "context" || !it.role ? fl : fo);
  const vals = P.flatMap((p) => spec.items.map((it) => spec.value(p.id, it.key)).filter((v) => v != null));
  const valW = d3.max(vals, (v) => textWidth(svg, spec.fmt(v), fo));
  // Geometry for one orientation; periods as columns ("across") or as rows.
  const geom = (across, useShort) => {
    const head = across ? fa.size + gap("axis_label") : periodW + gap("row_label");
    const side = across ? endW + gap("row_label") : 0;
    const footer = across ? 0 : fa.size + gap("axis_label");
    const gx = plot.x + (across ? side : head), gy = plot.y + (across ? head : footer);
    const gw = plot.x + plot.w - gx, gh = plot.y + plot.h - gy;
    const cw = gw / (across ? P.length : n), ch = gh / (across ? n : P.length);
    // Text layout: one line "name value", else two lines; full names, else short ones.
    {
      const nm = (it) => (useShort && it.short) || it.name;
      const nameW = d3.max(spec.items, (it) => textWidth(svg, nm(it), cellFont(it)));
      if (nameW + sp("s") + valW + 2 * pad <= cw - gapC && fo.size + pad <= ch - gapC) return { across, gx, gy, gw, gh, cw, ch, layout: { lines: 1, nm } };
      // Two centred lines need only a hairline of side room: the text never touches a tile edge.
      if (Math.max(nameW, valW) + 2 * sp("xs") <= cw - gapC && fo.size + fl.size + sp("2xs") + pad <= ch - gapC) return { across, gx, gy, gw, gh, cw, ch, layout: { lines: 2, nm } };
    }
    return null;
  };
  // Full names in the canvas's own orientation, then full names the other way, then short names: a
  // grid of "S&P" and "Bank" is harder to read than one turned on its side.
  const wide = plot.w >= plot.h;
  // spec.short === false: full names only, so a chart can try fewer periods before it abbreviates.
  const G0 = geom(wide, false) || geom(!wide, false) || (spec.short !== false && (geom(wide, true) || geom(!wide, true)));
  if (!G0) throw new Error(`LAYOUT: ${P.length} periods × ${n} items do not fit as cells either way`);
  const { across, gx, gy, gw, cw, ch, layout } = G0;

  // Period labels and the rank axis's two ends.
  P.forEach((p, i) => {
    if (across) K.text(g, gx + cw * (i + 0.5), plot.y + fa.size * 0.8, p.label, fa, fa.color, "middle");
    else K.text(g, gx - gap("row_label"), gy + ch * (i + 0.5) + fa.size * 0.35, p.label, fa, fa.color, "end");
  });
  if (across) {
    K.text(g, gx - gap("row_label"), gy + ch * 0.5 + fa.size * 0.35, ends.best, fa, fa.color, "end");
    K.text(g, gx - gap("row_label"), gy + ch * (n - 0.5) + fa.size * 0.35, ends.worst, fa, fa.color, "end");
  } else {
    K.text(g, gx + gapC / 2, plot.y + fa.size * 0.8, ends.best, fa, fa.color, "start");
    K.text(g, gx + gw - gapC / 2, plot.y + fa.size * 0.8, ends.worst, fa, fa.color, "end");
  }

  // Hairline rules between rows (ranks when periods run across, years when they run down), as in a printed
  // table: untiled entries need them to read as rows instead of floating text.
  const nRows = across ? n : P.length;
  for (let r = 1; r < nRows; r++) g.append("line").attr("class", "grid").attr("x1", gx).attr("x2", gx + gw)
    .attr("y1", gy + r * ch).attr("y2", gy + r * ch).attr("stroke", ink.grid).attr("stroke-width", K.sw("grid"));
  const checks = [];
  P.forEach((p, i) => {
    const ranked = spec.items.map((it) => ({ it, v: spec.value(p.id, it.key) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
    ranked.forEach(({ it, v }, r) => {
      const x0 = gx + (across ? i : r) * cw + gapC / 2, y0 = gy + (across ? r : i) * ch + gapC / 2, w = cw - gapC, h = ch - gapC;
      const fill = fillOf(it);
      const cell = g.append("rect").attr("class", "cell").attr("x", x0).attr("y", y0).attr("width", w).attr("height", h)
        .attr("rx", mk.cell_corner).attr("fill", fill).attr("data-key", it.key).attr("data-period", p.id);
      // The outline sits inside the cell (inset by half its width), so outlined and filled cells line up.
      if (strokeOf(it)) cell.attr("stroke", strokeOf(it)).attr("stroke-width", K.sw("compare")).attr("x", x0 + K.sw("compare") / 2).attr("y", y0 + K.sw("compare") / 2)
        .attr("width", w - K.sw("compare")).attr("height", h - K.sw("compare"));
      const f = cellFont(it), col = f === fo ? (it.role === "compare" ? C.ink : textOn(fill, C)) : fl.color;
      if (layout.lines === 1) {
        K.text(g, x0 + pad, y0 + h / 2 + f.size * 0.35, layout.nm(it), f, col, "start");
        K.text(g, x0 + w - pad, y0 + h / 2 + f.size * 0.35, spec.fmt(v), f, col, "end");
      } else {
        const top = y0 + (h - (f.size + sp("2xs") + f.size)) / 2;
        K.text(g, x0 + w / 2, top + f.size * 0.8, layout.nm(it), f, col, "middle");
        K.text(g, x0 + w / 2, top + f.size + sp("2xs") + f.size * 0.8, spec.fmt(v), f, col, "middle");
      }
      // Encoding: the cell's slot is its rank in this period (recomputed by sorting the values).
      const inset = strokeOf(it) ? K.sw("compare") / 2 : 0;
      checks.push([`${p.id} ${it.key} slot`, across ? +cell.attr("y") : +cell.attr("x"), (across ? gy : gx) + r * (across ? ch : cw) + gapC / 2 + inset],
        [`${p.id} ${it.key} colour`, cell.attr("stroke") || cell.attr("fill"), strokeOf(it) || fillOf(it)]);
    });
  });
  K.assert("grid ranks", checks, 0.5);
  return { g, K, across };
};
