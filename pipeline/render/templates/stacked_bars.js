// Template: stacked columns over time, diverging around zero, with an optional total line. For
// "what is driving the total" across many periods: contributions to inflation, sources of growth,
// a fund's return by holding. Two series carry the story in colour; the rest is one quiet grey.
//
// spec = {
//   keys: ["2022-01", ...],                         // one column per key, in order
//   ticks: [{ key, label }],                        // x labels under chosen columns (e.g. each January)
//   series: [{ key, name, role: "hero"|"context", color? }],   // stacking order outward from zero
//   rows: [{ key, [series.key]: value }],           // one per column
//   line?: { name, values: [{ key, value }] },      // the total, drawn over the bars
//   y: { unit: "", dp: 0 },
//   ends?: { [series.key | "line"]: "value text" }, // end labels, named, in a gutter sized to them ("" = name only)
// }
// Direct end labels replace a legend: every series and the line are named at the last column.
window.Templates = window.Templates || {};
window.Templates.stacked_bars = function (F, spec) {
  const K = Kit(F);
  const { svg, plot, C } = F;
  const { fa, fl, sp, gap, ink, mk } = K;
  const g = svg.append("g").attr("class", "chart stacked-bars");
  const colourOf = (s) => s.color || (s.role === "hero" ? C.line_hero : ink.context_fill);  // a large area: the paler fill grey
  const stack = d3.stack().keys(spec.series.map((s) => s.key)).offset(d3.stackOffsetDiverging)(spec.rows);
  const lineVals = spec.line ? spec.line.values.map((d) => d.value) : [];
  const data = d3.extent([...stack.flatMap((s) => s.flatMap((d) => [d[0], d[1]])), ...lineVals]);

  // End labels: the line and each series, value over name, in a right gutter as wide as the widest.
  const endItems = [...(spec.line && spec.ends?.line ? [{ id: "line", name: spec.line.name, value: spec.ends.line }] : []),
    ...spec.series.filter((s) => spec.ends?.[s.key] != null).map((s) => ({ id: s.key, name: s.name, value: spec.ends[s.key] || null }))];
  const gutterR = endItems.length ? d3.max(endItems, (e) => K.labelSize(e.value, e.name).w) + gap("label_mark") : 0;
  const bottom = plot.y + plot.h - fa.size - gap("axis_label");
  const tk = K.ticks(data[0], data[1], bottom - plot.y - fa.size * 0.6, undefined, [K.AX.y_cover, K.AX.y_cover]);
  const fmtTick = (t, top) => K.num(t, { dp: K.tickDp(tk.ticks, spec.y.dp ?? 0) }) + (top ? spec.y.unit || "" : "");
  const gutterL = d3.max(tk.ticks, (t) => textWidth(svg, fmtTick(t, t === d3.max(tk.ticks)), fa)) + gap("axis_label");
  const x = d3.scaleBand(spec.keys, [plot.x + gutterL, plot.x + plot.w - gutterR]).paddingInner(1 - mk.column_ratio);
  const y = d3.scaleLinear(tk.domain, [bottom, plot.y + fa.size * 0.6]);
  K.yGrid(g, y, tk.ticks, { x0: x.range()[0], x1: x.range()[1], fmt: fmtTick, zero: 0, data });

  // Segments, with a hairline of white between them so the stack reads as parts.
  const seam = sp("2xs") / 2, segs = [];
  for (const s of stack) {
    const ser = spec.series.find((d) => d.key === s.key);
    for (const d of s) {
      const y0 = y(Math.max(d[0], d[1])), h = Math.abs(y(d[0]) - y(d[1]));
      if (h <= 0) continue;
      const r = g.append("rect").attr("class", "bar").attr("x", x(d.data.key)).attr("width", x.bandwidth())
        .attr("y", y0 + seam).attr("height", Math.max(0, h - 2 * seam)).attr("fill", colourOf(ser)).attr("data-id", `${s.key}|${d.data.key}`);
      segs.push({ d, ser, node: r.node() });
    }
  }
  // The total line over the bars: baseline ink at compare weight, on a white casing, with an end dot.
  const cx = (key) => x(key) + x.bandwidth() / 2;
  if (spec.line) {
    const line = d3.line().x((d) => cx(d.key)).y((d) => y(d.value));
    g.append("path").datum(spec.line.values).attr("class", "halo").attr("d", line).attr("fill", "none").attr("stroke", C.surface).attr("stroke-width", K.sw("hero"));
    g.append("path").datum(spec.line.values).attr("class", "series line").attr("d", line).attr("fill", "none").attr("stroke", ink.baseline)
      .attr("stroke-width", K.sw("compare")).attr("stroke-linejoin", "round");
    const e = spec.line.values.at(-1);
    K.dot(g, cx(e.key), y(e.value), ink.baseline);
  }
  // End labels in a lane beside the last column, each near its segment's middle (or the line's end).
  const lastKey = spec.keys.at(-1), lastSeg = (key) => stack.find((s) => s.key === key).at(-1);
  // A name with no value gets a wider margin, so it cannot read as the name of the pair beside it.
  const margin = (e) => (e.value ? 0 : sp("m"));
  const items = endItems.map((e) => ({ e, size: K.labelSize(e.value, e.name).h + 2 * margin(e),
    target: e.id === "line" ? y(spec.line.values.at(-1).value) : y((lastSeg(e.id)[0] + lastSeg(e.id)[1]) / 2) }));
  for (const it of K.lane(items, plot.y, bottom, sp("s"))) K.label(g, x.range()[1] + gap("label_mark"), it.pos - it.size / 2 + margin(it.e), it.e.value, it.e.name, { knockout: false });
  for (const t of spec.ticks) K.text(g, x(t.key), bottom + gap("axis_label") + fa.size * 0.8, t.label, fa, fa.color, "start");

  // Encoding: every segment's top and height from the stacked values with plain arithmetic, its colour by series.
  const ly = K.lin(...y.domain(), ...y.range());
  K.assert("segment positions", segs.flatMap(({ d, ser, node }) => [[`${ser.key} ${d.data.key} top`, node.getAttribute("y"), ly(Math.max(d[0], d[1])) + seam],
    [`${ser.key} ${d.data.key} height`, +node.getAttribute("height"), Math.max(0, Math.abs(ly(d[0]) - ly(d[1])) - 2 * seam)]]), 0.5);
  K.assert("segment colours", segs.map(({ ser, node }) => [ser.key, node.getAttribute("fill"), colourOf(ser)]));
  return { x, y };
};
