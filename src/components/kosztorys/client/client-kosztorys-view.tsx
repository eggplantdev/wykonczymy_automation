'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo } from 'react'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { useElementHeight } from '@/hooks/use-element-height'
import { useMoneyAxis } from '@/components/kosztorys/use-money-axis'
import { buildV2Grid } from '@/components/kosztorys/kosztorys-v2-columns'
import { ClientKosztorysFooter } from '@/components/kosztorys/client/client-kosztorys-footer'
import { toGridRows } from '@/components/kosztorys/client/to-grid-rows'
import { MoneyAxisToggle } from '@/components/kosztorys/client/money-axis-toggle'
import type { ClientKosztorysViewT } from '@/lib/kosztorys/types'

type PropsT = { view: ClientKosztorysViewT }

/**
 * The client-facing kosztorys: the owner's grid, locked and narrowed.
 *
 * Reuses `buildV2Grid` rather than duplicating the columns — a second column list would drift from
 * the editor's, and the client would end up reading different figures from the ones the owner sees.
 * Safety is not in this component: the payload it renders already carries no subcontractor data
 * (`toClientView`), and the grid is pinned to `view: 'client'` so no subcontractor price is even
 * computable here. `readOnly` + `clientVisible` are the second and third locks.
 */
export function ClientKosztorysView({ view }: PropsT) {
  const [gridRef, gridHeight] = useElementHeight()
  const [storedAxis, setMoneyAxis] = useMoneyAxis()
  // The axis preference is shared with the editor (one localStorage key, a reading habit of the
  // person). 'none' is a valid editor choice but not one this view offers — it would leave the
  // client with quantities and no prices — so it reads as the pair here.
  const moneyAxis = storedAxis === 'none' ? 'both' : storedAxis

  const rows = useMemo(
    () => toGridRows(view.rows, view.stages, view.vatRate, view.globalDiscountActive),
    [view.rows, view.stages, view.vatRate, view.globalDiscountActive],
  )

  const { columns } = useMemo(
    () =>
      buildV2Grid({
        view: 'client',
        stages: view.stages,
        moneyAxis,
        readOnly: true,
        clientVisible: true,
        globalDiscountActive: view.globalDiscountActive,
      }),
    [view.stages, view.globalDiscountActive, moneyAxis],
  )

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="border-border flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <h1 className="truncate text-base font-medium">{view.investmentName}</h1>
        <MoneyAxisToggle value={moneyAxis} onChange={setMoneyAxis} />
      </header>

      {/* The grid needs a px height for virtualization (otherwise it renders every row) and a
          definite width, which `grid-cols-[minmax(0,1fr)]` gives it — without it the grid stretches
          its container to the sum of the columns instead of scrolling them internally. */}
      <div
        ref={gridRef}
        className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden"
      >
        <DynamicDataSheetGrid
          className="kosztorys-grid"
          value={rows}
          // Every cell is `disabled`, so this can never fire; datasheet-grid requires the prop.
          onChange={() => {}}
          columns={columns}
          height={gridHeight}
          rowHeight={32}
          headerRowHeight={32}
          lockRows
          rowKey={({ rowData }) => String(rowData.id)}
        />
      </div>

      <div className="border-border shrink-0 overflow-x-auto border-t">
        <ClientKosztorysFooter view={view} moneyAxis={moneyAxis} />
      </div>
    </div>
  )
}
