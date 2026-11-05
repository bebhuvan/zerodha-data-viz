// Chart 3a: state CPI inflation, December 2025, as a choropleth.
// The map is fitted to the whole plot; the legend and callouts go into open sea or empty land-free
// space next to it (checked by sampling the geography), so the map renders as large as it can.
window.draw = function ({ tokens, data }) {
  const S = States({ tokens, data });
  // The map's own shape (width/height), plus room for callouts either side, tells side layouts how
  // much width the chart can use.
  const [[ax0, ay0], [ax1, ay1]] = d3.geoPath(d3.geoConicConformal().parallels([12, 28]).rotate([-80, 0])
    .fitSize([1000, 1000], data.india)).bounds(data.india);
  const F = Frame({ tokens, ...S.text, plotAspect: ((ax1 - ax0) / (ay1 - ay0)) * 1.1 });
  const { svg, plot, C, font, k } = F;
  S.defs(svg);
  const fs = font("label_strong"), fl = font("label");

  // d3-geo wants clockwise exterior rings; GeoJSON files often wind the other way,
  // which d3 reads as "the whole globe minus this state". Rewind any ring that does.
  const geo = { ...data.india, features: data.india.features.map((f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const fixed = polys.map((rings) => rings.map((ring) =>
      d3.geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI ? [...ring].reverse() : ring));
    return { ...f, geometry: { type: "MultiPolygon", coordinates: fixed } };
  }) };
  const byName = (n) => geo.features.find((f) => f.properties.st_nm === n);
  const CALLOUTS = [
    { name: "Kerala", side: "left" },
    { name: "Lakshadweep", side: "left", marker: true },  // islands too small to see: mark them
    { name: "Manipur", side: "right" },
  ];
  const calloutW = (c) => Math.max(textWidth(svg, c.name, fs), textWidth(svg, S.fmt(S.byName.get(c.name).inflation), fl));

  const fitTo = (x0, y0, x1, y1) => d3.geoConicConformal().parallels([12, 28]).rotate([-80, 0]).fitExtent([[x0, y0], [x1, y1]], geo);
  // Land test by pixel lookup in an offscreen raster of the map, rebuilt when the projection
  // changes; fast enough for the callout search below to try every order and direction.
  let mask = null;
  const onLand = (proj, x, y) => {
    if (!mask || mask.proj !== proj) {
      const cv = document.createElement("canvas");
      cv.width = tokens.canvas.width; cv.height = tokens.canvas.height;
      const ctx = cv.getContext("2d");
      ctx.beginPath(); d3.geoPath(proj, ctx)(geo); ctx.fill();
      mask = { proj, data: ctx.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
    }
    const xi = Math.round(x), yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < mask.w && yi < mask.h && mask.data[(yi * mask.w + xi) * 4 + 3] > 0;
  };
  // Empty when no sampled point inside the box (plus padding) falls on land.
  const clearOfLand = (proj, b, pad = 10 * k) => {
    for (let px = b.x - pad; px <= b.x + b.w + pad; px += 4 * k)
      for (let py = b.y - pad; py <= b.y + b.h + pad; py += 4 * k) if (onLand(proj, px, py)) return false;
    return true;
  };

  // Map fitted to the whole plot (right-aligned in side layouts, where spare width sits next to the
  // header column). The legend goes into an empty corner if one is free of land, else above the map.
  let proj, lg;
  const fitAll = (y0) => {
    // Side layouts right-align the map but keep room for right-hand callouts beside it.
    const rRes = F.side ? d3.max(CALLOUTS.filter((c) => c.side === "right"), calloutW) + 40 * k : 0;
    const p = fitTo(plot.x, y0, plot.x + plot.w - rRes, plot.y + plot.h);
    if (F.side) { const [[, ], [bx1]] = d3.geoPath(p).bounds(geo); const [tx, ty] = p.translate(); p.translate([tx + plot.x + plot.w - rRes - bx1, ty]); }
    return p;
  };
  proj = fitAll(plot.y);
  const [[mx0]] = d3.geoPath(proj).bounds(geo);
  for (const vertical of [true, false]) {
    const L = S.layoutLegend(svg, F, { vertical, maxW: plot.w * 0.45 });
    const spots = [{ x: Math.max(plot.x, mx0), y: plot.y }, { x: plot.x, y: plot.y }, { x: plot.x + plot.w - L.w, y: plot.y }];
    const spot = spots.find((p) => clearOfLand(proj, { ...p, w: L.w, h: L.h }));
    if (spot) { lg = S.legend(svg, F, spot.x, spot.y, { layout: L }); break; }
  }
  if (!lg) {
    lg = S.legend(svg, F, plot.x, plot.y, { maxW: plot.w });
    proj = fitAll(lg.bottom + 16 * k);
  }
  const path = d3.geoPath(proj);
  const g = svg.append("g").attr("data-ramp", 1);  // binned colour ramp: exempt from the highlight-hue budget
  const hatch = tokens.hatch_nodata;
  g.selectAll("path.state").data(geo.features).join("path").attr("class", "state")
    .attr("d", path).attr("fill", (f) => S.fill(S.byName.get(f.properties.st_nm), hatch))
    .attr("stroke", C.surface).attr("stroke-width", k).attr("stroke-linejoin", "round");
  S.assertEncoding(g.selectAll("path.state").nodes(), geo.features.map((f) => S.byName.get(f.properties.st_nm)?.inflation),
    geo.features.map((f) => f.properties.st_nm), hatch);
  // Missing states are white on white: give them a dashed outline so their shape stays readable.
  if (!hatch) {
    g.selectAll("path.nodata").data(geo.features.filter((f) => S.missing(S.byName.get(f.properties.st_nm))))
      .join("path").attr("class", "nodata").attr("data-device", "dashed").attr("d", path).attr("fill", "none")
      .attr("stroke", C.nodata_stroke).attr("stroke-width", k).attr("stroke-dasharray", `${3 * k} ${3 * k}`);
  }

  // Callouts: each label searches outward from its state, nearest first, over a fan of directions
  // (its preferred side first) for a spot clear of land, the legend and labels already placed.
  const blockH = fs.size + fl.size + 10 * k;
  // Leaders already drawn, and a test for a segment crossing a box (sampled).
  const segHits = (x0, y0, x1, y1, b) => { for (let t = 0; t <= 1; t += 0.02) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (x > b.l && x < b.r && y > b.t && y < b.b) return true; } return false; };
  const FAN = { left: [180, 200, 160, 220, 140, 240, 120, 100, 260], right: [0, 20, -20, 40, -40, 60, -60, 90, -90] };
  // A leader must cross open sea or empty space, not other states: sample its outer 70%.
  const leaderClear = (x0, y0, x1, y1) => {
    for (let t = 0.3; t <= 1; t += 0.03) if (onLand(proj, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    return true;
  };
  // Every order of placing the callouts is tried (there are only a few); the one with the shortest
  // total leader length wins. Each label takes the nearest spot in its fan that is clear of land,
  // the legend, labels and leaders already placed.
  const placeOne = (c, taken, leaders) => {
    const [cx, cy] = path.centroid(byName(c.name));
    const w = calloutW(c);
    const start = c.marker ? 14 * k : 8 * k;
    for (let d = 28 * k; d < plot.w; d += 6 * k) {
      for (const deg of FAN[c.side]) {
        const a = (deg * Math.PI) / 180, px = cx + Math.cos(a) * (start + d), py = cy - Math.sin(a) * (start + d);
        const anchor = Math.cos(a) > 0.35 ? "start" : Math.cos(a) < -0.35 ? "end" : "middle";
        const l = anchor === "start" ? px : anchor === "end" ? px - w : px - w / 2;
        const box = { l, r: l + w, t: py - blockH / 2, b: py + blockH / 2 };
        if (box.l < plot.x || box.r > plot.x + plot.w || box.t < plot.y || box.b > plot.y + plot.h) continue;
        if (taken.some((b) => box.l < b.r && b.l < box.r && box.t < b.b && b.t < box.b)) continue;
        if (!clearOfLand(proj, { x: box.l, y: box.t, w, h: blockH }, 6 * k) || !leaderClear(cx, cy, px, py)) continue;
        if (leaders.some((sg) => segHits(...sg, box)) || taken.slice(1).some((b) => segHits(cx, cy, px, py, b))) continue;
        return { c, cx, cy, px, py, anchor, box, d };
      }
    }
    return null;
  };
  const perms = (xs) => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  let plan = null;
  for (const order of perms(CALLOUTS)) {
    const taken = [{ l: lg.x - 12 * k, r: lg.x + lg.w + 12 * k, t: lg.y - 12 * k, b: lg.y + lg.h + 12 * k }], leaders = [], out = [];
    for (const c of order) {
      const p = placeOne(c, taken, leaders);
      if (!p) break;
      out.push(p);
      taken.push({ l: p.box.l - 8 * k, r: p.box.r + 8 * k, t: p.box.t - 8 * k, b: p.box.b + 8 * k });
      leaders.push([p.cx, p.cy, p.px, p.py]);
    }
    if (out.length === order.length && (!plan || d3.sum(out, (p) => p.d) < d3.sum(plan, (p) => p.d))) plan = out;
  }
  if (!plan) throw new Error("LAYOUT: no open space for the map callouts");
  for (const best of plan) {
    const { c, cx, cy } = best, r = S.byName.get(c.name);
    const { px, py, anchor } = best;
    const ty = py - blockH / 2 + fs.size * 0.8;
    g.append("text").attr("x", px).attr("y", ty).attr("text-anchor", anchor)
      .attr("font-family", fs.family).attr("font-size", fs.size).attr("font-weight", fs.weight).attr("fill", C.ink).text(c.name);
    g.append("text").attr("x", px).attr("y", ty + fl.size + 6 * k).attr("text-anchor", anchor)
      .attr("font-family", fl.family).attr("font-size", fl.size).attr("fill", C.ink2).text(S.fmt(r.inflation));
    // Leader from the label's near edge (or its top/bottom middle) to the state.
    const lx = anchor === "start" ? px - 6 * k : anchor === "end" ? px + 6 * k : px;
    const ly = anchor === "middle" ? (py > cy ? best.box.t - 4 * k : best.box.b + 4 * k) : ty - fs.size * 0.35;
    const ex = cx + (lx > cx ? 1 : -1) * (c.marker ? 11 : 3) * k;
    g.append("path").attr("d", `M${lx},${ly}L${ex},${cy}`).attr("stroke", C.leader).attr("stroke-width", k)
      .attr("stroke-dasharray", tokens.leader_dash).attr("fill", "none");
    if (c.marker) g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 9 * k).attr("fill", S.fill(r, hatch))
      .attr("stroke", C.surface).attr("stroke-width", 2 * k);
    else g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 3 * k).attr("fill", C.ink);
  }
};
