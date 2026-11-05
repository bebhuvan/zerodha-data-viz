# Chart 1: what is driving India's CPI inflation, monthly contributions, Jan 2022 - Dec 2025.
source("r/frame.R")
suppressPackageStartupMessages({ library(dplyr); library(ggrepel) })

ORDER <- c("Food and beverages", "Personal care (incl. gold, silver)", "Housing", "Fuel and light", "Everything else")
pal <- setNames(c(C$categorical[1:4], C$other), ORDER)

d <- read_tidy("cpi_contrib.csv") |> filter(month >= "2022-01") |>
  mutate(date = as.Date(paste0(month, "-01")), component = factor(component, levels = rev(ORDER)))
h <- read_tidy("cpi_headline.csv") |> filter(month >= "2022-01") |> mutate(date = as.Date(paste0(month, "-01")))
last <- max(d$date)
lastH <- h$headline_published[h$date == last]
lastC <- d |> filter(date == last)
stackmid <- function(comp) {
  # Middle of a series' segment in the last bar, following ggplot's stacking order.
  v <- lastC |> arrange(component)
  pos <- v |> filter(contrib_pp >= 0) |> mutate(top = cumsum(contrib_pp), mid = top - contrib_pp / 2)
  neg <- v |> filter(contrib_pp < 0) |> mutate(top = cumsum(contrib_pp), mid = top - contrib_pp / 2)
  bind_rows(pos, neg)$mid[bind_rows(pos, neg)$component == comp]
}
pc <- lastC$contrib_pp[lastC$component == ORDER[2]]
fd <- lastC$contrib_pp[lastC$component == ORDER[1]]
labs_df <- data.frame(
  date = last + 28,  # start labels clear of the last bar
  y = c(lastH, stackmid(ORDER[2]), stackmid(ORDER[1])),
  label = c(sprintf("Headline %.2f%%", lastH), sprintf("Personal care +%.2f", pc), paste("Food", fmt_signed(fd)))
)

p <- ggplot(d, aes(date, contrib_pp, fill = component)) +
  geom_col(width = 25, colour = C$surface, linewidth = 2 * 72.27 / 96 / .pt) +
  geom_hline(yintercept = 0, colour = C$ink, linewidth = 1.5 / .pt) +
  geom_line(data = h, aes(date, headline_published), inherit.aes = FALSE, colour = C$surface, linewidth = 7 / .pt) +
  geom_line(data = h, aes(date, headline_published), inherit.aes = FALSE, colour = C$ink, linewidth = 3 / .pt) +
  geom_point(data = h[h$date == last, ], aes(date, headline_published), inherit.aes = FALSE,
             shape = 21, size = 4, fill = C$ink, colour = C$surface, stroke = 1.5) +
  geom_text_repel(data = labs_df, aes(date, y, label = label), inherit.aes = FALSE,
                  family = fam("label_strong"), size = fsize("label_strong") / .pt, colour = C$ink,
                  hjust = 0, direction = "y", xlim = c(as.numeric(last) + 28, NA),
                  segment.colour = NA, box.padding = 0.15, min.segment.length = Inf, seed = 1) +
  scale_fill_manual(values = pal, breaks = ORDER) +
  scale_y_continuous(limits = c(-2, 8), breaks = seq(-2, 8, 2), expand = c(0, 0),
                     labels = function(b) ifelse(b == 8, "8 pts", sub("-", "−", b))) +
  scale_x_date(breaks = as.Date(paste0(2022:2025, "-01-01")), date_labels = "%Y", expand = expansion(add = c(20, 480))) +
  coord_cartesian(clip = "off") +
  guides(fill = guide_legend(nrow = 2, byrow = TRUE)) +
  theme_zd() +
  theme(legend.position = "top", legend.justification = "left", legend.location = "plot",
        legend.key.size = unit(18, "bigpts"), legend.key.spacing.x = unit(28, "bigpts"),
        legend.margin = margin(0, 0, 30, 0), axis.ticks.x = element_line(colour = C$axis),
        axis.ticks.length.x = unit(8, "bigpts"))

finalise(p,
  kicker = "Inflation",
  headline = "Food is now pulling inflation down. Personal care, which includes gold and silver, is holding it up",
  dek = "Contribution of each group to India's year-on-year CPI inflation, in percentage points. In December 2025, food subtracted 0.89 points and personal care added 1.16 points to headline inflation of 1.33%.",
  notes = "Contributions use MOSPI's 2012-base CPI weights and add up to headline inflation. Personal care and effects also covers toiletries and other personal items.",
  source = "MOSPI (CPI, base 2012, All-India combined), Markets by Zerodha calculations",
  name = "cpi_contrib")
