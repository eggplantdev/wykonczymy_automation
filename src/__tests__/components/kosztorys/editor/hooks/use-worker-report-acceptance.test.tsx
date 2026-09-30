import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkerReportAcceptance } from '@/components/kosztorys/editor/hooks/use-worker-report-acceptance'
import { acceptWorkerReportAction } from '@/lib/actions/worker-report'
import { stageLane } from '@/lib/kosztorys/save-lanes'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { AcceptReportResultT } from '@/lib/kosztorys/worker-report/types'

vi.mock('@/lib/actions/worker-report', () => ({
  acceptWorkerReportAction: vi.fn(),
  rejectWorkerReportAction: vi.fn(),
}))

const NEW_STAGE = { id: 30, ordinal: 3 } as KosztorysStageT
const APPENDED = [{ id: 5, name: 'Salon', items: [{ id: 90 }] }] as AcceptReportResultT['appended']

function renderAcceptance() {
  const calls: string[] = []
  const record =
    (name: string) =>
    (..._args: unknown[]) => {
      calls.push(name)
    }
  const args = {
    investmentId: 1,
    flushUndoBuffer: vi.fn(record('flush')),
    drain: vi.fn(async () => {
      calls.push('drain')
    }),
    adoptStage: vi.fn(record('adoptStage')),
    appendItems: vi.fn(record('appendItems')),
    patchRows: vi.fn(record('patchRows')),
    pruneByIds: vi.fn(record('pruneByIds')),
    adoptRevision: vi.fn(record('adoptRevision')),
    reportFailure: vi.fn(record('reportFailure')),
  }
  vi.mocked(acceptWorkerReportAction).mockImplementation(async () => {
    calls.push('action')
    return {
      success: true,
      data: {
        stage: NEW_STAGE,
        appended: APPENDED,
        cells: [
          { itemId: 10, stageId: 30, qtyDone: 12 },
          { itemId: 90, stageId: 30, qtyDone: 3 },
        ],
        revision: 'rev-2',
      },
    }
  })
  const { result } = renderHook(() => useWorkerReportAcceptance(args))
  return { result, args, calls }
}

beforeEach(() => vi.clearAllMocks())

describe('useWorkerReportAcceptance', () => {
  it('quiets the touched cells before the call, and adopts the new etap before appending into it', async () => {
    const { result, args, calls } = renderAcceptance()

    await result.current.acceptReport(
      {
        investmentId: 1,
        reportId: 7,
        target: { kind: 'stage', stageId: 30 },
        lines: [{ lineId: 1, acceptedQty: 7 }],
        extras: [],
      },
      [10],
    )

    expect(args.drain).toHaveBeenCalledWith([stageLane(10, 30)])
    expect(calls).toEqual([
      'flush',
      'drain',
      'action',
      'adoptStage',
      'appendItems',
      'patchRows',
      'pruneByIds',
      'adoptRevision',
    ])
    expect(args.appendItems).toHaveBeenCalledWith(APPENDED[0], [NEW_STAGE])
  })

  it("writes the server's absolute figure into the cell rather than adding locally", async () => {
    const { result, args } = renderAcceptance()

    await result.current.acceptReport(
      { investmentId: 1, reportId: 7, target: { kind: 'new' }, lines: [], extras: [] },
      [],
    )

    const [match, patch] = vi.mocked(args.patchRows).mock.calls[0]
    const row = { id: 10, [stageKey(30)]: 5 } as unknown as KosztorysV2RowT
    const untouched = { id: 11 } as unknown as KosztorysV2RowT
    expect(match(row)).toBe(true)
    expect(match(untouched)).toBe(false)
    expect(patch(row)).toMatchObject({ [stageKey(30)]: 12 })
    expect(args.pruneByIds).toHaveBeenCalledWith([10, 90])
    expect(args.adoptRevision).toHaveBeenCalledWith('rev-2')
  })

  it('touches nothing in the grid when the accept is refused', async () => {
    const { result, args } = renderAcceptance()
    vi.mocked(acceptWorkerReportAction).mockResolvedValueOnce({
      success: false,
      error: 'To zgłoszenie zostało już rozpatrzone.',
    })

    const accepted = await result.current.acceptReport(
      { investmentId: 1, reportId: 7, target: { kind: 'new' }, lines: [], extras: [] },
      [],
    )

    expect(accepted).toBe(false)
    expect(args.reportFailure).toHaveBeenCalledWith(
      'To zgłoszenie zostało już rozpatrzone.',
      undefined,
    )
    expect(args.adoptStage).not.toHaveBeenCalled()
    expect(args.patchRows).not.toHaveBeenCalled()
    expect(args.adoptRevision).not.toHaveBeenCalled()
  })
})
