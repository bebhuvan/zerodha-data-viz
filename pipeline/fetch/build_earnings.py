"""Quarterly results of BSE-listed companies (IndiaDataHub), tidy table and facts.

Called from build_tidy.py: build(facts, write, check). Raw files from import_idh.py.

Method
- Growth is IndiaDataHub's year-on-year growth for each quarter (GROWTH tab). It compares the same
  companies in both years: growth worked out from the aggregate levels runs higher in complete quarters,
  because the levels also count companies listed during the year. Charts quote IndiaDataHub's growth,
  never growth from the levels.
- Levels (AGGREGATES tab, Rs bn) are used only to check the hierarchy (industries sum to their sector,
  sectors to the total), to find where profit is negative, and to spot an incomplete latest quarter.
- The latest quarter is provisional while results are still being filed: its total revenue level falls
  well short of the quarter before. It is marked `provisional` in the table and in facts.
- Hierarchy: IndiaDataHub's 12 top-level sectors (NSE macro-economic sectors) each followed by their
  industries; Diversified has none. "Utilities" is both a sector and one of its industries.
- Quarter keys are the quarter-end month, YYYY-MM (Sep-2026 -> 2026-09, July to September 2026).
"""
import csv
import re
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
SECTORS = ["Commodities", "Consumer Discretionary", "Diversified", "Energy", "Financial Services", "FMCG",
           "Healthcare", "Industrials", "Information Technology", "Services", "Telecommunication", "Utilities"]
MEASURES = {"revenue": "revenue", "ebitda": "ebitda", "pat": "pat"}  # key -> raw file suffix
MON = {"Mar": 3, "Jun": 6, "Sep": 9, "Dec": 12}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def num(x):
    x = x.strip().replace(",", "")
    return float(x) if x else None


def read(kind, m):
    rows = list(csv.reader(open(RAW / f"idh_{kind}_{m}.csv", encoding="utf-8-sig")))
    qs = [f"{h[4:]}-{MON[h[:3]]:02d}" for h in rows[0][1:]]
    return qs, [(r[0].strip(), [num(x) for x in r[1:]]) for r in rows[1:] if r and r[0].strip()]


def tree(rows, check):
    """(name, parent, level) per row, in file order."""
    check([r[0] for r in rows[:2]] == ["Total", "Total excl Fin Services"], "IDH: first rows are Total and Total excl Fin Services")
    out, cur = [("Total", "", "total"), ("Total excl Fin Services", "Total", "total")], None
    for name, _ in rows[2:]:
        if name in SECTORS and name != cur:
            cur = name
            out.append((name, "Total", "sector"))
        else:
            if cur is None:
                check(False, f"IDH: industry {name} comes before any sector")
            out.append((name, cur, "industry"))
    check([n for n, _, l in out if l == "sector"] == SECTORS, "IDH: the 12 sectors, each once, in order")
    return out


def build(facts, write, check):
    data, agg = {}, {}
    for m in MEASURES:
        qs, data[m] = read("growth", m)
        qa, agg[m] = read("agg", m)
        check(qa == qs, f"IDH {m}: growth and level files cover the same quarters")
        check([n for n, _ in data[m]] == [n for n, _ in agg[m]], f"IDH {m}: growth and level files have the same rows")
    names = [n for n, _ in data["revenue"]]
    check(all([n for n, _ in data[m]] == names for m in MEASURES), "IDH: same rows for revenue, EBITDA and PAT")
    check(all(qs[i + 1] > qs[i] for i in range(len(qs) - 1)) and len(qs) >= 12, f"IDH: {len(qs)} consecutive quarters, {qs[0]} to {qs[-1]}")
    t = tree(data["revenue"], check)

    # Levels: industries sum to their sector, sectors to the total, total less financials to the ex-fin row.
    for m in MEASURES:
        L = [v for _, v in agg[m]]
        for i, q in enumerate(qs):
            tot = L[0][i]
            sec = [L[j][i] for j, (_, _, lv) in enumerate(t) if lv == "sector"]
            bad = []
            if abs(sum(sec) - tot) > 0.5:
                bad.append(f"sectors {sum(sec):.1f} vs total {tot:.1f}")
            fin = L[[n for n, _, _ in t].index("Financial Services")][i]
            if abs(tot - fin - L[1][i]) > 0.5:
                bad.append("total less financials")
            for j, (name, _, lv) in enumerate(t):
                kids = [L[k][i] for k, (_, p, lk) in enumerate(t) if lk == "industry" and p == name and L[k][i] is not None]
                if lv == "sector" and kids and abs(sum(kids) - L[j][i]) > 0.5:
                    bad.append(f"{name}: industries {sum(kids):.1f} vs {L[j][i]:.1f}")
            check(not bad, f"IDH {m} {q}: levels add up {bad or ''}") if bad else None
        check(True, f"IDH {m}: industries sum to sectors and sectors to the total in all {len(qs)} quarters")

    # The latest quarter is incomplete while companies are still reporting: flag it from the data.
    rev = agg["revenue"][0][1]
    prov = rev[-1] < 0.9 * rev[-2]
    check(all(rev[i] >= 0.9 * rev[i - 1] for i in range(1, len(qs) - 1)), "IDH: every quarter before the latest is complete (revenue level within 10% of the quarter before)")
    latest, last_full = qs[-1], qs[-2] if prov else qs[-1]
    facts["earn_latest_quarter"] = latest
    facts["earn_provisional"] = prov
    facts["earn_downloaded"] = "2026-11-05"
    print(f"  note: latest quarter {latest} {'provisional (results still being filed)' if prov else 'complete'}")

    # Same-company growth is checked against growth from the levels in complete quarters: same direction
    # of error (levels include new listings), never far apart for the total.
    for m in MEASURES:
        g, L = data[m][0][1], agg[m][0][1]
        diffs = [(L[i] / L[i - 4] - 1) * 100 - g[i] for i in range(4, len(qs) - (1 if prov else 0))]
        if m == "revenue":
            check(sum(d > 0 for d in diffs) >= len(diffs) - 1 and max(abs(d) for d in diffs) < 8,
                  f"IDH revenue: growth from levels runs above same-company growth (new listings), within 8 points ({min(diffs):.1f} to {max(diffs):.1f})")

    out = []
    for m in MEASURES:
        for j, (name, parent, lv) in enumerate(t):
            g, L = data[m][j][1], agg[m][j][1]
            for i, q in enumerate(qs):
                out.append({"measure": m, "name": name, "key": slug(name) if not (lv == "industry" and name in SECTORS) else slug(name) + "_industry",
                            "parent": parent, "level": lv, "quarter": q, "growth": g[i], "level_bn": L[i],
                            "provisional": int(prov and q == latest)})
                if lv in ("total", "sector") and g[i] is not None:
                    facts[f"earn_{m}_{slug(name)}_{q}"] = g[i]
    check(len({(r["measure"], r["key"], r["quarter"]) for r in out}) == len(out), "IDH: one row per measure, group and quarter")
    write("earnings_growth.csv", out)

    # Facts the headline chart quotes.
    g = {m: dict(zip(qs, data[m][0][1])) for m in MEASURES}
    before = [q for q in qs if q != latest]
    facts["earn_revenue_total_prior_max"] = max(g["revenue"][q] for q in before)
    facts["earn_revenue_total_prior_max_quarter"] = max(before, key=lambda q: g["revenue"][q])
    facts["earn_first_quarter"] = qs[0]
    sec_rows = [data["revenue"][j][1] for j, (_, _, lv) in enumerate(t) if lv == "sector"]
    for i, q in enumerate(qs):
        facts[f"earn_revenue_sectors_over10_{q}"] = sum(r[i] > 10 for r in sec_rows)
    facts["earn_sector_count"] = len(SECTORS)
    check(g["revenue"][latest] is not None and g["pat"][latest] is not None, f"IDH: total revenue and PAT growth for {latest}")
