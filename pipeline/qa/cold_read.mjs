// Cold read: a fresh CLI agent instance (Claude Code or Gemini CLI), with no project context, reads a
// rendered chart the way a reader on a phone would, and says what it shows, what one mark means and what
// confused it. The stand-in for "a colleague did not understand this chart": lint cannot see that.
//
//   node pipeline/qa/cold_read.mjs <chart> [more charts] [--png=path] [--cli=claude|gemini] [--model=<model>]
//
// Reads output/zerodha/<chart>/<chart>_instagram-feed_1080x1350.png (or --png), copies it into an empty
// temporary folder (so the reader sees the image and nothing else) and runs `claude -p` or `gemini -p`
// there. Writes pipeline/qa/reports/coldread-<chart>.md and prints the verdict line.
// Needs the `claude` or `gemini` CLI on PATH and its own login; no keys pass through this script.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..", "..");
const args = process.argv.slice(2);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=");
const charts = args.filter((a) => !a.startsWith("--"));
if (!charts.length && !opt("png")) { console.error("usage: node pipeline/qa/cold_read.mjs <chart> [...] [--png=path] [--cli=claude|gemini] [--model=m]"); process.exit(2); }

function detectCli() {
  const forced = opt("cli");
  if (forced) return forced;
  for (const bin of ["claude", "gemini"]) {
    const check = spawnSync("which", [bin], { encoding: "utf8" });
    if (check.status === 0) return bin;
  }
  return "gemini";
}
const cli = detectCli();

const PROMPT = `Read the image chart.png in this folder. You are a reader scrolling Instagram or a newsletter:
curious, numerate, but you have never seen this chart before and have no special training in charts,
economics or climate science. Look at it for as long as a busy reader would.

Answer in exactly this format, plainly, no preamble:

TAKEAWAY: the one thing the chart tells you, in one sentence, in your own words.
ONE MARK: pick one bar, dot, line, square or cell and say what it stands for and how to read its position or size.
CONFUSING: anything you had to puzzle over, misread at first, or still do not understand (or "nothing").
MATCH: does the drawing itself (not just the headline text) show what the headline claims? yes / partly / no, and why in one line.
VERDICT: CLEAR if a lay reader gets the point and reads the marks correctly within about ten seconds; otherwise CONFUSING.`;

const jobs = opt("png") ? [{ name: basename(opt("png"), ".png"), png: resolve(opt("png")) }]
  : charts.map((c) => ({ name: c, png: resolve(project, "output", "zerodha", c, `${c}_instagram-feed_1080x1350.png`) }));
mkdirSync(resolve(here, "reports"), { recursive: true });
let confusing = 0;
for (const { name, png } of jobs) {
  if (!existsSync(png)) { console.error(`no image: ${png}`); process.exitCode = 2; continue; }
  const dir = mkdtempSync(resolve(tmpdir(), "coldread-"));
  copyFileSync(png, resolve(dir, "chart.png"));
  const cliArgs = cli === "gemini"
    ? ["-p", `${PROMPT}\n\n@chart.png`, ...(opt("model") ? ["-m", opt("model")] : [])]
    : ["-p", PROMPT, "--allowedTools", "Read", ...(opt("model") ? ["--model", opt("model")] : [])];
  const r = spawnSync(cli, cliArgs, { cwd: dir, encoding: "utf8", timeout: 300000 });
  rmSync(dir, { recursive: true, force: true });
  const out = (r.stdout || "").trim() || (r.stderr || "").trim();
  writeFileSync(resolve(here, "reports", `coldread-${name}.md`), `# Cold read: ${name}\n\nImage: ${png}\n\n${out}\n`);
  const verdict = (out.match(/^VERDICT:.*$/m) || ["VERDICT: (no answer)"])[0];
  if (!/CLEAR/.test(verdict) || /CONFUSING/.test(verdict)) confusing++;
  console.log(`${name}: ${verdict}\n  ${(out.match(/^TAKEAWAY:.*$/m) || [""])[0]}\n  ${(out.match(/^CONFUSING:.*$/m) || [""])[0]}`);
}
process.exitCode = process.exitCode || (confusing ? 1 : 0);
