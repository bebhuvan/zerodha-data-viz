// Choice: claim "Gold beat every other asset two years running" | job rank-periods | form rank_grid | tier specialist | not lines: six return series cross every year and tangle
// Ranked grid of calendar-year returns for six things an Indian investor can buy.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.asset_returns, d3.autoType);
  const first = f("ret_first_year"), last = f("ret_last_year");
  // Checked claims: gold led in the last two years, and no other back-to-back leader in the period.
  const reps = f("ret_repeat_leaders");
  if (reps.length !== 1 || reps[0][0] !== last || reps[0][1] !== "Gold") throw new Error(`COPY: headline says gold is the only back-to-back leader, ending ${last}; got ${JSON.stringify(reps)}`);
  const C = tokens.color;
  const items = [
    { key: "gold_inr", name: "Gold", role: "hero", color: C.categorical[1] },
    { key: "nifty50", name: "Nifty 50", short: "Nifty", role: "compare", color: C.accent_fill },
    { key: "midcap50", name: "Midcap 50", short: "Midcap" }, { key: "bank", name: "Bank Nifty", short: "Bank" },
    { key: "sp500_inr", name: "S&P 500", short: "S&P" }, { key: "usdinr", name: "Dollar" },
  ];
  const val = (y, k) => f(`ret_${k}_${y}`);
  const pct = (v) => Fmt.num(v, { dp: 0, sign: true }) + "%";
  // Full names at 18, 10 or 8 years first; short names ("S&P", "Bank") only when nothing else fits.
  const attempt = (n, short = false) => () => {
    const years = d3.range(Math.max(first, last - n + 1), last + 1);
    const F = Frame({ tokens,
      headline: [`Gold beat every other asset in both ${last - 1} and ${last}`, `Gold beat every other asset in ${last - 1} and ${last}`, `Gold led in both ${last - 1} and ${last}`],
      dek: [`Calendar-year returns in rupees, ${years[0]} to ${last}, best first: [[gold|categorical.1]], the [[Nifty 50|accent_fill]] and four other things an Indian investor can buy. No other asset led two years running in this period.`,
            `Calendar-year returns in rupees, ${years[0]} to ${last}, best first: [[gold|categorical.1]] and the [[Nifty 50|accent_fill]] against four others.`],
      notes: [[`Price indices, so dividends are not counted. Gold is the COMEX price and the S&P 500 its index level, each turned into rupees at the year-end exchange rate; Dollar is the rupee price of one US dollar.`,
               `Price indices without dividends; gold and the S&P 500 converted to rupees at year-end.`]],
      explain: [`**How to read this.** For each year, the six assets are listed from the best return to the worst. Gold is the orange cell and the Nifty 50 the blue-bordered one, so you can follow where each ranked year by year.`, `**How to read this.** Each year lists the six assets from best to worst return. Gold is orange.`],
      source: "NSE, CME and S&P via Yahoo Finance; Zerodha calculations" });
    Templates.rank_grid(F, { items, periods: years.map((y) => ({ id: y, label: String(y) })), value: val, fmt: pct, short });
  };
  firstFit([attempt(last - first + 1), attempt(10), attempt(8), attempt(10, true), attempt(8, true)]);
};
