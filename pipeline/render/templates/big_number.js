// Template: big number. One figure the post is about, set at headline size inside the chart, what it
// is beneath it (label pair: the figure is the value, the line under it the name), an optional change
// line, and a short history drawn with the lines template in the space left. For "the number today"
// posts: a yield, an index level, a price. The history must have its own axis; the big figure is the
// last point of it and the chart checks that.
//
// spec = {
//   value: "7.06%", name: "India's 10-year government bond yield, September 2026",
//   change?: "+0.48 points on a year earlier",
//   history?: { x: { domain }, y: { unit, zero?: null }, points: [{ x, y }], last: number, color? },
// }
window.Templates = window.Templates || {};
window.Templates.big_number = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fl, sp, gap } = K;
  const fh = F.font("headline"), fd = F.font("label_strong");
  const g = svg.append("g").attr("class", "chart big-number");
  let y = plot.y;
  K.text(g, plot.x, y + fh.size * 0.8, spec.value, fh, C.ink);
  y += fh.size + gap("value_name") + sp("xs");
  const nameH = F.textBlock(g, spec.name, fl, plot.x, y, Math.min(plot.w, fl.size * 28), fl.color);
  y += nameH;
  if (spec.change) { y += sp("xs"); K.text(g, plot.x, y + fd.size * 0.8, spec.change, fd, C.ink); y += fd.size; }
  const rest = { x: plot.x, y: y + sp("xl"), w: plot.w, h: plot.y + plot.h - y - sp("xl") };
  if (spec.history) {
    if (rest.h < Math.min(F.T.canvas.width, F.T.canvas.height) * 0.25) throw new Error(`LAYOUT: only ${Math.round(rest.h)}px left for the history`);
    const h = spec.history, lastPt = h.points.filter((p) => p.y != null).at(-1);
    if (Math.abs(lastPt.y - h.last) > 1e-9) throw new Error(`ENCODING: big number ${h.last} is not the history's last point ${lastPt.y}`);
    Templates.lines({ ...F, plot: rest }, { x: h.x, y: h.y,
      series: [{ id: "history", role: "hero", color: h.color || C.accent, curve: "linear", points: h.points }], callouts: h.callouts });
  }
  return { g, K };
};
