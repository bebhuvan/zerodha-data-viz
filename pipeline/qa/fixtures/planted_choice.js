// Choice: claim "This El Niño is the strongest since 1950 for the time of year" | job record | form beeswarm | tier familiar
// Planted defects for qa/lint_code.mjs check 'choice': exactly 4 issues. The form does not do the job
// "record"; the tier should be specialist; a specialist form gives no "not <form>: reason"; and there
// is no explanation box. (Not a real chart: it is never rendered.)
window.draw = function ({ tokens, data }) {
  const F = Frame({ tokens, headline: "x", dek: "x", source: "x" });
  Templates.beeswarm(F, { items: [] });
};
