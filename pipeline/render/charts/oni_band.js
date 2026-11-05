// Choice: claim "No El Niño since 1950 has been this strong this early" | job range | form lines | tier familiar
// El Niño trajectory (lines with an envelope): 2026 against the range of every year since 1950.
window.draw = function ({ tokens, data }) {
  const O = Oni({ data });
  const F = Frame({ tokens,
    headline: [`No El\u00A0Niño since 1950 has been this strong by ${O.SEASON[1]}`,
               `No El\u00A0Niño since 1950 was this strong by ${O.SEASON[1]}`,
               `No El\u00A0Niño on record was this strong by ${O.SEASON[1]}`,
               `This El\u00A0Niño is the strongest on record for ${O.SEASON[1]}`,
               `This El\u00A0Niño is stronger than any since 1950 at this point`,
               `This El\u00A0Niño is the strongest by ${O.SEASON[1]} since 1950`,
               `The strongest El\u00A0Niño by ${O.SEASON[1]} since 1950`],
    dek: [`How much warmer or cooler than normal the central Pacific was, season by season from June to May. The shaded area spans every year from 1950 to 2025; at ${O.sgn(O.at(O.yr))} for ${O.SEASON[0]}, [[2026|line_hero]] is above all of them.`,
          `How far the central Pacific ran above or below normal, June to May. The shading spans 1950 to 2025, and [[2026|line_hero]] is above all of it.`,
          `The central Pacific against normal, June to May. [[2026|line_hero]] is above every year since 1950.`],
    notes: O.notes, explain: [`**How to read this.** The orange line is this year, season by season. The grey lines are ${O.PEERS[0].name} and ${O.PEERS[1].name}, the strongest El Niños on record, and the shaded area covers every year since 1950. Above the El Niño line the Pacific is warm enough to count as an El Niño; below the La Niña line, cool enough to count as a La Niña.`,
               `**How to read this.** Orange is this year; grey lines are ${O.PEERS[0].name} and ${O.PEERS[1].name}; the shading spans every year since 1950.`],
    source: O.source });
  const past = O.oni.filter((d) => d.enso_year < O.yr);
  const band = d3.range(12).map((m) => { const v = past.filter((d) => d.month_pos === m).map((d) => d.anom); return { x: m, lo: d3.min(v), hi: d3.max(v) }; });
  const pts = (y) => O.byYear.get(y).map((d) => ({ x: d.month_pos, y: d.anom }));
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  Templates.lines(F, {
    x: { domain: [0, 11], ticks: [0, 2, 4, 6, 8, 10].map((m) => ({ at: m, label: months[m] })) },
    // ERA5's fixed base makes old La Niñas colder (to −2.4°C): one-degree steps need 7 ticks, and at two-degree
    // steps the El Niño and La Niña names crowd the zero label out.
    y: { unit: "°C", sign: true, zero: 0, ticksMax: 7 },
    band: { points: band, name: "1950–2025" },
    refLines: [{ y: 0.5, name: "El Niño" }, { y: -0.5, name: "La Niña" }],
    series: [
      ...O.PEERS.slice(0, 2).map((p) => ({ id: p.name, role: "compare", points: pts(p.yr) })),
      { id: "2026", role: "hero", points: pts(O.yr), end: { value: O.sgn(O.at(O.yr)), name: "2026 so far" } },
    ],
    callouts: O.PEERS.slice(0, 2).map((p) => { const d = O.byYear.get(p.yr).find((d) => d.month_pos === O.latest.month_pos);
      return { x: d.month_pos, y: d.anom, value: O.sgn(O.at(p.yr)), name: `${p.name} at this point`, prefer: ["se", "s", "e"], dot: true, optional: true }; }),
  });
};
