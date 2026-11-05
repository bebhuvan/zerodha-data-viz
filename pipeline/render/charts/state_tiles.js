// Choice: claim "Prices in Kerala are rising seven times as fast as in India" | job geography | form tiles | tier learnable
// State inflation as an equal-area tile grid (the geography view; the lead is state_ranked).
// Data and copy from States(); the form is the tiles template.
window.draw = function ({ tokens, data }) {
  const S = States({ tokens, data });
  const INDIA = fact(data.facts, "state_cpi_2025-12_All India");
  const explain = [`**How to read this.** Each square is a state or union territory, placed roughly where it sits on the map. Its colour shows how fast prices rose there in the year to December 2025.`,
    `**How to read this.** One square per state, roughly where it sits on the map.`];
  // The tile map keeps its size before the box: where the box would shrink the tiles below legible,
  // the box stays in the caption only.
  const draw = (withBox) => () => Templates.tiles(Frame({ tokens, ...S.text, explain, explainBox: withBox, plotAspect: d3.max(S.rows, (r) => r.col) / d3.max(S.rows, (r) => r.row) }), {
    tiles: S.rows.map((r) => ({ id: r.code, code: r.code, row: r.row, col: r.col,
      value: S.missing(r) ? null : fact(data.facts, `state_cpi_2025-12_${r.name}`) })),
    bins: { thresholds: S.thresholds, colors: S.colors, unit: "%", sign: true },
    marker: { value: INDIA, name: `India ${INDIA.toFixed(2)}%` },
    format: (v) => S.fmt(v).replace("%", ""),  // the unit is in the legend
  });
  firstFit([draw(true), draw(false)]);
};
