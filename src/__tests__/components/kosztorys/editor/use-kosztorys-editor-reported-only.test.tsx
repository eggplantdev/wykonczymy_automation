import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { REPORT_FIELD } from '@/lib/kosztorys/worker-report/report-field'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'
import { stackUndoRedo } from '@/__tests__/helpers/kosztorys-undo-redo'
import { workerAudience } from '@/__tests__/helpers/worker-audience'

const TREE = tree(
  [item(1, 'Płytki', 12, 100), item(2, 'Fugi', 8, 50), item(3, 'Silikon', 4, 20)],
  [stage(7, 1, 'Etap 1')],
)

function renderReport(reported: Record<number, number>) {
  return renderHook(() =>
    useKosztorysEditor({
      investmentId: 1,
      tree: TREE,
      undoRedo: stackUndoRedo().api,
      preview: true,
      worker: workerAudience(),
      seams: {
        transformColumns: (columns) => columns,
        initialRowPatch: (rows) =>
          rows.map((row) => ({ ...row, [REPORT_FIELD]: reported[row.id] ?? 0 })),
        onPreviewChange: vi.fn(),
      },
    }),
  )
}

const visibleIds = (result: { current: ReturnType<typeof useKosztorysEditor> }) =>
  result.current.viewRows.map((row) => row.id)

describe('„Tylko zgłaszane przeze mnie”', () => {
  it('keeps a row he clears under the cursor until he toggles the switch again', () => {
    const { result } = renderReport({ 1: 3, 2: 1 })

    act(() => result.current.setReportedOnly(true))
    expect(visibleIds(result)).toEqual([1, 2])

    act(() =>
      result.current.onChange(
        result.current.rows.map((row) => (row.id === 2 ? { ...row, [REPORT_FIELD]: 0 } : row)),
      ),
    )
    expect(visibleIds(result)).toEqual([1, 2])

    act(() => result.current.setReportedOnly(false))
    act(() => result.current.setReportedOnly(true))
    expect(visibleIds(result)).toEqual([1])
  })
})
