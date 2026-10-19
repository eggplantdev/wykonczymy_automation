'use client'

import { createContext, use } from 'react'

export type OpenCataloguePickerT = (sectionId?: number) => void

export const CataloguePickerContext = createContext<OpenCataloguePickerT | null>(null)

export function useCataloguePicker() {
  const open = use(CataloguePickerContext)
  if (!open) throw new Error('useCataloguePicker must be used within CataloguePickerHost')
  return open
}
