import type { ReactNode } from 'react'

// Right-aligned inline so the icon rides with the number instead of pinning to the column edge.
export function HintedValue({ children, hint }: { children: ReactNode; hint: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {children}
      {hint}
    </span>
  )
}
