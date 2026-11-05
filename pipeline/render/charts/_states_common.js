// Shared by the state charts: data, binning, legend, frame text (text: for charts that draw missing places
// with a dashed outline; textLeftOut: for charts that leave them out), encoding check.
window.States = function ({ tokens, data }) {
  const rows = d3.csvParse(data.state_cpi, d3.autoType);
  const byName = new Map(rows.map((r) => [r.name, r]));
  const C = tokens.color;
  const INDIA = fact(data.facts, "state_cpi_2025-12_All India");
  // Diverging with a neutral middle: within ±1 point of zero is "roughly flat", so noise
  // around zero does not split the country into two colours. Warm bins every 2 points above.
  const thresholds = [-2, -1, 1, ...C.diverging_warm.slice(1).map((_, i) => 1 + 2 * (i + 1))];
  const colors = [C.diverging_cool[0], C.diverging_cool[1], C.neutral || C.grid, ...C.diverging_warm];
  const scale = d3.scaleThreshold(thresholds, colors);
  const missing = (r) => !r || r.inflation == null || Number.isNaN(r.inflation);
  const fill = (r, hatch = true) => (!missing(r) ? scale(r.inflation) : hatch ? "url(#nodata)" : C.nodata);
  const fmt = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  const mark = tokens.hatch_nodata ? "Hatched" : "Dashed outline";
  const pct = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
  const KL = fact(data.facts, "state_cpi_2025-12_Kerala"), MN = fact(data.facts, "state_cpi_2025-12_Manipur");
  // "Seven times": Kerala over India, rounded to a whole number, checked here so the headline cannot drift.
  if (Math.round(KL / INDIA) !== 7) throw new Error(`COPY: headline says seven times, data says ${(KL / INDIA).toFixed(1)}`);
  const noFigure = rows.filter(missing).map((r) => r.name);
  const text = {
    kicker: "Inflation by state",
    headline: [
      "Prices in Kerala are rising seven times as fast as in India overall",
      "Prices in Kerala are rising seven times as fast as India's",
    ],
    dek: [
      `Year-on-year change in consumer prices, December 2025. Kerala's ${pct(KL)} compares with ${pct(INDIA)} for India; across most of the country prices barely moved. Manipur, at ${pct(MN)}, saw them fall.`,
      `Year-on-year change in consumer prices, December 2025. Kerala ${pct(KL)}, India ${pct(INDIA)}, Manipur ${pct(MN)}.`,
    ],
    // Notes name a visual device only when the chart draws it (render and lint check this):
    // the map and tiles mark missing places with a dashed outline; the ranked chart leaves them out.
    notes: [[
      `${mark}: no comparable figure. ` + rows.filter(missing).map((r) =>
        `${r.name}: ${/^[A-Z][a-z]/.test(r.note) ? r.note[0].toLowerCase() + r.note.slice(1) : r.note}`).join("; ") + ".",
      `${mark}: no comparable figure (${noFigure.join(", ")}).`,
      `${mark}: no comparable figure for ${noFigure.length} states and union territories.`,
    ]],
    source: "MOSPI (CPI, base 2012, combined rural and urban)",
  };

  function defs(svg) {
    const p = svg.append("defs").append("pattern").attr("id", "nodata").attr("width", 8).attr("height", 8)
      .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 8).attr("height", 8).attr("fill", C.nodata);
    p.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 8).attr("stroke", C.muted).attr("stroke-width", 2);  // editorial theme only
  }

  // Binned legend (for the map sketch): the kit's binned legend with this scale, India marked.
  const legendOpts = (o = {}) => ({ thresholds, colors, unit: "%", sign: true, marker: { value: INDIA, name: `India ${INDIA.toFixed(2)}%` },
    nofig: !tokens.hatch_nodata, ...o });
  const layoutLegend = (svg, F, o = {}) => Kit(F).binLegendSize(legendOpts(o));
  const legend = (svg, F, x, y, o = {}) => Kit(F).binLegend(svg, x, y, legendOpts({ vertical: o.layout?.vertical ?? o.vertical, maxW: o.maxW }));

  // Encoding check: each mark's fill must equal the token bin for its value, recomputed here
  // independently of the d3 scale used to draw.
  function assertEncoding(nodes, values, ids, hatch) {
    const expect = (v) => (v == null || Number.isNaN(v) ? (hatch ? "url(#nodata)" : C.nodata) : colors[thresholds.filter((t) => v >= t).length]);
    const bad = ids.filter((_, i) => nodes[i].getAttribute("fill") !== expect(values[i]));
    if (bad.length) throw new Error(`ENCODING: fills differ from token bins for ${bad.join(", ")}`);
  }
  // The same copy for a chart that leaves the missing places out instead of drawing them.
  const textLeftOut = { ...text, notes: [[
    `Not shown, for want of a comparable figure: ${noFigure.join(", ")}.`,
    `${noFigure.length} states and union territories without a comparable figure are not shown.`,
  ]] };
  return { rows, byName, fill, fmt, text, textLeftOut, defs, legend, layoutLegend, scale, colors, thresholds, missing, assertEncoding };
};

