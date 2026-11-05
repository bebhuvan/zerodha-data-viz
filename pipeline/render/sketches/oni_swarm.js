// Choice: claim "No El Niño since 1950 has been this strong this early" | job position | form beeswarm | tier specialist | not columns: kept only as the beeswarm example; columns (oni_years) won because lay readers misread the swarm
// Lead El Niño chart (beeswarm): every year at the latest season, one dot each; the record stands alone.
// Sketch since 4 Nov 2026: a colleague could not read it (the sideways spread looks like data). The lead is oni_years.
window.draw = function ({ tokens, data }) {
  const O = Oni({ data });
  const F = Frame({ tokens,
    headline: [`No El Niño since 1950 has been this strong by ${O.SEASON[1]}`,
               `The strongest El Niño by ${O.SEASON[1]} since 1950`],
    dek: [`Oceanic Niño Index for ${O.SEASON[0]}, one dot per year since 1950. [[2026|line_hero]], at ${O.sgn(O.at(O.yr))}, is ahead of 1997 (${O.sgn(O.at(1997))}) and 2015 (${O.sgn(O.at(2015))}), the two strongest El Niños on record.`,
          `Oceanic Niño Index for ${O.SEASON[0]}, one dot per year since 1950. [[2026|line_hero]] is at ${O.sgn(O.at(O.yr))}.`],
    notes: O.notes, source: O.source });
  const items = [...O.byYear.keys()].filter((y) => O.byYear.get(y).some((d) => d.season === O.season)).map((y) => {
    const peer = O.PEERS.slice(0, 2).find((p) => p.yr === y);
    const val = fact(data.facts, `oni_${y}_${O.season}`);
    return { id: String(y), value: val, role: y === O.yr ? "hero" : peer ? "compare" : "context",
      label: y === O.yr ? { value: O.sgn(val), name: "2026", prefer: ["n", "nw"] } : peer ? { value: O.sgn(val), name: String(y), prefer: y === 1997 ? ["s", "se", "sw"] : ["n", "nw", "w"] } : null };
  });
  Templates.beeswarm(F, { v: { unit: "°C", sign: true, zero: 0 }, items, refLines: [{ v: 0.5, name: "El Niño" }] });
};
