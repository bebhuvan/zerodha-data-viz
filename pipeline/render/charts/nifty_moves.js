// Choice: claim "Most days the Nifty moves less than 1%" | job distribution | form histogram | tier learnable
// Histogram: how far the Nifty 50 moves in a day.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const bins = d3.csvParse(data.nifty_daily_hist, d3.autoType);
  const share = f("nifty_share_days_within_1pct");
  // Checked claim: "seven of every ten" means 65-75%.
  if (share < 65 || share >= 75) throw new Error(`COPY: headline says seven in ten days; share is ${share}%`);
  const within = bins.filter((b) => b.lo >= -1 && b.hi <= 1).reduce((s, b) => s + b.days, 0);
  if (within !== f("nifty_days_within_1pct")) throw new Error("ENCODING: hero bins do not hold the days within 1%");
  const pctS = (v) => (v === 0 ? "0" : `${v < 0 ? "−" : "+"}${Math.abs(v)}%`);
  const first = Fmt.monthName(f("nifty_first_date").slice(0, 7), true), worst = f("nifty_worst_day");
  const F = Frame({ tokens,
    headline: [`The Nifty 50 moves less than 1% on seven trading days in ten`, `The Nifty moves less than 1% on seven days in ten`],
    dek: [`Trading days by the Nifty 50's change from the previous close, ${first} to ${Fmt.monthName(f("nifty_last_date"), true)}. Days within 1% either way are in [[blue|accent]].`,
          `Trading days by the Nifty 50's daily change since ${first}. Days within 1% are in [[blue|accent]].`],
    notes: [[`${Fmt.fmt(f("nifty_days"), "int")} trading days in half-point steps. Moves of 5% or more either way are pooled at the ends. Price index.`]],
    explain: [`**How to read this.** Each bar counts the trading days with a move of that size, in half-point steps. The tall blue bars in the middle are the quiet days, within 1% either way.`, `**How to read this.** Each bar counts the days with a move of that size.`],
    source: "NSE via Yahoo Finance; Zerodha calculations" });
  const worstBin = bins.findIndex((b) => b.hi === -5);
  Templates.histogram(F, {
    bins: bins.map((b) => ({ ...b, count: b.days, role: b.lo >= -1 && b.hi <= 1 ? "hero" : "context",
      label: b.lo === -999 ? "−5% or worse" : b.hi === 999 ? "+5% or more" : null })),
    x: { edges: [-4, -2, 0, 2, 4], fmt: pctS },
    y: { unit: " days" },
    note: { text: `${Fmt.fmt(share, "pct", { dp: 1 })} of days fall within 1% either way`, bin: bins.findIndex((b) => b.lo === 0.5) },
    callouts: [{ bin: worstBin, value: Fmt.fmt(f("nifty_worst_day_ret"), "pct", { dp: 1 }), name: Fmt.monthName(worst, true), prefer: ["ne", "n", "e"], optional: true }],
  });
};
