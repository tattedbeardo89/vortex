#!/usr/bin/env bash
# Intentional Vortex integration point. Upstream app/framework sources stay unchanged.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$root/custom/vortex/run.py" build "$@"
