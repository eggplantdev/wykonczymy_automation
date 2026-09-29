import type { ReactNode } from 'react'

// A numeric cell that may carry a hint icon next to it. Right-aligned inline so the icon rides with
// the number instead of pinning to the column edge, which is what put the two figures out of line.
export function HintedValue({ children, hint }: { children: ReactNode; hint: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {children}
      {hint}
    </span>
  )
}
