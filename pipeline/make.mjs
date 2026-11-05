// One command for a chart: render every format, lint the SVGs and the source, build a contact
// sheet to look at, and print the visual review the agent (or person) must answer from that image.
//
//   node pipeline/make.mjs <chart> [chart ...] [--format=platforms|all|a,b] [--theme=zerodha] [--dir=charts|sketches] [--out=path]
//   node pipeline/make.mjs --all            every published chart, the platforms' canvases (--format=all: every canvas)
//   node pipeline/make.mjs --test           the regression suite (all outputs + planted-defect fixtures + source lint)
//
// Exit code 0 only when every step passes. The contact sheet lands in pipeline/qa/reports/contact-<chart>.png
// (regenerated debug output; never in output/). A clean exit is necessary, not sufficient: the review
// questions printed at the end are answered by looking at the contact sheet (skills/visual-review).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split("=").slice(1).join("=");
const flag = (name) => args.includes(`--${name}`);
const theme = opt("theme", "zerodha"), dir = opt("dir", "charts"), format = opt("format", "platforms");  // platforms: the canvases formats.json "platforms" use; all: every canvas
const out = opt("out", "") ? resolve(opt("out", "")) : resolve(project, "output", theme);
const run = (cmd, argv, cwd = project) => {
  const r = spawnSync(cmd, argv, { cwd, encoding: "utf8", maxBuffer: 1 << 26 });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
};
const issuesOf = (text) => text.split("\n").filter((l) => /^\s+\S+ \[[a-z]+\]/.test(l));
let failed = false;
const step = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n${detail}` : ""}`); if (!ok) failed = true; };

if (flag("test")) {
  // The checks AGENTS.md lists as must-keep-passing, with their expected counts.
  const base = resolve(project, "output", "zerodha");
  const svgs = readdirSync(base).filter((c) => existsSync(resolve(base, c, "svg")))
    .flatMap((c) => readdirSync(resolve(base, c, "svg")).filter((x) => x.endsWith(".svg")).map((x) => `output/zerodha/${c}/svg/${x}`));
  const all = run("node", ["pipeline/qa/lint.mjs", ...svgs]);
  step(`lint: ${svgs.length} published SVGs clean`, issuesOf(all.out).length === 0, issuesOf(all.out).slice(0, 20).join("\n"));
  for (const [file, want, extra] of [
    ["pipeline/qa/fixtures/planted.svg", 7, ["--theme=editorial"]], ["pipeline/qa/fixtures/planted_space.svg", 6], ["pipeline/qa/fixtures/planted_grammar.svg", 6],
    ["pipeline/qa/fixtures/planted_swarm.svg", 1], ["pipeline/qa/fixtures/planted_spacing.svg", 1],
    ["pipeline/qa/fixtures/planted_headline.svg", 2], ["pipeline/qa/fixtures/planted_caps.svg", 1]]) {
    const n = issuesOf(run("node", ["pipeline/qa/lint.mjs", ...(extra || []), file]).out).length;
    step(`lint fixture ${file.split("/").pop()}: exactly ${want} issues`, n === want, n === want ? "" : `  got ${n}`);
  }
  const bake = "archive/2026-10-27-stack-bakeoff/outputs/editorial/cpi_contrib.svg";
  if (existsSync(resolve(project, bake))) step("lint: bake-off SVG fails brand", issuesOf(run("node", ["pipeline/qa/lint.mjs", bake]).out).some((l) => l.includes("[brand]")));
  const code = run("node", ["pipeline/qa/lint_code.mjs"]);
  step("lint_code: kit, frame, templates, charts", code.code === 0, code.out.trim().split("\n").slice(-6).join("\n"));
  const planted = run("node", ["pipeline/qa/lint_code.mjs", "pipeline/qa/fixtures/planted_code.js"]);
  step("lint_code fixture: exactly 5 issues", /^5 issues/m.test(planted.out));
  const plantedChoice = run("node", ["pipeline/qa/lint_code.mjs", "pipeline/qa/fixtures/planted_choice.js"]);
  step("lint_code choice fixture: exactly 4 issues", /^4 issues/m.test(plantedChoice.out));
  process.exit(failed ? 1 : 0);
}

const charts = flag("all")
  ? readdirSync(resolve(here, "render", dir)).filter((f) => !f.startsWith("_") && f.endsWith(".js")).map((f) => f.replace(".js", ""))
  : args.filter((a) => !a.startsWith("--"));
if (!charts.length) { console.error("usage: node pipeline/make.mjs <chart> [...] | --all | --test"); process.exit(2); }

// 1. Render.
const r = run("node", ["render.mjs", `--theme=${theme}`, `--format=${format}`, `--dir=${dir}`, ...(opt("out", "") ? [`--out=${out}`] : []), ...charts], resolve(here, "render"));
const skipped = r.out.split("\n").filter((l) => /LAYOUT:/.test(l)).map((l) => l.trim());
const errors = r.out.split("\n").filter((l) => /(COPY|ENCODING|FACT|GRAMMAR|Error):/.test(l) && !/LAYOUT:/.test(l)).map((l) => l.trim());
step(`render ${charts.join(", ")} (${format})`, r.code === 0, errors.join("\n"));
if (skipped.length) console.log(`      skipped where the form does not fit (by design):\n      ${skipped.join("\n      ")}`);

// 2. Lint every SVG produced.
const svgs = charts.filter((c) => existsSync(resolve(out, c, "svg")))
  .flatMap((c) => readdirSync(resolve(out, c, "svg")).filter((x) => x.endsWith(".svg")).map((x) => resolve(out, c, "svg", x)));
if (svgs.length) {
  const l = run("node", ["pipeline/qa/lint.mjs", `--theme=${theme}`, ...svgs]);
  const iss = issuesOf(l.out);
  step(`lint ${svgs.length} SVGs`, iss.length === 0, iss.join("\n"));
} else step("lint", false, "  nothing was rendered");

// 3. Lint the source (kit, frame, templates, charts).
const c = run("node", ["pipeline/qa/lint_code.mjs"]);
step("lint_code", c.code === 0, c.code ? c.out.trim() : "");

// 4. Contact sheet per chart: every format side by side, for the visual review.
const reports = resolve(here, "qa", "reports");
if (!existsSync(reports)) mkdirSync(reports, { recursive: true });
const { chromium } = await import("./render/node_modules/playwright/index.mjs");
const browser = await chromium.launch({ channel: process.env.ZVIZ_CHROME === "bundled" ? undefined : "chrome" }).catch(() => chromium.launch());
for (const chart of charts) {
  // One card per canvas (platforms sharing a canvas are the same image): the first PNG for each SVG master.
  const dirC = resolve(out, chart);
  const pngs = existsSync(dirC) ? readdirSync(dirC).filter((x) => x.endsWith(".png")) : [];
  const seen = new Set();
  const imgs = pngs.filter((x) => { const k = x.match(/_(\d+x\d+)\.png$/)?.[1]; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((x) => ({ f: x.slice(chart.length + 1, -4), src: resolve(dirC, x) }));
  if (!imgs.length) continue;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f2f2f2;font:16px system-ui;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;width:3200px}
    figure{margin:0;background:#fff;padding:8px}img{height:520px;display:block}figcaption{color:#555;margin-top:6px}</style>
    ${imgs.map((i) => `<figure><img src="file://${i.src}"><figcaption>${i.f}</figcaption></figure>`).join("")}`;
  const tmp = resolve(reports, `contact-${chart}.html`);
  writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: 3248, height: 800 } });
  await page.goto(`file://${tmp}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(reports, `contact-${chart}.png`), fullPage: true });
  await page.close();
  console.log(`      contact sheet: ${resolve(reports, `contact-${chart}.png`)}`);
}
await browser.close();

// 5. The review lint cannot do. Answer each from the contact sheet; fix and re-run on any "no".
console.log(`
VISUAL REVIEW (skills/visual-review/SKILL.md): open each contact sheet and answer, per format:
  1. Five-second test: does the chart alone say what the headline says?
  2. Is the hero the loudest thing, and is nothing else competing (colour, weight, size)?
  3. Does every label sit unambiguously beside the one mark it names?
  4. Is any area of the plot empty while marks are cramped elsewhere?
  5. Are the axis ranges honest (zero where the measure needs it; log scale named in the dek)?
  6. Does the copy name only what the chart draws, and every number trace to facts.json?
  7. Would an FT or Bloomberg graphics editor publish it as is? If not, what would they change first?`);
process.exit(failed ? 1 : 0);
