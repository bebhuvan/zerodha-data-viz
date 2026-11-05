// Choice: claim "Inflation has been under 2% in five of the last six months" | job reference | form lines | tier familiar
// Library example (annotated line with a target band): headline CPI inflation since 2014.
window.draw = function ({ tokens, data }) {
  const g = d3.csvParse(data.cpi_general, (d) => ({ month: d.month, yoy: +d.yoy }));
  const xOf = (m) => +m.slice(0, 4) + (+m.slice(5) - 1) / 12;
  const last = g.at(-1), low = d3.least(g, (d) => d.yoy), peak = d3.greatest(g.filter((d) => d.month >= "2016-08"), (d) => d.yoy);
  const val = (m) => fact(data.facts, `cpi_headline_${m}`);
  const name = (m) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  if (low.month !== "2025-10") throw new Error(`COPY: copy says October 2025 is the low; it is ${low.month}`);
  const F = Frame({ tokens,
    headline: [`India's inflation has been under 2% in five of the last six months`, `Inflation has been under 2% in five of the last six months`, `Inflation was below 2% in five of the past six months`],
    dek: [`Year-on-year change in consumer prices, monthly, 2014 to 2025. Shaded: the RBI's target band of 2% to 6%, in force since August 2016; no six months since then had as many under 2%.`,
          `Year-on-year change in consumer prices, monthly, 2014 to 2025. Shaded: the RBI's target band of 2% to 6%.`,
          `Consumer price inflation, monthly, 2014 to 2025, against the RBI's 2–6% band.`],
    notes: [["MOSPI's published rates for the general index, All-India combined. The gap is April and May 2020, when MOSPI published no rate."]],
    source: "MOSPI (CPI, base 2012); RBI" });
  // Checked claim: the last six months hold five under 2%, and no earlier six-month run since the
  // target (August 2016) held as many.
  const since = g.filter((d) => d.month >= "2016-08");
  const runs = since.map((d, i) => since.slice(Math.max(0, i - 5), i + 1).filter((r) => r.yoy < 2).length);
  if (runs.at(-1) !== 5 || d3.max(runs.slice(0, -1)) >= 5) throw new Error(`COPY: headline says five of the last six under 2%, a first; got ${runs.at(-1)}, earlier max ${d3.max(runs.slice(0, -1))}`);
  const gap = d3.range(2014 * 12, 2026 * 12).map((i) => `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`).filter((m) => !g.some((r) => r.month === m));
  if (gap.join() !== "2020-04,2020-05") throw new Error(`COPY: note names April and May 2020 as the gap; missing are ${gap}`);
  Templates.lines(F, {
    x: { domain: [xOf(g[0].month), xOf(last.month)], ticks: [2014, 2016, 2018, 2020, 2022, 2024].map((y) => ({ at: y, label: String(y) })) },
    y: { unit: "%", zero: 0 },
    refBand: { lo: 2, hi: 6, name: "RBI\u2019s target band", from: 2016 + 7 / 12 },
    // The latest month is named: it is where the headline's "last six months" end.
    series: [{ id: "cpi", role: "hero", color: tokens.color.accent, curve: "linear", end: { value: `${val(last.month).toFixed(2)}%`, name: name(last.month) },
      points: d3.range(xOf(g[0].month) * 12, xOf(last.month) * 12 + 1).map((i) => { const m = `${Math.floor(Math.round(i) / 12)}-${String(Math.round(i) % 12 + 1).padStart(2, "0")}`;
        const d = g.find((r) => r.month === m); return { x: Math.round(i) / 12, y: d ? d.yoy : null }; }) }],
    callouts: [
      { x: xOf(peak.month), y: peak.yoy, value: `${val(peak.month).toFixed(2)}%`, name: name(peak.month), prefer: ["e", "ne", "w", "nw", "se"], dot: true },
      { x: xOf(low.month), y: low.yoy, value: `${val(low.month).toFixed(2)}%`, name: name(low.month), prefer: ["w", "sw", "nw"], dot: true, optional: true },
    ],
  });
};
