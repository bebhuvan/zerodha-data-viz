// Choice: claim "Falling food prices pulled inflation down" | job composition | form stacked_bars | tier learnable
// Chart 1: what is driving India's CPI inflation, monthly contributions, Jan 2022 - Dec 2025.
// Two series carry the story (food, personal care); everything else is one quiet grey. Form: stacked_bars.
window.draw = function ({ tokens, data }) {
  const START = "2022-01";
  const FOOD = "Food and beverages", CARE = "Personal care (incl. gold, silver)", REST = "Everything else";
  const keepMonth = (d) => { const m = d.month; d3.autoType(d); d.month = m; return d; };
  const rows = d3.csvParse(data.cpi_contrib, keepMonth).filter((d) => d.month >= START);
  const head = d3.csvParse(data.cpi_headline, keepMonth).filter((d) => d.month >= START);
  const months = head.map((d) => d.month);
  // Housing, fuel and the rest fold into one grey series: they are context, not the story.
  const wide = months.map((m) => {
    const o = { month: m, [FOOD]: 0, [CARE]: 0, [REST]: 0 };
    for (const r of rows.filter((r) => r.month === m)) o[r.component === FOOD || r.component === CARE ? r.component : REST] += r.contrib_pp;
    return o;
  });

  // Copy numbers come from facts.json by explicit key, not from the arrays above.
  const LM = months.at(-1);
  const hd = fact(data.facts, `cpi_headline_${LM}`), food = fact(data.facts, `cpi_contrib_${LM}_${FOOD}`), care = fact(data.facts, `cpi_contrib_${LM}_${CARE}`);
  const p2 = (v) => Math.abs(v).toFixed(2);
  if (LM !== "2025-12" || food >= 0) throw new Error(`COPY: copy is written for December 2025 with food negative; data ends ${LM}`);
  const F = Frame({
    tokens,
    kicker: "Inflation",
    headline: [
      `Falling food prices have pulled India's inflation down to ${p2(hd)}%`,
      `Falling food prices have pulled inflation down to ${p2(hd)}%`,
      `Cheaper food pulled inflation down to ${p2(hd)}%`,
    ],
    dek: [
      `Contribution to year-on-year CPI inflation, percentage points, January 2022 to December 2025. In December [[food|categorical.0]] took off ${p2(food)} points while [[personal care|categorical.1]], which includes gold and silver, added ${p2(care)}.`,
      `Contribution to CPI inflation, percentage points. December 2025: [[food|categorical.0]] −${p2(food)}, [[personal care|categorical.1]] (incl. gold and silver) +${p2(care)}.`,
    ],
    notes: [[
      "Contributions use MOSPI's 2012-base CPI weights and add up to headline inflation. Everything else includes housing, fuel, clothing, transport, health and education.",
      "Contributions use MOSPI's 2012-base weights and add up to headline inflation. Everything else covers housing, fuel, transport and the rest.",
    ]],
    explain: [`**How to read this.** Each bar is one month's inflation, split into what each group of prices added to it. Parts above zero pushed inflation up; parts below zero pulled it down.`, `**How to read this.** Each bar is a month's inflation, split by group. Below zero pulls it down.`],
    source: `MOSPI (CPI, base 2012, All-India combined), ${tokens.brand} calculations`,
  });
  const C = tokens.color;
  const fmt = (v, sign) => `${v < 0 ? "−" : sign ? "+" : ""}${Math.abs(v).toFixed(2)}`;
  Templates.stacked_bars(F, {
    keys: months,
    ticks: months.filter((m) => m.endsWith("-01")).map((m) => ({ key: m, label: m.slice(0, 4) })),
    series: [
      { key: FOOD, name: "Food", role: "hero", color: C.categorical[0] },
      { key: CARE, name: "Personal care", role: "hero", color: C.categorical[1] },
      { key: REST, name: "Everything else", role: "context" },
    ],
    rows: wide.map((d) => ({ ...d, key: d.month })),
    line: { name: "Headline", values: head.map((d) => ({ key: d.month, value: d.headline_published })) },
    y: { unit: "", dp: 0 },
    // Values from facts by key; "Everything else" is named, not numbered (it is three groups folded together).
    ends: { line: `${p2(hd)}%`, [CARE]: fmt(care, true), [FOOD]: fmt(food), [REST]: "" },
  });
};
