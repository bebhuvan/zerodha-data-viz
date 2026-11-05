// Choice: claim "Sales at listed companies are growing at the fastest pace in three years" | job change | form lines | tier familiar 
// Sketch: three lines (sales, EBITDA, net profit) for comparison with the sales-only chart.
// Lines by quarter: year-on-year growth in sales (hero) and net profit (grey) of BSE-listed companies, the
// latest quarter dashed while results are still being filed.
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
  // Dek: profit growth is the highest since a named quarter.
  const patHigher = quarters.filter((q) => q !== latest && g("pat", q) >= g("pat", latest));
  const patSince = patHigher.at(-1);
  if (!patSince || patSince !== "2023-09") throw new Error(`COPY: dek says profit growth is the highest since Jul–Sep 2023; last higher quarter is ${patSince}`);
  if (!prov) throw new Error("COPY: copy calls the latest quarter provisional; the data says it is complete");
  // Checked: the provisional flag reaches the table rows the chart draws.
  if (!rows.some((r) => r.quarter === latest && r.provisional === 1)) throw new Error("ENCODING: latest quarter not marked provisional in the table");

  const F = Frame({ tokens,
    headline: [`Listed Indian companies' sales are growing at the fastest pace in three years`,
               `Company sales are growing at the fastest pace in three years`,
               `Company sales are growing at their fastest in three years`,
               `Sales are growing at the fastest pace in three years`],
    dek: [`Growth from a year earlier in [[sales|accent]], [[EBITDA|line_mid]] and [[net profit|line_mid]] of BSE-listed companies, quarter by quarter. With results still coming in for ${qName(latest)}, sales are up ${pct(g("revenue", latest))} and profit ${pct(g("pat", latest))}, the most since ${qName(patSince)}.`,
          `Growth from a year earlier in [[sales|accent]], [[EBITDA|line_mid]] and [[net profit|line_mid]] of BSE-listed companies. For ${qName(latest)} so far, sales are up ${pct(g("revenue", latest))} and profit ${pct(g("pat", latest))}.`,
          `Yearly growth in [[sales|accent]] and [[profit|line_mid]] of listed companies. ${qName(latest)} so far: sales ${pct(g("revenue", latest))}, profit ${pct(g("pat", latest))}.`],
    notes: [[`Dashed: ${qName(latest)}, companies that had reported by 5 November 2026; results are due by 14 November. Growth compares the same companies a year apart.`,
             `Dashed: ${qName(latest)}, results filed by 5 November 2026. Same companies a year apart.`]],
    source: "IndiaDataHub (all BSE-listed companies)" });

  const solid = quarters.filter((q) => q !== latest || !prov);
  const series = [];
  for (const [m, role, color, name] of [["pat", "compare", null, "Net profit"], ["ebitda", "compare", null, "EBITDA"], ["revenue", "hero", tokens.color.accent, "Sales"]]) {
    const pts = solid.map((q) => ({ x: xOf(q), y: g(m, q) }));
    // Encoding: the plotted points are the facts for this measure, one per complete quarter.
    K_check(pts.length === quarters.length - 1 && pts.every((p, i) => p.y === rows.find((r) => r.measure === m && r.quarter === solid[i]).growth), `${m} points match the table`);
    series.push({ id: m, role, color, curve: "linear", points: pts });
    series.push({ id: `${m}_prov`, role, color, curve: "linear", dashed: true,
      points: [{ x: xOf(prev), y: g(m, prev) }, { x: xOf(latest), y: g(m, latest) }],
      end: { value: pct(g(m, latest)), name } });
  }
  Templates.lines(F, {
    x: { domain: [xOf(first), xOf(latest)],
         ticks: quarters.filter((q) => q.endsWith("-09")).map((q) => ({ at: xOf(q), label: qName(q) })) },
    y: { unit: "%", dp: 0, zero: 0 },
    series,
  });

  function K_check(ok, msg) { if (!ok) throw new Error(`ENCODING: ${msg}`); }
};
