// Choice: claim "India's 10-year yield is at its highest since April 2024" | job one-number | form big_number | tier familiar
// Big number: India's 10-year government bond yield, with five years of history.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.india_10y, (d) => ({ month: d.month, y: +d.yield }));
  const last = rows.at(-1), since = f("india_10y_highest_since");
  // Checked claim: the latest yield is the highest since `since`, and every month in between was lower.
  const between = rows.filter((r) => r.month > since && r.month < last.month);
  if (!since || between.some((r) => r.y >= last.y)) throw new Error("COPY: headline says highest since " + since);
  const start = `${+last.month.slice(0, 4) - 5}${last.month.slice(4)}`;
  const hist = rows.filter((r) => r.month >= start);
  const xOf = (m) => +m.slice(0, 4) + (+m.slice(5) - 1) / 12;
  const F = Frame({ tokens,
    headline: [`India's 10-year bond yield is at its highest since ${Fmt.monthName(since, true)}`, `India's 10-year yield is the highest since ${Fmt.monthName(since, true)}`],
    dek: [`What the government pays to borrow for ten years, monthly average. A higher yield means bond prices have fallen and loans tied to it cost more.`,
          `What the government pays to borrow for ten years, monthly average.`],
    notes: [["OECD's monthly series for India's long-term government bond yield."]],
    source: "OECD via FRED" });
  Templates.big_number(F, {
    value: Fmt.fmt(f("india_10y_last"), "pct", { dp: 2 }),
    name: `Ten-year government bond yield, ${Fmt.monthName(last.month, true)}`,
    change: `${Fmt.fmt(f("india_10y_change_pp"), "pp")} on a year earlier`,
    history: { x: { domain: [xOf(hist[0].month), xOf(last.month)] }, y: { unit: "%", dp: 1, zero: null }, last: f("india_10y_last"),
      points: hist.map((r) => ({ x: xOf(r.month), y: r.y })),
      callouts: [{ x: xOf(since), y: f(`india_10y_${since}`), value: Fmt.fmt(f(`india_10y_${since}`), "pct", { dp: 2 }), name: Fmt.monthName(since, true), prefer: ["n", "ne", "nw"], dot: true }] },
  });
};
