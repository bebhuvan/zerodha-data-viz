// Choice: claim "Inflation hit its lowest on record in October 2025" | job season | form calendar | tier specialist | not lines: a reader looks up any month of any year and sees where it sat against the RBI band
// Library example (calendar heatmap): headline CPI inflation, every month since 2014, against RBI's band.
window.draw = function ({ tokens, data }) {
  const C = tokens.color;
  const g = d3.csvParse(data.cpi_general, (d) => ({ month: d.month, yoy: +d.yoy }));
  const low = d3.least(g, (d) => d.yoy);
  const lowV = fact(data.facts, `cpi_headline_${low.month}`);
  if (low.month !== "2025-10") throw new Error(`COPY: copy says October 2025 is the lowest month; it is ${low.month}`);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const F = Frame({ tokens,
    headline: [`India's inflation fell to ${lowV.toFixed(2)}% in October 2025, the lowest on record`,
               `Inflation fell to ${lowV.toFixed(2)}% in October 2025, the lowest on record`,
               `Inflation fell to a record low of ${lowV.toFixed(2)}%`],
    dek: [`Year-on-year change in consumer prices, every month from January 2014 to December 2025, coloured by where it sits against the Reserve Bank's target band of 2% to 6%.`,
          `Consumer price inflation each month, 2014 to 2025, against the RBI's 2–6% target band.`],
    notes: [["The RBI's inflation target is 4%, with a band of 2% to 6%, in force since August 2016. Dashed cells: April and May 2020, when MOSPI published no rate."]],
    explain: [`**How to read this.** Each square is one month, with years running one way and months the other. Grey means inflation was inside the RBI's band of 2% to 6%, blue below it and orange above it. Records begin in January 2014.`, `**How to read this.** One square per month. Grey: inside the RBI's 2% to 6% band; blue below, orange above.`],
    source: "MOSPI (CPI, base 2012, All-India combined); RBI" });
  const years = d3.range(2014, 2026).map(String);
  const missing = years.flatMap((y) => MONTHS.map((m, i) => `${y}-${String(i + 1).padStart(2, "0")}`)).filter((m) => !g.some((r) => r.month === m));
  if (missing.join() !== "2020-04,2020-05") throw new Error(`COPY: note names April and May 2020 as the gap; missing are ${missing}`);
  const cells = years.flatMap((y) => MONTHS.map((m, i) => {
    const key = `${y}-${String(i + 1).padStart(2, "0")}`, d = g.find((r) => r.month === key);
    return { row: y, col: m, value: d ? d.yoy : null };
  }));
  Templates.calendar(F, { rows: years, cols: MONTHS, cells, unit: "%",
    highlight: [{ row: low.month.slice(0, 4), col: MONTHS[+low.month.slice(5) - 1] }],
    // Colour follows the meaning: inside the RBI band is neutral grey, below it cool, above it warm
    // (and warmer past 8%). A month at 4-6% must not look like a breach.
    bins: { thresholds: [2, 6, 8], colors: [C.diverging_cool[1], C.neutral, C.diverging_warm[0], C.diverging_warm[1]],
      title: "Grey: inside the RBI's 2–6% band" } });
};
