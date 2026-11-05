"""Fetch climate data with provenance.

Run: python3 -I pipeline/fetch/fetch_climate.py
Writes untouched responses to pipeline/data/raw/ and merges their entries into
pipeline/data/raw/manifest.json (one entry per file; a refetch replaces the old entry).

Sources (public, no key):
  Our World in Data grapher   global temperature anomaly by month (Copernicus C3S ERA5, 1991-2020
                              baseline, processed by OWID) with NOAA's Oceanic Nino Index for the
                              same month. Licence CC BY 4.0; cite Copernicus and NOAA via OWID.
"""
import hashlib
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
MANIFEST = RAW / "manifest.json"
entries = []


def get(url, retries=4, ua="zerodha-dataviz/0.1"):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)


def save(name, body, url, note):
    (RAW / name).write_bytes(body)
    entries.append({"file": name, "url": url, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body), "note": note})
    print(f"saved {name} ({len(body):,} bytes)")


# OWID chart "Global temperature anomalies by El Nino and La Nina": the World series only.
SLUG = "global-temperature-anomalies-by-el-nino-la-nina"
Q = "v=1&csvType=filtered&useColumnShortNames=true&country=~OWID_WRL"
u = f"https://ourworldindata.org/grapher/{SLUG}.csv?{Q}"
body = get(u)
head = body.decode("utf-8").splitlines()[0]
if head != "entity,code,month,temperature_anomaly,oni_anomaly":
    raise SystemExit(f"OWID {SLUG}: unexpected columns {head!r}")
save("owid_era5_enso_world.csv", body, u,
     "World monthly surface temperature anomaly, degC vs 1991-2020 (Copernicus ERA5 via OWID) with NOAA ONI for the month")
u = f"https://ourworldindata.org/grapher/{SLUG}.metadata.json?{Q}"
save("owid_era5_enso_world.metadata.json", get(u), u, "OWID metadata for the series above: sources, processing, update dates")

old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
mine = {e["file"] for e in entries}
MANIFEST.write_text(json.dumps([e for e in old if e["file"] not in mine] + entries, indent=2))
print(f"manifest: {len(old)} -> {len([e for e in old if e['file'] not in mine]) + len(entries)} entries")
