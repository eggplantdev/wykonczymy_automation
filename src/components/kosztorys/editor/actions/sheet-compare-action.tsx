'use client'

import { useState } from 'react'
import { Scale as ScaleIcon } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { compareWithSheet, type SheetCompareResultT } from '@/lib/actions/kosztorys-import'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export type SheetCompareActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  result: SheetCompareResultT | null
  error: string | null
  loaded: boolean
  read: () => void
  requestOpen: () => void
}

export function useSheetCompareAction(): SheetCompareActionT {
  const { investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<SheetCompareResultT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Signalling on every open
  // would arm a remount that has nothing to remount for, and it would fire on the next unrelated
  // edit instead, taking the owner's search and sort with it.
  function read() {
    setLoaded(false)
    setResult(null)
    setError(null)
    void compareWithSheet(investmentId)
      .then((res) => {
        setResult(res.success ? res.data : null)
        setError(res.success ? null : res.error)
        if (res.success && (res.data.refresh?.updated ?? 0) + (res.data.refresh?.cleared ?? 0) > 0)
          onTreeReplaced?.()
      })
      .catch(() => {
        setResult(null)
        setError('Nie udało się odczytać arkusza Google.')
      })
      .finally(() => setLoaded(true))
  }

  function requestOpen() {
    setOpen(true)
    read()
  }

  return { open, setOpen, result, error, loaded, read, requestOpen }
}

export function SheetCompareMenuItem() {
  const { sheetCompare } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={sheetCompare.requestOpen}>
      <ScaleIcon />
      <MenuItemBody
        label="Porównaj z arkuszem…"
        description="Sprawdź, czy arkusz i aplikacja liczą to samo, i odśwież zapisane Pomiary z natury."
      />
    </DropdownMenuItem>
  )
}
