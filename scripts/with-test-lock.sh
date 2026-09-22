#!/usr/bin/env bash
# Serializes the heavy test legs against every OTHER checkout on this machine, not just this one.
# The mutex itself is a global tool (`with-test-lock`, ~/.local/bin) because two agents in two
# repos saturate the same 8 cores — a per-repo lock would not see them. This file only delegates,
# so the rule lives in one place and other repos wire the same one-liner.
#
# No tool installed (fresh clone, CI) → run unlocked rather than fail: the lock is a courtesy to
# a shared laptop, not a correctness gate. Say so once, loudly, so it is not a silent downgrade.
set -euo pipefail

[ "$#" -gt 0 ] || { echo "usage: with-test-lock.sh <command> [args...]" >&2; exit 64; }

if command -v with-test-lock >/dev/null 2>&1; then
  exec with-test-lock "$@"
fi

echo "⚠  with-test-lock not on PATH — running WITHOUT the machine-wide test lock." >&2
echo "   Install it from ai-toolkit (or copy it to ~/.local/bin) to serialize suites across repos." >&2
exec "$@"
