// Source linter for the visual grammar: node pipeline/qa/lint_code.mjs [files...]
// Default files: render/kit.js, render/frame.js, render/templates/*.js, render/charts/*.js (sketches are
// alternatives, not published, and are not covered). Flags, per line:
//   spacing   a pixel constant scaled by k (`14 * k`, `k * 14`, `${3 * k}`): gaps must come from the
//             spacing scale (K.sp / K.gap, frame sp) and mark sizes from grammar.mark (K.mk)
//   colour    a hex colour literal: colours come from theme tokens (C.*, K.ink)
//   choice    (chart files: any file defining window.draw) a choice record in the first ten lines,
//             `// Choice: claim "..." | job <job> | form <a>[, <b>] | tier <tier> [| not <form>: <reason>]`,
//             checked against design/chart_forms.json: every Templates.<x> the file calls is listed in
//             form, the job is one the first form does, the tier is the strictest of the forms', a
//             specialist form gives a "not <familiar form>: reason", and learnable or specialist forms
//             pass an explanation box (explain:) to the frame.
// A line may opt out with a trailing `// grammar-ok: <reason>` (say why; use sparingly).
// Exit code 1 when anything is flagged.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const files = args.length ? args.map((f) => resolve(f))
  : [`${root}/render/kit.js`, `${root}/render/frame.js`, ...["templates", "charts"].flatMap((d) =>
      readdirSync(`${root}/render/${d}`).filter((f) => f.endsWith(".js")).map((f) => `${root}/render/${d}/${f}`))];
const issues = [];
const CF = JSON.parse(readFileSync(`${root}/design/chart_forms.json`, "utf8"));
const rank = (t) => CF.tiers.indexOf(t);
function choice(f, src) {
  if (!/window\.draw\s*=/.test(src)) return;
  const at = (msg) => issues.push(`${relative(process.cwd(), f)}:1 [choice] ${msg}`);
  const line = src.split("\n").slice(0, 10).find((l) => /^\/\/ Choice:/.test(l));
  if (!line) return at("no choice record (// Choice: claim ... | job ... | form ... | tier ...) in the first ten lines");
  const field = Object.fromEntries(line.replace(/^\/\/ Choice:\s*/, "").split(/\s*\|\s*/).map((p) => { const m = p.match(/^(\w+)\s+(.*)$/s); return m ? [m[1], m[2].trim()] : [p, ""]; }));
  for (const k of ["claim", "job", "form", "tier"]) if (!field[k]) return at(`choice record has no ${k}`);
  const forms = field.form.split(/\s*,\s*/);
  for (const fm of forms) if (!CF.forms[fm]) return at(`form "${fm}" is not in design/chart_forms.json`);
  for (const m of src.matchAll(/Templates\.(\w+)\s*\(/g)) if (!forms.includes(m[1])) at(`calls Templates.${m[1]} but the choice record's form does not list it`);
  if (!CF.jobs[field.job]) at(`job "${field.job}" is not in design/chart_forms.json`);
  else if (!CF.forms[forms[0]].jobs.includes(field.job)) at(`form ${forms[0]} does not do the job "${field.job}" (chart_forms.json)`);
  const tier = forms.map((fm) => CF.forms[fm].tier).sort((a, b) => rank(b) - rank(a))[0];
  if (field.tier !== tier) at(`tier "${field.tier}" should be "${tier}" (strictest of ${forms.join(", ")})`);
  if (tier === "specialist" && !/^\w+: \S/.test(field.not || "")) at("a specialist form needs '| not <familiar form>: <reason>'");
  if (rank(tier) >= rank("learnable") && !/[{,]\s*explain\s*[:,}]/.test(src)) at(`a ${tier} form needs an explanation box (explain: in the Frame call)`);
}
for (const f of files) {
  choice(f, readFileSync(f, "utf8"));
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/grammar-ok:/.test(line)) return;
    const code = line.replace(/\/\/.*$/, "");  // comments may mention numbers
    for (const m of code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*\*\s*k\b|\bk\s*\*\s*(\d+(?:\.\d+)?)(?![\w.])/g))
      issues.push(`${relative(process.cwd(), f)}:${i + 1} [spacing] ${m[0]}: use a spacing step (sp/gap) or a grammar.mark token`);
    for (const m of code.matchAll(/["'`]#[0-9A-Fa-f]{3,8}\b/g))
      issues.push(`${relative(process.cwd(), f)}:${i + 1} [colour] ${m[0].slice(1)}: use a theme colour token`);
  });
}
for (const s of issues) console.log(`  ${s}`);
console.log(`${issues.length} issue${issues.length === 1 ? "" : "s"} in ${files.length} file${files.length === 1 ? "" : "s"}`);
process.exitCode = issues.length ? 1 : 0;
