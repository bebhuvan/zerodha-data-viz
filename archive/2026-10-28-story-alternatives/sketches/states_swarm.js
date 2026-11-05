// Sketch: every state as a dot on one line, India marked.
window.draw = function ({ tokens, data }) {
  const S = States({ tokens, data });
  const F = Frame({ tokens, ...S.text });
  const INDIA = fact(data.facts, "state_cpi_2025-12_All India");
  const named = { Kerala: ["n", "nw"], Lakshadweep: ["n", "nw", "ne"], Manipur: ["n", "ne"], Goa: ["n", "nw"] };
  const items = S.rows.filter((r) => !S.missing(r)).map((r) => { const v = fact(data.facts, `state_cpi_2025-12_${r.name}`);
    return { id: r.code, value: v, role: r.name === "Kerala" ? "hero" : r.name in named ? "compare" : "context",
      label: r.name in named ? { value: S.fmt(v), name: r.name, prefer: named[r.name] } : null }; });
  Templates.beeswarm(F, { v: { unit: "%", zero: 0 }, items, refLines: [{ v: INDIA, name: "India" }] });
};
