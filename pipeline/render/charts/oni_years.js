// Choice: claim "No El Niño since 1950 has been this strong this early" | job record | form columns | tier familiar
// Columns: the July–September ONI for every year since 1950; 2026 stands above the rest.
// Lead El Niño chart since 4 Nov 2026 (replaced the beeswarm oni_swarm, which lay readers misread).
window.draw = function ({ tokens, data }) {
  const O = Oni({ data });
  // The runners-up for this season, ranked from the data (they differ between ERA5 and NOAA).
  const [second, third] = [...O.byYear.keys()].filter((y) => y < O.yr && O.byYear.get(y).some((d) => d.season === O.season)).sort((a, b) => O.at(b) - O.at(a));
  const years = [...O.byYear.keys()].filter((y) => O.byYear.get(y).some((d) => d.season === O.season));
  const F = Frame({ tokens,
    headline: [`No El\u00A0Niño since 1950 has been this strong by ${O.SEASON[1]}`,
               `No El\u00A0Niño since 1950 was this strong by ${O.SEASON[1]}`,
               `No El\u00A0Niño on record was this strong by ${O.SEASON[1]}`,
               `This El\u00A0Niño is the strongest on record for ${O.SEASON[1]}`,
               `This El\u00A0Niño is stronger than any since 1950 at this point`,
               `This El\u00A0Niño is the strongest by ${O.SEASON[1]} since 1950`,
               `The strongest El\u00A0Niño by ${O.SEASON[1]} since 1950`],
    dek: [`How much warmer than normal the central Pacific was in ${O.SEASON[0]} each year, 1950 to 2026. [[2026|line_hero]] is ahead of ${second} (${O.sgn(O.at(second))}) and ${third} (${O.sgn(O.at(third))}), the next strongest at this time of year.`,
          `How much warmer than normal the central Pacific was in ${O.SEASON[0]}, each year since 1950. [[2026|line_hero]] is at ${O.sgn(O.at(O.yr))}.`],
    notes: O.notes, explain: [`**How to read this.** Each column is one year: how far the central Pacific's surface was above or below its normal temperature from ${O.SEASON[0]}. Above the El Niño line it is warm enough to count as an El Niño; below the La Niña line, cool enough to count as a La Niña.`, `**How to read this.** One column per year: the central Pacific's temperature against normal, ${O.SEASON[0]}.`],
    source: O.source });
  const peers = new Set([second, third]);
  Templates.columns(F, {
    bars: years.map((y) => ({ x: y, value: O.at(y), role: y === O.yr ? "hero" : peers.has(y) ? "compare" : "context", color: y === O.yr ? tokens.color.line_hero : null })),
    y: { unit: "°C", dp: 0, sign: true },
    refLines: [{ y: 0.5, name: "El Niño" }, { y: -0.5, name: "La Niña" }],
    callouts: [
      { x: O.yr, value: O.sgn(O.at(O.yr)), name: "2026", prefer: ["w", "nw", "n"] },
      { x: second, value: O.sgn(O.at(second)), name: String(second), prefer: ["n", "nw", "ne"] },
      { x: third, value: O.sgn(O.at(third)), name: String(third), prefer: ["n", "nw", "ne"], optional: true },
    ],
  });
};
