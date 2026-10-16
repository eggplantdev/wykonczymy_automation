#!/bin/bash
f=$(jq -r '.tool_input.filename // empty')
case "$f" in
  ""|/tmp/*|/private/tmp/*|*/.playwright-mcp/*) exit 0 ;;
  /*|*..*) ;;
  *) exit 0 ;;
esac
echo "Screenshot path '$f' is outside .playwright-mcp/ and the scratchpad. Pass a bare filename (it lands in .playwright-mcp/) or a path under your scratchpad directory." >&2
exit 2
