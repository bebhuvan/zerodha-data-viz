"""Import IndiaDataHub's quarterly results of BSE-listed companies (manual CSV downloads).

Run: python3 -I pipeline/fetch/import_idh.py <folder with the six CSVs> [--date YYYY-MM-DD]

IndiaDataHub (Sector Insights: Quarterly Performance of Listed Companies, all BSE-listed companies) has no
public API we use, so the files are downloaded by hand from the GROWTH tab (Revenue, EBITDA, PAT; YoY %) and
the AGGREGATES (RS BN) tab (Total Revenue, EBITDA, PAT). This script copies them untouched into
pipeline/data/raw/ under fixed names and merges their entries into manifest.json (one entry per file;
a re-import replaces the old entry). --date is when they were downloaded (default: the files' mtime).

It fails loudly if a file is missing or its layout changed: header of quarter-end months, the same row
labels in all six files.
"""
import csv
import hashlib
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
MANIFEST = RAW / "manifest.json"
PAGE = "https://indiadatahub.com (Sector Insights: Quarterly Performance of Listed Companies)"
FILES = {  # download name -> raw name, what it is
    "Growth_Revenue.csv": ("idh_growth_revenue.csv", "GROWTH tab, Revenue, YoY %"),
    "Growth_EBITDA.csv": ("idh_growth_ebitda.csv", "GROWTH tab, EBITDA, YoY %"),
    "Growth_PAT.csv": ("idh_growth_pat.csv", "GROWTH tab, PAT, YoY %"),
    "Aggregates_Total_Revenue.csv": ("idh_agg_revenue.csv", "AGGREGATES tab, Total Revenue, Rs bn"),
    "Aggregates_EBITDA.csv": ("idh_agg_ebitda.csv", "AGGREGATES tab, EBITDA, Rs bn"),
    "Aggregates_PAT.csv": ("idh_agg_pat.csv", "AGGREGATES tab, PAT, Rs bn"),
}
MONTHS = {"Mar", "Jun", "Sep", "Dec"}

args = sys.argv[1:]
if not args:
    raise SystemExit(__doc__)
src = Path(args[0])
date = args[args.index("--date") + 1] if "--date" in args else None

labels, entries = None, []
for name, (raw, what) in FILES.items():
    p = src / name
    if not p.exists():
        raise SystemExit(f"missing {p}")
    body = p.read_bytes()
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
    head = rows[0]
    if head[0] != "Identifier" or not all(h[:3] in MONTHS and h[3] == "-" and h[4:].isdigit() for h in head[1:]):
        raise SystemExit(f"{name}: unexpected header {head}")
    if any(len(r) != len(head) for r in rows):
        raise SystemExit(f"{name}: ragged rows")
    names = [r[0] for r in rows[1:]]
    if labels is None:
        labels = names
    elif names != labels:
        raise SystemExit(f"{name}: row labels differ from the other files")
    when = date or datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).date().isoformat()
    (RAW / raw).write_bytes(body)
    entries.append({"file": raw, "url": f"{PAGE}; manual download as {name}", "fetched_at": when,
                    "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body),
                    "note": f"IndiaDataHub, all BSE-listed companies, {what}, {head[1]} to {head[-1]}"})
    print(f"saved {raw} ({len(body):,} bytes, {len(rows) - 1} rows, {head[1]} to {head[-1]})")

old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
mine = {e["file"] for e in entries}
new = [e for e in old if e["file"] not in mine] + entries
MANIFEST.write_text(json.dumps(new, indent=2))
print(f"manifest: {len(old)} -> {len(new)} entries")
