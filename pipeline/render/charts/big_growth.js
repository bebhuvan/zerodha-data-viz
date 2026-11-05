// Choice: claim "India grew fastest of the 20 largest economies" | job ranking | form bars | tier familiar
// Ranked bars: real GDP growth in the 20 largest economies, latest year.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.big_economies, (d) => ({ iso3: d.iso3, name: d.name, growth: +d.growth }));
  const yr = f("wb_big_year");
  const sorted = [...rows].sort((a, b) => b.growth - a.growth);
  // Checked claims: India fastest; how far ahead of the next.
  if (sorted[0].iso3 !== "IND") throw new Error(`COPY: headline says India grew fastest; it was ${sorted[0].name}`);
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1 });
  // All 20 rows on tall canvases; on short ones, the ten fastest (the copy says so).
  const attempt = (n) => () => {
    const shown = sorted.slice(0, n);
    const which = n < rows.length ? `the ${n} fastest-growing of the 20 largest economies` : "the 20 largest economies by size in US dollars";
    const F = Frame({ tokens,
      headline: [`India grew faster than any of the world's 20 largest economies in ${yr}`, `India grew fastest of the 20 largest economies in ${yr}`],
      dek: [`Real GDP growth in ${yr}, ${which}. India's ${pct(f("big_growth_IND"))} was ahead of ${f("big_second")}'s ${pct(f("big_second_growth"))}; the middle of all 20 grew ${pct(f("big_median_growth"))}.`,
            `Real GDP growth in ${yr}, ${which}. The middle of all 20 grew ${pct(f("big_median_growth"))}.`],
      notes: [["Calendar years; size ranked by GDP at market exchange rates."]],
      source: "World Bank, World Development Indicators" });
    Templates.bars(F, {
      rows: shown.map((r) => ({ id: r.iso3, name: r.name, value: r.growth, role: r.iso3 === "IND" ? "hero" : "context",
        color: r.iso3 === "IND" ? tokens.color.accent : null, valueLabel: pct(f(`big_growth_${r.iso3}`)) })),
      fmt: pct,
    });
  };
  firstFit([attempt(rows.length), attempt(10)]);
};
