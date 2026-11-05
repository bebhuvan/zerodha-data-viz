"""Turn raw snapshots into tidy CSVs both renderers read, with validation gates.

Run: python3 -I pipeline/fetch/build_tidy.py
Fails loudly if any check fails. Writes pipeline/data/tidy/*.csv and facts.json
(every number a headline or annotation may quote).
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW, TIDY = ROOT / "data" / "raw", ROOT / "data" / "tidy"
TIDY.mkdir(parents=True, exist_ok=True)
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
facts = {}


def write(name, rows):
    with open(TIDY / name, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {name}: {len(rows)} rows")


def check(cond, msg):
    if not cond:
        raise SystemExit(f"CHECK FAILED: {msg}")
    print(f"  ok: {msg}")


# ---------------------------------------------------------------- 1. CPI contributions
# CPI (base 2012) Combined weights, MOSPI. Group indices aggregate to the general
# index with these fixed weights, so YoY contributions add up to headline inflation.
WEIGHTS = {
    "Food and Beverages-Overall": 45.86,
    "Pan, Tobacco and Intoxicants-Overall": 2.38,
    "Clothing and Footwear-Overall": 6.53,
    "Housing-Overall": 10.07,
    "Fuel and Light-Overall": 6.84,
    "Household Goods and Services": 3.80,
    "Health": 5.89,
    "Transport and Communication": 8.59,
    "Recreation and Amusement": 1.68,
    "Education": 4.46,
    "Personal Care and Effects": 3.89,
}
BUCKET = {  # chart component each weighted item rolls into
    "Food and Beverages-Overall": "Food and beverages",
    "Housing-Overall": "Housing",
    "Fuel and Light-Overall": "Fuel and light",
    "Personal Care and Effects": "Personal care (incl. gold, silver)",
}
OTHER = "Everything else"
check(abs(sum(WEIGHTS.values()) - 100) < 0.02, "CPI weights sum to 100")

cpi = json.loads((RAW / "mospi_cpi_allindia_combined_2013_2025.json").read_text())
# Months where the source returns two different values for the same series: drop, never pick one.
conflicted = {(c["key"][4], MONTHS.index(c["key"][5]) + 1) for c in json.loads((RAW / "source_conflicts.json").read_text())
              if c["key"][0] == "All India"}
facts["cpi_conflicted_months"] = sorted(f"{y}-{m:02d}" for y, m in conflicted)
idx, pub = {}, {}
for r in cpi:
    if (r["year"], MONTHS.index(r["month"]) + 1) in conflicted:
        continue
    key = (r["year"], MONTHS.index(r["month"]) + 1)
    if r["subgroup"] in WEIGHTS and r["index"] is not None:
        idx.setdefault(key, {})[r["subgroup"]] = float(r["index"])
    if r["subgroup"] == "General-Overall":
        pub[key] = (float(r["index"]), None if r["inflation"] is None else float(r["inflation"]))

months = sorted(k for k in idx if len(idx[k]) == len(WEIGHTS))
gaps = sorted(set(idx) - set(months))
# Known MOSPI API gap: Combined Housing index missing Dec 2018 - Sep 2019. Skip, never impute.
check(all(g < (2020, 1) for g in gaps), f"incomplete months all before 2020: {gaps}")
facts["cpi_gap_months"] = [f"{y}-{m:02d}" for y, m in gaps]

# Weighted index reproduces the published general index (within index rounding).
worst = max(abs(sum(WEIGHTS[s] * v for s, v in idx[k].items()) / 100 - pub[k][0]) for k in months)
check(worst < 0.25, f"weighted group indices reproduce published general index (max gap {worst:.2f} pts)")

contrib, headline = [], []
for (y, m) in months:
    prev = (y - 1, m)
    if prev not in months:
        continue
    base = sum(WEIGHTS[s] * v for s, v in idx[prev].items())
    parts = {}
    for s, w in WEIGHTS.items():
        b = BUCKET.get(s, OTHER)
        parts[b] = parts.get(b, 0) + w * (idx[(y, m)][s] - idx[prev][s]) / base * 100
    total = sum(parts.values())
    published = pub[(y, m)][1]
    # Published inflation comes from unrounded indices; ours from 1-dp indices.
    check(published is None or abs(total - published) < 0.15,
          f"{y}-{m:02d} contributions sum {total:.2f} vs published {published}")
    month = f"{y}-{m:02d}"
    headline.append({"month": month, "headline_published": published, "headline_computed": round(total, 3)})
    for b, v in parts.items():
        contrib.append({"month": month, "component": b, "contrib_pp": round(v, 3)})

write("cpi_contrib.csv", contrib)
write("cpi_headline.csv", headline)

# Facts a headline may quote: published headline values, and component contributions.
for h in headline:
    facts[f"cpi_headline_{h['month']}"] = h["headline_published"]
for c in contrib:
    facts[f"cpi_contrib_{c['month']}_{c['component']}"] = c["contrib_pp"]
# Change in each component's contribution over the latest twelve months (the bridge chart's steps).
# Contributions add up to headline inflation, so these changes add up to the change in the headline.
last = contrib[-1]["month"]
yago = f"{int(last[:4]) - 1}{last[4:]}"
cmap = {(c["month"], c["component"]): c["contrib_pp"] for c in contrib}
steps = {b: round(cmap[(last, b)] - cmap[(yago, b)], 3) for b in {c["component"] for c in contrib}}
hmap = {h["month"]: h for h in headline}
check(abs(sum(steps.values()) - (hmap[last]["headline_computed"] - hmap[yago]["headline_computed"])) < 0.01,
      f"contribution changes {yago} to {last} add up to the change in computed headline")
for b, v in steps.items():
    facts[f"cpi_contrib_change_{yago}_{last}_{b}"] = v
# Published year-on-year inflation for the general index and every subgroup, every month the source
# gives one (conflicted months dropped). Unlike cpi_headline.csv this includes the months where one
# group index is missing, because MOSPI still published the general rate for them.
general, subs = [], []
for r in cpi:
    key = (r["year"], MONTHS.index(r["month"]) + 1)
    if key in conflicted or r["inflation"] in (None, ""):
        continue
    month = f"{key[0]}-{key[1]:02d}"
    if r["subgroup"] == "General-Overall":
        general.append({"month": month, "yoy": float(r["inflation"])})
    subs.append({"month": month, "subgroup": r["subgroup"], "yoy": float(r["inflation"])})
general.sort(key=lambda d: d["month"])
subs.sort(key=lambda d: (d["subgroup"], d["month"]))
ms = [g["month"] for g in general]
check(len(ms) == len(set(ms)), "one published general inflation figure per month")
check(all(abs(g["yoy"]) < 15 for g in general), "general inflation within plausible range")
write("cpi_general.csv", general)
write("cpi_subgroup_yoy.csv", subs)
for g in general:
    facts[f"cpi_headline_{g['month']}"] = g["yoy"]
# Subgroup rates a chart may quote: the two Decembers the slope and small-multiple charts compare.
for d in subs:
    if d["month"] in ("2024-12", "2025-12"):
        facts[f"cpi_subgroup_yoy_{d['month']}_{d['subgroup']}"] = d["yoy"]
write("cpi_weights.csv", [{"group": g, "weight": w} for g, w in sorted(WEIGHTS.items(), key=lambda x: -x[1])])
for g, w in WEIGHTS.items():
    facts[f"cpi_weight_{g}"] = w
# The waffle's grey block: everything but food and personal care.
facts["cpi_weight_rest_ex_food_care"] = round(100 - WEIGHTS["Food and Beverages-Overall"] - WEIGHTS["Personal Care and Effects"], 2)

# ---------------------------------------------------------------- 2. ONI ridgeline
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]
oni = []
for line in (RAW / "noaa_oni.txt").read_text().splitlines()[1:]:
    seas, yr, total, anom = line.split()
    center = SEASONS.index(seas) + 1  # centre month of the 3-month season
    # ENSO year runs June -> May, labelled by the June year.
    enso_year = int(yr) if center >= 6 else int(yr) - 1
    oni.append({"enso_year": enso_year, "season": seas, "month_pos": (center - 6) % 12,
                "anom": float(anom)})
oni = [o for o in oni if o["enso_year"] >= 1950]
check(all(-3.5 < o["anom"] < 3.5 for o in oni), "ONI anomalies in plausible range")
write("oni.csv", oni)

latest = oni[-1]
facts["oni_latest_season"] = f"{latest['season']} {latest['enso_year']}"
facts["oni_latest"] = latest["anom"]
same_season = sorted(((o["anom"], o["enso_year"]) for o in oni if o["season"] == latest["season"]), reverse=True)
facts["oni_latest_rank_same_season"] = [y for _, y in same_season].index(latest["enso_year"]) + 1
facts["oni_same_season_top5"] = same_season[:5]
for o in oni:
    if o["season"] == latest["season"]:
        facts[f"oni_{o['enso_year']}_{o['season']}"] = o["anom"]
peaks = {}
for o in oni:
    if o["anom"] > peaks.get(o["enso_year"], -9):
        peaks[o["enso_year"]] = o["anom"]
for y, v in peaks.items():
    facts[f"oni_peak_{y}"] = v
facts["oni_peak_by_year_top8"] = sorted(((v, y) for y, v in peaks.items()), reverse=True)[:8]

# ---------------------------------------------------------------- 3. State CPI
GRID = {  # code: (row, col, map name)
    "JK": (1, 3, "Jammu and Kashmir"), "LA": (1, 4, "Ladakh"),
    "PB": (2, 2, "Punjab"), "CH": (2, 3, "Chandigarh"), "HP": (2, 4, "Himachal Pradesh"),
    "HR": (3, 3, "Haryana"), "UK": (3, 4, "Uttarakhand"), "AR": (3, 8, "Arunachal Pradesh"),
    "RJ": (4, 2, "Rajasthan"), "DL": (4, 3, "Delhi"), "UP": (4, 4, "Uttar Pradesh"),
    "BR": (4, 5, "Bihar"), "SK": (4, 6, "Sikkim"), "AS": (4, 7, "Assam"), "NL": (4, 8, "Nagaland"),
    "GJ": (5, 1, "Gujarat"), "MP": (5, 2, "Madhya Pradesh"), "CG": (5, 3, "Chhattisgarh"),
    "JH": (5, 4, "Jharkhand"), "WB": (5, 5, "West Bengal"), "ML": (5, 7, "Meghalaya"),
    "MN": (5, 8, "Manipur"),
    "DH": (6, 1, "Dadra and Nagar Haveli and Daman and Diu"), "MH": (6, 2, "Maharashtra"),
    "TS": (6, 3, "Telangana"), "OD": (6, 4, "Odisha"), "TR": (6, 7, "Tripura"), "MZ": (6, 8, "Mizoram"),
    "GA": (7, 1, "Goa"), "KA": (7, 2, "Karnataka"), "AP": (7, 3, "Andhra Pradesh"),
    "LD": (8, 1, "Lakshadweep"), "KL": (8, 2, "Kerala"), "TN": (8, 3, "Tamil Nadu"),
    "PY": (8, 4, "Puducherry"), "AN": (8, 6, "Andaman and Nicobar Islands"),
}
CPI_NAME = {"Andaman & Nicobar Islands": "Andaman and Nicobar Islands", "Jammu & Kashmir": "Jammu and Kashmir"}
NO_SERIES = {  # map units without a single CPI series, and why
    "Ladakh": "No separate CPI series",
    "Dadra and Nagar Haveli and Daman and Diu": "CPI still reports the two former UTs separately",
}

geo = json.loads((ROOT / "design" / "geo" / "india_states_dissolved.geojson").read_text())
map_names = {f["properties"]["st_nm"] for f in geo["features"]}
check(map_names == {v[2] for v in GRID.values()}, "tile grid and map cover the same 36 states/UTs")
check(len({(r, c) for r, c, _ in GRID.values()}) == len(GRID), "no two tiles share a grid cell")

st = json.loads((RAW / "mospi_cpi_states_combined_dec2024_dec2025.json").read_text())
gen = {(CPI_NAME.get(r["state"], r["state"]), r["year"]): r for r in st if r["subgroup"] == "General-Overall"}
rows = []
for code, (row, col, name) in GRID.items():
    r25, r24 = gen.get((name, 2025)), gen.get((name, 2024))
    value, note = None, NO_SERIES.get(name, "")
    if r25 and r25["inflation"] is not None:
        value = float(r25["inflation"])
        recomputed = (float(r25["index"]) / float(r24["index"]) - 1) * 100
        check(abs(recomputed - value) < 0.1, f"{name}: published YoY {value} matches index ratio {recomputed:.2f}")
    elif not note:
        note = "No combined index published"
    prev = float(r24["inflation"]) if r24 and r24["inflation"] is not None and value is not None else None
    rows.append({"code": code, "name": name, "row": row, "col": col,
                 "inflation": value, "inflation_prev": prev, "note": note})
    if value is not None:
        facts[f"state_cpi_2025-12_{name}"] = value
    if prev is not None:
        facts[f"state_cpi_2024-12_{name}"] = prev
write("state_cpi.csv", rows)
facts["state_cpi_2025-12_All India"] = pub[(2025, 12)][1]
facts["state_cpi_2024-12_All India"] = pub[(2024, 12)][1]

# ---------------------------------------------------------------- Markets, rates and macro
import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_markets  # noqa: E402
build_markets.build(facts, write, check)
import build_climate  # noqa: E402
build_climate.build(facts, write, check)
import build_era5_nino34  # noqa: E402
build_era5_nino34.build(facts, write, check)
import build_poverty  # noqa: E402
build_poverty.build(facts, write, check)
import build_earnings  # noqa: E402
build_earnings.build(facts, write, check)
import build_midterms  # noqa: E402
build_midterms.build(facts, write, check)

(TIDY / "facts.json").write_text(json.dumps(facts, indent=1))
print(f"wrote facts.json: {len(facts)} facts")
