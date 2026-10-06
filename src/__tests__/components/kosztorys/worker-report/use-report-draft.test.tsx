import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  reportDraftKey,
  useReportDraft,
} from '@/components/kosztorys/worker-report/use-report-draft'

const KEY = reportDraftKey(7, 3)

function storeDraft(qtyByItem: Record<number, string>) {
  localStorage.setItem(KEY, JSON.stringify({ qtyByItem, extras: [] }))
}

describe('useReportDraft', () => {
  beforeEach(() => localStorage.clear())

  it('drops szkic lines whose pozycja left the rozpiska and counts them', async () => {
    storeDraft({ 1: '2,5', 2: '4', 3: '1' })

    const { result } = renderHook(() => useReportDraft(KEY, new Set([1])))

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.draft.qtyByItem).toEqual({ 1: '2,5' })
    expect(result.current.droppedCount).toBe(2)
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').qtyByItem).toEqual({ 1: '2,5' }),
    )
  })

  it('does not count a blank entry for a vanished pozycja as lost work', async () => {
    storeDraft({ 1: '3', 2: '', 3: '0' })

    const { result } = renderHook(() => useReportDraft(KEY, new Set([1])))

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.droppedCount).toBe(0)
  })

  it('keeps the whole szkic when every pozycja is still there', async () => {
    storeDraft({ 1: '3', 2: '1,5' })

    const { result } = renderHook(() => useReportDraft(KEY, new Set([1, 2])))

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.draft.qtyByItem).toEqual({ 1: '3', 2: '1,5' })
    expect(result.current.droppedCount).toBe(0)
  })

  it('without a key, neither reads nor writes the device’s szkic', async () => {
    storeDraft({ 1: '9' })

    const { result } = renderHook(() => useReportDraft(undefined, new Set([1])))

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.draft.qtyByItem).toEqual({})
    act(() => result.current.setQty(1, '4'))
    expect(result.current.draft.qtyByItem).toEqual({ 1: '4' })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').qtyByItem).toEqual({ 1: '9' })
  })
})
