"""Climate tables and facts: world temperature by El Nino phase (Copernicus ERA5 via OWID, NOAA ONI).

Called from build_tidy.py: build(facts, write, check).

Method
- Monthly world surface temperature anomaly, degC against 1991-2020 (ERA5, area-weighted, land and
  ocean; OWID processing). Calendar-year means only for complete years.
- Each year takes the ENSO phase of its December-February season (ONI for January, i.e. the DJF value):
  world temperature lags the Pacific by a few months, so the phase at the turn of the year shapes the
  year (the usual convention, used by NOAA and WMO summaries). El Nino at ONI >= +0.5, La Nina at
  <= -0.5, else neutral. The headline claim is re-checked under two other definitions (mean ONI of the
  prior October-March, and the calendar-year mean) and must hold under all three.
- OWID's ONI is cross-checked month by month against NOAA CPC's own file (pipeline/data/raw/noaa_oni.txt).
"""
import csv
import json
import statistics as st
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]


def phase(v):
    return "nino" if v >= 0.5 else "nina" if v <= -0.5 else "neutral"


def build(facts, write, check):
    rows = list(csv.DictReader(open(RAW / "owid_era5_enso_world.csv")))
    check(all(r["entity"] == "World" for r in rows), "ERA5 via OWID: World series only")
    t = {r["month"]: float(r["temperature_anomaly"]) for r in rows}
    oni = {r["month"]: float(r["oni_anomaly"]) for r in rows if r["oni_anomaly"]}
    months = sorted(t)
    # Contiguous months, one row each.
    def nxt(m):
        y, mo = int(m[:4]), int(m[5:])
        return f"{y + (mo == 12)}-{mo % 12 + 1:02d}"
    check(len(months) == len(rows) and all(nxt(a) == b for a, b in zip(months, months[1:])),
          f"ERA5 months contiguous, one row each, {months[0]} to {months[-1]}")
    check(all(-2 < v < 2 for v in t.values()), "ERA5 world anomalies within ±2°C")
    meta = json.loads((RAW / "owid_era5_enso_world.metadata.json").read_text())
    cite = meta["columns"]["temperature_anomaly"]["citationLong"]
    check("Copernicus" in cite and "ERA5" in cite, "OWID metadata cites Copernicus ERA5")

    # OWID's ONI equals NOAA CPC's centred three-month value (NOAA labels NDJ with November's year).
    noaa = {}
    for line in (RAW / "noaa_oni.txt").read_text().splitlines()[1:]:
        s, y, _, a = line.split()
        noaa[(s, int(y))] = float(a)
    def noaa_for(m):
        y, mo = int(m[:4]), int(m[5:])
        return noaa.get((SEASONS[(mo - 2) % 12], y - (mo == 1)))
    bad = [m for m in oni if noaa_for(m) is None or abs(noaa_for(m) - oni[m]) > 0.005]
    check(not bad, f"OWID ONI matches NOAA CPC in all {len(oni)} months (mismatches: {bad[:5]})")

    years = sorted({int(m[:4]) for m in months})
    full = [y for y in years if all(f"{y}-{mo:02d}" in t for mo in range(1, 13))]
    ann = {y: st.mean(t[f"{y}-{mo:02d}"] for mo in range(1, 13)) for y in full}
    defs = {
        "djf": lambda y: oni.get(f"{y}-01"),
        "oct_mar": lambda y: st.mean([oni[k] for k in [f"{y-1}-10", f"{y-1}-11", f"{y-1}-12", f"{y}-01", f"{y}-02", f"{y}-03"] if k in oni]),
        "calendar": lambda y: st.mean([oni[f"{y}-{mo:02d}"] for mo in range(1, 13)]),
    }
    out = []
    for y in full:
        if defs["djf"](y) is None:
            continue
        out.append({"year": y, "anomaly": round(ann[y], 3), "oni_djf": oni[f"{y}-01"], "phase": phase(oni[f"{y}-01"])})
        facts[f"era5_year_{y}"] = round(ann[y], 2)
        facts[f"era5_phase_{y}"] = phase(oni[f"{y}-01"])
    write("era5_enso_annual.csv", out)
    facts["era5_first_year"], facts["era5_last_year"] = out[0]["year"], out[-1]["year"]

    # The year in progress: mean of the months so far, with the month range named.
    cur = years[-1]
    ytd = [f"{cur}-{mo:02d}" for mo in range(1, 13) if f"{cur}-{mo:02d}" in t]
    if cur not in full and ytd:
        facts["era5_ytd_year"], facts["era5_ytd_months"] = cur, len(ytd)
        facts["era5_ytd_last_month"] = ytd[-1]
        facts[f"era5_year_{cur}_so_far"] = round(st.mean(t[m] for m in ytd), 2)
        facts["era5_latest_month"], facts["era5_latest"] = ytd[-1], round(t[ytd[-1]], 2)
        facts["era5_latest_oni"] = oni.get(ytd[-1])

    # Claim: the La Nina years of 2021 and 2022 were warmer than 1998, the great El Nino year, by about a
    # quarter of a degree, under every phase definition; and warmer than every El Nino year before 2015.
    for name, f in defs.items():
        ph = {y: phase(f(y)) for y in ann}
        # 1998 is an El Nino year by the turn-of-year conventions; by calendar-year mean the 1997-98 event,
        # which turned to La Nina by mid-1998, nets out. The comparison below must hold under all three.
        if name != "calendar":
            check(ph[2021] == "nina" and ph[2022] == "nina" and ph[1998] == "nino",
                  f"phases ({name}): 2021 and 2022 La Nina, 1998 El Nino")
        early_nino = [y for y in ann if ph[y] == "nino" and y < 2015]
        check(min(ann[2021], ann[2022]) > max(ann[y] for y in early_nino),
              f"2021 and 2022 warmer than every El Nino year before 2015 ({name})")
    facts["era5_nina_2021_vs_1998"] = round(ann[2021] - ann[1998], 2)
    facts["era5_nina_2022_vs_1998"] = round(ann[2022] - ann[1998], 2)
    facts["era5_warmest_year"] = max(ann, key=ann.get)
    facts["era5_warmest_nino_before_2015"] = max((y for y in ann if phase(defs["djf"](y)) == "nino" and y < 2015), key=ann.get)
    facts["era5_source_updated"] = meta["columns"]["temperature_anomaly"].get("lastUpdated")
