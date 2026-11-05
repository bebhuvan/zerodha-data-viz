// Choice: claim "Prices in Kerala are rising seven times as fast as in India" | job ranking | form ranked_dots, beeswarm | tier specialist | not bars: 33 rows of bars do not fit short canvases, where the beeswarm takes over
// Lead state chart: every state ranked against India (ranked dots) where 33 rows fit; on canvases
// too short for that, every state as one dot on a single scale (beeswarm), extremes named.
window.draw = function ({ tokens, data }) {
  const S = States({ tokens, data });
  const INDIA = fact(data.facts, "state_cpi_2025-12_All India");
  const have = S.rows.filter((r) => !S.missing(r));
  const val = (r) => fact(data.facts, `state_cpi_2025-12_${r.name}`);
  const full = (n) => n.replace(" and Nicobar Islands", " and Nicobar");
  // Short forms as Indian readers use them, for canvases where full names leave the dots no room; codes
  // (as on the tile chart) only where even these do not fit. The template keeps full names for labelled rows.
  const SHORT = { "Andaman and Nicobar Islands": "A&N Islands", "Jammu and Kashmir": "J&K", "Himachal Pradesh": "Himachal",
    "Andhra Pradesh": "Andhra", "Madhya Pradesh": "MP", "Uttar Pradesh": "UP", "West Bengal": "Bengal" };
  // Checked claim for the note: how many sit within two points of India (counted here, not typed).
  const within = have.filter((r) => Math.abs(val(r) - INDIA) <= 2).sort((a, b) => val(a) - val(b));
  if (within.length < have.length / 2) throw new Error(`COPY: note says most states are within two points of India; only ${within.length} are`);
  const near = { n: within.length, median: within[Math.floor(within.length / 2)] };
  const explain = [`**How to read this.** Each dot is a state or union territory, placed by how fast its prices rose in the year to December 2025. The line is India as a whole; the further a dot sits from it, the more that place differs.`,
    `**How to read this.** Each dot is a state, placed by its inflation. The line is India.`];
  firstFit([
    () => Templates.ranked_dots(Frame({ tokens, ...S.textLeftOut, explain }), { v: { unit: "%", dp: 1 }, showValues: "ends",
      ref: { value: INDIA, name: `India ${INDIA.toFixed(2)}%` }, stems: true, band: { lo: INDIA - 2, hi: INDIA + 2 },
      // The axis stays linear: Kerala's distance from India is the headline, so squeezing or breaking
      // the axis would hide the claim. The crowded strip is explained in words, beside it.
      note: { id: near.median.code, leader: false, text: `Shaded: within two points of India, where ${near.n} of ${have.length} states and union territories sit` },
      rows: have.map((r) => ({ id: r.code, name: full(r.name), short: SHORT[r.name] || r.name, code: r.code, value: val(r), role: r.name === "Kerala" ? "hero" : "context" })) }),
    () => {
      const named = { Kerala: ["n", "nw"], Lakshadweep: ["n", "nw", "ne"], Manipur: ["n", "ne"], Goa: ["n", "nw", "ne"] };
      return Templates.beeswarm(Frame({ tokens, ...S.textLeftOut, explain }), { v: { unit: "%", zero: 0 }, refLines: [{ v: INDIA, name: "India" }],
        items: have.map((r) => ({ id: r.code, value: val(r), role: r.name === "Kerala" ? "hero" : r.name in named ? "compare" : "context",
          label: r.name in named ? { value: S.fmt(val(r)), name: r.name, prefer: named[r.name] } : null })) });
    },
  ]);
};
