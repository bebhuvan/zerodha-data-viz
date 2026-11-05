// Frame shared by every D3 chart: background, header (topper, optional kicker, headline, dek),
// legend, footer (notes, source, logo or brand name). Returns the SVG and the free plot rectangle.
// Everything brand-specific comes from the theme; everything size-specific from the format.
// Spacing is written for the 1080px base and multiplied by k (body size / 24); outer margins come
// from tokens (equal on every side).
//
// Copy: headline, dek and each note may be a string or a list of variants, longest first. The frame
// uses the first variant that fits the theme's line budget for this layout (header.max_lines) and
// throws COPY: when none does. Shorten the copy; never shrink the type. The caption file gets the
// first (fullest) variant.
//
// Dek markup: [[words|colorKey]] underlines words in a series colour, so the text keys the
// chart without coloured text (which the Zerodha guide does not allow). colorKey is a path
// into tokens.color, e.g. "categorical.0" or "line_hero". **words** sets a semibold ink lead-in
// (used in the explanation box).
//
// explain: the explanation box, a plain-language reading of the chart for someone who has never seen
// this kind of chart ("**How to read this.** Each column is one year..."). Variants, longest first.
// It sits under a hairline rule below the chart (stacked layouts) or under the dek (side layouts); when no
// variant fits without squeezing the chart below its floor, it is left off that canvas and kept in
// the caption. Required for learnable and specialist forms (design/chart_forms.json, lint_code).
// explainBox: false keeps it in the caption only (a fixed-shape chart's fallback when the box would
// shrink it below legible).
window.Frame = function Frame({ tokens: T, kicker, headline, dek, dekShort, notes = [], explain, explainBox = true, source, plotAspect, layout }) {
  const { width: W, height: H } = T.canvas;
  const M = T.margin;
  const C = T.color;
  const k = T.k || 1;
  const fmt = T.format || { layout: "stack", notes: true };
  // layout: "stack" asks for the header across the top on any canvas (a chart that can reshape itself to
  // a wide strip, e.g. a 20x5 waffle); otherwise the format decides.
  let side = (layout || fmt.layout) === "side";
  const HD = T.header || {};
  // Spacing steps (theme grammar.space, px at k=1). Header gaps may be step names or old-style numbers.
  const SP = { "2xs": 2, xs: 4, s: 8, m: 12, l: 16, xl: 24, "2xl": 32, "3xl": 48, ...((T.grammar || {}).space || {}) };
  const sp = (name) => SP[name] * k;
  const gap = Object.fromEntries(Object.entries({ topper: 20, headline: 20, dek: 40, legend: 24, foot: 32, ...(HD.gaps || {}) })
    .filter(([n]) => !n.startsWith("_")).map(([n, v]) => [n, (typeof v === "string" ? SP[v] : v)]));
  let budget = { ...((HD.max_lines || {})[side ? "side" : "stack"] || {}), ...(fmt.max_lines || {}) };
  const font = (key) => {
    const t = T.type[key];
    return { family: `"${T.font[t.family]}"`, size: t.size, weight: t.weight, leading: t.leading || 1.25, tracking: t.tracking ?? null,
      color: t.color || null, role: key };
  };
  const NOBREAK = (((T.grammar || {}).no_break || {}).terms || []).slice().sort((a, b) => b.length - a.length);
  const colorOf = (path) => path.split(".").reduce((o, p) => o[p], C);
  const plain = (s) => s.replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, "$1");
  const variants = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
  const heads = variants(headline), deks = [...variants(dek), ...variants(dekShort)];
  const noteSets = notes.map(variants);
  const explainAll = variants(explain), explains = explainBox ? explainAll : [];  // explainBox false: caption only
  const unbold = (s) => plain(s).replace(/\*\*([^*]+)\*\*/g, "$1");
  window.__meta = { headline: plain(heads[0]), headlines: heads.map(plain), dek: plain(deks[0]), notes: noteSets.map((n) => plain(n[0])),
    explain: explainAll.length ? unbold(explainAll[0]) : null, explainShown: null, source };

  const svg = d3.create("svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
  // Default tracking for every text element, in em of its own size; text that sets its own
  // tracking (headline, dek) carries data-track and an inline style, which wins.
  // Chart text uses tabular figures so digits line up in columns and on axes; header and footer
  // prose keeps Inter's proportional figures.
  svg.append("style").text((T.tracking_default ? `text:not([data-track]),text:not([data-track]) tspan{letter-spacing:${T.tracking_default}em}` : "") +
    ".chart text,.chart tspan{font-variant-numeric:tabular-nums}");
  svg.append("rect").attr("width", W).attr("height", H).attr("fill", C.surface);
  document.body.append(svg.node()); // attached so text can be measured

  // Greedy word wrap using real glyph widths. Each line is a <tspan> whose children are
  // runs of plain or keyed words; keyed runs get a colour underline after layout.
  // Returns the block height; .lines on the function holds the last block's line count.
  function textBlock(g, str, f, x, y, maxW, fill) {
    for (const term of NOBREAK) str = str.split(term).join(term.replace(/ /g, "\u00A0"));  // theme grammar.no_break
    str = str.replace(/(\w)'(\w)/g, "$1\u2019$2")  // typographic apostrophe
      .replace(/(\w)-(?=\w)/g, "$1\u2010");          // true hyphen (tabular figures widen U+002D)
    const words = [];
    for (const part of str.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/)) {
      const b = part.match(/^\*\*([^*]+)\*\*$/);
      const m = b ? [part, b[1], "__bold"] : part.match(/^\[\[([^|\]]+)\|([^\]]+)\]\]$/);
      // Text that follows a keyed phrase with no space (", which") glues to it.
      const glue = !m && words.length > 0 && /^\S/.test(part);
      // Words break at ordinary spaces only: a no-break space (U+00A0) binds a name ("El\u00A0Niño").
      (m ? m[1] : part).split(/[ \t\n\r]+/).filter(Boolean).forEach((w, i) => words.push({ w, key: m ? m[2] : null, glue: glue && i === 0 }));
    }
    const t = g.append("text").attr("xml:space", "preserve")
      .attr("font-family", f.family).attr("font-size", f.size).attr("font-weight", f.weight).attr("fill", fill);
    if (f.tracking != null) t.attr("data-track", f.tracking).attr("style", `letter-spacing:${f.tracking}em`);
    const lh = f.size * f.leading;
    let lineEl, line = [], lines = 0;
    const newLine = () => { lineEl = t.append("tspan").attr("x", x).attr("y", y + f.size * 0.8 + lines * lh); lines++; line = []; };
    const paint = () => {
      lineEl.selectAll("*").remove();
      let run = null;
      // The space between two runs travels inside a run's own text (the plain one, so a keyed underline never
      // spans it): some SVG viewers drop a whitespace-only tspan, which read "September,2026sits".
      line.forEach((wd, i) => {
        if (!run || run.key !== wd.key) {
          const space = i > 0 && !wd.glue;
          if (space && run && !run.key) { run.trail = " "; run.el.text(run.lead + run.words.join(" ") + " "); }
          run = { key: wd.key, el: lineEl.append("tspan").attr("data-key", wd.key), words: [], lead: space && !(run && !run.key) && !wd.key ? " " : "" };
          // Bold lead-in: semibold ink at the small size (the label_on_fill values).
          if (wd.key === "__bold") run.el.attr("font-weight", T.type.label_on_fill.weight).attr("fill", C.ink);
          if (space && run.lead === "" && wd.key && !(line[i - 1] && !line[i - 1].key)) lineEl.insert("tspan", () => run.el.node()).text(" ");
        }
        run.words.push(wd.w);
        run.el.text(run.lead + run.words.join(" ") + (run.trail || ""));
      });
    };
    newLine();
    for (const wd of words) {
      line.push(wd); paint();
      if (lineEl.node().getComputedTextLength() > maxW && line.length > 1) {
        // Punctuation glued to the word before it (", the" after a keyed phrase) moves with that word,
        // so no line starts with a comma.
        const carry = wd.glue && line.length > 2 ? [line.at(-2), wd] : [wd];
        line.splice(line.length - carry.length); paint(); newLine(); line.push(...carry); paint();
      }
    }
    t.selectAll("tspan[data-key]").each(function () {
      const key = this.getAttribute("data-key");
      if (!key || key === "null" || key === "__bold") return;
      const r = this.getBoundingClientRect();
      const base = +this.parentNode.getAttribute("y");
      g.insert("rect", () => t.node()).attr("class", "text-key")
        .attr("x", r.left).attr("y", base + f.size * 0.2).attr("width", r.width)
        .attr("height", Math.max(3, sp("xs"))).attr("rx", 1).attr("fill", colorOf(key));
    });
    textBlock.lines = lines; textBlock.node = t.node();
    return lines * lh;
  }
  const scratch = svg.append("g");
  const linesOf = (str, f, w) => { textBlock(scratch, str, f, 0, 0, w, C.ink); scratch.selectAll("*").remove(); return textBlock.lines; };
  // First variant within the line budget, or a COPY error naming the shortfall.
  function pick(list, f, w, max, what) {
    let n;
    for (const v of list) { n = linesOf(v, f, w); if (!max || n <= max) return v; }
    throw new Error(`COPY: ${what} takes ${n} lines at ${f.size}px in a ${Math.round(w)}px column, budget ${max}; add a shorter variant`);
  }

  // Columns: stack puts the header above the chart; side gives it a left column.
  const fullW = W - M.left - M.right;
  // Landscape canvases take the stacked header whenever it is short (theme header.stack_on_wide_max,
  // a share of the canvas height): a side column of three lines of headline and a little dek leaves a
  // dead hole under the text. Fixed-shape charts (maps, grids, waffles) keep the side column, which
  // they fill. Notes stay off-canvas on these formats (fmt.notes false); the caption file has them.
  if (side && !plotAspect && HD.stack_on_wide_max) {
    const sb = { ...((HD.max_lines || {}).stack || {}), ...(fmt.max_lines || {}) };
    const fh0 = font("headline"), fd0 = font("dek");
    const fits = (list, f, max) => list.find((v) => linesOf(v, f, fullW) <= (max || 99));
    const hl0 = fits(heads, fh0, sb.headline), dk0 = fits(deks, fd0, sb.dek);
    if (hl0 && dk0) {
      const tp = HD.topper ? HD.topper.height * k + gap.topper * k : 0;
      const h = tp + linesOf(hl0, fh0, fullW) * fh0.size * fh0.leading + gap.headline * k + linesOf(dk0, fd0, fullW) * fd0.size * fd0.leading;
      if (h <= HD.stack_on_wide_max * (H - M.top - M.bottom)) { side = false; budget = sb; }
    }
  }
  svg.attr("data-layout", side ? "side" : "stack");
  if (fmt.id) svg.attr("data-format", fmt.id);  // lint reads the canvas from the file, not its folder
  let headW = side ? Math.round(fullW * (fmt.side_col ?? 0.36)) : fullW;
  // Fixed-shape charts (maps, tile grids: plotAspect = width/height) cannot use spare width; in side
  // layouts it goes to the header column, up to 45%, instead of becoming an empty band.
  if (side && plotAspect) {
    const need = plotAspect * (H - M.top - M.bottom);
    headW = Math.round(Math.min(0.45 * fullW, Math.max(headW, fullW - sp("3xl") - need)));
  }
  if (plotAspect) svg.attr("data-fixed-aspect", 1);
  const head = svg.append("g").attr("class", "frame-head");
  let y = M.top;
  if (HD.topper) {
    const tp = HD.topper;
    head.append("rect").attr("class", "topper").attr("x", M.left).attr("y", y)
      .attr("width", tp.width * k).attr("height", tp.height * k).attr("fill", colorOf(tp.color));
    y += tp.height * k + gap.topper * k;
  }
  if (T.type.kicker && kicker) {  // some brands (Zerodha) forbid all caps and keep to two sizes: no kicker
    y += textBlock(head, kicker.toUpperCase(), font("kicker"), M.left, y, headW, C.accent) + sp("m");
  }
  const fh = font("headline"), fd = font("dek");
  // Headlines are set at the full column width, always; the measure is never narrowed (narrowing to
  // fix a widow or balance lines is what made headlines look clamped on 28 Oct, 3 Nov and 4 Nov). Lint
  // 'headline' proves it: no line ends where the next line's first word would have fitted. Widows are
  // solved with copy: the frame takes the first variant that wraps without a one-word last line, two
  // lines before three (a three-line headline outweighs the chart on feeds), and only then accepts a
  // widow (lint flags it, so the chart file gets a variant that wraps cleanly).
  const wrap = (str) => {
    textBlock(scratch, str, fh, 0, 0, headW, C.ink);
    const lines = [...textBlock.node.children].map((t) => t.textContent.trim().split(/\s+/).length);
    scratch.selectAll("*").remove();
    return lines;
  };
  const ok = (v, max, widowOK) => { const ls = wrap(v); return ls.length <= max && (widowOK || ls.length === 1 || ls.at(-1) >= 2); };
  const two = Math.min(2, budget.headline || 2), all = budget.headline || 3;
  const hl = heads.find((v) => ok(v, two, false)) || heads.find((v) => ok(v, all, false)) || heads.find((v) => ok(v, two, true))
    || pick(heads, fh, headW, budget.headline, "headline");
  const hw = headW;
  y += textBlock(head, hl, fh, M.left, y, hw, fh.color || C.ink) + gap.headline * k;
  d3.select(textBlock.node).attr("data-role", "headline").attr("data-col", +headW.toFixed(2));  // lint 'headline'
  y += textBlock(head, pick(deks, fd, headW, budget.dek, "dek"), fd, M.left, y, headW, fd.color || C.ink2);

  // Footer, laid out bottom-up: logo (or brand name) and source on the bottom margin, notes above.
  const foot = svg.append("g").attr("class", "frame-foot");
  const fn = font("note"), fsrc = font(T.type.source ? "source" : "note");
  let brandW, clear = sp("2xl"), brandH = fn.size;
  if (T.logo) {
    // Official logo, embedded unaltered and scaled uniformly. Clear space = 2x, where x is the
    // icon-to-wordmark gap (Zerodha guide), measured in the logo's own units.
    const doc = new DOMParser().parseFromString(T.logo.svg, "image/svg+xml").documentElement;
    const vw = +doc.getAttribute("width"), vh = +doc.getAttribute("height");
    brandH = T.logo.height * k;
    const s = brandH / vh;
    clear = 2 * T.logo.gap_units * s;
    brandW = vw * s;
    const lx = side ? M.left : W - M.right - brandW;
    const g = foot.append("g").attr("class", "logo")
      .attr("transform", `translate(${lx},${H - M.bottom - brandH}) scale(${s})`);
    for (const child of [...doc.childNodes]) g.node().append(document.importNode(child, true));
  } else {
    const fb = font("brand");
    const brand = foot.append("text").attr("x", side ? M.left : W - M.right).attr("y", H - M.bottom)
      .attr("text-anchor", side ? "start" : "end").attr("font-family", fb.family).attr("font-size", fb.size)
      .attr("font-weight", fb.weight).attr("fill", C.ink).text(T.brand);
    brandW = brand.node().getComputedTextLength();
  }
  const lhN = fn.size * fn.leading;
  // A block whose last baseline sits at `base`: returns its top.
  let lastBlock;
  const blockUp = (str, w, x, base, f = fn) => {
    const n = linesOf(str, f, w);
    const top = base - f.size * 0.8 - (n - 1) * lhN;
    lastBlock = foot.append("g").attr("class", "foot-block");
    textBlock(lastBlock, str, f, x, top, w, f.color || C.muted);
    return top;
  };
  let sideNotes = null, sourceTop = null, notesBottom = null, boxBottom = null;
  // Explanation box ("How to read this"): no fill. A full-width hairline in the context ink marks it off
  // from the chart, and the note sits flush beneath in annotation type with a semibold lead-in, like a
  // newspaper's reading note. (A grey slab was tried on 4 Nov and read as a widget.)
  const fe = font("annotation"), lhE = fe.size * fe.leading, ruleGap = sp("m");
  const ruleInk = ((T.grammar || {}).ink || {}).context || C.muted;
  const boxH = (str, w) => ruleGap + (linesOf(str, fe, w) - 1) * lhE + fe.size;
  const drawBox = (str, x, top, w) => {
    const g = foot.append("g").attr("class", "explain");
    g.append("line").attr("class", "explain-rule").attr("x1", x).attr("x2", x + w).attr("y1", top).attr("y2", top)
      .attr("stroke", ruleInk).attr("stroke-width", k);
    textBlock(g, str, fe, x, top + ruleGap - fe.size * 0.1, w, fe.color || C.ink2);
    window.__meta.explainShown = unbold(str);
    return top + boxH(str, w);
  };
  // Stacked formats with notes:false are too short for notes; side formats always try the header
  // column, where notes fill the space between dek and source when they fit.
  const shownNotes = (fmt.notes === false && !side) || !budget.notes ? [] : noteSets;
  // Notes as one block: the fullest variant set within maxLines at width w, or null.
  const noteBlock = (w, maxLines) => {
    for (let i = 0; i < Math.max(...shownNotes.map((n) => n.length)); i++) {
      const s = shownNotes.map((n) => n[Math.min(i, n.length - 1)]).join(" ");
      if (linesOf(s, fn, w) <= maxLines) return s;
    }
    return null;
  };
  window.__meta.notesShown = [];
  let fy;
  const logoTop = H - M.bottom - brandH;
  if (side) {
    // Side layout: source sits above the logo in the header column; notes go above the source when
    // the column has room for them, so the column carries method instead of a dead gap.
    fy = sourceTop = blockUp(`Source: ${source}`, headW, M.left, logoTop - clear - fn.size * 0.3, fsrc);  // descenders clear the logo zone
    // The explanation box follows the dek; it outranks notes (they stay in the caption).
    let colY = y;
    const ex = explains.find((v) => y + gap.foot * k + boxH(v, headW) <= fy - sp("l"));
    if (ex) colY = boxBottom = drawBox(ex, M.left, y + gap.foot * k, headW);
    if (shownNotes.length) {
      const room = fy - sp("l") - (colY + gap.foot * k);  // between the dek or box (plus a section gap) and the source
      const fit = Math.min(budget.notes, Math.floor((room + lhN - fn.size) / lhN));
      const chosen = fit > 0 ? noteBlock(headW, fit) : null;
      // Notes follow the dek (one block of reading, top down); the spare height, if any, sits above the
      // source and logo at the foot of the column instead of opening a hole between dek and notes.
      if (chosen) {
        const top = colY + gap.foot * k, n = linesOf(chosen, fn, headW);
        blockUp(chosen, headW, M.left, top + fn.size * 0.8 + (n - 1) * lhN);
        sideNotes = lastBlock; notesBottom = top + (n - 1) * lhN + fn.size; window.__meta.notesShown = [chosen];
      }
    }
  } else {
    // Source shares the bottom line with the logo when it fits there on as many lines as at full
    // width; otherwise it takes the full measure and the logo drops to its own line below, so the
    // source never wraps early to make room for the logo.
    const srcStr = `Source: ${source}`;
    const besideOK = linesOf(srcStr, fsrc, fullW - brandW - clear) <= linesOf(srcStr, fsrc, fullW);
    fy = besideOK ? blockUp(srcStr, fullW - brandW - clear, M.left, H - M.bottom, fsrc)
      : blockUp(srcStr, fullW, M.left, logoTop - clear - fsrc.size * 0.3, fsrc);
    const srcTop = fy;
    let notesG = null;
    const placeNotes = (maxLines) => {
      if (notesG) { notesG.remove(); notesG = null; }
      fy = srcTop; window.__meta.notesShown = [];
      if (!shownNotes.length || maxLines < 1) return true;
      const chosen = noteBlock(fullW, maxLines);
      if (!chosen) return false;
      // Clear both the source block and the logo's clear space.
      fy = blockUp(chosen, fullW, M.left, Math.min(fy - sp("s"), logoTop - clear) - (fn.size * 0.25));
      notesG = lastBlock; window.__meta.notesShown = [chosen];
      return true;
    };
    if (shownNotes.length && !placeNotes(budget.notes)) throw new Error(`COPY: notes take more than ${budget.notes} lines at ${fn.size}px; add a shorter variant`);
    if (explains.length) {
      // Box above the notes, on the first variant that leaves the chart at least half the canvas's inner
      // height (theme header.explain_min_plot) and keeps the plot above lint's area minimum for stacked
      // charts (rules.space, with a little slack because the drawn chart is smaller than its plot box);
      // otherwise the box stays in the caption only.
      const floor = (HD.explain_min_plot ?? 0.5) * (H - M.top - M.bottom);
      const sf = fmt.safe || {}, RS = (T.rules || {}).space || {};
      const areaMin = plotAspect ? 0 : 1.05 * ((fmt.space || {}).chart_area_min ?? RS.stack_chart_area_min ?? 0) * W * (H - (sf.top || 0) - (sf.bottom || 0));
      // Above notes, a section gap; with no notes the box takes the notes' own place over the source and
      // the logo's clear space.
      const boxBottom0 = () => (notesG ? Math.min(fy, logoTop - clear) - sp("l") : Math.min(fy - sp("s"), logoTop - clear) - fn.size * 0.25);
      const fits = (v) => { const bottom = boxBottom0(), h = bottom - boxH(v, fullW) - gap.foot * k - (y + gap.dek * k); return h >= floor && h * fullW >= areaMin; };
      // The box outranks the notes for a lay reader: shorter notes first, then none (the caption keeps
      // them), before the box is given up.
      let ex = explains.find(fits);
      for (let n = (budget.notes || 0) - 1; !ex && shownNotes.length && n >= 0; n--) if (placeNotes(n)) ex = explains.find(fits);
      if (!ex && shownNotes.length) placeNotes(budget.notes);
      if (ex) { const bottom = boxBottom0(); drawBox(ex, M.left, bottom - boxH(ex, fullW), fullW); fy = bottom - boxH(ex, fullW); }
    }
  }

  let plot = side
    ? { x: M.left + headW + sp("3xl"), y: M.top, w: fullW - headW - sp("3xl"), h: H - M.top - M.bottom }
    : { x: M.left, y: y + gap.dek * k, w: fullW, h: Math.min(fy - gap.foot * k, logoTop - clear - sp("xs")) - (y + gap.dek * k) };  // and clear of the logo's clear space
  let headBottom = y;
  svg.attr("data-plot", [plot.x, plot.y, plot.w, plot.h].map(Math.round).join(" "));  // for lint 'space'
  if (side && headBottom > fy - sp("l")) throw new Error(`LAYOUT: header (${Math.round(headBottom)}px) runs into footer (${Math.round(fy)}px)`);
  // A chart squeezed below 40% of the canvas's short side is a layout failure, not an output.
  if (plot.h < Math.max(sp("3xl") * 3, 0.4 * Math.min(W, H))) throw new Error(`LAYOUT: only ${Math.round(plot.h)}px left for the chart`);

  // Legend: items are { label, color, kind: "swatch" | "line" | "dot" }. Sized with legendSize;
  // placed by legend(): in the header column for side layouts, at a spot the chart offers in its own
  // empty space (inset(w, h) returns {x, y} or null), else as rows above the plot. Returns the y at
  // which the plot may start.
  const fl = font("label");
  const swatchW = sp("l"), rowH = Math.max(fl.size * 1.35, sp("xl")), itemGap = sp("xl");
  const itemW = (it) => swatchW + sp("s") + textWidth(svg, it.label, fl);
  function legendSize(items, maxW, vertical) {
    if (vertical) return { w: d3.max(items, itemW), h: items.length * rowH, rows: items.map((it) => [it]) };
    const rows = [[]]; let x = 0;
    for (const it of items) {
      if (x > 0 && x + itemW(it) > maxW) { rows.push([]); x = 0; }
      rows.at(-1).push(it); x += itemW(it) + itemGap;
    }
    return { w: d3.max(rows, (r) => d3.sum(r, itemW) + itemGap * (r.length - 1)), h: rows.length * rowH, rows };
  }
  function drawLegend(parent, lay, x0, y0) {
    const g = parent.append("g").attr("class", "legend");
    lay.rows.forEach((row, ri) => {
      let x = x0;
      const cy = y0 + ri * rowH + rowH / 2;
      for (const it of row) {
        if (it.kind === "line") g.append("line").attr("x1", x).attr("x2", x + swatchW).attr("y1", cy).attr("y2", cy)
          .attr("stroke", it.color).attr("stroke-width", (it.width || 2) * k).attr("stroke-dasharray", it.dash || null);
        else if (it.kind === "dot") g.append("circle").attr("cx", x + swatchW / 2).attr("cy", cy).attr("r", sp("s") * 0.75).attr("fill", it.color);
        else g.append("rect").attr("x", x).attr("y", cy - sp("s")).attr("width", sp("l")).attr("height", sp("l")).attr("rx", sp("2xs"))
          .attr("fill", it.color).attr("stroke", it.stroke || null).attr("stroke-width", it.stroke ? k : null)
          .attr("stroke-dasharray", it.stroke ? `${sp("xs")} ${sp("xs")}` : null);
        g.append("text").attr("x", x + swatchW + sp("s")).attr("y", cy + fl.size * 0.36).attr("font-family", fl.family)
          .attr("font-size", fl.size).attr("fill", C.ink2).text(it.label);
        x += itemW(it) + itemGap;
      }
    });
    return g;
  }
  function legend(items, { inset } = {}) {
    if (side) {
      const lay = legendSize(items, headW, true);
      let ly = (sideNotes ? notesBottom : boxBottom ?? headBottom) + gap.legend * k;
      // A legend outranks notes in the header column: drop the notes (they stay in the caption) if needed.
      if (ly + lay.h > fy - sp("l") && sideNotes) { sideNotes.remove(); sideNotes = null; fy = sourceTop; window.__meta.notesShown = []; ly = (boxBottom ?? headBottom) + gap.legend * k; }
      if (ly + lay.h > fy - sp("l")) throw new Error("LAYOUT: legend does not fit in the header column");
      drawLegend(head, lay, M.left, ly);
      headBottom = ly + lay.h;
      return plot.y;
    }
    if (inset) {
      for (const vertical of [false, true]) {
        const lay = legendSize(items, plot.w, vertical);
        const at = inset(lay.w, lay.h);
        if (at) { drawLegend(svg, lay, at.x, at.y); return plot.y; }
      }
    }
    const lay = legendSize(items, plot.w, false);
    drawLegend(svg, lay, plot.x, plot.y);
    return plot.y + lay.h + gap.legend * k;
  }
  return { svg, plot, T, C, font, textBlock, k, side, legend, legendSize, drawLegend };
};

// A number from facts.json by its explicit key; a missing key is an error, never a fallback.
window.fact = function (facts, key) {
  if (!(key in facts) || facts[key] == null) throw new Error(`FACT: no fact "${key}" in facts.json`);
  return facts[key];
};

// Place labels along one axis so none overlap, keeping each as close to its target as possible.
window.dodge = function dodge(items, minGap, lo = -Infinity, hi = Infinity) {
  const s = [...items].sort((a, b) => a.target - b.target);
  s.forEach((d) => (d.pos = Math.min(hi, Math.max(lo, d.target))));
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 1; i < s.length; i++) {
      const overlap = s[i - 1].pos + minGap - s[i].pos;
      if (overlap > 0) {
        s[i - 1].pos -= overlap / 2;
        s[i].pos += overlap / 2;
        moved = true;
      }
    }
    s.forEach((d) => (d.pos = Math.min(hi, Math.max(lo, d.pos))));
    if (!moved) break;
  }
  return s;
};

// Width of a string in a given font, for sizing gutters to their labels.
window.textWidth = function (svg, str, f) {
  const t = svg.append("text").attr("font-family", f.family).attr("font-size", f.size).attr("font-weight", f.weight).text(str);
  // Chart roles are set with tabular figures (frame CSS on .chart); measure them the same way.
  if (f.role && !["headline", "dek", "note", "source", "kicker", "brand"].includes(f.role)) t.style("font-variant-numeric", "tabular-nums");
  const w = t.node().getComputedTextLength();
  t.remove();
  return w;
};

// True when a box (in px) is clear of every series line, sampled along x with linear
// interpolation between points. Used to place labels in empty parts of a chart.
window.clearOfLines = function (box, series, x, y, pad = 6) {
  for (const pts of series) {
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      const xa = x(a.x), xb = x(b.x);
      if (xb < box.l - pad || xa > box.r + pad) continue;
      for (let px = Math.max(xa, box.l - pad); px <= Math.min(xb, box.r + pad); px += 3) {
        const v = a.y + (b.y - a.y) * ((px - xa) / (xb - xa || 1));
        const py = y(v);
        if (py >= box.t - pad && py <= box.b + pad) return false;
      }
    }
  }
  return true;
};
