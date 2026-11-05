// Choice: claim "India rose from 12th to 5th largest economy and slipped to 6th" | job rank-change | form bump | tier specialist | not lines: GDP levels span fifty times, so the climb in rank is invisible on a value axis
// Bump chart: the world's largest economies by GDP in US dollars, rank by year.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.gdp_rank, d3.autoType);
  const last = f("wb_gdp_last_year"), first = 2004;
  const r0 = f(`gdp_rank_IND_${first}`), r1 = f(`gdp_rank_IND_${last}`), best = f("gdp_rank_IND_best"), bestYears = f("gdp_rank_IND_best_years");
  // Checked claims: India rose from r0 to best, then slipped to r1 in the latest year.
  if (!(r0 > best && r1 > best && bestYears.at(-1) === last - 1)) throw new Error(`COPY: headline says India climbed to ${best}th and slipped in ${last}`);
  const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
  const items = d3.groups(rows, (d) => d.iso3).map(([id, rs]) => ({ id, name: rs[0].name, role: id === "IND" ? "hero" : id === "GBR" ? "compare" : "context",
    color: id === "IND" ? tokens.color.accent : null, ranks: Object.fromEntries(rs.map((r) => [r.year, r.rank])) }));
  const F = Frame({ tokens,
    headline: [`India rose from ${ord(r0)} to ${ord(best)} largest economy and is now ${ord(r1)}`, `India rose from ${ord(r0)} to ${ord(best)} largest economy, and is ${ord(r1)} now`, `India rose from ${ord(r0)} to ${ord(best)}, and is ${ord(r1)} now`],
    dek: [`Rank by GDP in US dollars, ${first} to ${last}, for every economy that made the top ten. [[India|accent]] was ${ord(best)} from ${bestYears[0]} to ${bestYears.at(-1)}; in ${last} the [[UK|line_mid]] moved back ahead of it.`,
          `Rank by GDP in US dollars, ${first} to ${last}. [[India|accent]] was ${ord(best)} from ${bestYears[0]} to ${bestYears.at(-1)}.`],
    // Square and web canvases are short: the one-line note keeps the chart above the area floor.
    notes: [[...(["square", "web"].includes(tokens.format.id) ? [] : [`At market exchange rates, so a weaker rupee lowers India's dollar GDP even when the economy grows. In ${last} India's GDP was $${Fmt.num(f(`gdp_usd_tn_IND_${last}`), { dp: 2 })} trillion.`]),
             `At market exchange rates, so a weaker rupee lowers India's rank.`]],
    explain: [`**How to read this.** Each line follows one economy's rank year by year, with 1st at the top. India's line climbs from ${ord(r0)} to ${ord(best)}, then drops a place in ${last}.`, `**How to read this.** Each line is one economy's rank, 1st at the top.`],
    source: "World Bank, World Development Indicators" });
  Templates.bump(F, { periods: d3.range(first, last + 1), items, top: 12 });
};
