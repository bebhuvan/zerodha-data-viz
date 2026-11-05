// Chart 2: every ENSO year since 1950 overlaid on one June-to-May axis, so 2026 can be read
// directly against the strongest past El Niños at the same point in the year.
window.draw = function ({ tokens, data }) {
  const oni = d3.csvParse(data.oni, d3.autoType);
  const latest = oni.at(-1);
  const PAST = { 2015: "2015–16", 1997: "1997–98", 1982: "1982–83" };
  const byYear = d3.group(oni, (d) => d.enso_year);
  // Look peers up by year, never by position: object keys sort numerically, which once put 1982's value under 2015.
  const atLatest = (yr) => byYear.get(yr).find((d) => d.month_pos === latest.month_pos).anom.toFixed(2);

  const F = Frame({
    tokens,
    kicker: "Climate",
    headline: ["No El Niño since 1950 has been this strong by September", "No El Niño since 1950 was this strong by September"],
    dek: [
      `Oceanic Niño Index for every year since 1950, June to the following May. At +${latest.anom.toFixed(2)}°C for July to September, [[2026|line_hero]] is ahead of 1997 (+${atLatest(1997)}°C) and 2015 (+${atLatest(2015)}°C) at the same point.`,
      `Oceanic Niño Index, June to May, every year since 1950. [[2026|line_hero]] is at +${latest.anom.toFixed(2)}°C, ahead of 1997 and 2015 at this point.`,
    ],
    notes: [[
      "Three-month averages of sea-surface temperature anomalies in the Niño 3.4 region of the Pacific, against a 1991–2020 base. El Niño conditions begin at +0.5°C. 2026 values are provisional.",
      "Three-month sea-surface temperature anomalies, Niño 3.4 region, against a 1991–2020 base. El Niño begins at +0.5°C. 2026 is provisional.",
    ]],
    source: "NOAA Climate Prediction Center (ONI, ERSSTv5)",
  });
  const { svg, plot, C, font, k } = F;
  const fa = font("axis"), fl = font("label"), fs = font("label_strong");
  const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}°C`;

  const top = plot.y, bottom = plot.y + plot.h - fa.size - 16 * k;
  // The threshold label sits in the axis column, between the +1 and 0 ticks, so the plot can run
  // to the right margin. On canvases too short for that (judged at the tallest axis the label loop
  // below may pick), it falls back to a right gutter.
  const threshInAxis = (bottom - top) / 8.2 / 2 >= (fa.size + fl.size) / 2 + 6 * k;
  const gutterL = Math.max(textWidth(svg, "−2°C", fa), threshInAxis ? textWidth(svg, "El Niño", fl) : 0) + 16 * k;
  const gutterR = threshInAxis ? 4 * k : textWidth(svg, "El Niño line", fl) + 24 * k;
  const x = d3.scaleLinear([0, 11], [plot.x + gutterL, plot.x + plot.w - gutterR]);
  const series = [...byYear.values()].map((pts) => pts.map((d) => ({ x: d.month_pos, y: d.anom })));

  // Labels: 2026 top-left, past El Niños stacked top-right. Both must sit clear of every line;
  // if they do not fit, raise the top of the axis until they do (short landscape canvases).
  const order = Object.entries(PAST).map(([yr, name]) => ({ name, pk: d3.greatest(byYear.get(+yr), (d) => d.anom) }))
    .sort((a, b) => b.pk.anom - a.pk.anom);
  const stackW = d3.max(order, (o) => textWidth(svg, o.name, fs) + 10 * k + textWidth(svg, `peak ${signed(o.pk.anom)}`, fl));
  const rowH = fs.size + 14 * k;
  const nowLines = [`2026 so far  +${latest.anom.toFixed(2)}°C`, "highest July–September reading since 1950"];
  const nowW = Math.max(textWidth(svg, nowLines[0], fs), textWidth(svg, nowLines[1], fl));
  let y, sx;
  // Bottom of the axis just below the coldest reading (and the −2°C gridline), so no dead strip.
  const yBottom = Math.min(-2, d3.min(oni, (d) => d.anom)) - 0.15;
  for (const yTop of [3, 3.5, 4, 4.5, 5, 6]) {
    y = d3.scaleLinear([yBottom, yTop], [bottom, top]);
    const nowBox = { l: x(0), r: x(0) + nowW, t: top, b: top + fs.size + fl.size + 16 * k };
    sx = [8.4, 9, 9.5, 10].map((p) => Math.min(x(p), x(11) + gutterR - stackW))
      .find((px) => clearOfLines({ l: px, r: px + stackW, t: top, b: top + rowH * order.length }, series, x, y, 6 * k));
    if (sx !== undefined && clearOfLines(nowBox, series, x, y, 6 * k)) break;
  }
  if (sx === undefined) sx = x(11) + gutterR - stackW;
  // The two label groups must also clear each other: shorten the 2026 note, or drop it
  // (the dek already carries it) when the canvas is too narrow.
  for (const alt of ["a July–September record", ""]) {
    // Leaders run up and right from each peak, so the note must end before the leftmost peak too.
    const limit = Math.min(sx, d3.min(order, (o) => x(o.pk.month_pos)));
    if (x(0) + Math.max(textWidth(svg, nowLines[0], fs), textWidth(svg, nowLines[1], fl)) + 24 * k < limit) break;
    nowLines[1] = alt;
  }
  const g = svg.append("g");

  // Gridlines stay out of the label zone at the top.
  const labelZone = top + Math.max(fs.size + fl.size + 16 * k, rowH * order.length) + 8 * k;
  for (const t of d3.range(-2, Math.floor(y.domain()[1]) + 1).filter((t) => y(t) > labelZone || t <= 2)) {
    g.append("line").attr("x1", x(0)).attr("x2", x(11)).attr("y1", y(t)).attr("y2", y(t))
      .attr("stroke", t === 0 ? C.axis : C.grid).attr("stroke-width", k);
    g.append("text").attr("x", x(0) - 14 * k).attr("y", y(t) + fa.size * 0.35).attr("text-anchor", "end")
      .attr("font-family", fa.family).attr("font-size", fa.size).attr("fill", C.muted).text(signed(t));
  }
  // El Niño threshold.
  g.append("line").attr("x1", x(0)).attr("x2", x(11)).attr("y1", y(0.5)).attr("y2", y(0.5))
    .attr("stroke", C.label).attr("stroke-width", k).attr("stroke-dasharray", tokens.leader_dash);
  g.append("text").attr("x", threshInAxis ? x(0) - 14 * k : x(11) + 16 * k).attr("y", y(0.5) + fl.size * 0.35)
    .attr("text-anchor", threshInAxis ? "end" : "start").attr("font-family", fl.family).attr("font-size", fl.size)
    .attr("fill", C.ink2).text(threshInAxis ? "El Niño" : "El Niño line");

  // Monotone smoothing passes through every reading and never overshoots between them; the ONI
  // is already a three-month running mean, so the curve adds no detail the data lacks.
  const line = d3.line().x((d) => x(d.month_pos)).y((d) => y(d.anom)).curve(d3.curveMonotoneX);
  const draw = (pts, stroke, width) => g.append("path").datum(pts).attr("d", line).attr("fill", "none")
    .attr("stroke", stroke).attr("stroke-width", width).attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
  for (const [yr, pts] of byYear) if (!(yr in PAST) && yr !== latest.enso_year) draw(pts, C.line_bg, k);
  for (const yr of Object.keys(PAST)) draw(byYear.get(+yr), C.line_mid, 2 * k);
  const now = byYear.get(latest.enso_year);
  draw(now, C.surface, 8 * k);
  draw(now, C.line_hero, 4 * k);
  g.append("circle").attr("cx", x(latest.month_pos)).attr("cy", y(latest.anom)).attr("r", 7 * k)
    .attr("fill", C.line_hero).attr("stroke", C.surface).attr("stroke-width", 2.5 * k);

  // Past El Niños: compact stack, each tied to its peak by a short dashed leader.
  order.forEach((it, i) => {
    const ty = top + fs.size * 0.8 + i * rowH;
    const t = g.append("text").attr("x", sx).attr("y", ty).attr("font-family", fs.family).attr("font-size", fs.size)
      .attr("font-weight", fs.weight).attr("fill", C.ink).text(it.name);
    t.append("tspan").attr("dx", 10 * k).attr("font-family", fl.family).attr("font-size", fl.size).attr("font-weight", 400)
      .attr("fill", C.ink2).text(`peak ${signed(it.pk.anom)}`);
    g.append("path").attr("d", `M${x(it.pk.month_pos) + 4 * k},${y(it.pk.anom) - 4 * k}L${sx - 10 * k},${ty - fs.size * 0.35}`)
      .attr("fill", "none").attr("stroke", C.label).attr("stroke-width", k).attr("stroke-dasharray", tokens.leader_dash);
    g.append("circle").attr("cx", x(it.pk.month_pos)).attr("cy", y(it.pk.anom)).attr("r", 3 * k).attr("fill", C.line_mid);
  });

  // 2026, top-left, with a dashed drop to its latest reading.
  const ly = top + fs.size * 0.8;
  g.append("text").attr("x", x(0)).attr("y", ly).attr("font-family", fs.family).attr("font-size", fs.size)
    .attr("font-weight", fs.weight).attr("fill", C.ink).text(nowLines[0]);
  if (nowLines[1]) g.append("text").attr("x", x(0)).attr("y", ly + fl.size + 8 * k).attr("font-family", fl.family)
    .attr("font-size", fl.size).attr("fill", C.ink2).text(nowLines[1]);
  g.append("path").attr("d", `M${x(latest.month_pos)},${ly + (nowLines[1] ? fl.size + 22 * k : 14 * k)}V${y(latest.anom) - 12 * k}`)
    .attr("fill", "none").attr("stroke", C.label).attr("stroke-width", k).attr("stroke-dasharray", tokens.leader_dash);

  for (const [pos, m] of [[0, "Jun"], [2, "Aug"], [4, "Oct"], [6, "Dec"], [8, "Feb"], [10, "Apr"]]) {
    g.append("text").attr("x", x(pos)).attr("y", bottom + 10 * k + fa.size).attr("text-anchor", "middle")
      .attr("font-family", fa.family).attr("font-size", fa.size).attr("fill", C.muted).text(m);
  }
};
