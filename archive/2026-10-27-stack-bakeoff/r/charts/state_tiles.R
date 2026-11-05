# Chart 3b: the same data as an equal-area tile grid, so small states are visible.
source("r/frame.R")
source("r/charts/_states_common.R")

tiles <- st |> mutate(bg = bin_colour(inflation), ink = vapply(bg, text_on, ""),
                      ink = ifelse(is.na(inflation), C$ink, ink),
                      value = ifelse(is.na(inflation), "n/a", fmt_pct(inflation)))

p <- ggplot(tiles, aes(col, -row)) +
  geom_tile(aes(fill = inflation), width = 0.95, height = 0.95) +
  geom_tile(data = tiles[is.na(tiles$inflation), ], width = 0.95, height = 0.95, fill = C$nodata) +
  geom_text(aes(x = col - 0.38, y = -row + 0.24, label = code, colour = I(ink)), hjust = 0, vjust = 1,
            family = fam("label_strong"), size = fsize("label_strong") / .pt) +
  geom_text(aes(x = col - 0.38, y = -row - 0.32, label = value, colour = I(ink)), hjust = 0, vjust = 0,
            family = fam("axis"), size = fsize("axis") / .pt) +
  fill_scale() +
  coord_fixed(expand = FALSE, xlim = c(0.5, 8.5), ylim = c(-8.5, -0.5)) +
  theme_zd() + legend_theme + theme(axis.text = element_blank(), panel.grid = element_blank(), panel.grid.major.y = element_blank())

assert_encoding(p, tiles$inflation, tiles$code)
STATES_TEXT$notes <- sprintf(STATES_TEXT$notes, "Grey")
do.call(finalise, c(list(p), STATES_TEXT, list(name = "state_tiles")))
