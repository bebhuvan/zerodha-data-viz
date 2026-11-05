// Template: calendar heatmap. Rows (years) by columns (months), each cell coloured by a binned
// value. For seeing a whole history at once and the season inside it: inflation month by month,
// monthly returns, rainfall. Bins, not a continuous ramp, so a reader can say which band a cell is in.
//
// spec = {
//   rows: ["2014", ...], cols: ["J", "F", ...] (or full names; the template shortens to fit),
//   cells: [{ row, col, value }]   (a missing cell is a dashed outline),
//   bins: { thresholds: [2, 4, 6], colors: [...], labels?: ["Under 2%", ...] },
//   unit: "%",
//   highlight?: [{ row, col }],   // the cell(s) the headline names: outlined in ink
// }
window.Templates = window.Templates || {};
window.Templates.calendar = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart calendar").attr("data-ramp", 1);
  const { thresholds, colors } = spec.bins;
  const binOf = (v) => thresholds.filter((t) => v >= t).length;
  const rowW = d3.max(spec.rows, (r) => textWidth(svg, r, fa)) + gap("axis_label");

  // Legend strip across the top: equal swatches, threshold numbers at the joins.
  const titleH = spec.bins.title ? fa.size + sp("s") : 0;
  const legH = titleH + sp("m") + sp("s") + fa.size + sp("m");
  const colHead = fa.size + sp("s");
  const top = plot.y + legH + colHead;
  const cg = mk.cell_gap;
  // Cells fill the height; they may be up to 2.6 times as wide as tall so the grid fills the width.
  const cellH = (plot.y + plot.h - top + cg) / spec.rows.length;
  const cell = Math.min((plot.w - rowW + cg) / spec.cols.length, cellH * 2.6);
  if (cellH < sp("l")) throw new Error(`LAYOUT: calendar cells ${Math.round(cellH)}px tall`);
  const gridW = cell * spec.cols.length - cg;
  // Centre the grid (with its row labels) in the plot.
  // Fixed shape (12 x 12 cells of bounded proportion): centred when stacked, right-aligned beside a header column.
  svg.attr("data-fixed-aspect", 1);
  const ox = F.side ? plot.x + plot.w - gridW : plot.x + rowW + (plot.w - rowW - gridW) / 2;
  const longest = d3.max(spec.cols, (c) => textWidth(svg, c, fa));
  const colLabel = (c) => (longest + sp("s") <= cell ? c : c.slice(0, 1));

  const sw = Math.min(sp("3xl") * 2, gridW / colors.length);
  const lx = ox;
  colors.forEach((c, i) => g.append("rect").attr("class", "key").attr("x", lx + i * sw).attr("y", plot.y + titleH).attr("width", sw - sp("2xs")).attr("height", sp("m")).attr("fill", c));
  thresholds.forEach((t, i) => K.text(g, lx + (i + 1) * sw - sp("2xs") / 2, plot.y + titleH + sp("m") + sp("s") + fa.size * 0.8,
    `${K.num(t, { dp: K.tickDp([t]) })}${i === thresholds.length - 1 ? spec.unit || "" : ""}`, fa, fa.color, "middle"));
  if (spec.bins.title) K.text(g, lx, plot.y + fa.size * 0.8, spec.bins.title, fl, fl.color, "start");
  const hasMissing = spec.cells.some((c) => c.value == null) || spec.rows.length * spec.cols.length > spec.cells.length;
  if (hasMissing) {
    const mx = lx + colors.length * sw + sp("xl"), my = plot.y + titleH;
    g.append("rect").attr("x", mx).attr("y", my).attr("width", sp("2xl")).attr("height", sp("m")).attr("fill", C.surface)
      .attr("stroke", ink.compare).attr("stroke-width", K.sw("context")).attr("stroke-dasharray", `${sp("xs")} ${sp("xs")}`);
    K.text(g, mx + sp("2xl") + sp("s"), my + sp("m") / 2 + fa.size * 0.36, "No figure", fl, fl.color, "start");
  }

  spec.cols.forEach((c, j) => K.text(g, ox + j * cell + (cell - cg) / 2, top - sp("s"), colLabel(c), fa, fa.color, "middle"));
  spec.rows.forEach((r, i) => K.text(g, ox - gap("axis_label"), top + i * cellH + (cellH - cg) / 2 + fa.size * 0.35, r, fa, fa.color, "end"));
  const byKey = new Map(spec.cells.map((c) => [`${c.row}|${c.col}`, c]));
  const marks = [];
  spec.rows.forEach((r, i) => spec.cols.forEach((c, j) => {
    const d = byKey.get(`${r}|${c}`);
    const x = ox + j * cell, y = top + i * cellH;
    if (!d || d.value == null) {
      const hw = K.sw("context") / 2;  // stroke inset, so the outline sits inside the cell
      if (d) g.append("rect").attr("x", x + hw).attr("y", y + hw).attr("width", cell - cg - 2 * hw).attr("height", cellH - cg - 2 * hw).attr("fill", C.surface)
        .attr("stroke", ink.compare).attr("stroke-width", K.sw("context")).attr("stroke-dasharray", `${sp("xs")} ${sp("xs")}`).attr("data-device", "dashed");
      return;
    }
    const rect = g.append("rect").attr("class", "cell").attr("x", x).attr("y", y).attr("width", cell - cg).attr("height", cellH - cg)
      .attr("rx", mk.cell_corner).attr("fill", colors[binOf(d.value)]);
    marks.push({ d, node: rect.node() });
  }));

  // The cell the headline is about gets an ink outline (outside the fill, so its colour still reads).
  for (const h of spec.highlight || []) {
    const i = spec.rows.indexOf(h.row), j = spec.cols.indexOf(h.col);
    if (i < 0 || j < 0) throw new Error(`ENCODING: highlight ${h.row} ${h.col} is not on the grid`);
    const o = K.sw("compare") / 2 + K.sw("context") / 2;  // the outline sits just outside the cell
    g.append("rect").attr("class", "highlight").attr("x", ox + j * cell - o).attr("y", top + i * cellH - o)
      .attr("width", cell - cg + 2 * o).attr("height", cellH - cg + 2 * o).attr("rx", mk.cell_corner + o).attr("fill", "none")
      .attr("stroke", C.ink).attr("stroke-width", K.sw("compare"));
  }
  // Encoding: each cell's colour from its value, recomputed against the thresholds directly.
  K.assert("cell colours", marks.map(({ d, node }) => [`${d.row} ${d.col}`, node.getAttribute("fill"),
    colors[thresholds.reduce((n, t) => n + (d.value >= t ? 1 : 0), 0)]]));
  return { cell };
};
