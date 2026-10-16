import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { AddLineToRozpiska } from '@/components/kosztorys/editor/dialogs/worker-reports/add-line-to-rozpiska'
import type { ReportLineT } from '@/lib/kosztorys/worker-report/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const { pointReportLineAction, insertCatalogueItemsAction, captured } = vi.hoisted(() => ({
  pointReportLineAction: vi.fn(async () => ({ success: true as const, data: undefined })),
  insertCatalogueItemsAction: vi.fn(),
  captured: { onPick: undefined as undefined | ((...args: unknown[]) => Promise<boolean>) },
}))

vi.mock('@/lib/actions/accept-worker-report', () => ({ pointReportLineAction }))
vi.mock('@/lib/actions/catalogue-to-kosztorys', () => ({ insertCatalogueItemsAction }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 7,
    rows: [],
    sections: [{ sectionId: 3, sectionName: 'Prace dodatkowe' }],
    workCatalogue: [],
    isTemplate: false,
    handleAppendedCatalogueItems: vi.fn(),
    placeNewItem: vi.fn(),
    recoverStaleTree: vi.fn(),
  }),
}))
vi.mock('@/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog', () => ({
  CatalogueSwapDialog: (props: { onPick: (...args: unknown[]) => Promise<boolean> }) => {
    captured.onPick = props.onPick
    return null
  },
}))

const extraLine = {
  id: 11,
  kind: 'extra',
  unit: 'szt',
  sectionName: 'Prace dodatkowe',
} as ReportLineT
const entry = { id: 5 } as WorkCatalogueItemT

describe('AddLineToRozpiska — praca spoza rozpiski (EX-1055)', () => {
  it('remembers on the server a pozycja the sekcja already holds', async () => {
    const onChange = vi.fn()
    render(
      <AddLineToRozpiska
        line={extraLine}
        entryId={undefined}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    )

    await captured.onPick?.(entry, 3, { catalogueId: 5, matchedItemIds: [42], itemId: 42 })

    expect(insertCatalogueItemsAction).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(11, { catalogueId: 5, matchedItemIds: [42], itemId: 42 })
    expect(pointReportLineAction).toHaveBeenCalledWith(7, 11, 42)
  })
})
