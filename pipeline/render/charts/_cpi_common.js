// Shared by the CPI charts: tidy data, component names and colours, the latest month's facts.
window.Cpi = function ({ data, tokens }) {
  const keepMonth = (d) => { const m = d.month; d3.autoType(d); d.month = m; return d; };
  const contrib = d3.csvParse(data.cpi_contrib, keepMonth);
  const head = d3.csvParse(data.cpi_headline, keepMonth);
  const FOOD = "Food and beverages", CARE = "Personal care (incl. gold, silver)", HOUS = "Housing", FUEL = "Fuel and light", REST = "Everything else";
  const C = tokens.color;
  const LM = head.at(-1).month, YA = `${+LM.slice(0, 4) - 1}${LM.slice(4)}`;
  const f = (key) => fact(data.facts, key);
  const monthName = (m) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  if (LM !== "2025-12" || f(`cpi_contrib_${LM}_${FOOD}`) >= 0) throw new Error(`COPY: copy is written for December 2025 with food negative; data ends ${LM}`);
  return { contrib, head, FOOD, CARE, HOUS, FUEL, REST, LM, YA, f, monthName,
    color: { [FOOD]: C.categorical[0], [CARE]: C.categorical[1] },
    source: `MOSPI (CPI, base 2012, All-India combined), ${tokens.brand} calculations` };
};
