# Editorial frame for ggplot charts: same layout as d3/frame.js, built with grid.
# finalise(plot, kicker, headline, dek, notes, source, name) writes out/r/<name>.svg and .png.
suppressPackageStartupMessages({
  library(ggplot2); library(grid); library(gridtext); library(systemfonts); library(jsonlite)
})

ROOT <- normalizePath(file.path(dirname(sys.frame(1)$ofile %||% "r/frame.R"), ".."))
TK <- fromJSON(file.path(ROOT, "shared/tokens.json"))
C <- TK$color

# systemfonts registers one file per family name (plain), so each weight gets an alias.
# The linter knows the same aliases.
for (f in list.files(file.path(ROOT, "shared/fonts"), "\\.ttf$", full.names = TRUE)) {
  parts <- strsplit(tools::file_path_sans_ext(basename(f)), "-")[[1]]
  fam <- if (parts[1] == "SourceSerif4") "Source Serif 4" else "Libre Franklin"
  register_font(paste0(fam, " W", parts[2]), plain = f)
}
fam <- function(key) {
  t <- TK$type[[key]]
  paste0(TK$font[[t$family]], " W", t$weight)
}
fsize <- function(key) TK$type[[key]]$size
gp_of <- function(key, col) {
  t <- TK$type[[key]]
  gpar(fontfamily = fam(key), fontsize = t$size, col = col, lineheight = t$leading %||% 1.25)
}

theme_zd <- function() {
  theme_minimal(base_family = fam("axis"), base_size = fsize("axis")) +
    theme(
      plot.background = element_rect(fill = C$surface, colour = NA),
      panel.background = element_rect(fill = C$surface, colour = NA),
      panel.grid.minor = element_blank(), panel.grid.major.x = element_blank(),
      panel.grid.major.y = element_line(colour = C$grid, linewidth = 1.5 / .pt * 72.27 / 96),
      axis.text = element_text(colour = C$muted, size = fsize("axis")),
      axis.title = element_blank(),
      legend.text = element_text(family = fam("label"), size = fsize("label"), colour = C$ink2),
      legend.title = element_blank(),
      plot.margin = margin(0, 0, 0, 0)
    )
}

box <- function(text, key, col, width) {
  textbox_grob(text, x = 0, y = 1, hjust = 0, vjust = 1, halign = 0, valign = 1,
               width = width, gp = gp_of(key, col), padding = unit(0, "pt"), margin = unit(0, "pt"),
               box_gp = gpar(col = NA, fill = NA))
}

finalise <- function(p, kicker, headline, dek, notes = character(), source, name) {
  W <- TK$canvas$width; H <- TK$canvas$height; M <- TK$margin
  inner <- unit(W - M$left - M$right, "bigpts")
  draw <- function() {
    grid.newpage()
    grid.rect(gp = gpar(fill = C$surface, col = NA))
    pt <- function(g, what = "h") convertHeight(grobHeight(g), "bigpts", valueOnly = TRUE)
    y <- M$top
    place <- function(g, top, h) {
      pushViewport(viewport(x = unit(M$left, "bigpts"), y = unit(H - top, "bigpts"),
                            width = inner, height = unit(h, "bigpts"), just = c("left", "top")))
      grid.draw(g); popViewport()
    }
    k <- box(toupper(kicker), "kicker", C$accent, inner); hk <- pt(k); place(k, y, hk); y <- y + hk + 14
    h <- box(headline, "headline", C$ink, inner); hh <- pt(h); place(h, y, hh); y <- y + hh + 16
    d <- box(dek, "dek", C$ink2, inner); hd <- pt(d); place(d, y, hd); y <- y + hd

    # Footer, bottom-up: brand + source, rule, notes.
    brand <- textGrob(TK$brand, x = unit(W - M$right, "bigpts"), y = unit(M$bottom, "bigpts"),
                      hjust = 1, vjust = 0, gp = gp_of("brand", C$ink))
    grid.draw(brand)
    bw <- convertWidth(grobWidth(brand), "bigpts", valueOnly = TRUE)
    s <- box(paste0("Source: ", source), "note", C$muted, unit(W - M$left - M$right - bw - 32, "bigpts"))
    hs <- pt(s)
    fy <- H - M$bottom - hs + fsize("note") * 0.25
    place(s, fy, hs)
    fy <- fy - 20
    grid.lines(x = unit(c(M$left, W - M$right), "bigpts"), y = unit(H - fy, "bigpts"),
               gp = gpar(col = C$grid, lwd = 1.5 * 72 / 96))
    for (n in rev(notes)) {
      g <- box(n, "note", C$muted, inner); hn <- pt(g)
      fy <- fy - hn - 10
      place(g, fy, hn)
    }
    top <- y + 36; bottom <- fy - 32
    pushViewport(viewport(x = unit(M$left, "bigpts"), y = unit(H - top, "bigpts"),
                          width = inner, height = unit(bottom - top, "bigpts"), just = c("left", "top")))
    grid.draw(ggplotGrob(p)); popViewport()
  }
  svglite::svglite(file.path(ROOT, "out/r", paste0(name, ".svg")), width = W / 72, height = H / 72, bg = C$surface)
  draw(); invisible(dev.off())
  ragg::agg_png(file.path(ROOT, "out/r", paste0(name, ".png")), width = W * TK$canvas$scale,
                height = H * TK$canvas$scale, res = 72 * TK$canvas$scale, background = C$surface)
  draw(); invisible(dev.off())
  message("rendered ", name)
}

read_tidy <- function(f) read.csv(file.path(ROOT, "data/tidy", f), stringsAsFactors = FALSE)
fmt_signed <- function(v, d = 2) sub("-", "−", formatC(v, format = "f", digits = d))
