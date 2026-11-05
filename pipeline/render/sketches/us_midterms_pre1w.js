// Choice: claim "Nifty 50 rose in the week before nine of ten US mid-terms" | job amounts | form columns | tier familiar
// Columns: Nifty 50 return in the week leading into each US mid-term election (1990 to 2026).
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.us_midterms_nifty, (d) => ({ year: +d.year, m1w: +d.m1w, p1d: +d.p1d }));
  if (f("midterm_m1w_all_pos") !== 9 || f("midterm_m1w_all_n") !== 10 || f("midterm_m1w_1998") >= 0)
    throw new Error("COPY: headline claims Nifty rose in 9 of 10 pre-midterm weeks, with 1998 the only fall");

  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1, sign: v !== 0 });
  const r26 = f("midterm_m1w_2026"), r90 = f("midterm_m1w_1990"), r98 = f("midterm_m1w_1998"), d26 = f("midterm_p1d_2026");

  const F = Frame({ tokens,
    headline: [
      `Nifty 50 rose in the week before nine of ten US mid-term elections`,
      `Indian stocks rose in the week before nine of ten US mid-term elections`,
      `Nifty 50 gained in the week before nine of ten US mid-term votes`,
      `Nifty 50 rose before nine of the ten US mid-term elections`,
      `Indian stocks rallied before nine of ten US mid-term votes`,
    ],
    dek: [
      `Nifty 50 change in the seven days up to each US mid-term election, 1990 to 2026. [[2026|line_hero]] gained ${pct(r26)} before the vote and ${pct(d26)} on results day; only 1998 (${pct(r98)}) fell in the run-up.`,
      `Nifty 50 change in the week before each US mid-term election, 1990 to 2026. [[2026|line_hero]] gained ${pct(r26)} before the vote; only 1998 (${pct(r98)}) fell.`,
    ],
    notes: [[
      `Price index (dividends excluded), measured over the seven calendar days ending on the last Indian close on or before US Election Tuesday. Across the nine completed cycles since 1990, the median gain in the week after the vote slowed to ${pct(f("midterm_p1w_hist_median"))}.`,
      `Price index, seven calendar days ending on or before Election Tuesday.`,
    ]],
    source: "NSE Indices; Zerodha calculations" });

  Templates.columns(F, {
    bars: rows.map((r) => ({
      x: String(r.year),
      value: f(`midterm_m1w_${r.year}`),
      role: r.year === 2026 ? "hero" : (r.year === 1990 || r.year === 1998) ? "compare" : "context",
      color: r.year === 2026 ? tokens.color.line_hero : null,
    })),
    x: { ticks: rows.map((r) => ({ at: String(r.year), label: String(r.year) })) },
    y: { unit: "%", dp: 0, sign: true },
    callouts: [
      { x: "2026", value: pct(r26), name: "2026", prefer: ["w", "nw", "n"] },
    ],
  });
};
