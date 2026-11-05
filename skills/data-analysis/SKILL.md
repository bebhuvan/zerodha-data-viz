---
name: data-analysis
description: Find the story in a dataset before charting it, for Zerodha / Markets by Zerodha / Rainmatter economics, macro and markets charts. Use when new data arrives, when asked "what can we say about X", when a chart has no clear point yet, and before writing build code for a new dataset (pipeline/fetch/). Covers profiling the data, generating and ranking candidate findings, robustness checks, and turning the winner into facts and checks.
---

# Data analysis: from a dataset to one defensible claim

A chart starts as a sentence that is true, interesting and robust. This skill gets you that sentence.
The statistics themselves (CAGR, contributions, base effects) are in `chart-stats`; the market and
economic conventions in `finance-conventions`. Exploration scripts go in your scratchpad, never in the
project. Only what survives goes into `pipeline/fetch/build_*.py`.

## 1. Profile before you compute

For every raw file, write down (in the exploration script's output, not from memory):

- Coverage: first and last date, frequency, and whether the last period is complete (a monthly bar
  for the current month is the month so far).
- Gaps: missing periods (list them), duplicate keys, conflicting values for the same key.
- Units: level, % change, index (which base), currency, per-person or total, nominal or real.
- Definitions: price index or total return; calendar or financial year (India's FY runs April to March);
  provisional or final; seasonally adjusted or not.
- Sanity: the largest one-period moves, compared with events you know (13% Nifty fall on 23 March 2020
  is real; a 40% one-day jump in a large-cap index is a bad tick).

Real failures this project hit: Yahoo's `range=max` silently returns quarterly bars for long monthly
histories and monthly bars for daily requests; its monthly gold-futures series skips about two months
a year; FRED stalls custom user agents; MOSPI's API pages unstably. Each now has a check in the fetcher
or the build. Assume every source has one you have not found yet, and write the check that would find it.

## 2. Generate candidate findings, many of them

Compute cheaply and broadly first. Typical families:

| Family | Questions to compute | Example that became a chart |
|---|---|---|
| Level | Where is it now vs its history? Highest/lowest since when? | India 10-year yield highest since April 2024 |
| Change | Biggest change over 1, 5, 10 years; fastest decade | Rupee fell fastest 1985–1995 |
| Rank | Who leads, who moved most, who repeated | Gold led the asset table two years running, a first |
| Distribution | Where most observations sit; how fat the tails are | 7 in 10 Nifty days move under 1% |
| Range of outcomes | Worst/median/best by horizon or group | No 10-year Sensex stretch lost money |
| Comparison | Against peers, a target, an average | India fastest of the 20 largest economies |
| Episodes | Drawdowns, recoveries, runs, inversions | Nifty's current fall vs 2008 and 2020 |
| Composition | Who contributed to a change | Food cut CPI from 5.22% to 1.33% |

Print them as a table: claim, number, comparison, period. Twenty candidates is normal.

## 3. Rank them

Score each candidate on four questions, and drop any that fails the first two:

1. True and checkable: can the build compute it, and can chart code re-check it?
2. Robust: does it survive a different reasonable start date, end date, definition or source? (Rerun
   with the start moved six months either way; with total return instead of price; with the other
   exchange's index.) If it flips, it is not a headline.
3. Surprising or useful to an Indian reader: does it change what they think or do? "Markets go up and
   down" fails; "a ten-year holder never lost money" passes.
4. Visible: can one chart form make the claim obvious in five seconds (see `chart-choice`)?

Prefer the claim about the reader's own money or country. Prefer a concrete comparison over an
adjective ("seven times as fast" over "sharply").

## 4. Guard against the classic traps

- Survivorship: today's index constituents, live funds only, countries that exist now. State the
  universe and its date.
- Look-ahead: a rule or a ranking that uses information not known at the time.
- Cherry-picked windows: the start date that makes the number biggest. Use the series start, a policy
  change, or a round period, and say why.
- Partial periods: never mix the current, incomplete year with whole years; label "so far".
- Many comparisons: the best of 50 sectors beat the market by luck. Say how many you looked at.
- Units: per cent vs percentage points vs basis points; nominal vs real; rupees vs dollars.

## 5. Turn the winner into code

In `pipeline/fetch/build_*.py`:

1. Compute the numbers from the raw snapshot, with full precision.
2. `check(...)` every assumption the claim rests on (no gaps, one row per period, sums add up, a
   recomputation by a second method agrees). A failing check stops the build.
3. Write each number the copy will quote to `facts.json` under an explicit, readable key
   (`sensex_roll_10y_min`, `ret_top_2025`, `nifty_drawdown_now`). Lists and dates are fine as facts.

In the chart file, re-check the claim against the data and throw `COPY:` when it stops holding (the
data will be refreshed; the copy must not silently become false).

## 6. Write the methodology note

Every published chart carries its method in the notes (and always in the caption file): the measure,
the universe, the period, price vs total return, the conversion used, and what is excluded. One or two
plain sentences. Example: "Annualised returns of the price index, so dividends (about 1% to 1.5% a year)
are not counted. 233 ten-year windows; the latest started in November 2016."
