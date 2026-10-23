'use client'

import { createContext, use, type ReactNode } from 'react'

export type HeaderMenuExtensionT = {
  // Read as the menu opens: a click on one of its items lands outside the grid, which clears the
  // grid's selection before the item's onSelect runs.
  targetIds: (columnId: string) => string[]
  items: (targetIds: string[]) => ReactNode
}

export const HeaderColumnIdContext = createContext<string | undefined>(undefined)
export const HeaderMenuExtensionContext = createContext<HeaderMenuExtensionT | undefined>(undefined)

export function useHeaderMenuExtension() {
  return {
    columnId: use(HeaderColumnIdContext),
    extension: use(HeaderMenuExtensionContext),
  }
}
