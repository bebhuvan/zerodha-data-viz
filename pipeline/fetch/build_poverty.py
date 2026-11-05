"""India poverty tables and facts from the World Bank PIP (release pinned in fetch_pip.py).

Called from build_tidy.py: build(facts, write, check).

Method
- Headcount ratio: share of people living in households whose consumption per person is below the
  line, at 2021 purchasing power parity (PPP) prices. Lines: $3.00 (international extreme poverty line),
  $4.20 (lower-middle-income line), $8.30 (upper-middle-income line), a person a day.
- Survey years only (fill_gaps=false). PIP's interpolated and nowcast years are used only to check
  that we read the same release as the Poverty, Prosperity, and Planet Report 2026 (its 2024 figures).
- Number of poor = headcount x PIP's reporting population for the survey year.
- `programme` marks the survey programme: NSS rounds (1977-78 to 2011-12) and the Household Consumption
  Expenditure Survey (HCES, 2022-23 on). Charts break the line between programmes: the HCES is a new
  questionnaire, and there is no survey in between (PIP removed the private CPHS estimates for 2015-21).
- A survey year with a fraction (2011.5) spans two calendar years and is labelled "2011-12".
- Gap estimates: PIP's calendar-year lineup for the years strictly between the last NSS round and the
  first HCES survey (2012 to 2022), which PIP interpolates from the surveys on either side with growth in
  the national accounts. Written to india_poverty_est.csv; charts draw them dashed, never as survey data.
- Rupee equivalents: line x PIP's PPP rate (rupees per 2021 PPP dollar, household consumption) x PIP's
  CPI for the latest survey (2021 = 1), i.e. the line at the latest survey's prices.
"""
import csv
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
LINES = {"3": 3.0, "42": 4.2, "83": 8.3}
# Poverty, Prosperity, and Planet Report 2026 (PIP September 2026): India, 2024, millions of poor
# (figure 1.6 and figure 1B.2) and the $3.00 rate in percent (chapter 1, note 5).
REPORT_2024 = {"3": 33, "42": 216, "83": 1143}
REPORT_2024_RATE_3 = 2


def label(sy):
    y = int(sy)
    return f"{y}-{(y + 1) % 100:02d}" if sy - y >= 0.25 else str(y)


def build(facts, write, check):
    data = {}
    for k, pl in LINES.items():
        rows = list(csv.DictReader(open(RAW / f"pip_ind_{k}_surveys.csv")))
        check(all(r["reporting_level"] == "national" and r["welfare_type"] == "consumption" for r in rows),
              f"PIP India ${pl:.2f}: national consumption surveys only")
        data[k] = {float(r["survey_year"]): r for r in rows}
    years = sorted(data["3"])
    check(all(sorted(d) == years for d in data.values()), f"PIP India: same {len(years)} survey years at every line")
    check(len(years) >= 9 and years[-1] >= 2023.5, f"PIP India surveys {years[0]} to {years[-1]}")
    for y in years:
        hc = [float(data[k][y]["headcount"]) for k in LINES]
        check(hc == sorted(hc) and 0 <= hc[0] and hc[-1] <= 1, f"{label(y)}: headcount rises with the line {hc}")
        pop = float(data["3"][y]["reporting_pop"])
        check(6e8 < pop < 1.6e9 and all(float(data[k][y]["reporting_pop"]) == pop for k in LINES),
              f"{label(y)}: one population across lines ({pop / 1e6:.0f}M)")
    programme = lambda r: "HCES" if r["survey_acronym"] == "HCES" else "NSS" if r["survey_acronym"].startswith("NSS") else None
    check(all(programme(r) for r in data["3"].values()), "every survey is an NSS round or the HCES")

    out = []
    for y in years:
        for k, pl in LINES.items():
            r = data[k][y]
            rate = float(r["headcount"]) * 100
            poor = float(r["headcount"]) * float(r["reporting_pop"]) / 1e6
            out.append({"survey_year": y, "label": label(y), "line": pl, "rate": round(rate, 4),
                        "poor_m": round(poor, 2), "programme": programme(r), "survey": r["survey_acronym"],
                        "comparable_spell": r["comparable_spell"]})
            facts[f"india_pov_{k}_{label(y)}"] = round(rate, 4)
            facts[f"india_poor_{k}_{label(y)}_m"] = round(poor, 2)
    write("india_poverty.csv", out)

    # The release matches the report: PIP's own 2024 nowcast reproduces the report's India figures.
    for k, pl in LINES.items():
        line24 = [r for r in csv.DictReader(open(RAW / f"pip_ind_{k}_lineup.csv")) if r["reporting_year"] == "2024"]
        check(len(line24) == 1, f"${pl:.2f}: one 2024 lineup row")
        poor24 = float(line24[0]["headcount"]) * float(line24[0]["reporting_pop"]) / 1e6
        check(round(poor24) == REPORT_2024[k], f"${pl:.2f}: 2024 poor {poor24:.1f}M matches the report's {REPORT_2024[k]}M")
        if k == "3":
            check(round(float(line24[0]["headcount"]) * 100) == REPORT_2024_RATE_3, "$3.00: 2024 rate rounds to the report's 2%")
        facts[f"india_poor_{k}_2024_nowcast_m"] = round(poor24, 2)

    # Gap estimates (lineup years strictly between the programmes).
    y_nss = max(y for y in years if programme(data["3"][y]) == "NSS")
    y_hces = min(y for y in years if programme(data["3"][y]) == "HCES")
    est = []
    for k, pl in LINES.items():
        lineup = [r for r in csv.DictReader(open(RAW / f"pip_ind_{k}_lineup.csv")) if y_nss < int(r["reporting_year"]) < y_hces]
        check(len(lineup) == int(y_hces) - int(y_nss) and all(r["estimation_type"] == "interpolation" for r in lineup),
              f"${pl:.2f}: {len(lineup)} interpolated lineup years in the survey gap")
        for r in lineup:
            est.append({"year": int(r["reporting_year"]), "line": pl, "rate": round(float(r["headcount"]) * 100, 4)})
    check(all(a["rate"] <= b["rate"] for a, b in zip(est, est[len(est) // 3:])), "gap estimates rise with the line")
    write("india_poverty_est.csv", est)
    facts["india_pov_est_first_year"], facts["india_pov_est_last_year"] = est[0]["year"], est[len(est) // 3 - 1]["year"]

    # Rupee equivalents of each line at the latest survey's prices.
    ppp = {float(r["ppp"]) for d in data.values() for r in d.values()}
    check(len(ppp) == 1 and 15 < next(iter(ppp)) < 25, f"one PPP rate for every survey ({ppp} rupees per PPP dollar)")
    ppp = next(iter(ppp))
    cpi_last = float(data["3"][years[-1]]["cpi"])
    check(1 < cpi_last < 1.5, f"latest survey CPI {cpi_last:.3f} (2021 = 1)")
    facts["india_pov_ppp_inr"] = round(ppp, 4)
    facts["india_pov_cpi_last"] = round(cpi_last, 4)
    for k, pl in LINES.items():
        facts[f"poverty_line_{k}_inr_last"] = round(pl * ppp * cpi_last, 2)

    first, last = label(years[0]), label(years[-1])
    nss_last = label(max(y for y in years if programme(data["3"][y]) == "NSS"))
    hces_first = label(min(y for y in years if programme(data["3"][y]) == "HCES"))
    facts.update({"poverty_line_3": 3.0, "poverty_line_42": 4.2, "poverty_line_83": 8.3,
                  "india_pov_first": first, "india_pov_last": last,
                  "india_pov_nss_last": nss_last, "india_pov_hces_first": hces_first})
