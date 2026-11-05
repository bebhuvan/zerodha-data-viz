// Choice: claim "Food is nearly half of the consumer price index" | job part-to-whole | form waffle | tier learnable
// Library example (waffle): what the CPI basket is made of.
window.draw = function ({ tokens, data }) {
  const C = tokens.color;
  const food = fact(data.facts, "cpi_weight_Food and Beverages-Overall"), care = fact(data.facts, "cpi_weight_Personal Care and Effects");
  const rest = fact(data.facts, "cpi_weight_rest_ex_food_care");
  // Wide canvases: header across the top and a 20x5 strip of squares the full width (a side column beside
  // a square grid left a fifth of the canvas empty); the side column is the fallback.
  const draw = (wide) => () => {
  const F = Frame({ tokens, ...(wide ? { layout: "stack" } : { plotAspect: 1 }),
    headline: [`Food makes up ${Math.round(food)}% of India's consumer price index`,
               `Food is ${Math.round(food)}% of India's consumer price index`],
    dek: [`Weights of the CPI basket, All-India, rural and urban combined, out of 100. Personal care, which includes gold and silver, is under 4%; it moves the index only when its prices move a lot.`,
          `Weights of the CPI basket, All-India, rural and urban combined, out of 100.`],
    notes: [["Weights from MOSPI's 2012 base, drawn from the 2011–12 household consumption survey. Each square is one point of weight."]],
    explain: [`**How to read this.** The grid has 100 squares, one for each point of weight in the price index. Food fills ${Math.round(food)} of them, so a change in food prices moves the index more than anything else.`, `**How to read this.** 100 squares, one per point of weight in the index. Food fills ${Math.round(food)}.`],
    source: "MOSPI (CPI, base 2012)" });  // plotAspect 1 (fallback): a 10x10 grid with its legend is about square, so the header column widens to meet it
  Templates.waffle(F, { items: [
    { id: "food", name: "Food and drink", value: food, valueText: `${food.toFixed(2)}%`, role: "hero", color: C.categorical[0] },
    { id: "care", name: "Personal care, with gold", value: care, valueText: `${care.toFixed(2)}%`, role: "hero", color: C.categorical[1] },
    { id: "rest", name: "Everything else", value: rest, valueText: `${rest.toFixed(2)}%`, role: "context" },
  ], minFill: wide ? 0.85 : 0 });
  };
  // Only landscape (side) formats try the wide strip; stacked formats keep their square grid.
  firstFit(tokens.format?.layout === "side" ? [draw(true), draw(false)] : [draw(false)]);
};
