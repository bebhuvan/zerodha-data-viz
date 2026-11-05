// Choice: claim "Sales at listed companies are growing at the fastest pace in three years" | job change | form small_multiples | tier learnable | not lines: three lines on one plot tangle, and the 2023 profit swings squash the sales line
// Three panels on one scale: year-on-year growth in sales, EBITDA and net profit of BSE-listed companies, each
// in blue over the other two in grey; the latest quarter dashed while results are still being filed.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.earnings_growth, (d) => ({ ...d, growth: d.growth === "" ? null : +d.growth, provisional: +d.provisional })).filter((r) => r.key === "total");
  const latest = f("earn_latest_quarter"), first = f("earn_first_quarter"), prov = f("earn_provisional");
  const quarters = [...new Set(rows.map((r) => r.quarter))].sort();
  const g = (m, q) => f(`earn_${m}_total_${q}`);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const xOf = (q) => +q.slice(0, 4) + (+q.slice(5) - 1) / 12;
  const qName = (q) => `${MON[+q.slice(5) - 3]}–${MON[+q.slice(5) - 1]} ${q.slice(0, 4)}`;  // 2026-09 -> Jul–Sep 2026
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1 });
  const prev = quarters.at(-2);

  // Checked claims. Headline: sales growth in the latest quarter (and in the last complete one) is above
  // every other quarter of the past three years, the whole window we have.
  const back3 = quarters.filter((q) => xOf(q) >= xOf(latest) - 3 && q !== latest);
  if (!(g("revenue", latest) > d3.max(back3, (q) => g("revenue", q)))) throw new Error("COPY: headline says sales growth is the fastest in three years");
  if (!(g("revenue", prev) > d3.max(back3.filter((q) => q !== prev), (q) => g("revenue", q)))) throw new Error("COPY: dek says the last complete quarter was already the fastest in three years");
  if (xOf(latest) - xOf(first) < 3) throw new Error("COPY: headline needs three years of data");
  if (!prov) throw new Error("COPY: copy calls the latest quarter provisional; the data says it is complete");
  // Checked: the provisional flag reaches the table rows the chart draws.
  if (!rows.some((r) => r.quarter === latest && r.provisional === 1)) throw new Error("ENCODING: latest quarter not marked provisional in the table");

  const F = Frame({ tokens,
    headline: [`Listed Indian companies' sales are growing at the fastest pace in three years`,
               `Company sales are growing at the fastest pace in three years`,
               `Company sales are growing at their fastest in three years`,
               `Sales are growing at the fastest pace in three years`],
    dek: [`Growth from a year earlier in sales, EBITDA and net profit of BSE-listed companies, quarter by quarter. With results still coming in for ${qName(latest)}, sales are up ${pct(g("revenue", latest))}, EBITDA ${pct(g("ebitda", latest))} and net profit ${pct(g("pat", latest))}.`,
          `Growth from a year earlier in sales, EBITDA and net profit of BSE-listed companies. ${qName(latest)} so far: sales ${pct(g("revenue", latest))}, EBITDA ${pct(g("ebitda", latest))}, net profit ${pct(g("pat", latest))}.`,
          `Yearly growth of listed companies. ${qName(latest)} so far: sales ${pct(g("revenue", latest))}, EBITDA ${pct(g("ebitda", latest))}, net profit ${pct(g("pat", latest))}.`],
    explain: [`**How to read this.** Each small chart is one measure: how much it grew from a year earlier, quarter by quarter. All three share the same scale. EBITDA is profit before interest, tax, depreciation and amortisation. The dashed last step is ${qName(latest)}, with results still coming in.`,
              `**How to read this.** One measure per panel, all on the same scale; dashed is ${qName(latest)} so far.`],
    notes: [[`Dashed: ${qName(latest)} counts only the companies that had announced results by 5 November 2026. The rest have until 14 November, so these figures may change. Growth compares the same companies a year apart.`,
             `Dashed: ${qName(latest)}, only companies that reported by 5 November 2026; may change. Same companies a year apart.`]],
    source: "IndiaDataHub (all BSE-listed companies)" });

  const MEAS = [["revenue", "Sales"], ["ebitda", "EBITDA"], ["pat", "Net profit"]];
  for (const [m] of MEAS) K_check(quarters.every((q) => rows.find((r) => r.measure === m && r.quarter === q).growth === g(m, q)), `${m} points match the table`);
  Templates.small_multiples(F, {
    x: { domain: [xOf(first), xOf(latest)], ticks: [first, ...quarters.filter((q) => q.endsWith("-09"))].map((q) => ({ at: xOf(q), label: qName(q) })) },
    y: { unit: "%", zero: 0 },
    dashLast: prov, others: false, curve: "linear",
    panels: MEAS.map(([m, name]) => ({ id: m, name, points: quarters.map((q) => ({ x: xOf(q), y: g(m, q) })), end: `${pct(g(m, latest))} so far` })),
  });

  function K_check(ok, msg) { if (!ok) throw new Error(`ENCODING: ${msg}`); }
};
