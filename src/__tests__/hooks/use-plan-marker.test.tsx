import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlanMarker } from '@/hooks/use-plan-marker'
import { setMediaKindAction } from '@/lib/actions/media-kind'
import { toastMessage } from '@/lib/utils/toast'
import type { MediaFileT } from '@/types/media'

vi.mock('@/lib/actions/media-kind', () => ({ setMediaKindAction: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const FILE = { id: 7, url: '/rzut.jpg', filename: 'rzut.jpg', kind: null } as unknown as MediaFileT

describe('usePlanMarker', () => {
  beforeEach(() => vi.clearAllMocks())

  // `onMark` is fired from an onClick with nowhere to put a rejection, so an action that THROWS
  // (expired cookie, deploy skew, offline) would read as a click that did nothing.
  it('reports a transport-level failure instead of dying as an unhandled rejection', async () => {
    vi.mocked(setMediaKindAction).mockRejectedValue(new Error('Failed to find Server Action'))
    const { result } = renderHook(() => usePlanMarker([FILE]))

    result.current.onMark(FILE)

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(result.current.isMarked(FILE)).toBe(false)
  })

  it('marks the file locally once the action succeeds', async () => {
    vi.mocked(setMediaKindAction).mockResolvedValue({ success: true })
    const { result } = renderHook(() => usePlanMarker([FILE]))

    result.current.onMark(FILE)

    await waitFor(() => expect(result.current.isMarked(FILE)).toBe(true))
  })
})
