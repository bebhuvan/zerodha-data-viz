---
name: visual-review
description: Review a rendered Zerodha / Markets by Zerodha / Rainmatter chart by looking at it, the way a graphics editor at the FT or Bloomberg would, after it passes lint. Use after every `node pipeline/make.mjs <chart>` run (it prints the contact sheet path), before calling any chart done, and when asked to critique or improve a chart. Lint-clean is necessary, never sufficient.
---

# Visual review

The linter checks rules a machine can measure: collisions, contrast, brand, spacing, tick coverage.
It cannot tell whether the chart makes its point, whether a label is ambiguous, or whether the form is
right. You must open the image and look. Do this for every chart, in every format that rendered
(`pipeline/qa/reports/contact-<chart>.png` shows them side by side), and at the size a reader sees it
(a phone: a portrait PNG at about a third of its pixel width).

## The seven questions

Answer each in writing, per format where they differ. Any "no" is a finding.

1. **Five-second test.** Cover the headline. Does the chart alone say what the headline says? If the
   reader has to hunt, the form or the hero is wrong (go back to `chart-choice`).
2. **One loud thing.** Is the hero the most prominent mark, and is nothing else competing in colour,
   weight or size? Greys should recede; at most three hues.
3. **Unambiguous labels.** Does every label sit beside the one mark it names, or on a leader to it? A
   name floating between two dots is wrong even if it collides with nothing.
4. **Space.** Is any part of the plot empty while marks are cramped elsewhere? Do bars float in tall
   rows? Is there a gutter holding one label? Is the header crushing the chart?
5. **Honest scales.** Bars from zero. Lines may zoom, with the zero line drawn when the data crosses
   it. Log scales named in the dek. Ticks cover the data. No dual axes.
6. **Copy matches marks.** Does every device the copy names (shaded, dashed, blue) exist on the chart?
   Does every number trace to `facts.json`? Is the dek's colour key the colour of the mark it keys?
7. **Editor's test.** Would an FT or Bloomberg graphics editor publish this as is? If not, what is the
   first thing they would change? Change it.

## Cold read (after the seven questions)

You know what the chart is meant to say, so you cannot see what a stranger misreads. A colleague could
not read the El Niño beeswarm that passed every check. Run the cold read on every new or changed chart:

```
node pipeline/qa/cold_read.mjs <chart>
```

It hands the feed PNG, alone in an empty folder, to a fresh `claude -p` or `gemini -p` with no project context, and
asks for the takeaway, what one mark means, what was confusing, and whether the drawing (not just the
headline) shows the claim. Results go to `pipeline/qa/reports/coldread-<chart>.md`. The VERDICT line is
lenient; the CONFUSING line is the signal. Treat every item there as a finding: fix it in the chart, the
template or the explanation box, re-render, and read again. (Its first run caught label knockouts
shaving the tops of columns, which neither lint nor the author had seen.)

## Faults this project has actually shipped (look for these first)

| Fault | Where it came from | Class fix (in the template or kit, not the chart) |
|---|---|---|
| A 19-year daily series drawn at hero weight became a blue ribbon | `lines` | Dense heroes draw at compare weight without the halo (`K.series` `dense`) |
| "10-year" rendered as "10 - year" | Inter's tabular figures widen U+002D | Word hyphens typeset as U+2010 (`K.text`, frame `textBlock`) |
| Indian grouping on dollars: "$1,00,000" | one formatter for all currencies | `usd` / `intl` formats |
| Scatter names placed near, not beside, their dot | `Kit.place` searching far | Non-hero names only east or west, adjacent |
| Tail labels of a histogram ran off the canvas | centred labels on edge bins | End labels anchored inward |
| Range bars floating in tall portrait rows | horizontal form on a tall canvas | Past `row_max`, the form turns to columns |
| A dek line starting with ", the" | keyed phrase followed by punctuation | Glued punctuation wraps with its word |
| White text on the series blue at 4.1:1 | `#387ED1` fill | `accent_fill` (#2A64A9) for filled cells with white text |
| A dek keyed "middle" in orange while the mark was dark grey | copy written before the chart | Key only words whose mark carries that colour |
| A beeswarm read as data spread left to right; a colleague could not read it | specialist form for a familiar job | Familiarity tiers in `chart_forms.json`; specialist forms need a reason and an explanation box; El Niño moved to columns |
| Callout knockouts shaved a pixel off the tops of thin columns ("stepped" tops) | knockout drawn over the bars | `columns` draws callouts beneath the bars, above the grid |

When you find a fault, ask whether it is an instance of a class. If it could happen in another chart,
fix it in the kit, frame or template, add a lint check or a planted fixture if a machine can see it,
and add a row to the table above.

## Reporting

List findings most severe first: what is wrong, in which formats, and the fix you made (or propose).
Then re-run `node pipeline/make.mjs <chart>` and look again. Only a clean lint run plus seven "yes"
answers is done.
