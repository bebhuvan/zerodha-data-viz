// Choice: claim "Recent La Niña years were warmer than the El Niño year 1998" | job amounts | form columns | tier familiar
// Columns, diverging around zero: world temperature each year since 1951, coloured by El Niño phase.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const C = tokens.color;
  const rows = d3.csvParse(data.era5_enso_annual, (d) => ({ year: +d.year, anomaly: +d.anomaly, phase: d.phase }));
  const first = f("era5_first_year"), last = f("era5_last_year");
  const by = (y) => rows.find((r) => r.year === y);
  // Checked claim: the La Niña years 2021 and 2022 were warmer than 1998, an El Niño year, by at least
  // 0.25°C (build_climate.py re-checks it under three phase definitions; this guards the copy).
  const d21 = f("era5_nina_2021_vs_1998"), d22 = f("era5_nina_2022_vs_1998");
  if (by(2021).phase !== "nina" || by(2022).phase !== "nina" || by(1998).phase !== "nino" || Math.min(d21, d22) < 0.25)
    throw new Error(`COPY: headline says La Niña 2021 and 2022 beat El Niño 1998 by at least 0.25°C; got ${d21}, ${d22}`);
  const deg = (v) => Fmt.num(v, { dp: 2, sign: true }) + "°C";
  const ytd = f("era5_ytd_year"), ytdMonths = f("era5_ytd_months");
  const monthName = (m) => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m.slice(5) - 1];
  const F = Frame({ tokens,
    headline: [`La\u00A0Niña years 2021 and 2022 were warmer than El\u00A0Niño year 1998`,
               `Recent La\u00A0Niña years were warmer than El\u00A0Niño year 1998`],
    dek: [`World surface temperature each year against the 1991–2020 average, ${first} to ${last}, by the state of the Pacific at the turn of the year: [[El Niño|line_hero]], [[La Niña|accent]] or neutral. 1998: ${deg(f("era5_year_1998"))}; 2021: ${deg(f("era5_year_2021"))}; 2022: ${deg(f("era5_year_2022"))}.`,
          `World surface temperature each year against the 1991–2020 average, ${first} to ${last}: [[El Niño|line_hero]] years, [[La Niña|accent]] years and the rest.`],
    notes: [[`A year takes the phase of its December–February Oceanic Niño Index (El Niño at +0.5 or more, La Niña at −0.5 or less). ${ytd} so far (January to ${monthName(f("era5_ytd_last_month"))}): ${deg(f(`era5_year_${ytd}_so_far`))}, as a strong El Niño builds.`,
             `Phase from the December–February Oceanic Niño Index. ${ytd} so far: ${deg(f(`era5_year_${ytd}_so_far`))}.`]],
    explain: [`**How to read this.** Each column is one year's world temperature against the 1991–2020 average. La Niña years are usually cooler and El Niño years warmer, so blue columns standing above an orange one show the world warming underneath both.`, `**How to read this.** One column per year. La Niña years are usually cooler, El Niño years warmer.`],
    source: "Copernicus (ERA5) and NOAA via Our World in Data; Zerodha calculations" });
  if (ytdMonths >= 12) throw new Error("COPY: notes treat the latest year as incomplete");
  const colour = { nino: C.line_hero, nina: C.accent };
  Templates.columns(F, {
    bars: rows.map((r) => ({ x: r.year, value: r.anomaly, role: r.phase === "neutral" ? "context" : "hero", color: colour[r.phase] || null })),
    y: { unit: "°C", dp: 1, sign: true },
    callouts: [
      { x: 1998, value: deg(f("era5_year_1998")), name: "1998, El Niño" },
      // One label for the two La Niña years the headline names; dropped on canvases too short for it
      // (the dek carries both values).
      { x: 2021, value: `${deg(f("era5_year_2021"))}, ${deg(f("era5_year_2022"))}`, name: "2021 and 2022, La Niña", prefer: ["nw", "n", "w"], optional: true },
    ],
  });
};
