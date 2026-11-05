"""Fetch Copernicus ERA5 sea-surface temperature over the Nino 3.4 box, with provenance.

Run: python3 -I pipeline/fetch/fetch_era5.py
Needs a Copernicus Climate Data Store account: the cdsapi package reads the URL and key from
~/.cdsapirc (never from this script, the command line or the repository).

Writes the untouched NetCDF responses to pipeline/data/raw/ and merges their entries into
pipeline/data/raw/manifest.json (one entry per file; a refetch replaces the old entry).

Dataset: reanalysis-era5-single-levels-monthly-means, monthly_averaged_reanalysis,
sea_surface_temperature, area 5N-5S, 170W-120W (the Nino 3.4 region), 0.25 degree grid,
January 1950 to the latest month the CDS serves (ERA5T, about a week after a month ends).
Licence: Copernicus licence; cite "Copernicus Climate Change Service (C3S), ERA5".
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# `python3 -I` leaves out user site-packages, where cdsapi is usually installed; add them back explicitly
# (only that directory, not the current folder).
import site  # noqa: E402
sys.path.append(site.getusersitepackages())
import cdsapi  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
MANIFEST = RAW / "manifest.json"
DATASET = "reanalysis-era5-single-levels-monthly-means"
AREA = [5, -170, -5, -120]  # N, W, S, E
entries = []
client = cdsapi.Client(quiet=True)


def request(years, months):
    return {"product_type": ["monthly_averaged_reanalysis"], "variable": ["sea_surface_temperature"],
            "year": [str(y) for y in years], "month": [f"{m:02d}" for m in months], "time": ["00:00"],
            "area": AREA, "data_format": "netcdf", "download_format": "unarchived"}


def fetch(name, years, months, note):
    target = RAW / name
    client.retrieve(DATASET, request(years, months), str(target))
    body = target.read_bytes()
    if body[:4] not in (b"CDF\x01", b"CDF\x02", b"\x89HDF"):
        raise SystemExit(f"{name}: not a NetCDF file (first bytes {body[:16]!r})")
    entries.append({"file": name, "url": f"cds://{DATASET} {json.dumps(request(years, months))}",
                    "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body), "note": note})
    print(f"saved {name} ({len(body):,} bytes)")


now = datetime.now(timezone.utc)
fetch("era5_sst_nino34_1950_2025.nc", range(1950, 2026), range(1, 13),
      "ERA5 monthly mean SST, Nino 3.4 box, 1950-2025 (Copernicus C3S)")
# The current year: ask for every month up to the last one; the CDS refuses months it does not have
# yet, so step back one month at a time until it serves the request.
for last in range(now.month - 1, 0, -1):
    try:
        fetch(f"era5_sst_nino34_{now.year}.nc", [now.year], range(1, last + 1),
              f"ERA5 monthly mean SST, Nino 3.4 box, {now.year} January to month {last} (ERA5T, provisional)")
        break
    except Exception as e:  # noqa: BLE001
        print(f"  {now.year}-{last:02d} not served yet: {str(e).splitlines()[0][:120]}", file=sys.stderr)

old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
mine = {e["file"] for e in entries}
MANIFEST.write_text(json.dumps([e for e in old if e["file"] not in mine] + entries, indent=2))
print(f"manifest: {len(old)} -> {len([e for e in old if e['file'] not in mine]) + len(entries)} entries")
