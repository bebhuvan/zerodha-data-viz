// Stack-agnostic chart linter: node pipeline/qa/lint.mjs [--theme=zerodha] output/zerodha/*/svg/*.svg
// The format comes from the SVG's data-format attribute (else its folder name); unknown ones are linted
// as instagram_portrait.
// Loads each SVG in headless Chrome with the design-system fonts and checks:
//   overlap   text boxes that collide with other text
//   strike    text crossed by a stroked line (leader lines, series lines)
//   straddle  text partly on, partly off a filled mark (a bar edge, a region); text wholly inside a tile is fine
//   bounds    text outside the canvas safe area
//   minfont   text smaller than the minimum size
//   contrast  text vs what is under it (a mark it sits inside, or the surface): WCAG 4.5:1, or 3:1 for large/bold
//   numbers   every decimal number shown must match a fact in data/tidy/facts.json
//   brand     theme rules: approved fonts and text colours, max type sizes/weights, no all-caps
//             styling, logo present with its clear space free of other text and lines
//   space     use of the canvas (thresholds in theme rules.space, per-format overrides in formats.json):
//             chart share of canvas (area when stacked, width when side), header share of height,
//             outer margins equal and 4.5-7.5% of the short side, no empty band wider than one dek line,
//             no gutter beside the marks that holds a single label. A chart whose footprint is the shape
//             of its data (svg data-fill="shape", e.g. a beeswarm) skips the area minimum and the bands
//             inside the chart; margins and the bands around the chart still apply. Bars (rect.bar) must
//             fill at least bar_fill_min of their row or column pitch (no bars floating in air).
//   headline  clamping: in a headline tagged data-role="headline" data-col=<column px>, no line ends where
//             the next line's first word would have fitted (the measure was narrowed, which reads as
//             clamped), and the last line holds two words or more (no widow).
//   crop      text outside a platform's preview crop (formats.json crops, e.g. Instagram's 3:4 grid)
//   grammar   the visual grammar (theme 'grammar' and 'type'; skipped for themes without one):
//             every text is a type role (size, weight, colour; white allowed on a fill); chart text with
//             digits uses tabular figures; chart marks use only grammar inks or series colours (binned
//             ramps marked data-ramp excepted); ticks on a data-axis cover the data (no end of the data
//             more than half a step past the outermost tick, at least ticks_min ticks); copy that names a
//             device (dashed, outline, shaded, hatched) has a mark tagged with it; header, chart and
//             footer are at least the section_min gap apart.
//   style     house style (theme 'marks' and rules.style): every chart stroke is one of the theme's
//             weights; numbers use a true minus (U+2212), never a hyphen; at most N highlight hues
//             among the data marks (greys and binned ramps marked data-ramp do not count)
// Writes pipeline/qa/reports/<format>-<chart>.json and a debug PNG with problems boxed in red.
import { chromium } from "../render/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { cpus } from "node:os";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { FORMATS, tokensFor } from "../render/tokens.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const themeName = (argv.find((a) => a.startsWith("--theme=")) || "--theme=zerodha").split("=")[1];
const base = tokensFor(themeName, "instagram_portrait");
const files = argv.filter((a) => !a.startsWith("--"));
const facts = JSON.parse(readFileSync(`${root}/data/tidy/facts.json`, "utf8"));
const factValues = [];
(function walk(v) {
  if (typeof v === "number") factValues.push(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
})(facts);

// The theme's fonts, under canonical names and the per-weight aliases R needs.
const fontCSS = base.fonts.flatMap((f) => {
  const src = `url(data:font/ttf;base64,${readFileSync(`${root}/design/fonts/${f.file}`).toString("base64")})`;
  return [`@font-face{font-family:"${f.family}";font-weight:${f.weight};src:${src}}`,
          `@font-face{font-family:"${f.family} W${f.weight}";src:${src}}`];
}).join("\n");

const browser = await chromium.launch({ channel: process.env.ZVIZ_CHROME === "bundled" ? undefined : "chrome" }).catch(() => chromium.launch());
// Files are linted concurrently, each on its own page in one browser (a page per file keeps every
// check independent); results are reported in the order the files were given.
async function lintOne(file) {
  // The canvas: the SVG's own data-format, else its folder name (old layout), else instagram_portrait.
  const tagged = (readFileSync(file, "utf8").slice(0, 4000).match(/<svg[^>]*data-format="([^"]+)"/) || [])[1];
  const stack = FORMATS[tagged] ? tagged : basename(dirname(file));
  const T = tokensFor(themeName, FORMATS[stack] ? stack : "instagram_portrait");
  const page = await browser.newPage({ viewport: { width: T.canvas.width, height: T.canvas.height } });
  // output/<theme>/<chart>/svg/<format>.svg names the chart by its folder; older layouts by the file.
  const chart = basename(dirname(file)) === "svg" ? basename(dirname(dirname(file))) : basename(file, ".svg");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontCSS}
    body{margin:0} svg{display:block}</style></head><body>${readFileSync(file, "utf8")}</body></html>`);
  // Normalise size: svglite writes width in pt, which browsers scale by 4/3.
  await page.evaluate(([W, H]) => {
    const s = document.querySelector("svg");
    s.setAttribute("width", W); s.setAttribute("height", H);
  }, [T.canvas.width, T.canvas.height]);
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(({ grammar, roles, colors, marks, kk, rules, W, H, facts, surface, logo, fmt }) => {
    const svg = document.querySelector("svg");
    // Units of text: tspans when a text element has them, else the text element.
    const units = [];
    for (const t of svg.querySelectorAll("text")) {
      const spans = t.querySelectorAll(":scope > tspan");
      for (const n of spans.length ? spans : [t]) {
        const s = n.textContent.trim();
        if (!s) continue;
        const r = n.getBoundingClientRect();
        if (!r.width) continue;
        const fs = parseFloat(getComputedStyle(n).fontSize) * (n.getScreenCTM()?.a || 1);
        // Shrink the em box toward the glyphs: ascent/descent padding is not ink.
        units.push({ s, fs, node: n, box: { l: r.left + 0.5, r: r.right - 0.5, t: r.top + r.height * 0.2, b: r.bottom - r.height * 0.15 } });
      }
    }
    const issues = [];
    const d3m = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : 0; };  // median
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    probe.setAttribute("fill", surface); svg.append(probe);
    const surfaceRGB = getComputedStyle(probe).fill.replace(/\s/g, ""); probe.remove();
    const lum = (c) => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const GAP = 2; // text must clear other text by this much
    const hit = (a, b) => a.l - GAP < b.r && b.l - GAP < a.r && a.t - GAP < b.b && b.t - GAP < a.b;
    const isBackground = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height > 0.6 * W * H; };
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        if (hit(units[i].box, units[j].box)) issues.push({ check: "overlap", text: `${units[i].s} × ${units[j].s}`, box: units[i].box });
      }
    }
    const inset = rules.safe_inset_px;
    for (const u of units) {
      if (u.box.l < inset || u.box.r > W - inset || u.box.t < inset || u.box.b > H - inset)
        issues.push({ check: "bounds", text: u.s, box: u.box });
      if (u.fs < rules.min_font_px - 0.01) issues.push({ check: "minfont", text: `${u.s} (${u.fs.toFixed(1)}px)`, box: u.box });
      // Sample the glyph box densely. Stroked unfilled lines under it are strike-throughs;
      // a filled mark under some samples but not others is a straddle.
      const struck = new Set();
      const fillHits = new Map();
      let samples = 0;
      const nx = Math.max(4, Math.ceil((u.box.r - u.box.l) / 3)), ny = 4;
      for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
        const x = u.box.l + (u.box.r - u.box.l) * (ix + 0.5) / nx, y = u.box.t + (u.box.b - u.box.t) * (iy + 0.5) / ny;
        samples++;
        // Topmost first; an opaque surface-coloured shape (a label knockout) hides what is beneath it.
        for (const el of document.elementsFromPoint(x, y)) {
          if (!["path", "line", "polyline", "polygon", "rect", "circle"].includes(el.tagName) || isBackground(el)) continue;
          const cs = getComputedStyle(el);
          if (el.classList.contains("knockout")) break;
          const unfilled = cs.fill === "none" || cs.fillOpacity === "0" || el.tagName === "line" || el.tagName === "polyline";
          if (unfilled) {
            if (cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0 && cs.strokeOpacity !== "0") struck.add(el);
          } else if (cs.fill.replace(/\s/g, "") !== surfaceRGB) {  // surface-coloured panels are not marks
            fillHits.set(el, (fillHits.get(el) || 0) + 1);
          }
        }
      }
      let under = surfaceRGB;
      for (const [el, n] of fillHits) {
        if (n < samples * 0.98) { issues.push({ check: "straddle", text: `${u.s} over <${el.tagName}>`, box: u.box }); break; }
        if (!getComputedStyle(el).fill.startsWith("url")) under = getComputedStyle(el).fill.replace(/\s/g, "");
      }
      const ink = getComputedStyle(u.node).fill;
      const ratio = contrast(ink, under);
      const large = u.fs >= 24 || (u.fs >= 18.66 && parseInt(getComputedStyle(u.node).fontWeight) >= 600);
      if (ratio < (large ? 3 : 4.5)) issues.push({ check: "contrast", text: `${u.s} ${ratio.toFixed(2)}:1`, box: u.box });
      if (struck.size) issues.push({ check: "strike", text: u.s, box: u.box });
    }
    // Number tracing. Decimals only: integers are ticks and years.
    for (const u of units) {
      for (const m of u.s.replace(/−/g, "-").matchAll(/[-+]?\d+\.(\d+)/g)) {
        const v = parseFloat(m[0]), tol = 0.5 * 10 ** -m[1].length + 1e-9;
        if (!facts.some((f) => Math.abs(Math.abs(f) - Math.abs(v)) <= tol && Math.sign(f || 1) === Math.sign(v || 1) || Math.abs(f - v) <= tol))
          issues.push({ check: "numbers", text: `${m[0]} in "${u.s}" matches no fact`, box: u.box });
      }
    }
    // Brand rules from the theme.
    const B = rules.brand;
    if (B) {
      const norm = (c) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "rect"); p.setAttribute("fill", c); svg.append(p);
        const v = getComputedStyle(p).fill.replace(/\s/g, ""); p.remove(); return v; };
      const okColors = new Set(B.text_colors.map(norm));
      const sizes = new Set(), weights = new Set();
      for (const u of units) {
        const cs = getComputedStyle(u.node);
        const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").replace(/ W\d+$/, "").trim();
        if (!B.fonts.includes(fam)) issues.push({ check: "brand", text: `${u.s}: font ${fam}`, box: u.box });
        if (!okColors.has(cs.fill.replace(/\s/g, ""))) issues.push({ check: "brand", text: `${u.s}: text colour ${cs.fill}`, box: u.box });
        sizes.add(Math.round(u.fs)); weights.add(parseInt(cs.fontWeight));
        // All-caps styling: a word of 6+ capital letters, or uppercase via CSS. Short acronyms (CPI, MOSPI, KL) are fine,
        // and so are longer ones the theme lists in brand.acronyms (EBITDA): names of measures, not styling.
        const caps = (u.s.match(/\b[A-Z]{6,}\b/g) || []).filter((w) => !(B.acronyms || []).includes(w));
        if (B.no_all_caps && (caps.length || cs.textTransform === "uppercase"))
          issues.push({ check: "brand", text: `${u.s}: all caps`, box: u.box });
      }
      // Sizes within the guide's ±4px adjustment of a core size count as that size.
      const tol = B.size_step_tolerance || 0, steps = [];
      for (const z of [...sizes].sort((a, b) => b - a)) if (!steps.some((c) => c - z <= tol)) steps.push(z);
      sizes.clear(); steps.forEach((z) => sizes.add(z));
      if (sizes.size > B.max_sizes) issues.push({ check: "brand", text: `${sizes.size} type sizes (${[...sizes].sort((a, b) => a - b).join(", ")}px), max ${B.max_sizes}`, box: { l: 0, r: 0, t: 0, b: 0 } });
      if (weights.size > B.max_weights) issues.push({ check: "brand", text: `${weights.size} weights (${[...weights].join(", ")}), max ${B.max_weights}`, box: { l: 0, r: 0, t: 0, b: 0 } });
      if (B.logo_required) {
        const lg = svg.querySelector("g.logo");
        if (!lg) issues.push({ check: "brand", text: "logo missing", box: { l: 0, r: 0, t: 0, b: 0 } });
        else {
          const r = lg.getBoundingClientRect();
          const clear = 2 * logo.gap_units * (logo.height / logo.viewbox_height);
          const zone = { l: r.left - clear, r: r.right + clear, t: r.top - clear, b: r.bottom + clear };
          for (const u of units) if (hit(u.box, zone)) issues.push({ check: "brand", text: `${u.s}: inside logo clear space`, box: u.box });
          for (const el of svg.querySelectorAll("line, path, rect, polyline")) {
            if (lg.contains(el) || isBackground(el)) continue;
            const e = el.getBoundingClientRect();
            if (e.width + e.height > 0 && hit({ l: e.left, r: e.right, t: e.top, b: e.bottom }, zone))
              issues.push({ check: "brand", text: `<${el.tagName}> inside logo clear space`, box: { l: e.left, r: e.right, t: e.top, b: e.bottom } });
          }
        }
      }
    }
    // Use of space. Every visible element is classed header (g.frame-head), footer (g.frame-foot)
    // or chart (everything else); boxes are unioned per class.
    const S = rules.space, F = fmt;
    const metrics = {};
    if (S && svg.querySelector("g.frame-head")) {
      const vis = [];
      for (const el of svg.querySelectorAll("text, path, rect, line, circle, polygon, polyline, ellipse")) {
        if (el.closest("defs") || isBackground(el) || (el.tagName !== "text" && el.closest("text"))) continue;
        const cs = getComputedStyle(el);
        if (el.tagName !== "text" && cs.fill === "none" && cs.stroke === "none") continue;
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const box = el.tagName === "text"
          ? units.filter((u) => el.contains(u.node)).reduce((b, u) => b ? { l: Math.min(b.l, u.box.l), r: Math.max(b.r, u.box.r), t: Math.min(b.t, u.box.t), b: Math.max(b.b, u.box.b) } : { ...u.box }, null)
          : { l: r.left, r: r.right, t: r.top, b: r.bottom };
        if (!box) continue;
        const part = el.closest("g.frame-head") ? "head" : el.closest("g.frame-foot") ? "foot" : "chart";
        vis.push({ el, box, part, text: el.tagName === "text" });
      }
      const union = (xs) => xs.reduce((b, v) => b ? { l: Math.min(b.l, v.box.l), r: Math.max(b.r, v.box.r), t: Math.min(b.t, v.box.t), b: Math.max(b.b, v.box.b) } : { ...v.box }, null);
      const ink = union(vis), head = union(vis.filter((v) => v.part === "head")), chart = union(vis.filter((v) => v.part === "chart"));
      const flag = (text, box = { l: 0, r: 0, t: 0, b: 0 }) => issues.push({ check: "space", text, box });
      const short = Math.min(W, H), safe = F.safe || {};
      const side = (svg.getAttribute("data-layout") || F.layout) === "side";  // the frame may stack a landscape canvas
      const ov = F.space || {};
      if (chart) {
        metrics.chart_area = +((chart.r - chart.l) * (chart.b - chart.t) / (W * H)).toFixed(3);
        metrics.chart_width = +((chart.r - chart.l) / W).toFixed(3);
        const usable = (H - (safe.top || 0) - (safe.bottom || 0)) / H;  // safe zones are not usable canvas
        const fixed = svg.getAttribute("data-fixed-aspect") === "1";
        const pa = (svg.getAttribute("data-plot") || "").split(" ").map(Number);
        metrics.chart_height = +((chart.b - chart.t) / H).toFixed(3);
        if (fixed && pa.length === 4) {
          // Maps and tile grids keep their shape: they must fill their plot box in at least one dimension.
          const fill = Math.max((chart.r - chart.l) / pa[2], (chart.b - chart.t) / pa[3]);
          metrics.fixed_fill = +fill.toFixed(3);
          if (fill < S.fixed_aspect_fill_min) flag(`fixed-shape chart fills ${(fill * 100).toFixed(0)}% of its plot, want ≥${S.fixed_aspect_fill_min * 100}%`, chart);
        } else if (svg.getAttribute("data-fill") === "shape") {
          // footprint follows the data's shape: no area minimum
        } else if (side) {
          const min = ov.chart_width_min ?? S.side_chart_width_min;
          if (metrics.chart_width < min) flag(`chart is ${(metrics.chart_width * 100).toFixed(0)}% of width, want ≥${min * 100}%`, chart);
        } else {
          const min = (ov.chart_area_min ?? S.stack_chart_area_min) * usable;
          if (metrics.chart_area < min) flag(`chart is ${(metrics.chart_area * 100).toFixed(0)}% of canvas, want ≥${(min * 100).toFixed(0)}%`, chart);
        }
      }
      if (head && !side) {
        metrics.header_height = +((head.b - head.t) / H).toFixed(3);
        const max = (ov.header_height_max ?? S.stack_header_max) * (H - (safe.top || 0) - (safe.bottom || 0)) / H;
        if (metrics.header_height > max) flag(`header is ${(metrics.header_height * 100).toFixed(0)}% of height, want ≤${(max * 100).toFixed(0)}%`, head);
      }
      if (ink) {
        const m = { left: ink.l, right: W - ink.r, top: ink.t - (safe.top || 0), bottom: H - ink.b - (safe.bottom || 0) };
        metrics.margins = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +(v / short).toFixed(3)]));
        for (const [side_, v] of Object.entries(m)) {
          // A safe zone (story UI) is the margin on its edge: nothing may enter it (2px for glyph rounding).
          if (safe[side_]) { if (v < -2) flag(`${side_}: ink ${Math.round(-v)}px inside the ${side_} safe zone`); continue; }
          const minM = S.margin_min, maxM = S.margin_max;
          if (v / short < minM - 1e-3 || v / short > maxM + 1e-3) flag(`${side_} margin ${(v / short * 100).toFixed(1)}% of short side, want ${S.margin_min * 100}-${maxM * 100}%`);
        }
        const vals = Object.entries(m).filter(([side_]) => !safe[side_]).map(([, v]) => v);  // safe-zone edges are fixed by the platform
        if ((Math.max(...vals) - Math.min(...vals)) / short > S.margin_tolerance) flag(`margins unequal: ${vals.map((v) => Math.round(v)).join("/")}px (l/r/t/b)`);
      }
      // Empty bands: project boxes onto the stacking axis and find gaps. Side layouts are checked
      // across their width (header column vs chart) and down the chart; the header column's gap above
      // the source is deliberate (the footer anchors to the bottom).
      const gaps = (list, axis, lo, hi) => {
        const iv = list.map((v) => axis === "y" ? [v.box.t, v.box.b] : [v.box.l, v.box.r]).sort((a, b) => a[0] - b[0]);
        const out = []; let end = lo;
        for (const [a, b] of iv) { if (a - end > 0) out.push([end, a]); end = Math.max(end, b); }
        if (hi - end > 0) out.push([end, hi]);
        return out;
      };
      const band = S.band_max_lines * rules.dek_line;
      const pl = (svg.getAttribute("data-plot") || "").split(" ").map(Number);
      const gys = [...new Set([...svg.querySelectorAll("g.axis.y line")].map((l) => Math.round(l.getBoundingClientRect().top)))].sort((p, q) => p - q);
      const axisStep = gys.length > 1 ? Math.min(...gys.slice(1).map((v, i) => v - gys[i])) : 0;
      metrics.widest_band = 0;
      const checkBands = (list, axis, lo, hi, where) => {
        for (const [a, b] of gaps(list, axis, lo, hi)) {
          metrics.widest_band = Math.max(metrics.widest_band, +((b - a) / (axis === "y" ? H : W)).toFixed(3));
          // Ranked layouts (bump charts) declare their row pitch: a gap of one rank row inside the chart is a slot, not waste.
          const pitch = +svg.getAttribute("data-row-pitch") || 0;
          let limit = pitch && chart && a >= chart.t - 1 && b <= chart.b + 1 ? Math.max(band, pitch * 1.05) : band;
          // Y axes stretch up to a full tick step to reach a covering round tick (grammar.axis y_cover), so
          // the data never runs past a gridline; air of up to that step between data and end gridline is by design.
          if (axisStep && pl.length === 4 && a >= pl[1] - 1 && b <= pl[1] + pl[3] + 1) limit = Math.max(limit, axisStep * (grammar?.axis?.y_cover ?? grammar?.axis?.stretch_max ?? 0.5) + rules.min_font_px);
          if (b - a > limit) flag(`empty ${axis === "y" ? "horizontal" : "vertical"} band ${Math.round(b - a)}px at ${Math.round(a)}–${Math.round(b)} ${where}, want ≤${Math.round(band)}px`,
            axis === "y" ? { l: ink.l, r: ink.r, t: a, b } : { l: a, r: b, t: ink.t, b: ink.b });
        }
      };
      const shape = svg.getAttribute("data-fill") === "shape";
      const solid = shape && chart ? [...vis.filter((v) => v.part !== "chart"), { box: chart }] : vis;  // gaps in the data are not wasted layout
      if (ink && !side) checkBands(solid, "y", ink.t, ink.b, "");
      // Side layouts: only inside the chart. The gutter between header column and chart is deliberate.
      if (ink && side && chart && !shape) checkBands(vis.filter((v) => v.part === "chart"), "y", chart.t, chart.b, "in the chart");
      // A beeswarm (data-swarm v|h) must spread across at least swarm_cross_min of its plot's cross axis:
      // the shape exemption covers the distribution's outline, not a thin column in a wide box.
      const sw = svg.getAttribute("data-swarm");
      const dots = [...svg.querySelectorAll(".chart.beeswarm circle")].map((el) => el.getBoundingClientRect());
      if (sw && dots.length && pl.length === 4) {
        const ext = sw === "v" ? Math.max(...dots.map((b) => b.right)) - Math.min(...dots.map((b) => b.left)) : Math.max(...dots.map((b) => b.bottom)) - Math.min(...dots.map((b) => b.top));
        metrics.swarm_cross = +(ext / (sw === "v" ? pl[2] : pl[3])).toFixed(3);
        if (metrics.swarm_cross < (S.swarm_cross_min ?? 0.4)) flag(`swarm spans ${(metrics.swarm_cross * 100).toFixed(0)}% of the plot across its value axis, want ≥${(S.swarm_cross_min ?? 0.4) * 100}%`, chart);
      }
      // Bars that float in their slots: thickness over slot pitch, for bar and column charts (rect.bar).
      const bars = [...svg.querySelectorAll(".chart rect.bar")].map((el) => el.getBoundingClientRect());
      if (bars.length >= 3) {
        const spread = (f) => Math.max(...bars.map(f)) - Math.min(...bars.map(f));
        const rowsAxis = spread((b) => b.top + b.height / 2) > spread((b) => b.left + b.width / 2);  // stacked down the page
        const centres = [...new Set(bars.map((b) => Math.round(rowsAxis ? b.top + b.height / 2 : b.left + b.width / 2)))].sort((a, b) => a - b);
        const thick = d3m(bars.map((b) => (rowsAxis ? b.height : b.width)));
        const pitch = d3m(centres.slice(1).map((c, i) => c - centres[i]));
        if (pitch > 0) {
          metrics.bar_fill = +(thick / pitch).toFixed(3);
          if (metrics.bar_fill < S.bar_fill_min) flag(`bars fill ${(metrics.bar_fill * 100).toFixed(0)}% of their ${rowsAxis ? "rows" : "columns"}, want ≥${S.bar_fill_min * 100}%`, chart);
        }
      }
      // Gutters: strips between the data marks and the edge of the chart area that hold a single
      // label (legends excluded: an inset legend sits in space the marks do not use anyway).
      const own = vis.filter((v) => v.part === "chart" && !v.el.closest("g.legend"));
      const ownBox = union(own);
      if (ownBox && svg.getAttribute("data-fixed-aspect") !== "1") {  // spare width beside a map is not a wasted gutter
        const marks = union(own.filter((v) => !v.text && (v.box.r - v.box.l) * (v.box.b - v.box.t) > 4));
        if (marks) for (const [l, r, where] of [[ownBox.l, marks.l, "left"], [marks.r, ownBox.r, "right"]]) {
          if (r - l < S.gutter_min * W) continue;
          const touching = own.filter((v) => v.text && v.box.r > l + 1 && v.box.l < r - 1);
          // A bar's own value label at its end is part of the bar, not a gutter label.
          const barEnd = (t) => [...svg.querySelectorAll("rect.bar")].some((b) => { const e = b.getBoundingClientRect();
            return t.box.b > e.top && t.box.t < e.bottom && (where === "right" ? Math.abs(t.box.l - e.right) : Math.abs(e.left - t.box.r)) <= 16 * kk; });
          if (touching.length === 1 && !barEnd(touching[0])) flag(`${where} gutter ${Math.round(r - l)}px holds a single label`, { l, r, t: ownBox.t, b: ownBox.b });
        }
      }
    }
    // House style.
    if (marks && rules.style) {
      const allowed = Object.entries(marks).filter(([n, v]) => typeof v === "number" && n !== "dot").map(([, v]) => v * kk);
      allowed.push((marks.hero + 2 * marks.halo) * kk, ...(rules.style.extra_strokes || []).map((v) => v * kk));
      const bad = new Map();
      for (const el of svg.querySelectorAll("path, line, rect, circle, polyline")) {
        if (el.closest("g.frame-head, g.frame-foot, g.logo, defs") || isBackground(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.stroke === "none" || !(parseFloat(cs.strokeWidth) > 0)) continue;
        const w = parseFloat(el.getAttribute("stroke-width") || cs.strokeWidth);
        if (!allowed.some((a) => Math.abs(a - w) < 0.06 * kk)) bad.set(w.toFixed(2), el);
      }
      for (const [w, el] of bad) { const e = el.getBoundingClientRect();
        issues.push({ check: "style", text: `stroke ${w}px is not a house weight (${[...new Set(allowed.map((a) => a.toFixed(1)))].join(", ")})`, box: { l: e.left, r: e.right, t: e.top, b: e.bottom } }); }
      for (const u of units) if (/(^|[\s(])-\d/.test(u.s)) issues.push({ check: "style", text: `${u.s}: hyphen used as a minus sign`, box: u.box });
      const hues = new Set();
      const sat = (c) => { const m = c.match(/[\d.]+/g); if (!m) return 0; const [r, g, b] = m.slice(0, 3).map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
      for (const el of svg.querySelectorAll("path, line, rect, circle")) {
        if (el.closest("g.frame-head, g.frame-foot, g.logo, defs, [data-ramp]") || isBackground(el)) continue;
        const cs = getComputedStyle(el);
        for (const c of [cs.fill, cs.stroke]) if (c && c.startsWith("rgb") && sat(c) > 0.25) hues.add(c.replace(/\s/g, ""));
      }
      if (hues.size > rules.style.max_hues) issues.push({ check: "style", text: `${hues.size} highlight colours (${[...hues].join(" ")}), max ${rules.style.max_hues}`, box: { l: 0, r: 0, t: 0, b: 0 } });
    }
    // Visual grammar.
    if (grammar) {
      const G = grammar, gi = (n) => issues.push({ check: "grammar", ...n });
      const normC = (c) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "rect"); p.setAttribute("fill", c); svg.append(p);
        const v = getComputedStyle(p).fill.replace(/\s/g, ""); p.remove(); return v; };
      const roleSet = Object.entries(roles).filter(([n, r]) => r && typeof r === "object" && r.color)
        .map(([n, r]) => ({ n, size: r.size, weight: r.weight, color: normC(r.color) }));
      const white = normC("#FFFFFF");
      for (const u of units) {
        const cs = getComputedStyle(u.node), w = parseInt(cs.fontWeight), c = cs.fill.replace(/\s/g, "");
        const ok = roleSet.some((r) => Math.abs(r.size - u.fs) < 0.6 && r.weight === w && (r.color === c || c === white));
        if (!ok) gi({ text: `${u.s}: ${Math.round(u.fs)}px ${w} ${cs.fill} is no type role`, box: u.box });
        if (u.node.closest(".chart") && /\d/.test(u.s) && !/tabular-nums/.test(cs.fontVariantNumeric)) gi({ text: `${u.s}: figures not tabular`, box: u.box });
      }
      // Ink: chart marks only in grammar inks, series colours or the surface.
      const okInk = new Set([...Object.entries(G.ink || {}).filter(([n, v]) => !n.startsWith("_") && /^#/.test(v)).map(([, v]) => v),
        ...colors.categorical, colors.line_hero, colors.accent, ...(colors.accent_fill ? [colors.accent_fill] : []), colors.surface].map(normC));
      const badInk = new Map();
      for (const el of svg.querySelectorAll("path, line, rect, circle, polygon, polyline")) {
        if (el.closest("g.frame-head, g.frame-foot, g.logo, defs, clipPath, [data-ramp], .knockout") || el.classList.contains("knockout") || isBackground(el)) continue;
        const cs = getComputedStyle(el), stroked = cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0;
        // Lines have no fill, whatever the computed style says.
        for (const c of [["line", "polyline"].includes(el.tagName) ? null : cs.fill, stroked ? cs.stroke : null])
          if (c && c.startsWith("rgb") && !okInk.has(c.replace(/\s/g, ""))) badInk.set(c.replace(/\s/g, ""), el);
      }
      for (const [c, el] of badInk) { const e = el.getBoundingClientRect(); gi({ text: `mark colour ${c} is not a grammar ink or series colour`, box: { l: e.left, r: e.right, t: e.top, b: e.bottom } }); }
      // Ticks cover the data.
      for (const ax of svg.querySelectorAll("[data-axis]")) {
        // Log axes are checked in log space: "half a step" is half a ratio step.
        const tf = ax.getAttribute("data-scale") === "log" ? Math.log10 : (v) => v;
        const [lo, hi] = ax.getAttribute("data-axis").split(" ").map(Number).map(tf), tk = (ax.getAttribute("data-ticks") || "").split(" ").filter(Boolean).map(Number).map(tf).sort((a, b) => a - b);
        const step = tk.length > 1 ? Math.min(...tk.slice(1).map((t, i) => t - tk[i])) : Infinity, eps = 1e-6 * (Math.abs(hi) + 1);
        const e = ax.getBoundingClientRect(), box = { l: e.left, r: e.right, t: e.top, b: e.bottom };
        if (tk.length < (G.axis?.ticks_min ?? 2)) gi({ text: `axis has ${tk.length} ticks, want ≥${G.axis?.ticks_min ?? 2}`, box });
        else if (lo < tk[0] - step / 2 - eps || hi > tk.at(-1) + step / 2 + eps) gi({ text: `ticks ${tk[0]}–${tk.at(-1)} do not cover the data ${lo}–${hi}`, box });
      }
      // Devices named in the copy must be drawn.
      const copy = [...svg.querySelectorAll("g.frame-head text, g.frame-foot text")].map((t) => t.textContent).join(" ");
      const named = new Set();  // one issue per missing device, however many words name it
      for (const [word, sel] of Object.entries(G.devices || {})) {
        if (word.startsWith("_") || named.has(sel) || !new RegExp(`\\b${word}`, "i").test(copy)) continue;
        named.add(sel);
        if (!svg.querySelector(sel)) gi({ text: `copy mentions "${word}" but no mark is tagged ${sel}`, box: { l: 0, r: 0, t: 0, b: 0 } });
      }
      // Sections apart: header, chart and footer ink at least section_min apart (down the page, or down
      // the header column in side layouts).
      const minGap = (G.space?.[G.gaps?.section_min] ?? 12) * kk;
      const partBox = (sel) => { const us = units.filter((u) => u.node.closest(sel)); const els = [...svg.querySelectorAll(`${sel} rect, ${sel} line, ${sel} circle, ${sel} path`)].filter((el) => !el.closest("g.logo, clipPath, defs") && !isBackground(el) && !el.classList.contains("knockout"));
        const bs = [...us.map((u) => u.box), ...els.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }).filter((b) => b.r > b.l || b.b > b.t)];
        return bs.length ? bs : null; };
      const head = partBox("g.frame-head"), foot = partBox("g.frame-foot");
      const chartEls = [...svg.children].filter((n) => n.tagName === "g" && !n.matches(".frame-head, .frame-foot, .logo")).map((n) => n.getAttribute("class") ? `.${n.getAttribute("class").split(" ")[0]}` : null).filter(Boolean);
      const chart = chartEls.length ? partBox(chartEls.join(", ")) : null;
      const closest = (A, B) => { let d = Infinity; for (const a of A) for (const b of B) { const ov = a.l < b.r && b.l < a.r; if (ov) d = Math.min(d, b.t >= a.b ? b.t - a.b : a.t >= b.b ? a.t - b.b : -1); } return d; };
      for (const [A, B, what] of [[head, chart, "header and chart"], [chart, foot, "chart and footer"], [head, foot, "header and footer"]]) {
        if (!A || !B) continue;
        const d = closest(A, B);
        if (d < minGap - 0.5) gi({ text: `${what} only ${d < 0 ? "overlapping" : Math.round(d) + "px apart"}, want ≥${Math.round(minGap)}px`, box: { l: 0, r: W, t: 0, b: 0 } });
      }
    }
    // Headline clamping: a line is clamped when the next line's first word would have fitted on it
    // (the measure was narrowed); and no one-word last line.
    for (const hd of svg.querySelectorAll('text[data-role="headline"][data-col]')) {
      const col = +hd.getAttribute("data-col"), lines = [...hd.children];
      const e = hd.getBoundingClientRect(), box = { l: e.left, r: e.right, t: e.top, b: e.bottom };
      const probe = (str) => { const t = hd.cloneNode(false); t.removeAttribute("data-role"); t.textContent = str; svg.append(t); const w = t.getComputedTextLength(); t.remove(); return w; };
      lines.slice(0, -1).forEach((t, i) => {
        const next = lines[i + 1].textContent.trim().split(/[ \t\n\r]+/)[0];  // a no-break space binds words
        const would = probe(t.textContent.replace(/\s+$/, "") + " " + next);
        if (would < col - 1) issues.push({ check: "headline", text: `headline line ${i + 1} ends early: "${next}" would fit (${Math.round(would)}px in a ${col}px column); the measure was narrowed`, box });
      });
      if (lines.length > 1 && lines.at(-1).textContent.trim().split(/\s+/).length < 2) issues.push({ check: "headline", text: `headline ends on a one-word line ("${lines.at(-1).textContent.trim()}"); add a variant that wraps cleanly`, box });
    }
    // Platform preview crops (centred): text must stay inside each.
    for (const c of fmt.crops || []) {
      const cw = Math.min(W, H * c.aspect), ch = Math.min(H, W / c.aspect);
      const box = { l: (W - cw) / 2, r: (W + cw) / 2, t: (H - ch) / 2, b: (H + ch) / 2 };
      for (const u of units) if (u.box.l < box.l || u.box.r > box.r || u.box.t < box.t || u.box.b > box.b)
        issues.push({ check: "crop", text: `${u.s}: outside ${c.name}`, box: u.box });
    }
    // Draw problems for the debug image.
    const ns = "http://www.w3.org/2000/svg";
    for (const i of issues) {
      const r = document.createElementNS(ns, "rect");
      const p = svg.createSVGPoint();
      const m = svg.getScreenCTM().inverse();
      p.x = i.box.l; p.y = i.box.t; const a = p.matrixTransform(m);
      p.x = i.box.r; p.y = i.box.b; const b = p.matrixTransform(m);
      Object.entries({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, fill: "none", stroke: "red", "stroke-width": 3 })
        .forEach(([k, v]) => r.setAttribute(k, v));
      svg.append(r);
    }
    return { units: units.length, metrics, issues: issues.map(({ check, text }) => ({ check, text })) };
  }, { grammar: T.grammar || null, roles: T.type, colors: T.color, marks: T.marks, kk: T.k, rules: T.rules, W: T.canvas.width, H: T.canvas.height, facts: factValues, surface: T.color.surface, logo: T.logo && { ...T.logo, height: T.logo.height * T.k },
    fmt: FORMATS[stack] ? T.format : { layout: "stack" } });
  // Keyed dek words (colour underlines) sit in their own tspan: the words beside them must keep a space
  // (or glued punctuation) inside their own text, or viewers that drop whitespace-only tspans run them
  // together ("Niñoyears", "September,2026sits").
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/<tspan data-key="[^"]+">([^<]*)<\/tspan><tspan>([^<]*)<\/tspan>/g))
    if (m[2] && !/^[\s,.;:’'”)\]–—-]/.test(m[2])) result.issues.push({ check: "grammar", text: `keyed "${m[1]}" runs into "${m[2].slice(0, 12)}" (no space)` });
  for (const m of src.matchAll(/<tspan>([^<]*)<\/tspan><tspan data-key="[^"]+">([^<]*)<\/tspan>/g))
    if (m[1] && !/[\s(“‘\[–—-]$/.test(m[1])) result.issues.push({ check: "grammar", text: `"${m[1].slice(-12)}" runs into keyed "${m[2]}" (no space)` });
  if (/<tspan[^>]*>\s+<\/tspan>/.test(src)) result.issues.push({ check: "grammar", text: "a whitespace-only tspan (some viewers drop it)" });
  writeFileSync(`${root}/qa/reports/${stack}-${chart}.json`, JSON.stringify(result, null, 1));
  await (await page.$("svg")).screenshot({ path: `${root}/qa/reports/${stack}-${chart}.png` });
  await page.close();
  const counts = {};
  for (const i of result.issues) counts[i.check] = (counts[i.check] || 0) + 1;
  const mt = result.metrics || {};
  return { row: { stack, chart, texts: result.units, chart_area: mt.chart_area, chart_w: mt.chart_width, header: mt.header_height,
    margins: mt.margins && Object.values(mt.margins).map((v) => (v * 100).toFixed(1)).join("/"), band: mt.widest_band, ...counts },
    lines: result.issues.map((i) => `  ${stack}/${chart} [${i.check}] ${i.text}`) };
}
const workers = Math.max(1, Math.min(Number(process.env.LINT_JOBS) || Math.min(cpus().length, 10), files.length));
const results = new Array(files.length);
let next = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (next < files.length) { const i = next++; results[i] = await lintOne(files[i]); }
}));
for (const r of results) for (const l of r.lines) console.log(l);
const summary = results.map((r) => r.row);
console.table(summary);
await browser.close();
