// Choice: claim "Cheaper food did most of the work in cutting inflation" | job decomposition | form bridge | tier specialist | not stacked_bars: two dates, and the reader needs the size of each push, not the monthly path
// Lead CPI chart (bridge): how each group moved headline inflation between two Decembers.
window.draw = function ({ tokens, data }) {
  const P = Cpi({ data, tokens });
  const h0 = P.f(`cpi_headline_${P.YA}`), h1 = P.f(`cpi_headline_${P.LM}`);
  const ch = (b) => P.f(`cpi_contrib_change_${P.YA}_${P.LM}_${b}`);
  const f0 = (b) => P.f(`cpi_contrib_${P.YA}_${b}`), f1 = (b) => P.f(`cpi_contrib_${P.LM}_${b}`);
  const n = (v, sign = true) => `${v < 0 ? "−" : sign ? "+" : ""}${Math.abs(v).toFixed(2)}`;
  const F = Frame({ tokens,
    headline: [`Cheaper food cut India's inflation from ${h0.toFixed(2)}% to ${h1.toFixed(2)}% in a year`,
               `Cheaper food cut inflation from ${h0.toFixed(2)}% to ${h1.toFixed(2)}%`],
    dek: [`Change in each group's contribution to year-on-year CPI inflation, December 2024 to December 2025, in percentage points.`,
          `Change in each group's contribution to CPI inflation, Dec 2024 to Dec 2025, percentage points.`],
    notes: [["Contributions use MOSPI's 2012-base CPI weights and add up to headline inflation; bars use rates computed from group indices, within 0.03 points of the published ones. Everything else covers clothing, transport, health, education and the rest.",
             "Contributions use MOSPI's 2012-base weights and add up to headline inflation. Everything else covers clothing, transport, health, education and the rest."]],
    explain: [`**How to read this.** Start from last December's inflation. Each bar is one group of prices and shows how much it pushed inflation up or pulled it down over the year. Together they take you to this December's figure.`, `**How to read this.** Each bar is one group of prices: how much it moved inflation over the year.`],
    source: P.source });
  const comp = (m) => P.head.find((d) => d.month === m).headline_computed;
  Templates.bridge(F, {
    unit: "%",
    start: { name: "December 2024", value: comp(P.YA), text: `${h0.toFixed(2)}%` },
    steps: [
      { id: "food", name: "Food", value: ch(P.FOOD), text: n(ch(P.FOOD)), role: "hero", color: P.color[P.FOOD],
        note: `Food went from adding ${n(f0(P.FOOD), false)} points to inflation to taking off ${n(-f1(P.FOOD), false)}` },
      { id: "care", name: "Personal care", value: ch(P.CARE), text: n(ch(P.CARE)), role: "hero", color: P.color[P.CARE],
        note: `Gold and silver lifted personal care from ${n(f0(P.CARE), false)} points to ${n(f1(P.CARE), false)}` },
      { id: "fuel", name: "Fuel and light", value: ch(P.FUEL), text: n(ch(P.FUEL)), role: "context" },
      { id: "hous", name: "Housing", value: ch(P.HOUS), text: n(ch(P.HOUS)), role: "context" },
      { id: "rest", name: "Everything else", value: ch(P.REST), text: n(ch(P.REST)), role: "context" },
    ],
    end: { name: "December 2025", value: comp(P.LM), text: `${h1.toFixed(2)}%` },
  });
};
