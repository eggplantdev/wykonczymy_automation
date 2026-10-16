import type { ReactNode } from 'react'

export function MenuItemBody({ label, description }: { label: ReactNode; description: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </div>
  )
}
