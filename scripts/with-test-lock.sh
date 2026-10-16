#!/usr/bin/env bash
set -euo pipefail

[ "$#" -gt 0 ] || { echo "usage: with-test-lock.sh <command> [args...]" >&2; exit 64; }

if command -v with-test-lock >/dev/null 2>&1; then
  exec with-test-lock "$@"
fi

echo "⚠  with-test-lock not on PATH — running WITHOUT the machine-wide test lock." >&2
echo "   Install it from ai-toolkit (or copy it to ~/.local/bin) to serialize suites across repos." >&2
exec "$@"
