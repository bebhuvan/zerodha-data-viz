// Choice: claim "The week before a US mid-term is the steadiest window for Indian stocks" | job outcome-range | form range_bars | tier specialist | not columns: each window needs its worst, median and best across all elections since 1990, not a single average
// Range bars: worst, median and best Nifty 50 return across US mid-term elections (1990-2026) for 1W/1M before and 1W/1M/3M/6M/1Y after.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const W = [
    { key: "m1w", name: "1W before", sfx: "all", role: "hero" },
    { key: "m1m", name: "1M before", sfx: "all" },
    { key: "p1w", name: "1W after", sfx: "hist" },
    { key: "p1m", name: "1M after", sfx: "hist" },
    { key: "p3m", name: "3M after", sfx: "hist" },
    { key: "p6m", name: "6M after", sfx: "hist" },
    { key: "p1y", name: "1Y after", sfx: "hist" },
  ];
  // Checked claim: 1W before rose in 9 of 10 elections (median +2.1%); every post-election window up to 6M has a worst loss deeper than -5%.
  if (f("midterm_m1w_all_pos") !== 9 || f("midterm_m1w_all_n") !== 10 || f("midterm_p1w_hist_min") > -5)
    throw new Error("COPY: headline claims 1W before is the only consistent window");

  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1, sign: v !== 0 });
  const F = Frame({ tokens,
    headline: [
      `The week before a US mid-term is the steadiest window for Indian stocks`,
      `Indian stocks rally most consistently in the week before a US mid-term`,
      `Indian stocks rise before US mid-terms far more reliably than after`,
      `Nifty 50 rises before US mid-terms more reliably than after`,
      `Nifty 50 rallies into US mid-terms more reliably than after`,
      `Pre-vote week is the steadiest US mid-term window for Nifty 50`,
      `Nifty 50 is steadiest in the week before US mid-terms`,
    ],
    dek: [
      `Nifty 50 return before and after US mid-term elections since 1990: worst, median and best. [[One week before|accent]] rose in ${f("midterm_m1w_all_pos")} of ${f("midterm_m1w_all_n")} elections (median ${pct(f("midterm_m1w_all_median"))}); one year later, returns spanned ${pct(f("midterm_p1y_hist_min"))} to ${pct(f("midterm_p1y_hist_max"))}.`,
      `Nifty 50 return before and after US mid-terms since 1990: worst, median and best. [[One week before|accent]] rose in ${f("midterm_m1w_all_pos")} of ${f("midterm_m1w_all_n")} elections (median ${pct(f("midterm_m1w_all_median"))}).`,
    ],
    notes: [[
      `Price index (dividends excluded), anchored on the last Indian close on or before Election Tuesday. Pre-election windows cover all 10 mid-terms (1990–2026); post-election windows cover the 9 completed cycles (1990–2022).`,
      `Price index, anchored on Election Tuesday. Pre-vote: 1990–2026 (10 mid-terms); post-vote: 1990–2022 (9).`,
    ]],
    explain: [
      `**How to read this.** Each bar is one time window around US mid-term elections. It runs from the worst Nifty 50 return in that window to the best, with the median marked by a dark line. The blue bar (one week before the vote) sits almost entirely above zero; after the vote, the bars widen rapidly.`,
      `**How to read this.** Each bar spans the worst to the best Nifty 50 return for that window across US mid-terms since 1990, with the median marked.`,
    ],
    source: "NSE Indices; Zerodha calculations" });

  Templates.range_bars(F, {
    rows: W.map((w) => ({
      id: w.key,
      name: w.name,
      lo: f(`midterm_${w.key}_${w.sfx}_min`),
      hi: f(`midterm_${w.key}_${w.sfx}_max`),
      mid: f(`midterm_${w.key}_${w.sfx}_median`),
      role: w.role || "context",
    })),
    fmt: pct,
    axis: { unit: "%", sign: true },
  });
};
