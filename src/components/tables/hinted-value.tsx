import type { ReactNode } from 'react'

export function HintedValue({ children, hint }: { children: ReactNode; hint: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {hint}
    </span>
  )
}
