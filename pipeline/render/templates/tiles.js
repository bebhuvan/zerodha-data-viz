// Template: tile cartogram. Equal tiles on a row/column grid (states, districts, countries), each
// coloured by a binned value and carrying its code and value, so small places weigh as much as big
// ones. For "where", when a map would hide the small places; a ranking reads faster for "how much".
//
// spec = {
//   tiles: [{ id, code, row, col, value }],       // value null/NaN = no figure: dashed outline, a dash
//   bins: { thresholds, colors, unit, sign? },    // binned fills; colors has thresholds.length + 1 entries
//   marker?: { value, name },                     // a reference value marked on the legend (India)
//   format?: (v) => string,                       // tile value text (no unit; the legend carries it)
// }
// Tiles are as large as the plot allows, up to grammar.mark.tile_max; the legend goes in the largest
// empty block of whole cells (the grid's empty corners), else above the grid. Fixed shape: centred
// when stacked, right-aligned beside a header column. Tiles too small for their two lines of text
// are a LAYOUT failure, never squeezed.
window.Templates = window.Templates || {};
window.Templates.tiles = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { sp, ink, mk } = K;
  const fc = F.font(F.T.type.label_on_fill ? "label_on_fill" : "label"), fq = K.fl;
  let fv = K.fv;  // values at body size; small tiles step down to the on-fill label size
  const g = svg.append("g").attr("class", "chart tiles").attr("data-ramp", 1);
  svg.attr("data-fixed-aspect", 1);
  const { thresholds: th, colors } = spec.bins;
  const missing = (t) => t.value == null || Number.isNaN(t.value);
  const fillOf = (t) => (missing(t) ? C.surface : colors[th.filter((x) => t.value >= x).length]);
  const fmt = spec.format || ((v) => K.num(v, { dp: 1 }));
  const cols = d3.max(spec.tiles, (t) => t.col), nrows = d3.max(spec.tiles, (t) => t.row);
  const pad = sp("s");
  let tgap = mk.tile_gap;
  const sizeFor = (top) => Math.min(mk.tile_max, (plot.w + tgap) / cols, (plot.y + plot.h - top + tgap) / nrows);

  // Empty blocks of whole cells, largest first, for a grid at `top` with tile `size` from `ox`.
  const filled = new Set(spec.tiles.map((t) => `${t.row},${t.col}`));
  const emptyBlocks = (top, size, ox) => {
    const out = [];
    for (let r0 = 1; r0 <= nrows; r0++) for (let c0 = 1; c0 <= cols; c0++)
      for (let r1 = r0; r1 <= nrows; r1++) for (let c1 = c0; c1 <= cols; c1++) {
        let ok = true;
        for (let r = r0; r <= r1 && ok; r++) for (let c = c0; c <= c1 && ok; c++) if (filled.has(`${r},${c}`)) ok = false;
        if (ok) out.push({ x: ox + (c0 - 1) * size, y: top + (r0 - 1) * size, w: (c1 - c0 + 1) * size - tgap, h: (r1 - r0 + 1) * size - tgap });
      }
    return out.sort((a, b) => b.w * b.h - a.w * a.h);
  };
  const originX = (size) => (F.side ? plot.x + plot.w - size * cols + tgap : plot.x + (plot.w - size * cols + tgap) / 2);
  const legendOpts = { thresholds: th, colors, unit: spec.bins.unit, sign: spec.bins.sign, marker: spec.marker, nofig: spec.tiles.some(missing) };
  let top = plot.y, size = sizeFor(top), ox = originX(size), placed = null;
  // A grid held back by the width leaves height below it: the legend goes there, under the grid,
  // instead of in a corner of the map with an empty band beneath (tall canvases).
  const below = K.binLegendSize({ ...legendOpts, maxW: plot.w });
  const spare = plot.y + plot.h - (top + nrows * size - tgap);
  const legendBelow = spare >= below.h + sp("xl");
  if (legendBelow) placed = K.binLegend(g, ox, top + nrows * size - tgap + sp("xl"), { ...legendOpts, maxW: plot.w });
  for (const b of placed ? [] : emptyBlocks(top, size, ox)) {
    for (const vertical of [false, true]) {
      const L = K.binLegendSize({ ...legendOpts, vertical, maxW: b.w });
      if (L.w <= b.w && L.h <= b.h) { placed = K.binLegend(g, b.x + b.w - L.w, b.y, { ...legendOpts, vertical, maxW: b.w }); break; }
    }
    if (placed) break;
  }
  if (!placed) {
    top = K.binLegend(g, plot.x, plot.y, { ...legendOpts, maxW: plot.w }).bottom + sp("s");
    size = sizeFor(top); ox = originX(size);
  }
  // A tile must hold both lines in height and its widest value in width.
  let widest = d3.max(spec.tiles.filter((t) => !missing(t)), (t) => textWidth(svg, fmt(t.value), fv));
  const needAt = (gp) => Math.max(2 * pad + 0.8 * fc.size + 0.75 * fv.size + sp("s"), pad + widest + sp("xs")) + gp;
  if (size < needAt(tgap) && size >= needAt(mk.tile_gap_min)) { tgap = mk.tile_gap_min; size = sizeFor(top); ox = originX(size); }
  if (size < needAt(tgap) && fv !== fc) { fv = fc; widest = d3.max(spec.tiles.filter((t) => !missing(t)), (t) => textWidth(svg, fmt(t.value), fv)); }
  if (size < needAt(tgap) && size >= needAt(mk.tile_gap_min)) { tgap = mk.tile_gap_min; size = sizeFor(top); ox = originX(size); }
  if (size < needAt(tgap)) throw new Error(`LAYOUT: tiles ${Math.round(size)}px, need ${Math.round(needAt(tgap))}px for their text (widest value ${Math.round(widest)}px)`);

  // A grid held back by the width leaves spare height that the legend did not take. The cells absorb up
  // to 8% of their height (taller than wide by an amount the eye does not see), and what is left is
  // split above and below, so no band opens between the grid and the header or footer.
  let pitchY = size;
  if (!legendBelow) {
    const left = plot.y + plot.h - (top + nrows * size - tgap);
    if (left > 0) { pitchY = size + Math.min(left / nrows, size * 0.08); top += (left - (pitchY - size) * nrows) / 2; }
  }
  const marks = [];
  for (const t of spec.tiles) {
    const x = ox + (t.col - 1) * size, y = top + (t.row - 1) * pitchY, s = size - tgap, sY = pitchY - tgap;
    const none = missing(t), bg = fillOf(t);
    const textInk = none ? fc.color : textOn(bg, C);
    const rect = g.append("rect").attr("class", "tile").attr("x", x).attr("y", y).attr("width", s).attr("height", sY).attr("rx", mk.tile_corner).attr("fill", bg).attr("data-id", t.id);
    if (none) rect.attr("data-device", "dashed").attr("stroke", ink.compare).attr("stroke-width", K.sw("context")).attr("stroke-dasharray", `${sp("xs")} ${sp("xs")}`);
    marks.push({ t, node: rect.node() });
    K.text(g, x + pad, y + pad + fc.size * 0.8, t.code, fc, textInk);
    const f = none ? fq : fv;  // a missing value is a quiet dash, not a number
    K.text(g, x + pad, y + sY - pad - sp("2xs"), none ? "–" : fmt(t.value), f, none ? fq.color : textInk);
  }
  // Encoding: each tile's fill from its value against the thresholds, recomputed with plain counting.
  K.assert("tile colours", marks.map(({ t, node }) => [t.id, node.getAttribute("fill"),
    missing(t) ? C.surface : colors[th.reduce((n, x) => n + (t.value >= x ? 1 : 0), 0)]]));
  return { size };
};
