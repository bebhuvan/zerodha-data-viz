// Choice: claim "Long-term US rates are back above short-term ones" | job curve | form lines | tier familiar
// Yield curve: US Treasury yields by maturity on three dates (lines over a log maturity axis).
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.ust_curve, d3.autoType);
  const now = f("ust_now_date"), then = f("ust_three_years_ago_date");
  // Checked claims: three years ago the 10-year was below the 3-month (inverted); now it is above.
  if (!(f("ust_three_years_ago_10y_minus_3m") < 0 && f("ust_now_10y_minus_3m") > 0)) throw new Error("COPY: headline says the curve was inverted and now slopes up");
  const day = (d) => Fmt.monthName(d, true);
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 2 });
  const mats = rows.filter((r) => r.when === "now");
  const series = (w) => rows.filter((r) => r.when === w).map((r) => ({ x: r.years, y: r.yield }));
  const F = Frame({ tokens,
    headline: [`Long-term US interest rates are back above short-term ones`, `Long US rates are back above short ones`],
    dek: [`US Treasury yields by time to maturity, [[${day(now)}|accent]] against ${day(then)}. Then the 10-year paid ${pct(f("ust_three_years_ago_DGS10"))} and the 3-month ${pct(f("ust_three_years_ago_DGS3MO"))}, an inverted curve; now the 10-year pays ${pct(f("ust_now_DGS10"))}.`,
          `US Treasury yields by maturity, [[${day(now)}|accent]] against ${day(then)}, when the curve was inverted.`],
    notes: [[`Constant-maturity yields. The 10-year was last below the 3-month on ${day(f("ust_last_inverted"))}; its longest unbroken spell below ran ${f("ust_longest_inversion_days")} trading days, from ${day(f("ust_longest_inversion_from"))}.`,
             `Constant-maturity yields; the time axis is on a log scale.`]],
    explain: [`**How to read this.** Each line shows what the US government pays to borrow, from three months on the left to 30 years on the right. A line that rises to the right is the usual shape; one that falls is called inverted.`, `**How to read this.** Each line runs from three-month to 30-year borrowing costs.`],
    source: "US Federal Reserve (H.15) via FRED" });
  const show = new Set(["3 mo", "1 yr", "2 yr", "5 yr", "10 yr", "30 yr"]);
  Templates.lines(F, {
    x: { domain: [mats[0].years, mats.at(-1).years], scale: "log", ticks: mats.filter((m) => show.has(m.label)).map((m) => ({ at: m.years, label: m.label })) },
    y: { unit: "%", dp: 0, zero: null },
    series: [
      { id: "then", role: "compare", curve: "monotone", points: series("three_years_ago"), end: { value: pct(f("ust_three_years_ago_DGS30")), name: Fmt.monthName(then.slice(0, 7)) } },
      { id: "now", role: "hero", color: tokens.color.accent, curve: "monotone", points: series("now"), end: { value: pct(f("ust_now_DGS30")), name: Fmt.monthName(now.slice(0, 7)) } },
    ],
  });
};
