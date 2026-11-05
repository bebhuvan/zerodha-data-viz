---
name: finance-conventions
description: Conventions for markets, rates, money and macro numbers on Zerodha / Markets by Zerodha / Rainmatter charts - Indian number formats (lakh, crore, ₹), per cent vs points vs bps, returns (price vs total, CAGR, rolling, calendar-year), currency conversion, yields, inflation adjustment, financial years, data sources and attribution, and compliance limits on what a chart may imply. Use whenever a chart shows prices, returns, rates, flows, GDP, inflation or any money amount.
---

# Finance and economics conventions

## Numbers and units (always through `Fmt` / `K.fmt`, never by hand)

| Kind | Format | `Fmt.fmt(v, kind)` | Note |
|---|---|---|---|
| Rupee amounts | ₹94.94, ₹1,23,456 | `inr` | Indian grouping (lakh, crore) |
| Large rupee totals | ₹3.96 lakh crore, ₹12,345 crore | `inr_cr` (input in crore) | Never "₹39.6 trillion" for an Indian reader |
| Indian counts | 4,692 days, 1,23,456 accounts | `int` | Indian grouping |
| Dollar amounts | $2,702, $100,000 | `usd` | International grouping: never $1,00,000 |
| Foreign counts | 100,000 | `intl` | |
| Dollar totals | $3.96 trillion | `usd_tn` | |
| Rates and returns | 7.6% | `pct` | One decimal by default |
| Change in a rate | +0.48 points | `pp` | Never "+6.8%" for a 6.8% relative rise in a rate |
| Small rate changes | 47 bps | `bps` | Only for a finance-literate audience; "points" otherwise |
| Multiples | 11.9x | `x` | |

A true minus (−) everywhere (lint `style`). Same decimals in the dek and on the chart. Round only for
display; one rounding rule (half away from zero).

## Returns

- Price index vs total return: Nifty 50, Sensex and S&P 500 levels exclude dividends (1–1.5% a year
  for Indian large caps). Say "price index" in notes when you use them; prefer TRI series (NSE's Total
  Return Index) when the claim is about what an investor earned.
- Calendar-year return: December close to December close. Never mix the current, partial year with
  whole years; label it "so far".
- Annualised (CAGR): (end/start)^(1/years) − 1. Never average yearly returns to annualise.
- Rolling returns: every start month, fixed holding period, annualised. Report count of windows,
  worst, median, best, and share negative. The latest windows end in the partial month; say so.
- Drawdown: close / running peak − 1 on daily closes. Recovery = first close back at the old peak.
- Asset returns for an Indian investor: convert foreign prices to rupees at the same date's exchange
  rate (gold in rupees = USD price × rupees per dollar). Say which rate and which date.
- Real returns: deflate by CPI for the same period and say so ("after inflation").
- Mutual funds and portfolios use XIRR for irregular cash flows; do not show a CAGR for SIPs.

## Rates

- A bond's yield and its price move in opposite directions; say it once in the dek when the audience
  may not know ("a higher yield means bond prices have fallen").
- Yield curves: maturities on a log axis, explicit tick labels (3 mo, 1 yr, 10 yr). "Inverted" means a
  long yield below a short one: name the pair (10-year vs 3-month).
- Policy rate changes in basis points for a market audience, "percentage points" for a general one.

## Inflation and growth

- Inflation is year-on-year unless stated; say "year-on-year" in the dek, never "YoY" on canvas.
- GDP growth is real (constant prices); nominal GDP in a currency is for size, not growth.
- Country GDP rankings at market exchange rates move with currencies: say so (a weaker rupee lowers
  India's dollar GDP even when the economy grows). PPP rankings are a different question.
- India's financial year runs April to March: FY26 = April 2025 to March 2026. World Bank and IMF
  tables for India may be calendar or fiscal: check and state which.

## Time axes

- Trading days have gaps (weekends, holidays). Daily lines over years are fine; daily columns are not.
- Long histories of things that compound (index levels, exchange rates, GDP in currency) go on a log
  scale; name it in the dek ("on a log scale: the same slope means the same percentage change").
- Dense series (more than one point per 2px) draw thinner: the kit does this automatically.

## Sources and attribution

Source line: publisher first, then dataset, then "Zerodha calculations" if transformed. Common ones:

| Data | Publisher (source line) | Fetch |
|---|---|---|
| Nifty indices | NSE (via Yahoo Finance, or niftyindices.com) | `fetch_markets.py` |
| Sensex | BSE | `fetch_markets.py` |
| CPI, IIP, GDP (India) | MOSPI | `fetch_all.py` (MOSPI API, never paged) |
| Policy rates, forex reserves, bank credit | RBI (DBIE) | not yet wired |
| Mutual fund flows and AUM | AMFI | not yet wired |
| FPI flows | NSDL | not yet wired |
| Cross-country GDP, inflation | World Bank (WDI), IMF (WEO) | `fetch_markets.py` |
| US yields, exchange rates | US Federal Reserve via FRED | `fetch_markets.py` |

Every raw file goes through a fetcher that records URL, time and sha256 in `data/raw/manifest.json`.

## Compliance: what a Zerodha chart may say

- Describe what happened; never recommend (no "buy", "time to switch", "should").
- Past returns are history, not a forecast: no copy that implies the pattern will continue ("will",
  "guaranteed", "safe"). "No ten-year stretch since 1997 lost money" is fine; "you cannot lose money
  over ten years" is not.
- No single-stock recommendations or targets. Company data is shown as fact with its source.
- When a chart could be read as advice, add a note: "Past returns do not indicate future returns."
