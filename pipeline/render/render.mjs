// Render D3 charts in headless Chrome.
//   node render.mjs [--theme=zerodha] [--format=instagram_portrait|all|a,b] [--dir=charts] [--out=path] [chart ...]
// --dir picks the folder of chart specs (charts/ is the published set; sketches/ holds alternatives);
// --out sends everything to another folder (use the session scratchpad for sketches, never output/).
// Writes one folder per chart, output/<theme>/<chart>/: a PNG per platform named <chart>_<platform>_<W>x<H>.png
// (formats.json "platforms"; a format no platform uses is named by the format), caption.md (headline, dek,
// notes, source, alt text), and svg/<format>.svg (the vector master each PNG was rendered from).
// Also output/<theme>/index.html (gallery). --format=platforms (default) renders the canvases the
// platforms use; --format=all every canvas; --format=a,b those.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FORMATS, PLATFORMS, tokensFor, fontFaceCSS } from "./tokens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split("=")[1];
const themeName = opt("theme", "zerodha");
const fmtOpt = opt("format", "platforms");
const platformFormats = [...new Set(Object.values(PLATFORMS).map((p) => p.format))];
const formatIds = fmtOpt === "all" ? Object.keys(FORMATS) : fmtOpt === "platforms" ? platformFormats : fmtOpt.split(",");
// File names for a canvas: one per platform that uses it, else the canvas name.
const namesFor = (fid) => { const ps = Object.entries(PLATFORMS).filter(([, p]) => p.format === fid).map(([slug]) => slug); return ps.length ? ps : [fid]; };
const pngName = (chart, slug, fid) => `${chart}_${slug}_${FORMATS[fid].width}x${FORMATS[fid].height}.png`;
const read = (p) => readFileSync(resolve(root, p), "utf8");
// Every tidy table, as CSV text under its file name; plus facts and the map geometry.
const data = Object.fromEntries(readdirSync(resolve(root, "data/tidy")).filter((f) => f.endsWith(".csv"))
  .map((f) => [f.replace(".csv", ""), read(`data/tidy/${f}`)]));
data.india = JSON.parse(read("design/geo/india_states_dissolved.geojson"));
data.facts = JSON.parse(read("data/tidy/facts.json"));
const chartDir = `${here}/${opt("dir", "charts")}`;

const charts = args.filter((a) => !a.startsWith("--")).length
  ? args.filter((a) => !a.startsWith("--"))
  : readdirSync(chartDir).filter((f) => !f.startsWith("_") && f.endsWith(".js")).map((f) => f.replace(".js", ""));
// Shared code: kit (marks, axes, labels, assertions), then templates (one per chart form), then chart helpers.
const helpers = ["kit.js", ...readdirSync(`${here}/templates`).filter((f) => f.endsWith(".js")).map((f) => `templates/${f}`),
  ...readdirSync(`${here}/charts`).filter((f) => f.startsWith("_")).map((f) => `charts/${f}`)];
// Final charts live outside the pipeline, in <project>/output/<theme>/.
const themeDir = opt("out", "") ? resolve(opt("out", "")) : resolve(root, "..", "output", themeName);
if (!existsSync(themeDir)) mkdirSync(themeDir, { recursive: true });
const chartDirOut = (name) => { const d = `${themeDir}/${name}`; for (const x of [d, `${d}/svg`]) if (!existsSync(x)) mkdirSync(x, { recursive: true }); return d; };

// System Chrome when present (exact match with the reference renders), else Playwright's bundled Chromium
// (npx playwright install chromium). ZVIZ_CHROME=bundled forces the bundled one.
const browser = await chromium.launch({ channel: process.env.ZVIZ_CHROME === "bundled" ? undefined : "chrome" }).catch(() => chromium.launch());
const failures = [], skipped = [], metas = new Map();
for (const formatId of formatIds) {
  const tokens = tokensFor(themeName, formatId);
  const page = await browser.newPage({
    viewport: { width: tokens.canvas.width, height: tokens.canvas.height },
    deviceScaleFactor: tokens.canvas.scale,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const name of charts) {
    errors.length = 0;
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCSS(tokens)}
      body{margin:0} svg{display:block}</style></head><body></body></html>`);
    await page.addScriptTag({ path: `${here}/node_modules/d3/dist/d3.min.js` });
    // Fonts must be loaded before any text is measured.
    await page.evaluate(async (fonts) => {
      await Promise.all(fonts.map((f) => document.fonts.load(`${f.weight} 20px "${f.family}"`)));
    }, tokens.fonts);
    await page.addScriptTag({ path: `${here}/frame.js` });
    for (const h of helpers) await page.addScriptTag({ path: `${here}/${h}` });
    await page.addScriptTag({ path: `${chartDir}/${name}.js` });
    try {
      await page.evaluate(({ tokens, data }) => window.draw({ tokens, data }), { tokens, data });
      // Copy that names a visual device (dashed, outline, shaded, hatched) must describe something the
      // chart draws: a mark tagged data-device (theme grammar.devices maps each word to its evidence).
      const bad = await page.evaluate((devices) => {
        const m = window.__meta || {};
        const copy = [m.headline, m.dek, m.explain, ...(m.notes || []), ...(m.notesShown || [])].filter(Boolean).join(" ");
        return Object.entries(devices || {}).filter(([w, sel]) => !w.startsWith("_") && new RegExp(`\\b${w}`, "i").test(copy) && !document.querySelector(`svg ${sel}`)).map(([w]) => w);
      }, tokens.grammar?.devices);
      if (bad.length) errors.push(`COPY: the copy mentions "${bad.join('", "')}" but the chart draws no such mark`);
      // Plain headlines (theme grammar.headline): every variant, so a short variant cannot smuggle in a colon.
      const HR = tokens.grammar?.headline;
      if (HR) {
        const heads = await page.evaluate(() => (window.__meta || {}).headlines || []);
        for (const h of heads) {
          const words = h.split(/\s+/).filter(Boolean).length;
          const why = [words > HR.max_words && `${words} words, max ${HR.max_words}`,
            ...(HR.no_start || []).filter((w) => h.startsWith(w)).map((w) => `starts "${w.trim()}"`),
            ...(HR.no_chars || []).filter((c) => h.includes(c)).map((c) => `contains "${c}"`)].filter(Boolean);
          if (why.length) errors.push(`COPY: headline "${h}" is not plain (${why.join(", ")}); move detail to the dek`);
        }
      }
    } catch (e) { errors.push(e.message.split("\n")[0]); }
    if (errors.length) {
      // A chart that does not fit a format is skipped, and any stale output from earlier runs removed.
      rmSync(`${themeDir}/${name}/svg/${formatId}.svg`, { force: true });
      for (const slug of namesFor(formatId)) rmSync(`${themeDir}/${name}/${pngName(name, slug, formatId)}`, { force: true });
      (errors.join(" ").includes("LAYOUT:") ? skipped : failures).push(`${formatId}/${name}: ${errors.join("; ").replace(/^page.evaluate: Error: /, "")}`);
      continue;
    }
    const svg = await page.$eval("svg", (n) => n.outerHTML);
    const dir = chartDirOut(name);
    writeFileSync(`${dir}/svg/${formatId}.svg`, svg);
    // Rendered once per canvas; platforms that share the canvas get a copy under their own name.
    const [first, ...rest] = namesFor(formatId);
    await (await page.$("svg")).screenshot({ path: `${dir}/${pngName(name, first, formatId)}` });
    for (const slug of rest) copyFileSync(`${dir}/${pngName(name, first, formatId)}`, `${dir}/${pngName(name, slug, formatId)}`);
    if (!metas.has(name)) metas.set(name, await page.evaluate(() => window.__meta));  // fullest copy: same on every canvas
    console.log(`rendered ${themeName}/${formatId}/${name}`);
  }
  await page.close();
}
await browser.close();

// Captions: post copy, alt text, and the files that exist for each platform (a skipped canvas has none).
const label = (slug) => PLATFORMS[slug]?.label || `${slug} (${FORMATS[slug]?.used_for?.[0] || "extra canvas"})`;
const slugOf = (chart, file) => file.slice(chart.length + 1).replace(/_\d+x\d+\.png$/, "");
const order = (chart, f) => { const i = Object.keys(PLATFORMS).indexOf(slugOf(chart, f)); return i < 0 ? 99 : i; };  // platform order, extras last
const pngsOf = (chart) => readdirSync(`${themeDir}/${chart}`).filter((x) => x.endsWith(".png")).sort((a, b) => order(chart, a) - order(chart, b) || a.localeCompare(b));
for (const [name, m] of metas) {
  const files = pngsOf(name).map((f) => `- ${label(slugOf(name, f))}: \`${f}\``).join("\n");
  writeFileSync(`${themeDir}/${name}/caption.md`,
    `# ${m.headline}\n\n${m.dek}\n\n${m.explain ? `${m.explain}\n\n` : ""}${m.notes.join("\n\n")}${m.notes.length ? "\n\n" : ""}Source: ${m.source}\n\n` +
    `Alt text: Chart. ${m.headline}. ${m.dek}\n\n## Files\n\n${files}\n`);
}

// Gallery: one row per chart folder, one card per platform file.
const allCharts = readdirSync(themeDir).filter((d) => existsSync(`${themeDir}/${d}/svg`)).sort();
const stamp = Date.now();  // cache-buster: a re-render shows new images without a hard refresh
const card = (c, f) => {
  const slug = slugOf(c, f), fid = PLATFORMS[slug]?.format || slug, F0 = FORMATS[fid] || {}, sf = F0.safe, pc = (v) => `${(100 * v) / F0.height}%`;
  const ui = sf ? `<div class="ui" style="top:0;height:${pc(sf.top)}">profile row</div><div class="ui" style="bottom:0;height:${pc(sf.bottom)}">reply bar</div>` : "";
  return `<figure><a class="shot" href="${c}/${f}?v=${stamp}" style="display:block"><img src="${c}/${f}?v=${stamp}">${ui}</a><figcaption>${label(slug)}<br>${F0.width}×${F0.height} · ${f}</figcaption></figure>`;
};
writeFileSync(`${themeDir}/index.html`, `<!doctype html><meta charset="utf-8"><title>${themeName} charts</title>
<style>body{font:14px system-ui;margin:24px;background:#f5f5f7}h2{margin:32px 0 4px}h2 a{font-size:13px;font-weight:400;margin-left:12px;color:#387ED1}.row{display:flex;gap:16px;align-items:flex-start;overflow-x:auto}
figure{margin:0;background:#fff;padding:8px;border:1px solid #e7e7e7;border-radius:8px}img{height:360px;display:block}figcaption{color:#666;margin-top:6px}
.shot{position:relative}.ui{position:absolute;left:0;right:0;background:rgba(20,20,20,.55);color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;pointer-events:none}
body:not(.chrome) .ui{display:none}label.t{display:block;margin:8px 0;color:#444}</style>
<label class="t"><input type="checkbox" checked onchange="document.body.classList.toggle('chrome',this.checked)"> Show the platform's own interface over the safe zones (story: profile row on top, reply bar below), as a phone shows them</label>
<script>document.body.classList.add("chrome")</script>
${allCharts.map((c) => `<h2>${c}<a href="${c}/caption.md">caption and alt text</a></h2><div class="row">${pngsOf(c).map((f) => card(c, f)).join("")}</div>`).join("\n")}`);
if (skipped.length) console.log(`\n${skipped.length} skipped (does not fit the format):\n  ${skipped.join("\n  ")}`);
if (failures.length) {
  console.error(`\n${failures.length} failed:\n  ${failures.join("\n  ")}`);
  process.exitCode = 1;
}
