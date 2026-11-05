// Choice: claim "Indian stocks usually rise into US mid-terms and drift once votes are in" | job range | form lines | tier familiar
// Trajectory: Nifty 50 from one month before to three months after US mid-term elections (T0 = 0%),
// 2026 so far against the 1990-2022 median and range.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.us_midterms_path, (d) => ({ year: +d.year, td: +d.td, pct: +d.pct }));
  // Checked claim: Nifty rose in the week before 9 of 10 mid-terms; 2026 gained +0.6% on results day after a +6.2% 1-month run-up.
  if (f("midterm_m1w_all_pos") !== 9 || f("midterm_m1w_all_n") !== 10 || f("midterm_td_1_2026") <= 0)
    throw new Error("COPY: headline/dek claims 9 of 10 pre-election weekly gains and a positive 2026 results day");

  const sgn = (v) => Fmt.fmt(v, "pct", { dp: 1, sign: v !== 0 });
  const past = rows.filter((d) => d.year < 2026);
  const tds = d3.range(-31, 93);
  const band = tds.map((k) => {
    const v = past.filter((d) => d.td === k).map((d) => d.pct);
    return { x: k, lo: d3.min(v), hi: d3.max(v) };
  });
  const medPts = tds.map((k) => {
    const v = past.filter((d) => d.td === k).map((d) => d.pct);
    return { x: k, y: d3.median(v) };
  });
  const curPts = rows.filter((d) => d.year === 2026).sort((a, b) => a.td - b.td).map((d) => ({ x: d.td, y: d.pct }));
  const cur1d = f("midterm_td_1_2026"), med92 = f("midterm_td_92_median"), lo92 = f("midterm_td_92_min"), hi92 = f("midterm_td_92_max");

  const F = Frame({ tokens,
    headline: [
      `Indian stocks usually rise into US mid-terms and drift once votes are in`,
      `Indian stocks rise into US mid-terms and drift once votes are in`,
      `Nifty 50 rallies before US mid-terms and drifts over the next quarter`,
      `Nifty 50 rises into US mid-terms and drifts afterwards`,
      `Indian stocks rise before US mid-terms and drift after`,
    ],
    dek: [
      `Nifty 50 cumulative change around US mid-term election day, from one month before to three months after. [[2026 so far|line_hero]] is at ${sgn(cur1d)} a day after the vote; across the nine elections since 1990, three-month moves ranged from ${sgn(lo92)} to ${sgn(hi92)}.`,
      `Nifty 50 change around US mid-term election day, one month before to three months after. [[2026 so far|line_hero]] is at ${sgn(cur1d)} after one day; past three-month moves ran from ${sgn(lo92)} to ${sgn(hi92)}.`,
      `Nifty 50 change around US mid-term elections, 1990 to 2026. [[2026 so far|line_hero]] is at ${sgn(cur1d)} a day after the vote.`,
    ],
    notes: [[
      `Price index (dividends excluded), rebased to 0% on the last Indian close on or before US Election Tuesday, from one calendar month before to three calendar months after.`,
      `Price index, rebased to 0% on the last Indian close on or before Election Tuesday.`,
    ]],
    explain: [
      `**How to read this.** Every election cycle is pinned to 0% on election day so they meet at the same point. Points to the left of Vote sit below 0% when the market rose into election day. The orange line is 2026 so far, the grey line is the middle path across the nine mid-terms from 1990 to 2022, and the shaded area spans the worst and best path at each day.`,
      `**How to read this.** Orange is 2026 so far, grey is the 1990–2022 median path, and the shaded area spans all nine past mid-terms relative to election day (0%).`,
    ],
    source: "NSE Indices; Zerodha calculations" });

  Templates.lines(F, {
    x: {
      domain: [-31, 92],
      ticks: [
        { at: -31, label: "−1M" },
        { at: 0, label: "Vote" },
        { at: 30, label: "+1M" },
        { at: 61, label: "+2M" },
        { at: 92, label: "+3M" },
      ],
    },
    y: { unit: "%", dp: 0, sign: true, zero: 0 },
    band: { points: band, name: "1990–2022 range" },
    series: [
      { id: "median", role: "compare", points: medPts },
      { id: "2026", role: "hero", points: curPts, end: { value: sgn(cur1d), name: "2026 (+1D)" } },
    ],
    callouts: [
      { x: 92, y: medPts.at(-1).y, value: sgn(med92), name: "1990–2022 median", prefer: ["w", "nw", "sw", "n", "s"], dot: true },
      { x: 92, y: band.at(-1).hi, value: sgn(hi92), name: "1998 best", prefer: ["w", "sw", "nw"], dot: true, optional: true },
      { x: 92, y: band.at(-1).lo, value: sgn(lo92), name: "1994 worst", prefer: ["w", "nw", "sw"], dot: true, optional: true },
    ],
  });
};
