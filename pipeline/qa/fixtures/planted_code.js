// Planted defects for qa/lint_code.mjs: exactly 5 issues (4 spacing, 1 colour); the last line opts out.
window.Templates.planted = function (F) {
  const { svg, k } = F;
  const gap = 14 * k;                                   // spacing: not from the scale
  const pad = k * 6;                                    // spacing: same, written the other way round
  svg.append("rect").attr("stroke-dasharray", `${3 * k} ${3 * k}`).attr("fill", "#C24E1C");  // spacing + colour
  const fine = 160 * k;  // grammar-ok: a planted line that opts out, to prove the escape works
  return gap + pad + fine;
};
