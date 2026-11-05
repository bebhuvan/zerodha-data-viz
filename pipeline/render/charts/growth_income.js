// Choice: claim "India is the poorest big economy per person and the fastest-growing" | job relationship | form scatter | tier learnable
// Scatter: growth against income per person, the 20 largest economies, log income axis.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.big_economies, d3.autoType);
  const yr = f("wb_big_year");
  const poorest = d3.least(rows, (r) => r.gdp_pc), fastest = d3.greatest(rows, (r) => r.growth);
  // Checked claim: India is both the fastest-growing and the poorest per person of the 20.
  if (poorest.iso3 !== "IND" || fastest.iso3 !== "IND") throw new Error(`COPY: headline says India is the poorest and fastest; got ${poorest.name}, ${fastest.name}`);
  const usd = (v) => Fmt.fmt(v, "usd");
  const F = Frame({ tokens,
    headline: [`India is the fastest-growing large economy and the poorest per person`, `The poorest big economy per person is also the fastest-growing`, `India is the poorest big economy and the fastest-growing`],
    dek: [`Real GDP growth in ${yr} against GDP per person in US dollars, on a log scale, for the 20 largest economies. [[India|accent]]: ${usd(f("big_gdp_pc_IND"))} a person, ${Fmt.fmt(f("big_growth_IND"), "pct")} growth.`,
          `Growth in ${yr} against GDP per person (log scale), 20 largest economies.`],
    notes: [["GDP per person at market exchange rates; a log scale gives each tenfold step the same width."]],
    explain: [`**How to read this.** Each dot is one economy. Further right means richer per person; higher up means faster growth. India sits alone at the top left.`, `**How to read this.** Right is richer per person; up is faster growth.`],
    source: "World Bank, World Development Indicators" });
  const named = new Set(["USA", "CHN", "IDN", "DEU", "JPN", "BRA", "SAU", "TUR", "MEX", "GBR"]);
  Templates.scatter(F, {
    points: rows.map((r) => ({ id: r.iso3, x: r.gdp_pc, y: r.growth, name: r.name,
      role: r.iso3 === "IND" ? "hero" : named.has(r.iso3) ? "compare" : "context", color: r.iso3 === "IND" ? tokens.color.accent : null,
      value: r.iso3 === "IND" ? Fmt.fmt(f("big_growth_IND"), "pct") : null, optional: r.iso3 !== "IND" })),
    x: { scale: "log", title: "GDP per person, US dollars (log scale)", tick: (t) => Fmt.fmt(t, "usd") },
    y: { title: "Real GDP growth", tick: (t, isTop) => Fmt.num(t, { dp: 0 }) + (isTop ? "%" : ""), zero: 0 },
  });
};
