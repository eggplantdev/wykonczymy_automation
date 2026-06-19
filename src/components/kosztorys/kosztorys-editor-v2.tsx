'use client'

import 'react-datasheet-grid/dist/style.css'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { Button } from '@/components/ui/button'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import { diffRow, treeToRows } from '@/lib/kosztorys/v2-rows'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  setStageProgressAction,
  updateItemFieldAction,
  type ItemPatchT,
} from '@/lib/actions/kosztorys'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

type PropsT = { investmentId: number; tree: KosztorysTreeT }

// Trzy widoki nad jednym zbiorem: zmieniają tylko aktywną cenę i jej liczone.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Robocizna' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

export function KosztorysEditorV2({ tree }: PropsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const [view, setView] = useState<PriceViewT>('client')
  // Snapshot poprzednich wierszy do diffu (po id pozycji).
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))

  const columns = buildV2Columns(tree.stages, view)

  function onChange(next: KosztorysV2RowT[]) {
    setRows(next)
    for (const row of next) {
      const prev = prevById.current.get(row.id)
      if (!prev) continue
      const diff = diffRow(prev, row)
      if (diff.itemPatch) {
        const patch = diff.itemPatch
        for (const field of Object.keys(patch)) {
          save(`item:${row.id}:${field}`, () =>
            updateItemFieldAction(row.id, { [field]: patch[field as keyof ItemPatchT] }),
          )
        }
      }
      for (const sc of diff.stageChanges ?? []) {
        save(`progress:${row.id}:${sc.stageId}`, () =>
          setStageProgressAction(row.id, sc.stageId, sc.qty),
        )
      }
      prevById.current.set(row.id, row)
    }
    // Pociągnij przeliczone sumy z serwera po ciszy zapisu (lekcja fire-and-forget).
    setTimeout(() => router.refresh(), 700)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            size="sm"
            variant={v.value === view ? 'default' : 'outline'}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      <DynamicDataSheetGrid value={rows} onChange={onChange} columns={columns} />
    </div>
  )
}
