// Choice: claim "Vegetables got cheaper while personal care got dearer" | job rank-change | form slope | tier learnable
// Library example (slope): food subgroups and personal care, December 2024 against December 2025.
window.draw = function ({ tokens, data }) {
  const C = tokens.color;
  const SUBS = [ // MOSPI subgroup -> label; vegetables and personal care carry the story
    ["Vegetables", "Vegetables", "hero", C.categorical[0]],
    ["Personal Care and Effects", "Personal care", "hero", C.categorical[1]],
    ["Pulses and Products", "Pulses", "context"], ["Oils and Fats", "Oils and fats", "context"],
    ["Fruits", "Fruits", "context"], ["Meat and Fish", "Meat and fish", "context"], ["Cereals and Products", "Cereals", "context"],
    ["Milk and Products", "Milk", "context"], ["Spices", "Spices", "context"], ["Sugar and Confectionery", "Sugar", "context"],
  ];
  const v = (m, s) => fact(data.facts, `cpi_subgroup_yoy_${m}_${s}`);
  const veg0 = v("2024-12", "Vegetables"), veg1 = v("2025-12", "Vegetables"), pc1 = v("2025-12", "Personal Care and Effects");
  if (!(veg0 > 20 && veg1 < -10 && pc1 > 20)) throw new Error("COPY: copy assumes vegetables swung from over 20% to under −10% and personal care is over 20%");
  const F = Frame({ tokens,
    headline: [`Vegetables got ${Math.round(-veg1)}% cheaper in a year while personal care rose ${Math.round(pc1)}%`,
               `Vegetables fell ${Math.round(-veg1)}% in a year and personal care rose ${Math.round(pc1)}%`,
               `Vegetables ${Math.round(-veg1)}% cheaper, personal care ${Math.round(pc1)}% dearer`],
    dek: [`Year-on-year change in consumer prices, December 2024 and December 2025, for food groups and personal care. [[Vegetables|categorical.0]] went from the fastest rise to the steepest fall; [[personal care|categorical.1]], which includes gold and silver, went the other way.`,
          `Year-on-year change in consumer prices, December 2024 and December 2025. [[Vegetables|categorical.0]] and [[personal care|categorical.1]] swapped places.`],
    notes: [["MOSPI's published year-on-year rates for each CPI subgroup, All-India, rural and urban combined."]],
    explain: [`**How to read this.** Each line joins a group's inflation in December 2024, on the left, to December 2025, on the right. A line that falls means prices in that group are rising more slowly than a year ago, or falling.`, `**How to read this.** Each line runs from December 2024 (left) to December 2025 (right).`],
    source: "MOSPI (CPI, base 2012)" });
  Templates.slope(F, { from: "Dec 2024", to: "Dec 2025", v: { unit: "%", dp: 1 }, contextName: "Other food groups",
    items: SUBS.map(([s, name, role, color]) => ({ id: s, name, role, color, from: v("2024-12", s), to: v("2025-12", s) })) });
};
