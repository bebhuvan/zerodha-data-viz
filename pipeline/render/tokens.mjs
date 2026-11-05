// Theme + format -> the tokens a chart sees. Shared by render.mjs and qa/lint.mjs.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FORMATS_JSON = JSON.parse(readFileSync(`${root}/design/formats.json`, "utf8"));
export const FORMATS = FORMATS_JSON.formats;
// Platforms a default run produces: { slug: { format, label, why } } (formats.json "platforms").
export const PLATFORMS = Object.fromEntries(Object.entries(FORMATS_JSON.platforms || {}).filter(([k]) => !k.startsWith("_")));

// Theme + format -> the tokens a chart sees. Type sizes map onto the format's three steps:
// headline; body (dek, strong labels, brand); small (axis, notes, plain labels).
export function tokensFor(themeName, formatId) {
  const t = JSON.parse(readFileSync(`${root}/design/themes/${themeName}.json`, "utf8"));
  if (t.logo) t.logo.svg = readFileSync(`${root}/design/${t.logo.file}`, "utf8");
  const f = FORMATS[formatId];
  if (!f) throw new Error(`unknown format ${formatId}`);
  const [hd, body, small] = f.sizes;
  const k = body / 24;
  // Each type role names its step (headline, body, small); older themes without steps use the fixed map.
  const steps = { headline: hd, body, small };
  const legacy = { headline: "headline", kicker: "small", dek: "body", label_strong: "body", brand: "body", axis: "small", note: "small", label: "small" };
  for (const [key, ty] of Object.entries(t.type)) {
    if (!ty || typeof ty !== "object") continue;
    const st = ty.step || legacy[key];
    if (st) t.type[key] = { ...ty, size: steps[st] };
  }
  const safe = f.safe || {};
  t.canvas = { width: f.width, height: f.height, scale: f.scale };
  // One margin on every side, a share of the short side, so the frame looks even on any canvas.
  // (Older themes give fixed per-side margins at the 1080 base instead; they scale with k.)
  const short = Math.min(f.width, f.height);
  const mm = t.margin.ratio ? { top: t.margin.ratio * short, right: t.margin.ratio * short, bottom: t.margin.ratio * short, left: t.margin.ratio * short }
    : { top: t.margin.top * k, right: t.margin.right * k, bottom: t.margin.bottom * k, left: t.margin.left * k };
  // A safe zone (story UI) already keeps text off that edge, so it replaces the margin there instead of adding to it.
  t.margin = { top: Math.max(Math.round(mm.top), safe.top || 0), right: Math.round(mm.right), bottom: Math.max(Math.round(mm.bottom), safe.bottom || 0),
               left: Math.round(mm.left), base: Math.round(mm.left) };
  t.rules = { ...t.rules, min_font_px: small,
              safe_inset_px: Math.round(t.rules.safe_inset_ratio ? t.rules.safe_inset_ratio * short : t.rules.safe_inset_px * k),
              dek_line: t.type.dek.size * (t.type.dek.leading || 1.25) };
  t.k = k;
  t.format = { id: formatId, ...f };
  return t;
}

export function fontFaceCSS(theme) {
  return theme.fonts.map((f) => `@font-face{font-family:"${f.family}";font-weight:${f.weight};` +
    `src:url(data:font/ttf;base64,${readFileSync(`${root}/design/fonts/${f.file}`).toString("base64")})}`).join("\n");
}

