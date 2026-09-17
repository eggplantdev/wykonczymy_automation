'use client'

import { useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { compareWithCatalogueAction } from '@/lib/actions/work-catalogue'
import type { CatalogueComparisonT } from '@/lib/kosztorys/work-catalogue/types'

export type CatalogueCompareActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  result: CatalogueComparisonT | null
  error: string | null
  loaded: boolean
  requestOpen: () => void
  refreshComparison: () => void
}

const READ_FAILED = 'Nie udało się porównać kosztorysu z katalogiem.'

export function useCatalogueCompareAction(): CatalogueCompareActionT {
  const { investmentId } = useKosztorysEditorContext()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<CatalogueComparisonT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  function runComparison() {
    return compareWithCatalogueAction(investmentId)
      .then((res) => {
        setResult(res.success ? res.data : null)
        setError(res.success ? null : (res.error ?? READ_FAILED))
      })
      .catch(() => {
        setResult(null)
        setError(READ_FAILED)
      })
  }

  // Fetch on the click, same reason as „Porównaj z arkuszem": Radix never fires `onOpenChange` for a
  // programmatic `open`, so the dialog cannot fetch itself.
  function requestOpen() {
    setOpen(true)
    setLoaded(false)
    setResult(null)
    setError(null)
    void runComparison().finally(() => setLoaded(true))
  }

  // Re-read rather than patched out of the lists: what the owner saved to the cennik is whatever he
  // left in the katalog form, which is free to differ from the rozpiska he opened it from — so only
  // the server knows whether that praca is now „Zgodne". `loaded` stays true so the window keeps its
  // rows and its rozwinięte foldy instead of blinking back to „Porównuję…".
  function refreshComparison() {
    void runComparison()
  }

  return { open, setOpen, result, error, loaded, requestOpen, refreshComparison }
}

export function CatalogueCompareMenuItem() {
  const { catalogueCompare } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={catalogueCompare.requestOpen}>
      <BookOpenCheck />
      <MenuItemBody
        label="Porównaj z katalogiem…"
        description="Sprawdź, gdzie ceny i stawki tego kosztorysu odbiegają od katalogu prac."
      />
    </DropdownMenuItem>
  )
}
