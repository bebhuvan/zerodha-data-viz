"""Nifty 50 around US mid-term elections (1990 to 2026).

Called from build_tidy.py: build(facts, write, check).

Conventions:
- US mid-term elections fall on the first Tuesday after the first Monday in November every four years
  between presidential elections (1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026).
- Base date (T0) is the last NSE trading day on or before US Election Tuesday (Indian market closes at
  15:30 IST Tuesday, before US polls close Tuesday night EST / Wednesday morning IST).
- Pre-election windows (-1M, -1W) measure the price return ending on T0 from the last trading day on or
  before (T0 - 1 calendar month = T0 - 31 days in October) and (T0 - 7 calendar days).
- Post-election windows (+1D, +1W, +1M, +3M, +6M, +1Y) measure the price return starting from T0 to the
  next trading day (+1D) or the first trading day on or after (T0 + 7 days / 1 / 3 / 6 / 12 months).
- Trajectory table (`us_midterms_path.csv`) records cumulative % change relative to T0 (T0 = 0%) for each
  calendar day offset k in [-31, +92] (one calendar month before to three calendar months after T0), so the
  path endpoints at -1M (k = -31), -1W (k = -7), +1D (k = +1), +1W (k = +7), +1M (k = +30), +3M (k = +92)
  match the summary window table (`us_midterms_nifty.csv`) and `us_midterms_windows.csv` to the decimal.
"""
import csv
import statistics as st
from datetime import date, timedelta
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"

MIDTERMS = [
    (1990, "1990-11-06"),
    (1994, "1994-11-08"),
    (1998, "1998-11-03"),
    (2002, "2002-11-05"),
    (2006, "2006-11-07"),
    (2010, "2010-11-02"),
    (2014, "2014-11-04"),
    (2018, "2018-11-06"),
    (2022, "2022-11-08"),
    (2026, "2026-11-03"),
]


def add_months(d: date, months: int) -> date:
    total_m = d.year * 12 + (d.month - 1) + months
    y, m = divmod(total_m, 12)
    m += 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue
    raise ValueError(f"invalid date {d} + {months}m")


def build(facts, write, check):
    r1 = lambda v: round(v, 1)
    r2 = lambda v: round(v, 2)

    raw_rows = list(csv.DictReader(open(RAW / "niftyindices_nifty50_daily.csv")))
    dates = [r["date"] for r in raw_rows]
    closes = [float(r["close"]) for r in raw_rows]
    check(len(dates) > 8500 and dates == sorted(dates) and len(set(dates)) == len(dates),
          f"Nifty 50 full daily history: {len(dates)} unique ascending trading days ({dates[0]} to {dates[-1]})")
    check(dates[0] <= "1990-07-05" and dates[-1] >= "2026-11-04",
          f"Nifty 50 covers all 10 US mid-terms from 1990 to 2026 ({dates[0]} to {dates[-1]})")

    def on_or_before(target_iso: str) -> int:
        idx = [i for i, d in enumerate(dates) if d <= target_iso]
        check(len(idx) > 0, f"trading day on or before {target_iso}")
        return idx[-1]

    def on_or_after(target_iso: str):
        idx = [i for i, d in enumerate(dates) if d >= target_iso]
        return idx[0] if idx else None

    HORIZONS = [
        ("m1m", "1M before", -1, "months"),
        ("m1w", "1W before", -7, "days"),
        ("p1d", "1D after", 1, "td"),
        ("p1w", "1W after", 7, "days"),
        ("p1m", "1M after", 1, "months"),
        ("p3m", "3M after", 3, "months"),
        ("p6m", "6M after", 6, "months"),
        ("p1y", "1Y after", 12, "months"),
    ]

    summary_rows = []
    path_rows = []

    for yr, ed_str in MIDTERMS:
        ed = date.fromisoformat(ed_str)
        first_mon = date(yr, 11, 1)
        while first_mon.weekday() != 0:
            first_mon += timedelta(days=1)
        check(ed == first_mon + timedelta(days=1), f"{yr}: {ed_str} is first Tuesday after first Monday in November")

        i0 = on_or_before(ed_str)
        d0_str = dates[i0]
        d0 = date.fromisoformat(d0_str)
        c0 = closes[i0]
        check((ed - d0).days <= 3, f"{yr}: base date {d0_str} within 3 days of election {ed_str}")

        row = {"year": yr, "election_date": ed_str, "base_date": d0_str, "base_close": r2(c0)}
        facts[f"midterm_base_date_{yr}"] = d0_str
        facts[f"midterm_base_close_{yr}"] = r2(c0)

        for key, label, step, unit in HORIZONS:
            if unit == "td":
                i_target = i0 + step if i0 + step < len(closes) else None
                ret = ((closes[i_target] / c0 - 1) * 100) if i_target is not None else None
            elif step < 0:
                target_dt = add_months(d0, step) if unit == "months" else (d0 + timedelta(days=step))
                i_prior = on_or_before(target_dt.isoformat())
                ret = (c0 / closes[i_prior] - 1) * 100
            else:
                target_dt = add_months(d0, step) if unit == "months" else (d0 + timedelta(days=step))
                i_after = on_or_after(target_dt.isoformat())
                ret = ((closes[i_after] / c0 - 1) * 100) if i_after is not None else None

            row[key] = None if ret is None else round(ret, 4)
            if ret is not None:
                facts[f"midterm_{key}_{yr}"] = r1(ret)
                facts[f"midterm_{key}_{yr}_2dp"] = r2(ret)

        summary_rows.append(row)

        # Calendar-day path around T0: k from -31 to +92 calendar days (1M before to 3M after)
        # For k <= 0: last close on or before (d0 + k days); for k == 1: first trading session after T0 (+1D reaction);
        # for k >= 2: first close on or after (d0 + k days), up to the latest available trading day.
        last_dt = date.fromisoformat(dates[-1])
        for k in range(-31, 93):
            target_dt = d0 + timedelta(days=k)
            if target_dt > last_dt:
                continue
            if k <= 0:
                ik = on_or_before(target_dt.isoformat())
            elif k == 1:
                ik = i0 + 1 if i0 + 1 < len(closes) else None
            else:
                ik = on_or_after(target_dt.isoformat())
            if ik is not None:
                chg = (closes[ik] / c0 - 1) * 100
                path_rows.append({"year": yr, "td": k, "date": dates[ik], "pct": round(chg, 4)})
                if k in (-31, -7, 0, 1, 7, 30, 61, 92):
                    facts[f"midterm_td_{k}_{yr}"] = r1(chg)

    # Verify that the path endpoints at k=+92 (+3M) and k=+30 (+1M) and k=+7 (+1W) and k=+1 (+1D) match summary_rows!
    for r in summary_rows:
        yr = r["year"]
        if yr < 2026:
            p92 = next(p["pct"] for p in path_rows if p["year"] == yr and p["td"] == 92)
            check(abs(p92 - r["p3m"]) < 1e-4, f"{yr}: path +92d ({p92}) == summary p3m ({r['p3m']})")
            p30 = next(p["pct"] for p in path_rows if p["year"] == yr and p["td"] == 30)
            check(abs(p30 - r["p1m"]) < 1e-4, f"{yr}: path +30d ({p30}) == summary p1m ({r['p1m']})")

    write("us_midterms_nifty.csv", summary_rows)
    write("us_midterms_path.csv", path_rows)

    win_rows = []
    for key, label, step, unit in HORIZONS:
        vals_all = [r[key] for r in summary_rows if r[key] is not None]
        vals_hist = [r[key] for r in summary_rows if r["year"] < 2026 and r[key] is not None]
        for suffix, vals in [("all", vals_all), ("hist", vals_hist)]:
            lo, med, hi, avg = min(vals), st.median(vals), max(vals), st.mean(vals)
            pos = sum(v > 0 for v in vals)
            facts[f"midterm_{key}_{suffix}_n"] = len(vals)
            facts[f"midterm_{key}_{suffix}_min"] = r1(lo)
            facts[f"midterm_{key}_{suffix}_median"] = r1(med)
            facts[f"midterm_{key}_{suffix}_max"] = r1(hi)
            facts[f"midterm_{key}_{suffix}_mean"] = r1(avg)
            facts[f"midterm_{key}_{suffix}_pos"] = pos
        win_rows.append({
            "key": key,
            "label": label,
            "n_all": len(vals_all),
            "min_all": round(min(vals_all), 3),
            "median_all": round(st.median(vals_all), 3),
            "max_all": round(max(vals_all), 3),
            "pos_all": sum(v > 0 for v in vals_all),
            "n_hist": len(vals_hist),
            "min_hist": round(min(vals_hist), 3),
            "median_hist": round(st.median(vals_hist), 3),
            "max_hist": round(max(vals_hist), 3),
            "pos_hist": sum(v > 0 for v in vals_hist),
        })
    write("us_midterms_windows.csv", win_rows)

    for k in (-31, -7, 0, 1, 7, 30, 61, 92):
        vk = [p["pct"] for p in path_rows if p["year"] < 2026 and p["td"] == k]
        check(len(vk) == 9, f"td={k} has all 9 past mid-terms")
        facts[f"midterm_td_{k}_median"] = r1(st.median(vk))
        facts[f"midterm_td_{k}_min"] = r1(min(vk))
        facts[f"midterm_td_{k}_max"] = r1(max(vk))

    check(facts["midterm_td_92_min"] == facts["midterm_p3m_hist_min"], "3M min matches between path and windows (-18.6%)")
    check(facts["midterm_td_92_median"] == facts["midterm_p3m_hist_median"], "3M median matches between path and windows (+5.1%)")
    check(facts["midterm_td_92_max"] == facts["midterm_p3m_hist_max"], "3M max matches between path and windows (+16.0%)")
    check(facts["midterm_m1w_all_pos"] == 9 and facts["midterm_m1w_all_n"] == 10,
          "Nifty 50 rose in the week before 9 of the 10 US mid-terms since 1990")
    check(facts["midterm_m1w_1998"] < 0, "1998 is the only negative 1-week run-up (-2.5%)")
