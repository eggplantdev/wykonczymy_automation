import type { ReactNode } from 'react'

// The disabled render for every custom-input cell in the read-only (clientView) grid: a plain
// left-aligned, truncated label where an editor would otherwise sit. Shared so the four custom cells
// can't drift on their read-only markup (they had before — one carried a stray alignment class).
export function ReadOnlyCellText({ children }: { children: ReactNode }) {
  return <span className="block size-full truncate px-2 text-left text-sm">{children}</span>
}
