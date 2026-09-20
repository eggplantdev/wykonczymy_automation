#!/bin/sh
# Launch system Chrome as ARM64, whatever the parent process's architecture preference is.
#
# pnpm ships here as the x86_64 `@pnpm/exe` build (`npm_config_user_agent` says `darwin x64`), so it
# runs under Rosetta — and macOS hands that binary preference down the WHOLE process tree. Chrome is
# a universal binary, so `pnpm test:e2e` used to launch a TRANSLATED renderer: a bare JS loop took
# 1211 ms instead of 303 ms, hydration 20 s instead of 0.3 s, and every spec that waits on a hydrated
# handler blew its budget. Nothing in the suite was slow — the browser was emulated.
#
# `arch -arm64` resets that preference for the exec'd process. `exec` keeps the fds Playwright passes
# on 3/4 for `--remote-debugging-pipe`.
CHROME="${E2E_CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# Without this, a machine with no system Chrome fails as `spawn EACCES` from inside Playwright —
# an error about the shim, pointing nowhere near the missing browser it is actually about.
if [ ! -x "$CHROME" ]; then
  echo "chrome-arm64.sh: no executable Chrome at $CHROME — install Google Chrome or set E2E_CHROME_PATH." >&2
  exit 127
fi

exec arch -arm64 "$CHROME" "$@"
