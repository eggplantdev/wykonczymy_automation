'use client'

import 'react-datasheet-grid/dist/style.css'
import { useState } from 'react'
import { DataSheetGrid, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'

type SmokeRowT = { description: string | null; measuredQty: number | null }

const columns = [
  { ...keyColumn<SmokeRowT, 'description'>('description', textColumn), title: 'Opis' },
  { ...keyColumn<SmokeRowT, 'measuredQty'>('measuredQty', floatColumn), title: 'Pomiar' },
]

export function KosztorysEditorV2() {
  const [rows, setRows] = useState<SmokeRowT[]>([
    { description: 'Wiersz A', measuredQty: 1 },
    { description: 'Wiersz B', measuredQty: 2 },
  ])
  return <DataSheetGrid value={rows} onChange={setRows} columns={columns} />
}
