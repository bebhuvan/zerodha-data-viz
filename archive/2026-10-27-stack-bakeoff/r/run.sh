#!/usr/bin/env bash
# Run an R chart script inside the viz-r environment: r/run.sh r/charts/<chart>.R
ENV="$HOME/.local/micromamba/envs/viz-r"
export PROJ_DATA="$ENV/share/proj" GDAL_DATA="$ENV/share/gdal"
cd "$(dirname "$0")/.." && exec "$ENV/bin/Rscript" "$@"
