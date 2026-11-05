// Sketch: contributions as lines instead of stacked bars.
window.draw = function ({ tokens, data }) {
  const P = Cpi({ data, tokens });
  const C = tokens.color;
  const hd = P.f(`cpi_headline_${P.LM}`), food = P.f(`cpi_contrib_${P.LM}_${P.FOOD}`), care = P.f(`cpi_contrib_${P.LM}_${P.CARE}`);
  const F = Frame({ tokens,
    headline: [`Falling food prices have pulled India's inflation down to ${hd.toFixed(2)}%`],
    dek: [`Contribution to year-on-year CPI inflation, percentage points, January 2022 to December 2025. In December [[food|categorical.0]] took off ${Math.abs(food).toFixed(2)} points while [[personal care|categorical.1]], which includes gold and silver, added ${care.toFixed(2)}.`,
          `Contribution to CPI inflation, percentage points, 2022 to 2025.`],
    notes: [["Contributions use MOSPI's 2012-base CPI weights and add up to headline inflation."]], source: P.source });
  const xOf = (m) => +m.slice(0, 4) + (+m.slice(5) - 1) / 12;
  const months = P.head.filter((d) => d.month >= "2022-01");
  const comp = (b) => months.map((d) => ({ x: xOf(d.month), y: P.contrib.find((r) => r.month === d.month && r.component === b).contrib_pp }));
  const rest = months.map((d) => ({ x: xOf(d.month), y: d3.sum(P.contrib.filter((r) => r.month === d.month && ![P.FOOD, P.CARE].includes(r.component)), (r) => r.contrib_pp) }));
  Templates.lines(F, {
    x: { domain: [2022, xOf(P.LM)], ticks: [2022, 2023, 2024, 2025].map((y) => ({ at: y, label: String(y), anchor: "start" })) },
    y: { unit: "", zero: 0, dp: 0 },
    series: [
      { id: "rest", role: "compare", curve: "linear", points: rest, end: { value: `+${(hd - food - care).toFixed(2)}`, name: "Everything else" } },
      { id: "head", role: "hero", color: C.ink, curve: "linear", points: months.map((d) => ({ x: xOf(d.month), y: d.headline_published })), end: { value: `${hd.toFixed(2)}%`, name: "Headline" } },
      { id: "food", role: "hero", color: C.categorical[0], curve: "linear", points: comp(P.FOOD), end: { value: `−${Math.abs(food).toFixed(2)}`, name: "Food" } },
      { id: "care", role: "hero", color: C.categorical[1], curve: "linear", points: comp(P.CARE), end: { value: `+${care.toFixed(2)}`, name: "Personal care" } },
    ],
  });
};
