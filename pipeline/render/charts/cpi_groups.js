// Choice: claim "Only personal care prices are rising fast" | job change | form small_multiples | tier learnable
// Library example (small multiples): inflation in each CPI group, 2014 to 2025, on one scale.
window.draw = function ({ tokens, data }) {
  const rows = d3.csvParse(data.cpi_subgroup_yoy, (d) => ({ month: d.month, subgroup: d.subgroup, yoy: +d.yoy }));
  const GROUPS = [["Food and Beverages-Overall", "Food"], ["Housing-Overall", "Housing"], ["Fuel and Light-Overall", "Fuel and light"],
    ["Clothing and Footwear-Overall", "Clothing"], ["Transport and Communication", "Transport"], ["Health", "Health"],
    ["Education", "Education"], ["Personal Care and Effects", "Personal care"]];
  const LM = "2025-12";
  const xOf = (m) => +m.slice(0, 4) + (+m.slice(5) - 1) / 12;
  const pc = fact(data.facts, `cpi_subgroup_yoy_${LM}_Personal Care and Effects`);
  const others = GROUPS.filter(([g]) => g !== "Personal Care and Effects").map(([g]) => fact(data.facts, `cpi_subgroup_yoy_${LM}_${g}`));
  if (!(pc > 3 * d3.max(others))) throw new Error("COPY: copy says personal care is far ahead of every other group");
  const F = Frame({ tokens,
    headline: [`Personal care prices are up ${Math.round(pc)}%, far faster than any other group`,
               `Personal care prices are up ${Math.round(pc)}%, far ahead of the rest`,
               `Personal care prices are up ${Math.round(pc)}% in a year`],
    dek: [`Year-on-year change in consumer prices for each CPI group, monthly, 2014 to 2025; the other groups in grey. Personal care includes gold and silver jewellery.`,
          `Year-on-year change in consumer prices by group, 2014 to 2025. Personal care includes gold and silver.`],
    notes: [["MOSPI's published year-on-year rates, All-India, rural and urban combined. Months where the source returned conflicting figures are left out."]],
    explain: [`**How to read this.** Each small chart is one group of prices, drawn on the same scale, with the other seven groups in grey behind it for comparison.`, `**How to read this.** One panel per group, all on the same scale.`],
    source: "MOSPI (CPI, base 2012)" });
  Templates.small_multiples(F, {
    key: "Each panel shows one group in blue against the other seven in grey. Top right: December 2025.",
    x: { domain: [2014, 2026], ticks: [{ at: 2014, label: "2014", anchor: "start" }, { at: 2026, label: "2025", anchor: "end" }] },
    y: { unit: "%", zero: 0 },
    panels: GROUPS.map(([g, name]) => ({ id: g, name, points: rows.filter((r) => r.subgroup === g).map((r) => ({ x: xOf(r.month) + 1 / 24, y: r.yoy })),
      end: `${fact(data.facts, `cpi_subgroup_yoy_${LM}_${g}`).toFixed(1)}%`.replace("-", "−") })),
  });
};
