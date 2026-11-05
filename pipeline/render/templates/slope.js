// Template: slope. Many items at two dates, a line each; the one or two the story is about in
// colour, the rest grey. For "what flipped": vegetables from top to bottom, gold from middle to top.
// Highlight grammar: hero lines are labelled at both ends with the label pair (value, then name);
// context lines are unlabelled light grey, named once as a group (contextName) beside the bundle.
//
// spec = {
//   from: "Dec 2024", to: "Dec 2025",
//   v: { unit: "%", dp: 1, sign: false },
//   items: [{ id, name, from, to, role: "hero"|"compare"|"context", color? }],
//   contextName?: "Other food groups",
// }
window.Templates = window.Templates || {};
window.Templates.slope = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, fs, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart slope");
  const fmt = (v) => K.num(v, { dp: spec.v.dp ?? 1, sign: spec.v.sign }) + (spec.v.unit || "");
  const named = spec.items.filter((it) => it.role !== "context");
  const colourOf = (it) => it.color || (it.role === "hero" ? C.line_hero : it.role === "compare" ? ink.compare : ink.context);
  const block = (it, key) => K.labelSize(fmt(it[key]), it.name);
  const ctxSize = spec.contextName ? K.labelSize(null, spec.contextName) : { w: 0, h: 0 };
  const leftW = d3.max(named, (it) => block(it, "from").w) + gap("label_mark");
  const rightW = Math.max(d3.max(named, (it) => block(it, "to").w), ctxSize.w) + gap("label_mark");
  const headH = fl.size + gap("axis_label");
  const top = plot.y + headH + fs.size, bottom = plot.y + plot.h - fs.size;
  // The two date axes take the full width left by the labels: no dead band between the columns.
  const xl = plot.x + leftW, xr = plot.x + plot.w - rightW;
  if (xr - xl < sp("3xl") * 4) throw new Error(`LAYOUT: only ${Math.round(xr - xl)}px between the two dates`);
  const vals = spec.items.flatMap((it) => [it.from, it.to]);
  const [lo, hi] = d3.extent([...vals, 0]);
  const y = d3.scaleLinear([lo, hi], [bottom, top]);

  K.text(g, xl, plot.y + fl.size * 0.8, spec.from, fl, fl.color, "middle");
  K.text(g, xr, plot.y + fl.size * 0.8, spec.to, fl, fl.color, "middle");
  for (const xx of [xl, xr]) g.append("line").attr("class", "grid").attr("x1", xx).attr("x2", xx).attr("y1", top - sp("s")).attr("y2", bottom + sp("s"))
    .attr("stroke", ink.grid).attr("stroke-width", K.sw("grid"));
  // Zero, when the values cross it, as the baseline between the two axes.
  if (lo < 0 && hi > 0) g.append("line").attr("class", "baseline").attr("x1", xl).attr("x2", xr).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", ink.baseline).attr("stroke-width", K.sw("baseline"));
  const order = { context: 0, compare: 1, hero: 2 };
  const lines = [];
  for (const it of [...spec.items].sort((a, b) => order[a.role] - order[b.role])) {
    const c = colourOf(it);
    if (it.role === "hero") g.append("line").attr("class", "halo").attr("x1", xl).attr("x2", xr).attr("y1", y(it.from)).attr("y2", y(it.to))
      .attr("stroke", C.surface).attr("stroke-width", K.sw("hero") + 2 * K.sw("halo")).attr("stroke-linecap", "round");
    const ln = g.append("line").attr("class", `series ${it.role}`).attr("x1", xl).attr("x2", xr).attr("y1", y(it.from)).attr("y2", y(it.to))
      .attr("stroke", c).attr("stroke-width", K.sw(it.role)).attr("stroke-linecap", "round").attr("data-id", it.id);
    lines.push({ it, node: ln.node() });
    if (it.role !== "context") for (const xx of [xl, xr]) K.dot(g, xx, y(xx === xl ? it.from : it.to), c, it.role === "hero" ? mk.dot : mk.dot_small);
  }
  // Labels in a lane on each side, each block as near its line end as the others allow.
  const side = (key, x, anchor) => {
    const its = named.map((it) => ({ it, target: y(it[key]), size: block(it, key).h }));
    if (key === "to" && spec.contextName) {
      const ctx = spec.items.filter((it) => it.role === "context").map((it) => y(it.to));
      its.push({ ctx: true, target: d3.median(ctx), size: ctxSize.h });
    }
    for (const p of K.lane(its, plot.y + headH, plot.y + plot.h - sp("s"), sp("s"))) {  // knockouts stay off the footer
      if (p.ctx) { K.label(g, x, p.pos - p.size / 2, null, spec.contextName, { anchor }); continue; }
      const top0 = p.pos - p.size / 2, ly = y(p.it[key]);
      K.label(g, x, top0, fmt(p.it[key]), p.it.name, { anchor });
      // A label pushed off its line end gets a leader back to it.
      if (Math.abs(ly - p.pos) > p.size / 2) K.leader(g, [[anchor === "end" ? x + sp("xs") : x - sp("xs"), Math.max(top0, Math.min(ly, top0 + p.size))], [anchor === "end" ? xl - mk.dot : xr + mk.dot, ly]]);
    }
  };
  side("from", xl - gap("label_mark"), "end");
  side("to", xr + gap("label_mark"), "start");

  // Encoding: both ends of every line from the data with plain arithmetic, and colour from role.
  const ly = K.lin(lo, hi, bottom, top);
  K.assert("slope ends", lines.flatMap(({ it, node }) => [[`${it.id} from`, node.getAttribute("y1"), ly(it.from)], [`${it.id} to`, node.getAttribute("y2"), ly(it.to)]]), 0.5);
  K.assert("slope colours", lines.map(({ it, node }) => [it.id, node.getAttribute("stroke"), colourOf(it)]));
  return { y };
};
