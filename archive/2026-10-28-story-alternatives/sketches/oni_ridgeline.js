// Chart 2 (alternative): every ENSO year since 1950 as a ridge of the Oceanic Nino Index, June to May.
window.draw = function ({ tokens, data }) {
  const oni = d3.csvParse(data.oni, d3.autoType);
  const years = d3.range(d3.min(oni, (d) => d.enso_year), d3.max(oni, (d) => d.enso_year) + 1);
  const latest = oni.at(-1);
  const HIGHLIGHT = { 2026: "2026", 2015: "2015–16", 1997: "1997–98", 1982: "1982–83" };
  const byYear = d3.group(oni, (d) => d.enso_year);
  const atLatest = (yr) => byYear.get(yr).find((d) => d.month_pos === latest.month_pos).anom.toFixed(2);

  const F = Frame({
    tokens,
    kicker: "Climate",
    headline: ["No El Niño since 1950 has been this strong by September", "No El Niño since 1950 was this strong by September"],
    dek: [
      `Each line is one year of the Oceanic Niño Index, June to the next May; shaded peaks are El Niño months, when the Pacific runs at least 0.5°C warmer than normal. [[2026|ridge_highlight]] is at +${latest.anom.toFixed(2)}°C for July to September, ahead of 1997 (+${atLatest(1997)}°C) and 2015 (+${atLatest(2015)}°C) at the same point.`,
      `Oceanic Niño Index, one line per year since 1950; shaded peaks are El Niño months. [[2026|ridge_highlight]] is at +${latest.anom.toFixed(2)}°C, a record for July to September.`,
    ],
    notes: [[
      "Three-month averages of sea-surface temperature anomalies in the Niño 3.4 region against a 1991–2020 base. Recent values are provisional.",
      "Niño 3.4 sea-surface temperature anomalies, 1991–2020 base. Recent values are provisional.",
    ]],
    source: "NOAA Climate Prediction Center (ONI, ERSSTv5)",
  });
  const { svg, plot, C, font, k } = F;
  const fa = font("axis"), fs = font("label_strong"), fl = font("label");
  const g = svg.append("g");

  const labelW = d3.max(Object.entries(HIGHLIGHT), ([yr, n]) => Math.max(textWidth(svg, n, fs),
    textWidth(svg, `peak +${d3.max(byYear.get(+yr), (d) => d.anom).toFixed(2)}°C`, fl), textWidth(svg, "+0.00°C so far", fl)));
  const gutterL = textWidth(svg, "2020", fa) + 20 * k, gutterR = labelW + 28 * k;  // labels start 28k right of the last month
  const bottom = plot.y + plot.h - fa.size - 16 * k;
  // Ridge height follows row spacing: 1°C is R rows, tall enough that El Niño years stand up as
  // peaks over their neighbours (at 1.35 rows they read as flat bands). Headroom above the first row
  // is just what the tallest early ridge needs.
  const R = 2.6;
  const peakOf = (yr) => d3.max(byYear.get(yr), (d) => d.anom);
  const headRows = Math.max(0, d3.max(years, (yr, i) => R * peakOf(yr) - i));
  const step = (bottom - plot.y) / (years.length - 1 + headRows);
  const amp = R * step;
  const x = d3.scaleLinear([0, 11], [plot.x + gutterL, plot.x + plot.w - gutterR]);
  const row = d3.scalePoint(years, [plot.y + headRows * step, bottom]);

  // Draw top to bottom so each later year sits in front of the one above it.
  for (const yr of years) {
    const pts = byYear.get(yr);
    const base = row(yr);
    const hi = yr in HIGHLIGHT;
    const yv = (v) => base - v * amp;
    const ridge = g.append("g").attr("class", "ridge");
    ridge.append("path").datum(pts).attr("fill", C.surface) // occlude rows behind
      .attr("d", d3.area().x((d) => x(d.month_pos)).y0(base).y1((d) => yv(d.anom)).curve(d3.curveMonotoneX));
    // Colour only the part above the +0.5°C El Niño threshold.
    ridge.append("path").datum(pts).attr("fill", hi ? C.ridge_highlight : C.ridge_shade)
      .attr("d", d3.area().x((d) => x(d.month_pos)).y0(yv(0.5)).y1((d) => yv(Math.max(0.5, d.anom))).curve(d3.curveMonotoneX));
    ridge.append("path").datum(pts)
      .attr("d", d3.line().x((d) => x(d.month_pos)).y((d) => yv(d.anom)).curve(d3.curveMonotoneX))
      .attr("fill", "none").attr("stroke", hi ? C.ridge_highlight : (C.ridge_line || C.ink2))
      .attr("stroke-width", (hi ? 2 : 1) * k).attr("stroke-linejoin", "round");
  }

  // Decade labels on the left.
  for (const yr of years.filter((y) => y % 10 === 0)) {
    g.append("text").attr("x", plot.x).attr("y", row(yr) + fa.size * 0.35).attr("font-family", fa.family)
      .attr("font-size", fa.size).attr("fill", C.muted).text(yr);
  }

  // Highlighted years: labelled on the right at their peak (or latest reading), dodged.
  const items = Object.entries(HIGHLIGHT).map(([yr, label]) => {
    const pts = byYear.get(+yr);
    const peak = d3.greatest(pts, (d) => d.anom), end = pts.at(-1);
    const isLatest = +yr === latest.enso_year;
    const pt = isLatest ? end : peak;
    return { label, pt, isLatest, sub: isLatest ? `+${latest.anom.toFixed(2)}°C so far` : `peak +${peak.anom.toFixed(2)}°C`,
             target: row(+yr) - pt.anom * amp, px: x(pt.month_pos) };
  });
  const lx = x(11) + 28 * k;
  for (const it of dodge(items, fs.size + fl.size + 16 * k, plot.y + amp + 24 * k, bottom)) {
    g.append("path").attr("d", `M${it.px + 6 * k},${it.target}L${lx - 26 * k},${it.target}L${lx - 6 * k},${it.pos}`)
      .attr("fill", "none").attr("stroke", C.leader).attr("stroke-width", k).attr("stroke-dasharray", tokens.leader_dash);
    if (it.isLatest) g.append("circle").attr("cx", it.px).attr("cy", it.target).attr("r", 6 * k).attr("fill", C.ridge_highlight)
      .attr("stroke", C.surface).attr("stroke-width", 2 * k);
    g.append("text").attr("x", lx).attr("y", it.pos + fs.size * 0.35).attr("font-family", fs.family).attr("font-size", fs.size)
      .attr("font-weight", fs.weight).attr("fill", it.isLatest ? C.text_accent : C.ink).text(it.label);
    g.append("text").attr("x", lx).attr("y", it.pos + fs.size * 0.35 + fl.size + 6 * k).attr("font-family", fl.family)
      .attr("font-size", fl.size).attr("fill", C.ink2).text(it.sub);
  }

  for (const [pos, m] of [[0, "Jun"], [3, "Sep"], [6, "Dec"], [9, "Mar"], [11, "May"]]) {
    g.append("text").attr("x", x(pos)).attr("y", bottom + 10 * k + fa.size).attr("text-anchor", "middle")
      .attr("font-family", fa.family).attr("font-size", fa.size).attr("fill", C.muted).text(m);
  }

  // Scale key, top of the label column: a bracket as tall as 1°C.
  const kx = lx + 4 * k, ky = plot.y;
  g.append("path").attr("d", `M${kx + 8 * k},${ky}H${kx}V${ky + amp}H${kx + 8 * k}`).attr("fill", "none")
    .attr("stroke", C.label).attr("stroke-width", 1.5 * k);
  g.append("text").attr("x", kx + 16 * k).attr("y", ky + amp / 2 + fa.size * 0.35)
    .attr("font-family", fa.family).attr("font-size", fa.size).attr("fill", C.ink2).text("1°C");
};
