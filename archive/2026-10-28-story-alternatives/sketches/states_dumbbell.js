// Sketch: each state's inflation a year ago and now.
window.draw = function ({ tokens, data }) {
  const S = States({ tokens, data });
  const F = Frame({ tokens, ...S.text });
  const INDIA = fact(data.facts, "state_cpi_2025-12_All India");
  const rows = S.rows.filter((r) => !S.missing(r) && r.inflation_prev != null).map((r) => ({ id: r.code, name: r.name.replace(" and Nicobar Islands", " and Nicobar"),
    value: fact(data.facts, `state_cpi_2025-12_${r.name}`), from: fact(data.facts, `state_cpi_2024-12_${r.name}`),
    role: r.name === "Kerala" ? "hero" : "context", color: tokens.color.line_hero }));
  Templates.ranked_dots(F, { v: { unit: "%", dp: 1 }, rows, ref: { value: INDIA, name: `India ${INDIA.toFixed(2)}%` }, fromName: "Dec 2024", toName: "Dec 2025", showValues: "hero" });
};
