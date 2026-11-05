"""Tidy tables and facts for the markets, rates and macro library.

Called by build_tidy.py (which owns facts.json), so one command rebuilds everything:
    python3 -I pipeline/fetch/build_tidy.py

Conventions (see skills/finance-conventions):
- Index levels from Yahoo are PRICE indices: dividends are excluded, so returns are understated by
  roughly the dividend yield (1-1.5% a year for Indian large caps). Every chart that uses them says so.
- A month is keyed by the bar's timestamp plus three days (Yahoo stamps monthly bars at local midnight
  of the 1st, which in UTC can fall on the last day of the previous month; a fixed offset is wrong
  across daylight saving).
- Calendar-year returns use December closes. The current, incomplete year is never mixed with whole years.
- Rolling returns use every month-end start; CAGR = (end/start)^(1/years) - 1.
- Drawdown = close / running peak - 1, on daily closes.
- World Bank: aggregates (regions, income groups) are dropped; only economies are ranked.
"""
import csv
import json
import math
import statistics as st
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"


def yahoo(name, daily=False):
    r = json.loads((RAW / name).read_text())["chart"]["result"][0]
    out = []
    for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]):
        if c is None:
            continue
        dt = datetime.fromtimestamp(t, timezone.utc) + timedelta(days=0 if daily else 3)
        if daily:  # Indian exchange: local midnight is 18:30 UTC the day before
            dt = datetime.fromtimestamp(t + r["meta"]["gmtoffset"], timezone.utc)
        out.append((dt.strftime("%Y-%m-%d" if daily else "%Y-%m"), c))
    return out


def month_ends(daily):
    """Last close in each calendar month, from (YYYY-MM-DD, close) pairs."""
    out = {}
    for d, c in daily:
        out[d[:7]] = c
    return sorted(out.items())


def consecutive(months):
    """Months missing between the first and last of a sorted YYYY-MM list."""
    y, m = map(int, months[0].split("-"))
    want, missing = set(months), []
    while f"{y}-{m:02d}" <= months[-1]:
        if f"{y}-{m:02d}" not in want:
            missing.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return missing


def fred(sid):
    with open(RAW / f"fred_{sid.lower()}.csv") as f:
        rows = list(csv.reader(f))[1:]
    return [(d, float(v)) for d, v in rows if v not in ("", ".")]


def wb(name, economies):
    meta, rows = json.loads((RAW / name).read_text())
    out = {}
    for r in rows:
        c = r["countryiso3code"]
        if c in economies and r["value"] is not None:
            out.setdefault(c, {})[int(r["date"])] = r["value"]
    return out


def build(facts, write, check):
    r2 = lambda v, n=2: round(v, n)

    # ------------------------------------------------------------ Nifty 50, daily: moves and drawdowns
    nd = yahoo("yahoo_nsei_1d.json", daily=True)
    dates = [d for d, _ in nd]
    check(len(set(dates)) == len(dates), "Nifty daily: one close per date")
    check(dates == sorted(dates), "Nifty daily: dates ascending")
    rows, peak, peak_d = [], nd[0][1], nd[0][0]
    for i, (d, c) in enumerate(nd):
        if c > peak:
            peak, peak_d = c, d
        ret = None if i == 0 else (c / nd[i - 1][1] - 1) * 100
        rows.append({"date": d, "close": r2(c), "ret": None if ret is None else round(ret, 4),
                     "drawdown": round((c / peak - 1) * 100, 4), "peak_date": peak_d})
    gaps = [(rows[i - 1]["date"], rows[i]["date"]) for i in range(1, len(rows))
            if (datetime.fromisoformat(rows[i]["date"]) - datetime.fromisoformat(rows[i - 1]["date"])).days > 6]
    check(len(gaps) == 0, f"Nifty daily: no gap longer than six days ({gaps})")
    rets = [r["ret"] for r in rows[1:]]
    check(max(abs(x) for x in rets) < 20, "Nifty daily: no one-day move of 20% or more (bad tick guard)")
    write("nifty_daily.csv", rows)
    last = rows[-1]
    facts["nifty_first_date"], facts["nifty_last_date"] = rows[0]["date"], last["date"]
    facts["nifty_last_close"] = last["close"]
    facts["nifty_days"] = len(rets)
    within1 = sum(abs(x) < 1 for x in rets)
    facts["nifty_share_days_within_1pct"] = r2(within1 / len(rets) * 100, 1)
    facts["nifty_days_within_1pct"] = within1
    worst = min(rows[1:], key=lambda r: r["ret"]); best = max(rows[1:], key=lambda r: r["ret"])
    facts["nifty_worst_day"], facts["nifty_worst_day_ret"] = worst["date"], r2(worst["ret"], 1)
    facts["nifty_best_day"], facts["nifty_best_day_ret"] = best["date"], r2(best["ret"], 1)
    facts["nifty_days_beyond_5pct"] = sum(abs(x) >= 5 for x in rets)
    # Drawdowns: the current one, and the trough of each episode deeper than 20%.
    facts["nifty_drawdown_now"] = r2(last["drawdown"], 1)
    facts["nifty_peak_date"] = last["peak_date"]
    facts["nifty_peak_close"] = r2(max(r["close"] for r in rows))
    episodes, cur = [], None
    for r in rows:
        if r["drawdown"] < 0:
            if cur is None or r["peak_date"] != cur["peak_date"]:
                cur = {"peak_date": r["peak_date"], "trough": r}
                episodes.append(cur)
            elif r["drawdown"] < cur["trough"]["drawdown"]:
                cur["trough"] = r
    deep = [e for e in episodes if e["trough"]["drawdown"] <= -20]
    facts["nifty_drawdowns_over_20"] = [[e["peak_date"], e["trough"]["date"], r2(e["trough"]["drawdown"], 1)] for e in deep]
    for e in deep:
        facts[f"nifty_drawdown_{e['trough']['date'][:4]}"] = r2(e["trough"]["drawdown"], 1)
    # Recovery: first close back at the old peak after the trough (None if not yet).
    for e in deep:
        pk = next(r["close"] for r in rows if r["date"] == e["peak_date"])
        rec = next((r for r in rows if r["date"] > e["trough"]["date"] and r["close"] >= pk), None)
        facts[f"nifty_recovery_{e['trough']['date'][:4]}"] = rec["date"] if rec else None
        if rec:
            d0, d1 = datetime.fromisoformat(e["trough"]["date"]), datetime.fromisoformat(rec["date"])
            facts[f"nifty_recovery_months_{e['trough']['date'][:4]}"] = round((d1 - d0).days / 30.44)
    check(-65 < min(r["drawdown"] for r in rows) < -50, "Nifty: 2008 drawdown between 50% and 65% (sanity)")

    # Daily-move histogram bins (half-point bins, tails pooled at ±5%) for the distribution chart.
    edges = [x / 2 for x in range(-10, 11)]
    hist = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        n = sum(lo <= x < hi for x in rets)
        hist.append({"lo": lo, "hi": hi, "days": n})
    hist.insert(0, {"lo": -999, "hi": -5, "days": sum(x < -5 for x in rets)})
    hist.append({"lo": 5, "hi": 999, "days": sum(x >= 5 for x in rets)})
    check(sum(h["days"] for h in hist) == len(rets), "Nifty histogram: bins hold every day once")
    write("nifty_daily_hist.csv", hist)

    # ------------------------------------------------------------ Monthly closes, several assets
    series = {"nifty50": "yahoo_nsei_1mo.json", "sensex": "yahoo_bsesn_1mo.json", "midcap50": "yahoo_nsemdcp50_1mo.json",
              "bank": "yahoo_nsebank_1mo.json", "gold_usd": "yahoo_gcf_1d.json", "usdinr": "yahoo_inrx_1mo.json",
              "sp500_usd": "yahoo_gspc_1mo.json"}
    M = {}
    for k, f in series.items():
        s = month_ends(yahoo(f, daily=True)) if f.endswith("_1d.json") else yahoo(f)
        months = [m for m, _ in s]
        check(len(set(months)) == len(months), f"{k} monthly: one bar per month")
        check(not consecutive(months), f"{k} monthly: no missing months ({consecutive(months)[:6]})")
        M[k] = dict(s)
    # Rupee prices of gold and the S&P 500 (what an Indian buyer would see): USD price x rupees per dollar.
    for k in ("gold", "sp500"):
        M[f"{k}_inr"] = {m: v * M["usdinr"][m] for m, v in M[f"{k}_usd"].items() if m in M["usdinr"]}
    write("index_monthly.csv", [{"month": m, "series": k, "close": r2(v, 4)} for k, s in M.items() for m, v in sorted(s.items())])
    this_year = int(max(M["nifty50"])[:4])
    facts["markets_last_month"] = max(M["nifty50"])

    # Calendar-year returns, December to December, whole years only.
    ASSETS = [("nifty50", "Nifty 50"), ("midcap50", "Midcap 50"), ("bank", "Bank Nifty"),
              ("gold_inr", "Gold"), ("sp500_inr", "S&P 500"), ("usdinr", "Dollar")]
    yr_rows = []
    for k, name in ASSETS:
        for y in range(2008, this_year):
            a, b = M[k].get(f"{y - 1}-12"), M[k].get(f"{y}-12")
            if a is None or b is None:
                check(False, f"{name}: December closes for {y - 1} and {y}")
            ret = (b / a - 1) * 100
            yr_rows.append({"year": y, "asset": name, "key": k, "ret": round(ret, 2)})
            facts[f"ret_{k}_{y}"] = round(ret, 2)
    for y in range(2008, this_year):
        ranked = sorted([r for r in yr_rows if r["year"] == y], key=lambda r: -r["ret"])
        for i, r in enumerate(ranked):
            r["rank"] = i + 1
        facts[f"ret_top_{y}"] = ranked[0]["asset"]
    write("asset_returns.csv", yr_rows)
    facts["ret_first_year"], facts["ret_last_year"] = 2008, this_year - 1
    tops = [facts[f"ret_top_{y}"] for y in range(2008, this_year)]
    facts["ret_repeat_leaders"] = [[y, tops[i]] for i, y in enumerate(range(2009, this_year), start=1) if tops[i] == tops[i - 1]]
    facts["ret_years_led"] = {name: tops.count(name) for _, name in ASSETS}

    # Sensex rolling returns: every start month, holding 1, 3, 5, 10 and 15 years, annualised.
    sx = sorted(M["sensex"].items())  # the last bar is the month so far: its close is the latest level
    roll = []
    for yrs in (1, 3, 5, 10, 15):
        k = 12 * yrs
        for i in range(k, len(sx)):
            roll.append({"years": yrs, "start": sx[i - k][0], "end": sx[i][0],
                         "cagr": round(((sx[i][1] / sx[i - k][1]) ** (1 / yrs) - 1) * 100, 3)})
    write("sensex_rolling.csv", roll)
    facts["sensex_first_month"], facts["sensex_last_month"] = sx[0][0], sx[-1][0]
    for yrs in (1, 3, 5, 10, 15):
        v = [r["cagr"] for r in roll if r["years"] == yrs]
        facts[f"sensex_roll_{yrs}y_n"] = len(v)
        facts[f"sensex_roll_{yrs}y_min"] = r2(min(v), 1)
        facts[f"sensex_roll_{yrs}y_max"] = r2(max(v), 1)
        facts[f"sensex_roll_{yrs}y_median"] = r2(st.median(v), 1)
        facts[f"sensex_roll_{yrs}y_loss_share"] = r2(sum(x < 0 for x in v) / len(v) * 100, 1)
        latest = [r for r in roll if r["years"] == yrs][-1]
        facts[f"sensex_roll_{yrs}y_latest"] = r2(latest["cagr"], 1)
        facts[f"sensex_roll_{yrs}y_latest_start"] = latest["start"]
    # Independent check: the 10-year minimum recomputed from closes directly.
    m10 = min((sx[i][1] / sx[i - 120][1]) ** 0.1 - 1 for i in range(120, len(sx))) * 100
    check(abs(m10 - facts["sensex_roll_10y_min"]) < 0.05, "Sensex 10-year minimum recomputes from closes")

    # ------------------------------------------------------------ Rupee per dollar since 1973 (FRED, month-end)
    inr = fred("DEXINUS")
    me = {}
    for d, v in inr:
        me[d[:7]] = (d, v)  # last trading day of each month
    inr_rows = [{"month": m, "date": d, "inr": v} for m, (d, v) in sorted(me.items())]
    check(all(0 < r["inr"] < 200 for r in inr_rows), "Rupee: every month-end rate plausible (0-200)")
    write("inr_monthly.csv", inr_rows)
    a, b = inr_rows[0], inr_rows[-1]
    yrs = (datetime.fromisoformat(b["date"]) - datetime.fromisoformat(a["date"])).days / 365.25
    facts["inr_first"], facts["inr_first_date"] = a["inr"], a["date"]
    facts["inr_last"], facts["inr_last_date"] = b["inr"], b["date"]
    facts["inr_years"] = r2(yrs, 1)
    facts["inr_cagr"] = r2(((b["inr"] / a["inr"]) ** (1 / yrs) - 1) * 100, 1)
    facts["inr_multiple"] = r2(b["inr"] / a["inr"], 1)
    for m in ("1991-06", "1991-07", "2013-05", "2013-08", "2022-01", "2022-10"):
        facts[f"inr_{m}"] = me[m][1]
    # Each decade's annualised fall, to check "about the same pace" style claims.
    for y0 in (1975, 1985, 1995, 2005, 2015):
        s0, s1 = me[f"{y0}-12"][1], me[f"{y0 + 10}-12"][1]
        facts[f"inr_cagr_{y0}_{y0 + 10}"] = r2(((s1 / s0) ** 0.1 - 1) * 100, 1)

    # ------------------------------------------------------------ US Treasury yield curve on chosen dates
    MATS = [("DGS1MO", 1 / 12, "1 mo"), ("DGS3MO", 0.25, "3 mo"), ("DGS6MO", 0.5, "6 mo"), ("DGS1", 1, "1 yr"),
            ("DGS2", 2, "2 yr"), ("DGS3", 3, "3 yr"), ("DGS5", 5, "5 yr"), ("DGS7", 7, "7 yr"), ("DGS10", 10, "10 yr"),
            ("DGS20", 20, "20 yr"), ("DGS30", 30, "30 yr")]
    Y = {sid: dict(fred(sid)) for sid, _, _ in MATS}
    common = sorted(set.intersection(*[set(v) for v in Y.values()]))
    latest = common[-1]
    def on_or_before(d):
        return max(x for x in common if x <= d)
    picks = {"now": latest, "year_ago": on_or_before(f"{int(latest[:4]) - 1}{latest[4:]}"),
             "three_years_ago": on_or_before(f"{int(latest[:4]) - 3}{latest[4:]}")}
    curve = [{"when": w, "date": d, "maturity": sid, "years": round(yrs_, 4), "label": lab, "yield": Y[sid][d]}
             for w, d in picks.items() for sid, yrs_, lab in MATS]
    write("ust_curve.csv", curve)
    for w, d in picks.items():
        facts[f"ust_{w}_date"] = d
        for sid, _, _ in MATS:
            facts[f"ust_{w}_{sid}"] = Y[sid][d]
        facts[f"ust_{w}_10y_minus_3m"] = r2(Y["DGS10"][d] - Y["DGS3MO"][d])
    inv = [d for d in common if Y["DGS10"][d] < Y["DGS3MO"][d]]
    facts["ust_last_inverted"] = inv[-1] if inv else None
    # The longest unbroken inversion (10-year below 3-month), in trading days.
    best, run, start = (0, None, None), 0, None
    for d in common:
        if Y["DGS10"][d] < Y["DGS3MO"][d]:
            run, start = run + 1, start or d
            if run > best[0]:
                best = (run, start, d)
        else:
            run, start = 0, None
    facts["ust_longest_inversion_days"], facts["ust_longest_inversion_from"], facts["ust_longest_inversion_to"] = best

    # India 10-year government bond yield, monthly (OECD via FRED).
    in10 = fred("INDIRLTLT01STM")
    write("india_10y.csv", [{"month": d[:7], "yield": v} for d, v in in10])
    for d, v in in10:
        facts[f"india_10y_{d[:7]}"] = v
    facts["india_10y_last"], facts["india_10y_last_month"] = in10[-1][1], in10[-1][0][:7]
    facts["india_10y_first_month"] = in10[0][0][:7]
    facts["india_10y_min"] = min(v for _, v in in10)
    facts["india_10y_max"] = max(v for _, v in in10)
    # Highest since: the last month before the latest with a yield at or above it.
    prior = [d for d, v in in10[:-1] if v >= in10[-1][1]]
    facts["india_10y_highest_since"] = prior[-1][:7] if prior else None
    # A year ago, and a short history for the sparkline.
    ya = dict(in10).get(f"{int(in10[-1][0][:4]) - 1}{in10[-1][0][4:]}")
    facts["india_10y_year_ago"] = ya
    facts["india_10y_change_bps"] = round((in10[-1][1] - ya) * 100) if ya is not None else None
    facts["india_10y_change_pp"] = round(in10[-1][1] - ya, 4) if ya is not None else None

    # ------------------------------------------------------------ World Bank: economies only
    cty = json.loads((RAW / "wb_countries.json").read_text())[1]
    econ = {c["id"]: c["name"] for c in cty if c["region"]["value"] != "Aggregates"}
    SHORT = {"United States": "US", "United Kingdom": "UK", "Russian Federation": "Russia", "Korea, Rep.": "South Korea",
             "Turkiye": "Turkey", "Iran, Islamic Rep.": "Iran", "Egypt, Arab Rep.": "Egypt", "Saudi Arabia": "Saudi Arabia"}
    nm = lambda c: SHORT.get(econ[c], econ[c])
    gdp = wb("wb_all_ny_gdp_mktp_cd.json", econ)
    last_y = max(y for v in gdp.values() for y in v)
    # A year counts only when most large economies have reported it.
    while sum(1 for v in gdp.values() if last_y in v and v[last_y] > 5e11) < 15:
        last_y -= 1
    facts["wb_gdp_last_year"] = last_y
    years = list(range(2004, last_y + 1))
    rank = {}
    for y in years:
        ordered = sorted([(v[y], c) for c, v in gdp.items() if y in v], reverse=True)
        for i, (_, c) in enumerate(ordered):
            rank.setdefault(c, {})[y] = i + 1
    TOP = 12
    ever = sorted({c for c in rank if any(rank[c].get(y, 99) <= 10 for y in years)})
    rows = [{"year": y, "iso3": c, "name": nm(c), "rank": rank[c].get(y), "gdp_usd_tn": round(gdp[c][y] / 1e12, 3)}
            for c in ever for y in years if y in gdp[c]]
    write("gdp_rank.csv", rows)
    for y in years:
        facts[f"gdp_rank_IND_{y}"] = rank["IND"][y]
        facts[f"gdp_usd_tn_IND_{y}"] = round(gdp["IND"][y] / 1e12, 2)
    facts["gdp_rank_IND_best"] = min(rank["IND"][y] for y in years)
    facts["gdp_rank_IND_best_years"] = [y for y in years if rank["IND"][y] == facts["gdp_rank_IND_best"]]
    check(facts["gdp_rank_IND_2004"] > facts[f"gdp_rank_IND_{last_y}"], "India ranks higher at the end than in 2004")

    # India's real GDP growth since 1961.
    ig = wb("wb_ind_ny_gdp_mktp_kd_zg.json", econ)["IND"]
    write("india_growth.csv", [{"year": y, "growth": round(v, 3)} for y, v in sorted(ig.items())])
    facts["india_growth_first_year"], facts["india_growth_last_year"] = min(ig), max(ig)
    facts["india_growth_negative_years"] = sorted(y for y, v in ig.items() if v < 0)
    for y, v in ig.items():
        facts[f"india_growth_{y}"] = r2(v, 1)
    facts["india_growth_avg_since_1991"] = r2(st.mean(v for y, v in ig.items() if y >= 1991), 1)
    facts["india_growth_avg_before_1991"] = r2(st.mean(v for y, v in ig.items() if y < 1991), 1)
    infl = wb("wb_ind_fp_cpi_totl_zg.json", econ)["IND"]
    for y, v in infl.items():
        facts[f"india_inflation_{y}"] = r2(v, 1)

    # The largest economies: growth, inflation and income per person in the latest full year.
    gr = wb("wb_all_ny_gdp_mktp_kd_zg.json", econ)
    inf = wb("wb_all_fp_cpi_totl_zg.json", econ)
    pc = wb("wb_all_ny_gdp_pcap_cd.json", econ)
    yb = last_y
    while sum(1 for c in gr if yb in gr[c]) < 150:
        yb -= 1
    facts["wb_big_year"] = yb
    big = sorted([c for c in gdp if yb in gdp[c]], key=lambda c: -gdp[c][yb])[:20]
    rows = [{"iso3": c, "name": nm(c), "gdp_usd_tn": round(gdp[c][yb] / 1e12, 3), "growth": gr.get(c, {}).get(yb),
             "inflation": inf.get(c, {}).get(yb), "gdp_pc": pc.get(c, {}).get(yb)} for c in big]
    check(all(r["growth"] is not None and r["gdp_pc"] is not None for r in rows), f"Top 20 economies all report growth and income per person for {yb}")
    write("big_economies.csv", rows)
    for r in rows:
        facts[f"big_growth_{r['iso3']}"] = r2(r["growth"], 1)
        facts[f"big_gdp_pc_{r['iso3']}"] = round(r["gdp_pc"])
        if r["inflation"] is not None:
            facts[f"big_inflation_{r['iso3']}"] = r2(r["inflation"], 1)
    by_growth = sorted(rows, key=lambda r: -r["growth"])
    facts["big_fastest"], facts["big_fastest_growth"] = by_growth[0]["name"], r2(by_growth[0]["growth"], 1)
    facts["big_second"], facts["big_second_growth"] = by_growth[1]["name"], r2(by_growth[1]["growth"], 1)
    facts["big_growth_rank_IND"] = [r["iso3"] for r in by_growth].index("IND") + 1
    facts["big_gdp_pc_rank_IND"] = sorted(rows, key=lambda r: -r["gdp_pc"]).index(next(r for r in rows if r["iso3"] == "IND")) + 1
    facts["big_median_growth"] = r2(st.median(r["growth"] for r in rows), 1)
    facts["big_n"] = len(rows)
