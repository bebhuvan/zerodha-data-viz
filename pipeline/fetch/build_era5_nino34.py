"""El Nino index from Copernicus ERA5: Nino 3.4 sea-surface temperature anomaly, three-month seasons.

Called from build_tidy.py: build(facts, write, check). Raw files from fetch_era5.py.

Method (the ONI recipe, applied to ERA5 instead of NOAA's ERSSTv5)
- Monthly mean SST over 5N-5S, 170W-120W (the Nino 3.4 box), ERA5 0.25 degree grid, averaged with
  cos(latitude) weights.
- Monthly anomaly against the 1991-2020 mean for that calendar month. One fixed base for every year;
  NOAA's ONI instead uses a base that moves every five years, which removes much of the long-run warming.
  That is why ERA5 runs about 0.2C cooler than NOAA before 1980 and close to it since 2000.
- Three-month running mean centred on the middle month (DJF, JFM, ... NDJ). ENSO year June to May,
  labelled by the June year, as in oni.csv.
- Gates: the box and grid are as requested, no missing values, months contiguous from January 1950,
  values in a plausible range, and season-by-season correlation with NOAA's ONI of at least 0.95.
Writes era5_nino34.csv (enso_year, season, month_pos, anom) and facts with the prefix era5n34_.
"""
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())  # xarray and netCDF4 under `python3 -I`
import numpy as np  # noqa: E402
import xarray as xr  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]


def build(facts, write, check):
    files = sorted(RAW.glob("era5_sst_nino34_*.nc"))
    check(len(files) >= 2, f"ERA5 Nino 3.4: history and current-year files present ({[f.name for f in files]})")
    ds = xr.concat([xr.open_dataset(f) for f in files], dim="valid_time").sortby("valid_time")
    sst = ds["sst"]
    lat, lon = sst.latitude.values, sst.longitude.values
    check(lat.min() == -5 and lat.max() == 5 and lon.min() == -170 and lon.max() == -120,
          f"ERA5 Nino 3.4: box 5S-5N, 170W-120W (got {lat.min()}..{lat.max()}, {lon.min()}..{lon.max()})")
    check(int(sst.isnull().sum()) == 0, "ERA5 Nino 3.4: no missing grid values over the open ocean box")
    w = np.cos(np.deg2rad(sst.latitude))
    s = (sst.weighted(w).mean(["latitude", "longitude"]) - 273.15).to_series()
    months = [(t.year, t.month) for t in s.index]
    check(months[0] == (1950, 1), f"ERA5 Nino 3.4: starts January 1950 (got {months[0]})")
    want = [(1950 + i // 12, 1 + i % 12) for i in range(len(months))]
    check(months == want, "ERA5 Nino 3.4: months contiguous, none repeated")
    vals = dict(zip(months, s.values.tolist()))
    check(all(24 < v < 31 for v in vals.values()), "ERA5 Nino 3.4: monthly SST between 24C and 31C")
    clim = {m: np.mean([vals[(y, m)] for y in range(1991, 2021)]) for m in range(1, 13)}
    anom = {k: v - clim[k[1]] for k, v in vals.items()}

    rows = []
    for i in range(1, len(months) - 1):
        y, m = months[i]
        v = (anom[months[i - 1]] + anom[months[i]] + anom[months[i + 1]]) / 3
        enso_year = y if m >= 6 else y - 1
        rows.append({"enso_year": enso_year, "season": SEASONS[m - 1], "month_pos": (m - 6) % 12, "anom": round(v, 2)})
    rows = [r for r in rows if r["enso_year"] >= 1950]
    check(all(-3.5 < r["anom"] < 3.5 for r in rows), "ERA5 Nino 3.4 seasons in a plausible range")

    # Cross-check against NOAA CPC's ONI, season by season.
    noaa = {}
    for line in (RAW / "noaa_oni.txt").read_text().splitlines()[1:]:
        seas, yr, _, a = line.split()
        noaa[(seas, int(yr))] = float(a)
    pairs = [(r["anom"], noaa[(r["season"], r["enso_year"] + (1 if r["month_pos"] >= 7 else 0))]) for r in rows
             if (r["season"], r["enso_year"] + (1 if r["month_pos"] >= 7 else 0)) in noaa]
    corr = float(np.corrcoef(*zip(*pairs))[0, 1])
    check(len(pairs) > 900 and corr >= 0.95, f"ERA5 Nino 3.4 tracks NOAA's ONI (r = {corr:.3f} over {len(pairs)} seasons)")
    facts["era5n34_noaa_corr"] = round(corr, 3)
    write("era5_nino34.csv", rows)

    latest = rows[-1]
    facts["era5n34_latest_season"] = f"{latest['season']} {latest['enso_year']}"
    facts["era5n34_latest"] = latest["anom"]
    same = sorted(((r["anom"], r["enso_year"]) for r in rows if r["season"] == latest["season"]), reverse=True)
    facts["era5n34_latest_rank_same_season"] = [y for _, y in same].index(latest["enso_year"]) + 1
    facts["era5n34_same_season_top5"] = same[:5]
    for r in rows:
        if r["season"] == latest["season"]:
            facts[f"era5n34_{r['enso_year']}_{r['season']}"] = r["anom"]
    peaks = {}
    for r in rows:
        peaks[r["enso_year"]] = max(peaks.get(r["enso_year"], -9), r["anom"])
    for y, v in peaks.items():
        facts[f"era5n34_peak_{y}"] = v
    # Lead of the latest year over the runner-up for the same season (the copy may quote it).
    facts["era5n34_latest_lead"] = round(same[0][0] - same[1][0], 2) if same[0][1] == latest["enso_year"] else None
