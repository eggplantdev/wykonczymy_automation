import type { ReactNode } from 'react'

// A menu or select item rendered as icon + label + a muted one-line explanation, so each entry says
// what it does inline (a hover tooltip inside an already-open Radix menu fights it for focus).
export function MenuItemBody({ label, description }: { label: ReactNode; description: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </div>
  )
}
