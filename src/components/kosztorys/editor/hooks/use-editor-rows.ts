'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { revertField } from '@/lib/kosztorys/row-ops'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export function useEditorRows(
  tree: KosztorysTreeT,
  initialRowPatch?: (rows: KosztorysV2RowT[]) => KosztorysV2RowT[],
) {
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() =>
    initialRowPatch ? initialRowPatch(treeToRows(tree)) : treeToRows(tree),
  )
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  const rowsRef = useRef(rows)
  useLayoutEffect(() => {
    rowsRef.current = rows
  })

  function patchRows(
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) {
    setRows((rs) => rs.map((r) => (match(r) ? patch(r) : r)))
    for (const [id, r] of prevById.current) {
      if (match(r)) prevById.current.set(id, patch(r))
    }
  }

  function revertOne(
    id: number,
    field: keyof KosztorysV2RowT,
    prevVal: unknown,
    attempted: unknown,
  ) {
    setRows((rs) => revertField(rs, id, field, prevVal, attempted))
    const snap = prevById.current.get(id)
    if (snap && snap[field] === attempted) {
      prevById.current.set(id, { ...snap, [field]: prevVal } as KosztorysV2RowT)
    }
  }

  return { rows, setRows, rowsRef, prevById, patchRows, revertOne }
}

export type EditorRowsT = ReturnType<typeof useEditorRows>
