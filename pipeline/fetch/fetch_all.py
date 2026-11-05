"""Fetch every dataset the bake-off needs and keep raw snapshots with provenance.

Run: python3 -I pipeline/fetch/fetch_all.py
Writes pipeline/data/raw/* (untouched responses) and pipeline/data/raw/manifest.json.
"""
import hashlib
import json
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

# MOSPI's server still needs legacy TLS renegotiation.
CTX = ssl.create_default_context()
CTX.options |= 0x4  # OP_LEGACY_SERVER_CONNECT

MOSPI = "https://api.mospi.gov.in/api/cpi/getCPIIndex"
manifest = []
conflicts = []  # same key, different values, straight from the source


def get(url, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "zerodha-dataviz/0.1"})
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)


def save(name, body, url, note):
    (RAW / name).write_bytes(body)
    manifest.append({
        "file": name,
        "url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(body).hexdigest(),
        "bytes": len(body),
        "note": note,
    })
    print(f"saved {name} ({len(body):,} bytes)")


def mospi_slice(params):
    """Fetch one slice small enough for a single page.

    MOSPI's paging has no stable sort: across pages rows repeat and others vanish.
    So never page; slice the query until it fits one page, and reject duplicates.
    """
    q = "&".join(f"{k}={v}" for k, v in {**params, "Format": "JSON", "limit": 100}.items())
    body = json.loads(get(f"{MOSPI}?{q}"))
    rows = body["data"]
    if rows and body["meta_data"]["totalPages"] != 1:
        raise SystemExit(f"slice too big for one page: {params}")
    seen = {}
    for r in rows:
        k = (r["state"], r["sector"], r["group"], r["subgroup"], r["year"], r["month"])
        if k in seen and seen[k] != (r["index"], r["inflation"]):
            conflicts.append({"key": k, "values": [seen[k], (r["index"], r["inflation"])]})
        seen[k] = (r["index"], r["inflation"])
    return rows, f"{MOSPI}?{q}"


# 1. All-India CPI (Combined), every group and subgroup, 2013-2025 (2012 base), one month per call.
cpi = []
for year in range(2013, 2026):
    for month in range(1, 13):
        rows, _ = mospi_slice({"base_year": 2012, "year": year, "month_code": month, "state_code": 99, "sector_code": 3})
        cpi += rows
    print(f"cpi all-india {year}: {sum(r['year'] == year for r in cpi)} rows")
save("mospi_cpi_allindia_combined_2013_2025.json", json.dumps(cpi).encode(),
     f"{MOSPI}?base_year=2012&year={{2013..2025}}&month_code={{1..12}}&state_code=99&sector_code=3&Format=JSON",
     "MOSPI CPI base 2012, All India, Combined sector, all groups/subgroups")

# 2. State CPI (Combined), each state, Dec 2024 and Dec 2025.
states = []
for year in (2024, 2025):
    for code in range(1, 40):
        rows, _ = mospi_slice({"base_year": 2012, "year": year, "month_code": 12, "state_code": code, "sector_code": 3})
        states += rows
save("mospi_cpi_states_combined_dec2024_dec2025.json", json.dumps(states).encode(),
     f"{MOSPI}?base_year=2012&year={{2024,2025}}&month_code=12&state_code={{1..39}}&sector_code=3&Format=JSON",
     "MOSPI CPI base 2012, each state, Combined, December of 2024 and 2025")

# 3. NOAA CPC Oceanic Nino Index (ERSSTv5, 3-month running mean of Nino 3.4 anomalies).
u = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
save("noaa_oni.txt", get(u), u, "NOAA CPC ONI, ERSSTv5, 1991-2020 climatology")

# 4. India state boundaries.
u = "https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson"
save("india_states.geojson", get(u), u, "State boundaries, udit-001/india-maps-data (check compliance before publishing)")

(RAW / "source_conflicts.json").write_text(json.dumps(conflicts, indent=1))
print(f"source conflicts: {len(conflicts)}")
(RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
