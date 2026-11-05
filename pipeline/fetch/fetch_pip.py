"""Fetch India's poverty estimates from the World Bank Poverty and Inequality Platform (PIP).

Run: python3 -I pipeline/fetch/fetch_pip.py
Writes untouched CSV responses to pipeline/data/raw/ and merges their entries into
pipeline/data/raw/manifest.json (one entry per file; a refetch replaces the old entry).

The release is pinned (VERSION) so the numbers match the Poverty, Prosperity, and Planet Report 2026,
which uses PIP version September 2026 at 2021 PPPs. Change VERSION deliberately, never silently.

Files, one per poverty line ($3.00, $4.20, $8.30 a person a day, 2021 PPP):
  pip_ind_<line>_surveys.csv   survey years only (fill_gaps=false): what the chart draws
  pip_ind_<line>_lineup.csv    every year incl. interpolated and nowcast years (fill_gaps=true): used only
                               to check our reading against the report's 2024 figures
"""
import csv
import hashlib
import io
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
MANIFEST = RAW / "manifest.json"
VERSION = "20260922_2021_01_02_PROD"
LINES = ["3", "4.2", "8.3"]
API = "https://api.worldbank.org/pip/v1/pip?country=IND&year=all&povline={pl}&version={v}&fill_gaps={fg}&format=csv"
entries = []


def get(url, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "zerodha-dataviz/0.1"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)


versions = json.loads(get("https://api.worldbank.org/pip/v1/versions"))
if VERSION not in {v["version"] for v in versions}:
    raise SystemExit(f"PIP no longer serves {VERSION}")
for pl in LINES:
    for fg, kind in [("false", "surveys"), ("true", "lineup")]:
        u = API.format(pl=pl, v=VERSION, fg=fg)
        body = get(u)
        rows = list(csv.DictReader(io.StringIO(body.decode())))  # fail loudly on an error payload
        if not rows or "headcount" not in rows[0] or {r["country_code"] for r in rows} != {"IND"}:
            raise SystemExit(f"PIP {pl} {kind}: unexpected response {body[:200]!r}")
        if any(abs(float(r["poverty_line"]) - float(pl)) > 1e-9 for r in rows):
            raise SystemExit(f"PIP {pl} {kind}: wrong poverty line in response")
        name = f"pip_ind_{pl.replace('.', '')}_{kind}.csv"
        (RAW / name).write_bytes(body)
        entries.append({"file": name, "url": u, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body),
                        "note": f"India poverty headcount at ${float(pl):.2f} a day (2021 PPP), PIP {VERSION}, "
                                + ("survey years only" if kind == "surveys" else "lineup years incl. interpolated and extrapolated")})
        print(f"saved {name} ({len(body):,} bytes, {len(rows)} rows)")

old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
mine = {e["file"] for e in entries}
MANIFEST.write_text(json.dumps([e for e in old if e["file"] not in mine] + entries, indent=2))
print(f"manifest: {len(old)} -> {len([e for e in old if e['file'] not in mine]) + len(entries)} entries")
