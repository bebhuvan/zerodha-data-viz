"""Fetch market, rates and macro data with provenance (finance and economics library).

Run: python3 -I pipeline/fetch/fetch_markets.py
Writes untouched responses to pipeline/data/raw/ and merges their entries into
pipeline/data/raw/manifest.json (one entry per file; a refetch replaces the old entry).

Sources (all public, no key):
  Yahoo Finance chart API   index and price history (price indices: dividends are NOT included)
  FRED (St Louis Fed)       US Treasury yields, rupee-dollar rate, India 10-year yield
  World Bank API            GDP, growth, inflation by country
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


def get(url, retries=4, ua="Mozilla/5.0 (zerodha-dataviz)"):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua} if ua else {})
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


# 1. Yahoo Finance: monthly history for indices and prices; daily for Nifty 50 (drawdowns, daily moves).
# range=max silently coarsens long histories (daily to monthly, monthly to quarterly); explicit bounds do not.
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?{span}&interval={iv}"
SPAN = {iv: f"period1=0&period2={int(time.time())}" for iv in ("1mo", "1d")}
for sym, iv, note in [
    ("^NSEI", "1mo", "Nifty 50, monthly, price index (no dividends)"),
    ("^NSEI", "1d", "Nifty 50, daily, price index (no dividends)"),
    ("^BSESN", "1mo", "S&P BSE Sensex, monthly, price index (no dividends)"),
    ("^NSEMDCP50", "1mo", "Nifty Midcap 50, monthly, price index (no dividends)"),
    ("^NSEBANK", "1mo", "Nifty Bank, monthly, price index (no dividends)"),
    # Yahoo's monthly gold-futures bars skip about two months a year; daily bars are complete.
    ("GC=F", "1d", "COMEX gold futures, front month, USD per troy ounce, daily"),
    ("INR=X", "1mo", "USD/INR, rupees per dollar, monthly"),
    ("^GSPC", "1mo", "S&P 500, monthly, price index (no dividends), USD"),
]:
    u = YAHOO.format(sym=urllib.request.quote(sym), iv=iv, span=SPAN[iv])
    name = f"yahoo_{sym.strip('^').replace('=', '').lower()}_{iv}.json"
    body = get(u)
    res = json.loads(body)["chart"]["result"][0]  # fail loudly on an error payload
    if res["meta"]["dataGranularity"] != iv:
        raise SystemExit(f"{sym}: asked for {iv}, got {res['meta']['dataGranularity']}")
    save(name, body, u, note)

# 2. FRED: US Treasury constant-maturity yields (daily), rupee per dollar (daily), India 10-year (monthly, OECD).
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}"
for sid, note in [
    *[(m, f"US Treasury constant-maturity yield, {m[3:]}, % a year, daily (Board of Governors, H.15)")
      for m in ["DGS1MO", "DGS3MO", "DGS6MO", "DGS1", "DGS2", "DGS3", "DGS5", "DGS7", "DGS10", "DGS20", "DGS30"]],
    ("DEXINUS", "Indian rupees per US dollar, noon buying rates in New York, daily (Board of Governors, H.10)"),
    ("INDIRLTLT01STM", "India long-term (10-year) government bond yield, % a year, monthly (OECD MEI)"),
]:
    u = FRED.format(sid=sid)
    body = get(u, ua=None)  # FRED stalls unfamiliar user agents; Python's default goes through
    if not body.startswith(b"observation_date") and not body.startswith(b"DATE"):
        raise SystemExit(f"FRED returned something other than CSV for {sid}")
    save(f"fred_{sid.lower()}.csv", body, u, note)

# 3. World Bank: GDP in current US$ (every country), India's real GDP growth and CPI inflation,
#    G20 growth and inflation for the latest years.
WB = "https://api.worldbank.org/v2/country/{c}/indicator/{i}?format=json&per_page=20000&date={d}"
for c, i, d, note in [
    ("all", "NY.GDP.MKTP.CD", "2000:2025", "GDP, current US$, every economy and aggregate, World Bank WDI"),
    ("IND", "NY.GDP.MKTP.KD.ZG", "1961:2025", "India real GDP growth, annual %, World Bank WDI"),
    ("IND", "FP.CPI.TOTL.ZG", "1961:2025", "India consumer price inflation, annual %, World Bank WDI"),
    ("all", "NY.GDP.MKTP.KD.ZG", "2015:2025", "Real GDP growth, annual %, every economy, World Bank WDI"),
    ("all", "FP.CPI.TOTL.ZG", "2015:2025", "Consumer price inflation, annual %, every economy, World Bank WDI"),
    ("all", "NY.GDP.PCAP.CD", "2015:2025", "GDP per person, current US$, every economy, World Bank WDI"),
]:
    u = WB.format(c=c, i=i, d=d)
    body = get(u, ua="zerodha-dataviz/0.1")
    meta, rows = json.loads(body)
    if meta.get("pages", 1) != 1 or not rows:
        raise SystemExit(f"World Bank {i} {c}: {meta}")
    save(f"wb_{c.lower()}_{i.lower().replace('.', '_')}.json", body, u, note)
# Country metadata: which codes are real economies (aggregates have region "Aggregates").
u = "https://api.worldbank.org/v2/country?format=json&per_page=400"
save("wb_countries.json", get(u, ua="zerodha-dataviz/0.1"), u, "World Bank country list with region and income group (aggregates flagged)")

# Merge into the shared manifest: one entry per file.
old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
mine = {e["file"] for e in entries}
MANIFEST.write_text(json.dumps([e for e in old if e["file"] not in mine] + entries, indent=2))
print(f"manifest: {len(old)} -> {len([e for e in old if e['file'] not in mine]) + len(entries)} entries")
