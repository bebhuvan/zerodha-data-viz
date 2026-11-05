---
name: new-chart
description: The end-to-end procedure for making a new Zerodha / Markets by Zerodha / Rainmatter chart in this repository, from a question or dataset to lint-clean, reviewed PNGs and SVGs in every format. Use whenever asked to make, add or publish a chart, or to turn a dataset or a story idea into a graphic.
---

# Making a chart, end to end

Follow the steps in order. Each names the skill that governs it. Do not skip the review at the end.

## 1. The question and the data (`data-analysis`, `finance-conventions`)

- Is the data already in `pipeline/data/tidy/` (see `facts.json` keys and the CSVs)? Use it.
- If not, add a fetcher: a function in `pipeline/fetch/fetch_markets.py` (or a new `fetch_<source>.py`
  that writes to the same manifest) that saves the untouched response to `pipeline/data/raw/` with URL,
  time and sha256. Fail loudly on an error payload or a coarsened/incomplete series.
- Build tidy tables and facts in `pipeline/fetch/build_markets.py` (or a new `build_<topic>.py` called
  from `build_tidy.py`), with a `check(...)` for every assumption. Run
  `python3 -I pipeline/fetch/build_tidy.py`.
- Explore in your scratchpad until you have one claim that is true, robust and worth a reader's time.

## 2. The form (`chart-choice`)

Follow the procedure in `chart-choice`: claim, job, data shape, then the most familiar form that makes
the claim visible. Prefer an existing template; a new form needs `new-template`, two real stories and
a sketch showing the existing forms fail them. Write the choice record (step 4).

## 3. The words (`chart-copy`)

Headline (one plain statement, 13 words at most, no colon or fronted figure), a shorter variant for
side layouts, dek or sub-heading (what, where, when, unit, the backing numbers; `[[word|colorKey]]`
keys), the explanation box for learnable and specialist forms (`**How to read this.** ...`, with a
one-sentence variant), notes (method, caveats; a shorter variant), source line. Every number from `facts.json` by explicit key.

## 4. The chart file

Create `pipeline/render/charts/<name>.js` (lower_snake_case; this name is the output file name):

```js
// Choice: claim "<the claim>" | job <job> | form <template> | tier <tier> [| not <familiar form>: <reason>]
// <Form>: <what it shows>.
window.draw = function ({ tokens, data }) {
  const f = (k) => fact(data.facts, k);                       // numbers by explicit key, never by position
  const rows = d3.csvParse(data.<tidy_table>, d3.autoType);   // data.<file name without .csv>
  // Checked claim: re-test what the headline says; throw COPY: when the data stops supporting it.
  if (!(/* the claim */)) throw new Error("COPY: headline says ...");
  const F = Frame({ tokens,
    headline: [`Full headline with ${Fmt.fmt(f("key"), "pct")}`, `Shorter variant`],
    dek: [`Full dek, [[keyed word|accent]] ...`, `Shorter dek`],
    explain: [`**How to read this.** Each <mark> is <thing>; <how to read it>.`, `**How to read this.** <one sentence>.`],
    notes: [[`Method note.`, `Shorter method note.`]],
    source: "Publisher (dataset); Zerodha calculations" });
  Templates.<form>(F, { /* the template's spec, documented at the top of its file */ });
};
```

Rules: no raw SVG drawing in chart files (templates draw); no pixel numbers or hex colours (tokens:
`tokens.color.*`); roles not colours (`role: "hero"` plus the series colour for the hero only); when the
form cannot fit some canvases, offer fallbacks with `firstFit([attemptA, attemptB])` and let copy follow
the form (fewer rows, say so in the dek).

## 5. Make (`node pipeline/make.mjs <name>`)

Renders all nine formats, lints every SVG and the source, writes the contact sheet. A `LAYOUT:` skip is
acceptable only if the chart genuinely cannot work on that canvas; otherwise add a fallback. `COPY:`,
`ENCODING:` and `FACT:` errors are real: fix the copy, the data or the template, never the check.

## 6. Review (`visual-review`)

Open `pipeline/qa/reports/contact-<name>.png`. Answer the seven questions. Run the cold read
(`node pipeline/qa/cold_read.mjs <name>`) and treat its CONFUSING line as findings. Fix, re-make, look
again.

## 7. Hand-off

- Outputs: one folder per chart, `output/zerodha/<name>/`, holding a PNG per platform
  (`<name>_<platform>_<w>x<h>.png`), `svg/<format>.svg`, and `caption.md` (headline, dek, explanation,
  notes, source, alt text, file list); gallery in `output/zerodha/index.html`.
- Run `node pipeline/make.mjs --test` before finishing: every published chart and fixture must still pass.
- Update the chart list in `AGENTS.md` if the chart is a new example of a form, and `CHANGELOG.md`.
