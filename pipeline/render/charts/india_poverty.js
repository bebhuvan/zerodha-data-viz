// Choice: claim "Extreme poverty in India fell from 27% to under 3% in 12 years" | job change | form lines | tier familiar
// Lines over survey years: share of Indians below the World Bank's $3.00, $4.20 and $8.30 lines (2021 PPP),
// the $3.00 line as hero; survey dots, with the World Bank's yearly estimates dashed across the 2012-22 survey gap.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);
  const rows = d3.csvParse(data.india_poverty, (d) => ({ survey_year: +d.survey_year, label: d.label, line: +d.line, rate: +d.rate, programme: d.programme }));
  const LINES = [{ k: "3", line: 3 }, { k: "42", line: 4.2 }, { k: "83", line: 8.3 }];
  const nssLast = f("india_pov_nss_last"), hcesFirst = f("india_pov_hces_first"), last = f("india_pov_last"), first = f("india_pov_first");
  const rate = (k, lab) => f(`india_pov_${k}_${lab}`), poor = (k, lab) => f(`india_poor_${k}_${lab}_m`);
  const pct = (v) => Fmt.fmt(v, "pct", { dp: 1 });
  const usd = (k) => Fmt.fmt(f(`poverty_line_${k}`), "usd", { dp: 2 });
  const yearOf = (lab) => rows.find((r) => r.label === lab).survey_year;
  const span = Math.round(yearOf(last) - yearOf(nssLast));

  // Checked claims: 27% in 2011-12 to under 3% in the latest survey, twelve years apart; four in five
  // still below $8.30; the people counts in the dek.
  if (Math.round(rate("3", nssLast)) !== 27 || !(rate("3", last) < 3) || span !== 12)
    throw new Error(`COPY: headline says 27% to under 3% in 12 years; got ${rate("3", nssLast)} to ${rate("3", last)} over ${span}`);
  if (Math.round(rate("83", last)) !== 80) throw new Error(`COPY: dek says 80% below $8.30; got ${rate("83", last)}`);
  const m = (v) => Fmt.fmt(Math.round(v), "int");
  if (rows.some((r) => r.programme === "HCES" && r.survey_year < yearOf(nssLast))) throw new Error("COPY: note says the HCES follows the NSS rounds");

  const inr = (k) => Fmt.fmt(f(`poverty_line_${k}_inr_last`), "inr", { dp: 0 });
  const est = d3.csvParse(data.india_poverty_est, (d) => ({ year: +d.year, line: +d.line, rate: +d.rate }));
  const estFirst = f("india_pov_est_first_year"), estLast = f("india_pov_est_last_year");
  if (!(estFirst > yearOf(nssLast) && estLast < yearOf(hcesFirst))) throw new Error("COPY: note says the dashed years sit between the two surveys");

  // Checked: the note ties the 2020 rise in the estimates to the 2020 contraction.
  const e3 = (y) => est.find((e) => e.line === 3 && e.year === y).rate;
  if (!(e3(2020) > e3(2019) && f("india_growth_2020") < 0)) throw new Error("COPY: note says the estimates rise in 2020, when the economy shrank");
  const estMid = Math.round((estFirst + estLast) / 2);
  const frame = () => Frame({ tokens,
    headline: [`Extreme poverty in India fell from 27% to under 3% in ${span} years`,
               `Extreme poverty in India fell from 27% to under 3%`,
               `India's extreme poverty fell to under 3%`],
    dek: [`Share of Indians below [[${usd("3")} a day|accent]] (${inr("3")} at ${last} prices), the World Bank's extreme poverty line: ${m(poor("3", last))} million people, down from ${m(poor("3", nssLast))} million in ${nssLast}. At ${usd("83")} (${inr("83")}), ${Math.round(rate("83", last))}% still fall below.`,
          `Share of Indians below [[${usd("3")} a day|accent]] (${inr("3")} at ${last} prices): ${m(poor("3", last))} million people, down from ${m(poor("3", nssLast))} million in ${nssLast}. At ${usd("83")} (${inr("83")}), ${Math.round(rate("83", last))}% still fall below.`,
          `Share of Indians below [[${usd("3")} a day|accent]] (${inr("3")}): ${m(poor("3", last))} million people. ${Math.round(rate("83", last))}% are below ${usd("83")} (${inr("83")}).`],
    notes: [[`Dollars are 2021 purchasing-power-parity dollars, converted at ${Fmt.fmt(f("india_pov_ppp_inr"), "inr", { dp: 2 })} a dollar and raised to ${last} prices. ${usd("42")} (${inr("42")}) and ${usd("83")} (${inr("83")}) are the lines for lower-middle and upper-middle-income countries. No national survey ran between ${nssLast} and ${hcesFirst}: the dashed years are the World Bank's estimates from the surveys on either side and growth in the national accounts, which is why they rise in 2020, when the economy shrank. The newer survey records spending in more detail, so the two are not strictly comparable.`,
             `PPP dollars at ${last} prices. Dashed: World Bank estimates; no survey ran between ${nssLast} and ${hcesFirst}.`]],
    source: "World Bank, Poverty and Inequality Platform (September 2026 release); Zerodha calculations" });

  const series = [];
  for (const { k } of LINES) {
    const pl = f(`poverty_line_${k}`);
    const pts = rows.filter((r) => r.line === pl).sort((a, b) => a.survey_year - b.survey_year);
    if (pts.length < 9) throw new Error(`ENCODING: ${k} has ${pts.length} survey years`);
    const points = [];
    pts.forEach((r, i) => {
      if (i && r.programme !== pts[i - 1].programme) points.push({ x: (r.survey_year + pts[i - 1].survey_year) / 2, y: null });
      points.push({ x: r.survey_year, y: r.rate });
    });
    const hero = k === "3", role = hero ? "hero" : "compare", color = hero ? tokens.color.accent : null;
    // The gap: dashed from the last NSS survey through the World Bank's yearly estimates to the first HCES survey.
    const gap = est.filter((e) => e.line === pl).sort((a, b) => a.year - b.year);
    if (gap.length !== estLast - estFirst + 1) throw new Error(`ENCODING: ${k} gap estimates incomplete`);
    series.push({ id: `pov_${k}_est`, role, color, curve: "linear", dashed: true,
      points: [{ x: yearOf(nssLast), y: rate(k, nssLast) }, ...gap.map((e) => ({ x: e.year, y: e.rate })), { x: yearOf(hcesFirst), y: rate(k, hcesFirst) }] });
    series.push({ id: `pov_${k}`, role, color, curve: "linear", dots: true,
      end: { value: pct(rate(k, last)), name: `${usd(k)} (${inr(k)})` }, points });
  }
  const draw = (estName, estNear = true, estAt = estMid) => () => Templates.lines(frame(), {
    x: { domain: [yearOf(first), yearOf(last)] },
    y: { unit: "%", dp: 0, zero: 0 },
    series,
    callouts: [
      { x: yearOf(nssLast), y: rate("3", nssLast), value: pct(rate("3", nssLast)), name: nssLast, prefer: ["e", "ne", "se", "sw", "w"] },  // right of the dot: on its left it reads as 2009-10's
      // The dashed stretch is named on the chart, so canvases without room for notes still say what it is.
      { x: estAt, y: e3(estAt), value: null, name: estName, prefer: ["sw", "w", "s", "ne", "n", "nw", "e", "se"], near: estNear },
      { x: yearOf(first), y: rate("3", first), value: pct(rate("3", first)), name: first, prefer: ["ne", "e", "se"], optional: true },
      // Start and 2011-12 values on the grey lines too, placed after the hero's so the hero never gives way;
      // where one cannot sit cleanly beside its dot (short wide plots) it is left off rather than drawn on a long leader.
      ...["83", "42"].flatMap((k) => [
        { x: yearOf(nssLast), y: rate(k, nssLast), value: pct(rate(k, nssLast)), name: nssLast, prefer: ["e", "ne", "se", "sw", "w"], optional: true, near: true },
        { x: yearOf(first), y: rate(k, first), value: pct(rate(k, first)), name: [`${first}, ${usd(k)} line`, first], prefer: ["se", "ne", "e", "s"], optional: true, near: true },  // names the line where a reader starts
      ]),
    ],
  });
  // The estimates label beside the dashed line, long name first, at any year along it; only if none fits, on a leader.
  // Anchors run outward from the middle of the gap, so the label sits as central as the space allows.
  const anchors = d3.range(estFirst + 1, estLast).sort((a, b) => Math.abs(a - estMid) - Math.abs(b - estMid));
  firstFit([...["World Bank estimates", "Estimates"].flatMap((n) => anchors.map((a) => draw(n, true, a))), draw("World Bank estimates", false), draw("Estimates", false)]);
};
