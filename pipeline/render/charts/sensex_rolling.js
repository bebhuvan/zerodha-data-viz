// Choice: claim "No ten-year Sensex holding since 1997 lost money" | job outcome-range | form range_bars | tier specialist | not columns: each holding period needs its worst and best, not one number
// Range bars: the worst, middle and best annualised Sensex return for each holding period.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const H = [1, 3, 5, 10, 15];
  // Checked claim: no 10-year (or longer) window lost money; shorter ones did.
  if (f("sensex_roll_10y_min") <= 0 || f("sensex_roll_15y_min") <= 0 || f("sensex_roll_5y_min") >= 0) throw new Error("COPY: headline says no ten-year stretch lost money and shorter ones did");
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1, sign: v > 0 });
  const first = Fmt.monthName(f("sensex_first_month"), true);
  const F = Frame({ tokens,
    headline: [`No ten-year holding of the Sensex since 1997 has lost money`, `No ten-year stretch in the Sensex since 1997 lost money`],
    dek: [`Yearly return from holding the Sensex for one to fifteen years, every start month from ${first}: worst, middle and best. One-year holds lost money ${Fmt.num(f("sensex_roll_1y_loss_share"), { dp: 1 })}% of the time; ten-year holds never did.`,
          `Yearly return from holding the Sensex, every start month since ${first}: worst, middle and best.`],
    notes: [[`Annualised returns of the price index, so dividends (about 1% to 1.5% a year) are not counted. ${f("sensex_roll_10y_n")} ten-year windows; the latest started in ${Fmt.monthName(f("sensex_roll_10y_latest_start"), true)}.`,
             `Price index, so dividends are not counted.`]],
    explain: [`**How to read this.** Each bar is one holding period. It runs from the worst yearly return anyone got over that period to the best, with the middle marked. The longer the hold, the shorter the bar and the further it sits from a loss.`, `**How to read this.** Each bar runs from the worst to the best yearly return for that holding period.`],
    source: "BSE via Yahoo Finance; Zerodha calculations" });
  Templates.range_bars(F, {
    rows: H.map((h) => ({ id: `${h}y`, name: h === 1 ? "1 year" : `${h} years`, lo: f(`sensex_roll_${h}y_min`), hi: f(`sensex_roll_${h}y_max`),
      mid: f(`sensex_roll_${h}y_median`), role: h === 10 ? "hero" : "context" })),
    fmt: pct,
    axis: { unit: "%", sign: true },
    midName: "middle",
  });
};
