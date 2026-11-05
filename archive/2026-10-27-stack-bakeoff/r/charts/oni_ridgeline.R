# Chart 2: every ENSO year since 1950 as a ridge of the Oceanic Nino Index, June to May.
source("r/frame.R")
suppressPackageStartupMessages({ library(dplyr); library(ggrepel) })

oni <- read_tidy("oni.csv")
years <- seq(min(oni$enso_year), max(oni$enso_year))
latest <- tail(oni, 1)
HIGHLIGHT <- c("2026" = "2026", "2015" = "2015–16", "1997" = "1997–98", "1982" = "1982–83")
AMP <- 1.35   # row units per °C (row step = 1); matches the D3 proportions (17px / 12.6px)
T0 <- 0.5     # El Niño threshold

# Smooth each year with a monotone spline (D3 used curveMonotoneX), then build
# three shapes per year: an occluder, the El Niño shading above T0, and the line.
smooth_year <- function(df) {
  if (nrow(df) < 2) return(data.frame(x = df$month_pos, v = df$anom))
  f <- splinefun(df$month_pos, df$anom, method = "monoH.FC")  # piecewise monotone, like curveMonotoneX
  x <- seq(min(df$month_pos), max(df$month_pos), length.out = 20 * (nrow(df) - 1) + 1)
  data.frame(x = x, v = f(x))
}
row_y <- function(yr) -(yr - min(years))  # 1950 at top
layers <- list()
for (yr in years) {
  s <- smooth_year(oni[oni$enso_year == yr, ])
  base <- row_y(yr); hi <- as.character(yr) %in% names(HIGHLIGHT)
  occ <- data.frame(x = c(s$x, rev(s$x)), y = c(base + s$v * AMP, rep(base, nrow(s))))
  sh <- data.frame(x = c(s$x, rev(s$x)), y = c(base + pmax(s$v, T0) * AMP, rep(base + T0 * AMP, nrow(s))))
  ln <- data.frame(x = s$x, y = base + s$v * AMP)
  layers <- c(layers, list(
    geom_polygon(data = occ, aes(x, y), fill = C$surface, colour = NA),
    geom_polygon(data = sh, aes(x, y), fill = if (hi) C$accent else C$diverging_warm[2],
                 alpha = if (hi) 1 else 0.55, colour = NA),
    geom_path(data = ln, aes(x, y), colour = if (hi) C$ink else C$ink2,
              linewidth = (if (hi) 2.2 else 1) / .pt * 72.27 / 96, lineend = "round")
  ))
}

# Labels for highlighted years, at each ridge's peak (or latest point), repelled vertically on the right.
lab <- do.call(rbind, lapply(names(HIGHLIGHT), function(y) {
  d <- oni[oni$enso_year == as.integer(y), ]
  isLatest <- as.integer(y) == latest$enso_year
  pk <- if (isLatest) tail(d, 1) else d[which.max(d$anom), ]
  data.frame(x = pk$month_pos, y = row_y(as.integer(y)) + pk$anom * AMP, isLatest = isLatest,
             label = if (isLatest) sprintf("2026\n+%.2f°C so far", latest$anom)
                     else sprintf("%s\npeak +%.2f°C", HIGHLIGHT[[y]], pk$anom))
}))

p <- ggplot() + layers +
  geom_point(data = lab[lab$isLatest, ], aes(x, y), shape = 21, size = 4, fill = C$accent, colour = C$surface, stroke = 1.5) +
  geom_text_repel(data = lab, aes(x, y, label = label), lineheight = 1.05,
                  family = fam("label_strong"), size = fsize("label_strong") / .pt,
                  colour = ifelse(lab$isLatest, C$accent, C$ink),
                  hjust = 0, direction = "y", xlim = c(11.4, NA), nudge_x = 12 - lab$x,
                  segment.colour = C$ink, segment.size = 1.2 / .pt, box.padding = 0.6, seed = 2) +
  scale_x_continuous(breaks = c(0, 3, 6, 9, 11), labels = c("Jun", "Sep", "Dec", "Mar", "May"),
                     expand = expansion(add = c(0.2, 3.6))) +
  scale_y_continuous(breaks = row_y(seq(1950, 2020, 10)), labels = seq(1950, 2020, 10),
                     expand = expansion(add = c(1, 3))) +
  annotate("segment", x = 14.4, xend = 14.4, y = 2.6, yend = 2.6 + AMP, colour = C$ink, linewidth = 2 / .pt) +
  annotate("text", x = 14.2, y = 2.6 + AMP / 2, label = "1°C", hjust = 1, family = fam("axis"),
           size = fsize("axis") / .pt, colour = C$ink2) +
  coord_cartesian(clip = "off") +
  theme_zd() + theme(panel.grid.major.y = element_blank())

finalise(p,
  kicker = "Climate",
  headline = "No El Niño on record has been this strong this early in the year",
  dek = sprintf("Each line is one year of the Oceanic Niño Index, from June to the next May; shaded peaks are El Niño months, when the Pacific runs at least 0.5°C warmer than normal. At +%.2f°C in July to September 2026, this year is ahead of 1997 (+1.79°C) and 2015 (+1.73°C) at the same point.", latest$anom),
  notes = "Three-month averages of sea-surface temperature anomalies in the Niño 3.4 region against a 1991–2020 base. Recent values are provisional.",
  source = "NOAA Climate Prediction Center (ONI, ERSSTv5)",
  name = "oni_ridgeline")
