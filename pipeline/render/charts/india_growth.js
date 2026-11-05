// Choice: claim "India's economy has rarely shrunk" | job amounts | form columns | tier familiar
// Columns, diverging around zero: India's real GDP growth every year since 1961.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.india_growth, (d) => ({ year: +d.year, growth: +d.growth }));
  const neg = rows.filter((r) => r.growth < 0).map((r) => r.year);
  // Checked claims: five years of shrinking since 1961, and only 2020 since 1980.
  if (neg.length !== 5 || neg.filter((y) => y >= 1980).join() !== "2020") throw new Error(`COPY: headline counts five shrinking years, one since 1980; got ${neg}`);
  const first = rows[0].year, last = rows.at(-1).year;
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1 });
  const F = Frame({ tokens,
    headline: [`India's economy has shrunk in only five years since ${first}`, `India's economy has shrunk only once since 1980`],
    dek: [`Real GDP growth each year, ${first} to ${last}. The economy [[shrank|line_hero]] in 1965, 1966, 1972, 1979 and 2020. Since 1991 growth has averaged ${pct(f("india_growth_avg_since_1991"))} a year, against ${pct(f("india_growth_avg_before_1991"))} before.`,
          `Real GDP growth each year, ${first} to ${last}. Growth has averaged ${pct(f("india_growth_avg_since_1991"))} a year since 1991.`],
    notes: [["Calendar-year figures in constant prices as published by the World Bank; India's own data runs April to March."]],
    source: "World Bank, World Development Indicators" });
  Templates.columns(F, {
    bars: rows.map((r) => ({ x: r.year, value: r.growth, role: r.growth < 0 ? "hero" : "context", color: r.growth < 0 ? tokens.color.line_hero : null })),
    y: { unit: "%", dp: 0 },
    callouts: [
      { x: 2020, value: pct(f("india_growth_2020")), name: "2020" },
      { x: 1979, value: pct(f("india_growth_1979")), name: "1979", optional: true },
      { x: last, value: pct(f(`india_growth_${last}`)), name: String(last), prefer: ["nw", "n", "w"], optional: true },
    ],
  });
};
