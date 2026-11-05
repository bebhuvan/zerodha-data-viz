// Choice: claim "A dollar that cost ₹8 in 1973 costs about ₹95 today" | job compounding | form lines | tier familiar
// Long history on a log scale: rupees per US dollar since 1973 (lines, y log, auto time ticks).
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.inr_monthly, (d) => ({ month: d.month, inr: +d.inr }));
  const K0 = Fmt;
  const xOf = (m) => +m.slice(0, 4) + (+m.slice(5) - 1) / 12;
  const last = rows.at(-1), first = rows[0];
  if (Math.abs(last.inr - f("inr_last")) > 1e-9 || Math.abs(first.inr - f("inr_first")) > 1e-9) throw new Error("COPY: first/last rate differ from facts");
  // Checked claim: 1985-95 was the fastest decade of the five measured.
  const decades = [1975, 1985, 1995, 2005, 2015].map((y) => [y, f(`inr_cagr_${y}_${y + 10}`)]);
  if (d3.greatest(decades, (d) => d[1])[0] !== 1985) throw new Error("COPY: dek says 1985-1995 was the fastest fall");
  const lastName = K0.monthName(last.month), lastLong = K0.monthName(last.month, true);
  const F = Frame({ tokens,
    headline: [`A dollar that cost ₹${K0.num(f("inr_first"), { dp: 0 })} in 1973 costs ₹${K0.num(f("inr_last"), { dp: 2 })} today`],
    dek: [`Rupees per US dollar at each month's end, 1973 to ${lastLong}, on a log scale: the same slope means the same percentage fall. The rupee fell fastest from 1985 to 1995, by ${K0.num(f("inr_cagr_1985_1995"), { dp: 1 })}% a year.`,
          `Rupees per US dollar, month-end, 1973 to ${lastName}, on a log scale. The fastest fall came from 1985 to 1995.`],
    notes: [[`Over ${K0.num(f("inr_years"), { dp: 1 })} years the rupee fell ${K0.num(f("inr_cagr"), { dp: 1 })}% a year on average. Noon buying rates in New York.`, `Noon buying rates in New York.`]],
    source: "Federal Reserve Board (H.10) via FRED; Zerodha calculations" });
  Templates.lines(F, {
    x: { domain: [xOf(first.month), xOf(last.month)] },
    y: { scale: "log", zero: null, tick: (t, top) => `₹${t}` },
    series: [{ id: "inr", role: "hero", color: tokens.color.accent, curve: "linear",
      end: { value: K0.fmt(f("inr_last"), "inr"), name: lastName }, points: rows.map((r) => ({ x: xOf(r.month), y: r.inr })) }],
    callouts: [
      { x: xOf("1991-07"), y: f("inr_1991-07"), value: K0.fmt(f("inr_1991-07"), "inr"), name: "July 1991 devaluation", prefer: ["nw", "w", "n"], dot: true },
      { x: xOf("2013-08"), y: f("inr_2013-08"), value: K0.fmt(f("inr_2013-08"), "inr"), name: "August 2013", prefer: ["nw", "w", "n"], dot: true, optional: true },
    ],
  });
};
