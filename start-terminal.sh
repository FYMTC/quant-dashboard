#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3100}"

echo "[dashboard] starting on :${PORT}"
exec npm run dev -- -p "${PORT}"
