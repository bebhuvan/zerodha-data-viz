# Chart 3a: state CPI inflation, December 2025, as a choropleth.
source("r/frame.R")
source("r/charts/_states_common.R")
suppressPackageStartupMessages({ library(sf); library(ggrepel) })
sf_use_s2(FALSE)

LCC <- "+proj=lcc +lat_1=12 +lat_2=28 +lon_0=80 +datum=WGS84"
geo <- st_read(file.path(ROOT, "shared/geo/india_states_dissolved.geojson"), quiet = TRUE) |>
  st_make_valid() |> st_transform(LCC) |> left_join(st, by = c("st_nm" = "name"))

# Hatching for missing data: a grid of diagonal lines clipped to those states.
nodata <- geo[is.na(geo$inflation), ]
bb <- st_bbox(geo); step <- 22000
offs <- seq(bb["xmin"] - (bb["ymax"] - bb["ymin"]), bb["xmax"], by = step)
hatch <- st_sfc(lapply(offs, function(o) st_linestring(rbind(c(o, bb["ymin"]), c(o + (bb["ymax"] - bb["ymin"]), bb["ymax"])))), crs = LCC)
hatch <- st_intersection(hatch, st_union(nodata))

cent <- suppressWarnings(st_point_on_surface(geo))
xy <- cbind(st_drop_geometry(cent), st_coordinates(cent))
call <- xy |> filter(st_nm %in% c("Kerala", "Lakshadweep", "Manipur", "Bihar")) |>
  mutate(label = paste0(st_nm, "\n", fmt_pct(inflation)), side = ifelse(st_nm %in% c("Kerala", "Lakshadweep"), "left", "right"))
xr <- bb["xmax"] - bb["xmin"]
left_lim <- bb["xmin"] - 0.30 * xr; right_lim <- bb["xmax"] + 0.22 * xr

p <- ggplot() +
  geom_sf(data = geo, aes(fill = inflation), colour = C$surface, linewidth = 1.2 / .pt) +
  geom_sf(data = hatch, colour = C$muted, linewidth = 2 / .pt) +
  geom_point(data = call, aes(X, Y), size = 2.4, colour = C$ink) +
  geom_text_repel(data = call[call$side == "left", ], aes(X, Y, label = label), hjust = 0, direction = "y",
                  xlim = c(left_lim, bb["xmin"] - 0.02 * xr), nudge_x = left_lim - call$X[call$side == "left"],
                  family = fam("label_strong"), size = fsize("label_strong") / .pt, colour = C$ink, lineheight = 1.05,
                  segment.colour = C$ink, segment.size = 1.2 / .pt, box.padding = 0.5, seed = 3) +
  geom_text_repel(data = call[call$side == "right", ], aes(X, Y, label = label), hjust = 1, direction = "y",
                  xlim = c(bb["xmax"] + 0.02 * xr, right_lim), nudge_x = right_lim - call$X[call$side == "right"],
                  family = fam("label_strong"), size = fsize("label_strong") / .pt, colour = C$ink, lineheight = 1.05,
                  segment.colour = C$ink, segment.size = 1.2 / .pt, box.padding = 0.5, seed = 3) +
  fill_scale() +
  coord_sf(crs = LCC, xlim = c(left_lim, right_lim), expand = FALSE, clip = "off", datum = NA) +
  theme_zd() + legend_theme + theme(axis.text = element_blank(), panel.grid = element_blank())

assert_encoding(p, geo$inflation, geo$st_nm)
STATES_TEXT$notes <- sprintf(STATES_TEXT$notes, "Hatched")
do.call(finalise, c(list(p), STATES_TEXT, list(name = "state_map")))
