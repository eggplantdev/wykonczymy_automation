#!/bin/bash
# Playwright MCP writes a relative filename into .playwright-mcp/, but an absolute one wherever it
# points — agents passed the repo root and left 50 screenshots in the tree (2026-10-14).
f=$(jq -r '.tool_input.filename // empty')
case "$f" in
  ""|/tmp/*|/private/tmp/*|*/.playwright-mcp/*) exit 0 ;;
  /*|*..*) ;;
  *) exit 0 ;;
esac
echo "Screenshot path '$f' is outside .playwright-mcp/ and the scratchpad. Pass a bare filename (it lands in .playwright-mcp/) or a path under your scratchpad directory." >&2
exit 2
