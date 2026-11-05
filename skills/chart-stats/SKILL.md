---
name: chart-stats
description: Choose and compute the right statistic for a chart, and avoid statistical traps, in this project's data pipeline (pipeline/fetch/build_tidy.py and chart code). Use whenever a number is derived (growth, change, contribution, average, ratio, rank, record) before it goes on a chart or into facts.json.
---

# Chart statistics

Every derived number is computed in `pipeline/fetch/build_tidy.py`, checked there with `check(...)`,
and written to `facts.json` under an explicit key. Charts look numbers up by key and re-check any
claim (record, first, "seven times") in code, throwing `COPY:` when it stops being true. Each trap
below gives: the trap, an Indian example, the right method, and a check the pipeline can run.

## Growth and change

**YoY vs MoM, and base effects.** Year-on-year inflation can fall because last year's month was high,
not because prices fell now. Example: CPI fell to 1.33% in Dec 2025 partly because vegetables were up
26.56% in Dec 2024. Method: say "year-on-year" in the dek; when a fall is mostly base effect, show the
index level or the month-on-month change too. Check: compute both; if |YoY change| is driven by the
year-ago month (index then vs trend), flag it in notes.

**Index ratios, not averaged rates.** Annual inflation is index(avg this year)/index(avg last year) − 1,
not the average of twelve monthly YoY rates; group inflation is never the average of item rates.
Check: `build_tidy.py` recomputes each state's YoY from index ratios and asserts it matches the
published rate within 0.1.

**Contributions and weights.** A group's contribution = weight × change in its index / last year's
general index. Contributions add up to headline inflation; weights alone do not tell you who drove it
(food at 45.86% weight can contribute negative). Check: contributions sum to published headline within
0.15 points (rounding of 1-dp indices); weighted group indices reproduce the general index.

**CAGR vs average growth.** Five years of +50%, −50% averages 0% but loses 25%. Use CAGR
((end/start)^(1/years) − 1) for anything compounding (returns, GDP, prices). Check: assert CAGR
reproduces the end value from the start.

**Percentage vs percentage points.** Inflation going from 5.22% to 1.33% fell 3.89 points, not 75%.
Say "points" for differences of rates. Check: copy test — any "%" change of a rate must be labelled
"points" or "pp".

**Real vs nominal.** Salaries, deposit rates, GDP: deflate by CPI (or the GDP deflator for GDP) before
saying something "grew". A 7% FD with 5% inflation earns 2% real. Check: real series = nominal / (index/100)
with the index base stated in notes.

## Comparisons

**Per capita and per unit.** UP vs Goa in total GST says nothing; per person or per rupee of GSDP does.
Check: normalise in build_tidy and keep the denominator's source in the manifest.

**Cherry-picked start dates.** Starting a Nifty chart at the March 2020 low makes any return look
heroic. Method: start at a natural break (series start, policy change, a round period) and say why in
notes; test that the claim holds for nearby start dates. Check: rerun the headline claim for start dates
± 6 months; if it flips, do not publish it.

**Records and "firsts".** "Highest since 2014" must be checked against the whole series, and the series
start must be in the copy ("since this series began in 2014"). Check: the chart code computes the rank
from the data (`oni_latest_rank_same_season`, the CPI low-month check) and throws `COPY:` otherwise.

**Small samples.** Three IPOs that doubled are not a trend; 1 in 4 states is a state count, not a
share. Show counts with any percentage under ~30 observations.

**Multiple comparisons.** Test 20 sectors and one will "significantly" beat the market by chance.
Do not headline the best of many unless it holds out of sample or is huge; say how many you looked at.

**Correlation is not causation.** Gold prices and personal-care inflation move together because gold is
in the basket (mechanical), not because one causes the other in the economic sense. Name the mechanism
or say "moved together".

## Data quality

**Revisions and provisional data.** MOSPI's latest month is provisional; NOAA revises the last ONI
seasons. Mark them ("2026 values are provisional") and refetch before republishing.

**Survivorship and look-ahead bias.** Mutual fund category averages that drop closed funds overstate
returns; backtests that use today's Nifty 50 list for 2010 use hindsight. Use point-in-time
constituents and include dead funds. Check: the universe for each date is the one known on that date.

**Seasonality.** Vegetable prices rise every monsoon; compare like months (YoY) or seasonally adjust;
never compare June to December raw.

**Gaps and conflicts.** Never impute or pick between conflicting source values. MOSPI's API returns two
values for some 2013 months (dropped: `cpi_conflicted_months`), no Housing index Dec 2018–Sep 2019
(those months are dropped from contributions: `cpi_gap_months`), and no rate for April–May 2020. Show
gaps as gaps and name them in notes.

## Scales and display

**Truncated axes.** Bars start at zero, always. Lines may zoom, but the zero line is drawn when the data
crosses it, and the frame never exaggerates a 0.2-point move into a cliff: if it is small, say so.

**Log vs linear.** Use log scales for long histories of things that compound (Sensex since 1979, GDP
since 1950); label ticks in real values (1,000; 10,000), and say "log scale" in the dek.

**Rounding.** One formatter (`K.num`: round half away from zero, true minus). Round only for display;
compute with full precision; decimals match between dek and chart. Shares that must add to 100 (waffle)
use largest-remainder allocation.

## Before a number goes on a chart

1. Is it computed in build_tidy.py, with a `check` that would catch it going wrong?
2. Is it in facts.json under an explicit key, and does the chart fetch it by that key?
3. Is the claim around it (record, first, ratio) re-checked in the chart code?
4. Is the comparison fair: same units, same base, same season, normalised?
5. Would a different reasonable start date or definition flip it?
