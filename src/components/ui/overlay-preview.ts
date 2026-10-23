'use client'

import { createContext, use } from 'react'

export const OverlayPreview = createContext(false)

export function useOverlayPreview() {
  return use(OverlayPreview)
}
