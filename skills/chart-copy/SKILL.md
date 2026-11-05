---
name: chart-copy
description: Write or review the words on a Zerodha / Markets by Zerodha / Rainmatter chart - headline, dek, notes, source line, labels and alt text. Use whenever chart copy is drafted, shortened for a format, or checked, including the copy variants in pipeline/render/charts/*.js.
---

# Chart copy

The reader is someone scrolling Instagram or X on a phone, smart but with no finance or statistics
training. They give the chart two seconds. The headline must land in those two seconds.

## Headline

States the finding, in plain words, as one full sentence with a verb: the way you would say it to a
friend across the table. Detail and backing numbers go to the dek, not the headline.

- A number or a concrete comparison when it is the point ("seven times as fast", "from 5.22% to 1.33%");
  a second number belongs in the dek.
- One statement. Not two clauses joined by a colon or semicolon, not a figure fronted before the subject
  ("At +2.16°C by September, this El Niño is..."), not "Even ...", not "..., a first since ...".
- Give several variants that say the same thing in different words. The frame never narrows a headline
  (narrowing is what made headlines look clamped, three times); it takes the first variant that wraps
  at full width without a one-word last line, so variants are how widows get fixed. Lint `headline`
  fails a line the next word would have fitted on, and a one-word last line.
- Names never break across lines ("El Niño", "Nifty 50", state names): the theme's `grammar.no_break`
  lists them and the frame binds them in all frame text. Add a name there, not a no-break space in copy.
- At most 13 words. Render checks every variant against the theme's `grammar.headline` (word count,
  banned openings "At", "Even", "With", "As", "While", "Despite", and the characters `: ; ? ! —`) and
  throws `COPY:`.
- Words a reader without finance training knows on first read. No jargon unless it is the subject
  (inflation, El Niño and repo rate are fine; "base effects", "YoY", "sequential momentum", "bps",
  "print" are not).
- No clever, abstract, punning or teasing lines. No questions. No "Here's why".
- Sentence case. No full stop. No all caps (brand rule).
- It must be true of the chart below it, and the chart must show it. If the claim is a record or a
  "first", the chart code checks it and throws `COPY:` when the data stops supporting it.

| Bad | Why | Good |
|---|---|---|
| Food for thought: the great disinflation | pun, abstract | Cheaper food cut India's inflation from 5.22% to 1.33% in a year |
| Kerala's CPI print diverges from the national trend | jargon, vague | Prices in Kerala are rising seven times as fast as in India overall |
| Is gold the new onion? | question, pun | Personal care, which includes gold, costs 28% more than a year ago |
| Headline inflation undershoots the tolerance band | jargon | Inflation has been under the RBI's 2% floor in five of the last six months |
| ENSO goes off the charts | jargon, cliché | No El Niño since 1950 has been this strong by September |
| Nifty P/E mean reversion signals caution | jargon, advice | Shares in the Nifty cost more per rupee of profit than in 9 of the last 10 years |
| Volatility spikes | vague | The Nifty moved more than 2% a day on six days this month, the most since 2022 |
| At +2.16°C by September, this El Niño is already stronger than any other since 1950 | figure fronted, 17 words | No El Niño since 1950 has been this strong by September |
| Even the La Niña years of 2021 and 2022 were at least 0.25°C warmer than 1998, a big El Niño year | "Even", appositive tail, 20 words | La Niña years 2021 and 2022 were warmer than El Niño year 1998 |
| Gold has topped this table two years running, a first since 2016 | "this table", tacked-on record | Gold beat every other asset in both 2024 and 2025 |

Length: stacked formats, at most 3 lines; side formats, at most 4. Give a shorter variant as the
second item of the `headline` array; the frame picks the first that fits and throws `COPY:` when none
does. Shorten the words, never the type.

## Dek (the sub-heading)

Says what is measured, where, when and in what unit, in words a lay reader knows ("how much warmer than
normal the central Pacific was", not "Oceanic Niño Index"), then the one or two numbers that back the
headline. Key series are named with `[[word|colorKey]]` so the underline matches the series colour.

- Good: "Year-on-year change in consumer prices, December 2025. Kerala's 9.49% compares with 1.33% for
  India; across most of the country prices barely moved."
- Bad: "Data shows interesting divergence across states." (no measure, no date, no number)

At most 3 lines stacked (2 on square, web and blog_wide); give a shorter variant.

## Explanation box ("How to read this")

A short plain-language paragraph under a full-width hairline below the chart (no fill: a grey slab was
tried and read as a widget), `explain:` in the Frame call, with a semibold lead-in: `**How to read this.** Each column is one year: ...`. It tells a reader who has never
seen this kind of chart what one mark stands for and how to read its position, colour or size, and, if
the measure is unfamiliar, what it means in everyday terms. Two or three sentences; give a one-sentence
variant.

- Required for learnable and specialist forms (`pipeline/design/chart_forms.json`; `lint_code` checks).
  Add it to a familiar form when the measure is jargon (ONI, yield curve, drawdown).
- Explain the reading, not the finding: the headline and dek carry the claim. No advice, no forecast,
  no "this means you should".
- Name only what the chart draws, with the words a reader sees ("the orange line", "grey means inside the
  band"). Device words (dashed, outline, shaded) need a tagged mark, as in any copy.
- Numbers in it come from `facts.json` like every other number.
- Placement is automatic: under the chart on stacked canvases (notes shorten, then move to the caption,
  before the box is dropped), under the dek in side layouts. Where it cannot fit without squeezing the
  chart (most 16:9 canvases), it is left off that canvas and kept in the caption. `explainBox: false`
  keeps it in the caption only (a fixed-shape chart's fallback).

## Notes

Method and caveats in one or two sentences: weights or base used, what "everything else" contains,
provisional values, gaps and why. Notes appear on canvas only where the format allows; they always go
to the caption file.

## Source

Publisher, then dataset, then "Zerodha calculations" if we transformed it:
"MOSPI (CPI, base 2012, All-India combined), Zerodha calculations". No URLs on the canvas.

## Labels on the chart

The house label: the value first in semibold ink, what it is underneath in regular grey
("+2.16°C" / "2026 so far"). Units on the top tick only. A true minus sign (−), never a hyphen
(lint `style` checks). Same number of decimals as the dek. Every number comes from `facts.json` by an
explicit key (`fact(data.facts, "state_cpi_2025-12_Kerala")`), never by array position.

## Alt text

"Chart. <headline>. <dek>." is generated into the caption file. Add one sentence describing the shape
when the chart's point is visual (a dot alone at the end of a row; a line diving below zero).

## Self-check before rendering

1. Would my parent understand the headline without the chart? Without asking a question?
2. Is it one plain statement of 13 words or fewer, with the detail moved to the dek?
3. Does every number in the headline and dek appear on the chart or in facts.json under the key I used?
4. Is every claim of a record, a first, "only" or "most" checked in code?
5. Does the dek say what, where, when, unit?
6. Is there a shorter variant for side and square formats?
6a. For a learnable or specialist form, does the explanation box say what one mark is and how to read it?
7. No jargon, puns, questions, all caps, exclamation marks, hyphens as minus signs.

## Indian context

Use Indian number words where they help (lakh, crore) and say "₹1.2 lakh crore", not "$14bn". Months
spelled out in the dek, short in labels ("Dec 2025"). The RBI, MOSPI, SEBI, NSE are fine as
abbreviations; spell out anything else on first use.
