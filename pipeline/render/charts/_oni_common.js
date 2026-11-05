// Shared by the El Niño charts: data, peers and copy. Numbers come from facts.json by explicit key.
// source "era5" (default since 4 Nov 2026): Niño 3.4 sea-surface temperature anomaly from Copernicus ERA5,
// three-month seasons against a fixed 1991–2020 base (build_era5_nino34.py). source "noaa": NOAA's ONI.
// The two sources rank past El Niños differently (ERA5: 1997, 1982, 2015; NOAA: 2015, 1997, 1982), so the
// comparison years are derived from the data, never typed.
window.Oni = function ({ data, source = "era5" }) {
  const S = {
    era5: { table: data.era5_nino34, key: "era5n34",
      source: "Copernicus Climate Change Service (ERA5); Zerodha calculations",
      index: "Niño 3.4 sea-surface temperature index",
      notes: [[
        "Sea-surface temperature in the Niño 3.4 region of the Pacific (5°N–5°S, 170°W–120°W), three-month averages against the 1991–2020 average, from Copernicus ERA5. El Niño conditions begin at +0.5°C. 2026 values are provisional (ERA5T).",
        "Niño 3.4 sea-surface temperature, three-month averages against 1991–2020, Copernicus ERA5. El Niño begins at +0.5°C. 2026 is provisional.",
      ]] },
    noaa: { table: data.oni, key: "oni",
      source: "NOAA Climate Prediction Center (ONI, ERSSTv5)",
      index: "Oceanic Niño Index",
      notes: [[
        "Three-month averages of sea-surface temperature anomalies in the Niño 3.4 region of the Pacific, against a 1991–2020 base. El Niño conditions begin at +0.5°C. 2026 values are provisional.",
        "Three-month sea-surface temperature anomalies, Niño 3.4 region, against a 1991–2020 base. El Niño begins at +0.5°C. 2026 is provisional.",
      ]] },
  }[source];
  if (!S || !S.table) throw new Error(`FACT: no El Niño table for source "${source}"`);
  const oni = d3.csvParse(S.table, d3.autoType);
  const latest = oni.at(-1);
  const byYear = d3.group(oni, (d) => d.enso_year);
  const season = latest.season, yr = latest.enso_year;
  const at = (y) => fact(data.facts, `${S.key}_${y}_${season}`);
  const peak = (y) => fact(data.facts, `${S.key}_peak_${y}`);
  if (fact(data.facts, `${S.key}_latest_rank_same_season`) !== 1) throw new Error("COPY: copy says 2026 is the strongest on record for its season; it no longer is");
  const SEASON = { JAS: ["July to September", "September"], ASO: ["August to October", "October"], SON: ["September to November", "November"] }[season];
  if (!SEASON) throw new Error(`COPY: copy has no wording for season ${season}`);
  // Peers: the strongest El Niños before this one, by peak, from the data.
  const PEERS = [...byYear.keys()].filter((y) => y < yr).map((y) => ({ yr: y, peak: peak(y), name: `${y}–${String(y + 1).slice(2)}` }))
    .sort((a, b) => b.peak - a.peak).slice(0, 3);
  // The record claim per season: the runner-up in this season, by explicit lookup.
  const runnerUp = [...byYear.keys()].filter((y) => y < yr && byYear.get(y).some((d) => d.season === season)).sort((a, b) => at(b) - at(a))[0];
  const sgn = (v) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}°C`;
  return { oni, latest, byYear, season, yr, at, peak, PEERS, runnerUp, sgn, SEASON, key: S.key, index: S.index,
    source: S.source, notes: S.notes };
};
