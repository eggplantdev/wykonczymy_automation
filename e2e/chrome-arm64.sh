#!/bin/sh
# pnpm ships here as the x86_64 `@pnpm/exe` build, so it runs under Rosetta — and macOS hands that
# binary preference down the WHOLE process tree.
# `exec` keeps the fds Playwright passes on 3/4 for `--remote-debugging-pipe`.
CHROME="${E2E_CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# Without this, a machine with no system Chrome fails as `spawn EACCES` from inside Playwright —
# an error about the shim, pointing nowhere near the missing browser it is actually about.
if [ ! -x "$CHROME" ]; then
  echo "chrome-arm64.sh: no executable Chrome at $CHROME — install Google Chrome or set E2E_CHROME_PATH." >&2
  exit 127
fi

exec arch -arm64 "$CHROME" "$@"
