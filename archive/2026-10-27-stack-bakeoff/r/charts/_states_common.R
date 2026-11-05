# Shared by the two state charts: data, binned colour scale, frame text.
suppressPackageStartupMessages({ library(dplyr) })

st <- read_tidy("state_cpi.csv")
BREAKS <- c(-2, 0, 2, 4, 6)
COLS <- c(C$diverging_cool, C$diverging_warm)
# Six equal-width bins from -4 to 8; values beyond are squished into the end bins.
fill_scale <- function() {
  # A binned scale handed the six token colours directly. scale_fill_stepsn interpolated
  # a gradient and sent the top bin to NA, greying out Kerala, the chart's whole point.
  binned_scale("fill", palette = function(x) COLS[seq_along(x)], breaks = BREAKS, limits = c(-4, 8),
               oob = function(x, range) pmin(pmax(x, range[1] + 1e-6), range[2] - 1e-6), na.value = C$nodata,
               labels = function(b) paste0(sub("-", "\u2212", b), ifelse(b == 6, "%", "")),
               guide = guide_coloursteps(barwidth = unit(640, "bigpts"), barheight = unit(16, "bigpts"),
                                         show.limits = FALSE, title = NULL))
}
# Encoding check: every state's rendered fill must equal the bin colour the tokens define.
assert_encoding <- function(p, values, ids, layer = 1) {
  b <- ggplot_build(p)$data[[layer]]
  bad <- which(toupper(b$fill) != toupper(bin_colour(values)))
  if (length(bad)) stop("ENCODING: fills differ from token bins for ", paste(ids[bad], collapse = ", "))
  message("encoding ok: ", nrow(b), " marks match token bins")
}
legend_theme <- theme(legend.position = "top", legend.justification = "left", legend.location = "plot",
                      legend.text = element_text(family = fam("axis"), size = fsize("axis"), colour = C$ink2),
                      legend.margin = margin(0, 0, 24, 0))
# One rounding rule for both stacks: half away from zero, as JS toFixed does here.
round_away <- function(v, d) sign(v) * floor(abs(v) * 10^d + 0.5 + 1e-9) / 10^d
fmt_pct <- function(v) paste0(sub("-", "−", formatC(round_away(v, 1), format = "f", digits = 1)), "%")
missing <- st[is.na(st$inflation), ]
lower1 <- function(s) ifelse(grepl("^[A-Z][a-z]", s), paste0(tolower(substr(s, 1, 1)), substring(s, 2)), s)
STATES_TEXT <- list(
  kicker = "Inflation by state",
  headline = "Prices in Kerala are rising seven times as fast as in India overall",
  dek = "Year-on-year change in the consumer price index, December 2025. Kerala's 9.49% compares with 1.33% for India. Manipur, at −4.23%, saw prices fall.",
  notes = paste0("%s: no comparable figure. ", paste0(missing$name, ": ", lower1(missing$note), collapse = "; "), "."),
  source = "MOSPI (CPI, base 2012, combined rural and urban)"
)

# Pick black or white text for a fill using WCAG contrast.
text_on <- function(hex) {
  lum <- function(h) {
    c <- grDevices::col2rgb(h)[, 1] / 255
    c <- ifelse(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055)^2.4)
    sum(c * c(0.2126, 0.7152, 0.0722))
  }
  L <- lum(hex)
  if (1.05 / (L + 0.05) > (L + 0.05) / (lum(C$ink) + 0.05)) "#FFFFFF" else C$ink
}
bin_colour <- function(v) ifelse(is.na(v), C$nodata, COLS[findInterval(v, BREAKS) + 1])
