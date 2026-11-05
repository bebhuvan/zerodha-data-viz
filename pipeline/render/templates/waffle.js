// Template: waffle. A whole as 100 squares, each part a block of them, for shares a reader should
// be able to count: what is in the CPI basket, where a household's money goes, who owns a company.
// Name two to four parts in colour and fold the rest into one grey "everything else".
//
// spec = {
//   items: [{ id, name, value, valueText, role: "hero"|"context", color? }],  // values sum to 100
//   minFill?: 0.85,  // throw LAYOUT when grid + labels span less of the plot's width (try another frame)
// }
// Squares are allocated by largest remainder, so the counts always add to 100. Cells stay square;
// the grid is 10x10, 20x5 or 5x20, beside or above its labels, whichever gives the biggest cells.
window.Templates = window.Templates || {};
window.Templates.waffle = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart waffle");
  const total = d3.sum(spec.items, (d) => d.value);
  if (Math.abs(total - 100) > 0.05) throw new Error(`ENCODING: waffle parts add to ${total}, not 100`);
  // Largest remainder: floor each, then hand the leftover squares to the biggest fractions.
  const counts = spec.items.map((d) => Math.floor(d.value));
  const order = spec.items.map((d, i) => [d.value - Math.floor(d.value), i]).sort((a, b) => b[0] - a[0]);
  const short = 100 - d3.sum(counts);
  for (let i = 0; i < short; i++) counts[order[i][1]]++;
  const colourOf = (d) => d.color || (d.role === "hero" ? C.accent : ink.context_fill);  // a large area: the paler fill grey

  const labels = spec.items.map((d) => ({ d, sz: K.labelSize(d.valueText, d.name) }));
  const sw = sp("l"), swGap = sw + gap("label_mark");  // swatch, and its distance to the label
  const labW = d3.max(labels, (l) => l.sz.w) + swGap, labH = d3.sum(labels, (l) => l.sz.h) + sp("xl") * (labels.length - 1);
  // Below the grid the labels sit in one row when they fit across, else stacked.
  const rowW = d3.sum(labels, (l) => l.sz.w + swGap) + sp("2xl") * (labels.length - 1);
  const inRow = rowW <= plot.w, belowH = inRow ? d3.max(labels, (l) => l.sz.h) : labH;
  // Square cells always. The grid may be 10x10, 20x5 (wide boxes) or 5x20 (tall boxes); of every
  // grid shape beside or below the labels, the one with the biggest grid wins.
  const shapes = [[10, 10], [20, 5], [5, 20]];
  // (Below: the label block's measured height includes descender room the last line never uses.)
  const boxes = [{ beside: true, w: plot.w - labW - sp("xl"), h: plot.h }, { beside: false, w: plot.w, h: plot.h - belowH - sp("xl") + 0.4 * fl.size }];
  // Arrangements that would leave an empty band (over sp("s")) above or below the grid only win when
  // nothing else fits.
  const cands = boxes.flatMap((bx) => shapes.map(([cols, rows]) => {
    // Pitch includes the gap (12% of a cell) between cells but not after the last one.
    const cell = Math.min(bx.w / (cols - 0.12), bx.h / (rows - 0.12));
    const gw0 = cell * (cols - 0.12), span = (bx.beside ? gw0 + sp("xl") + labW : Math.max(gw0, inRow ? rowW : labW)) / plot.w;
    return { ...bx, cols, rows, cell, span, slack: (bx.h - cell * (rows - 0.12)) / 2 };  // spare height is split above and below
  }));
  // The biggest grid wins among arrangements whose spare height (split above and below) stays small;
  // a tiny limit (8k) used to pick a smaller grid with its legend squeezed underneath.
  // Beside a header column the spare height sits outside the chart's ink; stacked, it opens a band
  // between header and chart, so it must stay small there.
  // With minFill, only shapes that span enough of the width compete (a wide strip beats a small square).
  const pool = spec.minFill && cands.some((c) => c.span >= spec.minFill) ? cands.filter((c) => c.span >= spec.minFill) : cands;
  const tight = pool.filter((c) => c.slack <= sp(F.side ? "3xl" : "xl"));
  const best = d3.greatest(tight.length ? tight : pool, (c) => c.cell);
  if (spec.minFill && !tight.length) throw new Error("LAYOUT: a wide waffle would leave bands above and below it");
  const { beside, cols, rows, cell } = best;
  const gw = cell * (cols - 0.12), gh = cell * (rows - 0.12);
  if (cell < sp("l")) throw new Error("LAYOUT: no room for a legible waffle");
  // minFill: the grid and its labels must span this share of the plot's width (a caller trying a stacked
  // header on a wide canvas falls back to a side column when the grid would float in the middle).
  const spanW = (beside ? gw + sp("xl") + labW : Math.max(gw, inRow ? rowW : labW)) / plot.w;
  if (spec.minFill && spanW < spec.minFill) throw new Error(`LAYOUT: waffle spans ${Math.round(spanW * 100)}% of the width, want ${Math.round(spec.minFill * 100)}%`);
  const cgap = cell * 0.12;
  svg.attr("data-fixed-aspect", 1);  // a grid of countable cells: lint checks it fills its box in one dimension
  // Side layouts right-align, so spare width sits by the header column rather than at the canvas edge.
  // Grid and labels travel together: centred when stacked, right-aligned beside a header column.
  const groupW = beside ? gw + sp("xl") + labW : gw;
  const gx = (F.side ? plot.x + plot.w - groupW : plot.x + (plot.w - groupW) / 2), gy = plot.y + best.slack;

  // Fill column by column from the top-left, so each part is one contiguous block.
  const marks = [];
  let n = 0;
  counts.forEach((c, i) => {
    for (let j = 0; j < c; j++, n++) {
      const col = Math.floor(n / rows), row = n % rows;
      const r = g.append("rect").attr("class", "cell").attr("x", gx + col * cell).attr("y", gy + row * cell)
        .attr("width", cell - cgap).attr("height", cell - cgap).attr("rx", mk.cell_corner).attr("fill", colourOf(spec.items[i])).attr("data-id", spec.items[i].id);
      marks.push({ i, node: r.node() });
    }
  });
  // Labels: a swatch and the house label pair per part.
  // Beside: labels in the column right of the grid, flush with the plot's right edge region.
  let ly = beside ? gy + (gh - labH) / 2 : gy + gh + sp("xl"), lx = beside ? gx + gw + sp("xl") : gx;
  // A legend row under the grid starts at the grid's left edge (never centred past it).
  if (!beside && inRow) lx = Math.max(plot.x, Math.min(gx, plot.x + plot.w - rowW));
  for (const { d, sz } of labels) {
    g.append("rect").attr("x", lx).attr("y", ly + sp("xs")).attr("width", sw).attr("height", sw).attr("rx", mk.cell_corner).attr("fill", colourOf(d));
    K.label(g, lx + swGap, ly, d.valueText, d.name, { knockout: false });
    if (!beside && inRow) lx += sz.w + swGap + sp("2xl"); else ly += sz.h + sp("xl");
  }
  // Encoding: squares per part equal the rounded shares, total 100, colours by part.
  K.assert("waffle counts", spec.items.map((d, i) => [d.id, marks.filter((m) => m.i === i).length, counts[i]]), 0);
  K.assert("waffle total", [["all", marks.length, 100]], 0);
  K.assert("waffle colours", marks.map((m) => [spec.items[m.i].id, m.node.getAttribute("fill"), colourOf(spec.items[m.i])]));
  return { counts };
};
