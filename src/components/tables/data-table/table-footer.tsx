import type { ReactNode } from 'react'

// Sticky lives on the cells, not on the `<tfoot>`: in the virtualized path the footer sits inside
// the scroll container, and only cell-level sticky pins it there across browsers. The opaque
// background is what stops virtual rows scrolling through underneath it.
export function TableFooter({ children }: { children: ReactNode }) {
  return (
    <tfoot className="[&_td]:border-border [&_td]:bg-background [&_td]:text-foreground [&_td]:sticky [&_td]:bottom-0 [&_td]:border-t [&_td]:px-3 [&_td]:py-2">
      {children}
    </tfoot>
  )
}
