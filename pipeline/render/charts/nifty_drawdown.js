// Choice: claim "The Nifty's fall from its peak is mild next to 2008 and 2020" | job drawdown | form lines | tier familiar
// Drawdown (underwater) chart: how far below its last peak the Nifty 50 has stood, every day.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.nifty_daily, (d) => ({ date: d.date, dd: +d.drawdown }));
  const now = f("nifty_drawdown_now"), d08 = f("nifty_drawdown_2008"), d20 = f("nifty_drawdown_2020");
  // Checked claims: today's fall is shallower than both 2008 and 2020; the deepest fall is 2008's.
  if (!(now > d20 && now > d08) || d3.min(rows, (r) => r.dd) > d08 + 0.05) throw new Error("COPY: headline says today's fall is mild next to 2008 and 2020");
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1 });
  const x = (s) => Fmt.decYear(s);
  const peak = Fmt.monthName(f("nifty_peak_date").slice(0, 7), true);
  const F = Frame({ tokens,
    headline: [`The Nifty's ${pct(-now)} fall from its peak is mild by past standards`, `The Nifty's ${pct(-now)} fall from its peak is mild by past standards`, `The Nifty's ${pct(-now)} fall is mild by past standards`],
    dek: [`How far the Nifty 50 stood below its highest close up to that day, ${Fmt.monthName(f("nifty_first_date").slice(0, 7), true)} to ${Fmt.monthName(f("nifty_last_date"), true)}. The index last peaked in ${peak}. It took ${f("nifty_recovery_months_2008")} months to climb back after the 2008 low and ${f("nifty_recovery_months_2020")} after 2020's.`,
          `How far the Nifty 50 stood below its highest close so far, each trading day since ${f("nifty_first_date").slice(0, 4)}. It last peaked in ${peak}.`],
    notes: [["Daily closes of the price index, so dividends are not counted."]],
    explain: [`**How to read this.** The line shows how far the Nifty stood below its highest close so far. Zero means a new high; the deeper the dip, the bigger the fall.`, `**How to read this.** Zero is a new high; the deeper the dip, the bigger the fall.`],
    source: "NSE via Yahoo Finance; Zerodha calculations" });
  const last = rows.at(-1);
  Templates.lines(F, {
    x: { domain: [x(rows[0].date), x(last.date)] },
    y: { unit: "%", zero: 0 },
    series: [{ id: "drawdown", role: "hero", color: tokens.color.accent, curve: "linear", fill: true,
      end: { value: pct(now), name: Fmt.monthName(last.date) }, points: rows.map((r) => ({ x: x(r.date), y: r.dd })) }],
    callouts: [
      { x: x(f("nifty_drawdowns_over_20")[0][1]), y: d08, value: pct(d08), name: "October 2008", prefer: ["e", "se", "ne"], dot: true },
      { x: x(f("nifty_drawdowns_over_20").at(-1)[1]), y: d20, value: pct(d20), name: "March 2020", prefer: ["e", "w", "se", "sw"], dot: true },
    ],
  });
};
