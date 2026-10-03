import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import type { SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'

const toastMessage = vi.hoisted(() => vi.fn())
const restoreSnapshotAction = vi.hoisted(() => vi.fn())

const SNAPSHOT: SnapshotListItemT = {
  id: 3,
  investmentId: 7,
  kind: 'manual',
  label: 'Przed zmianą zakresu',
  takenAt: '2026-09-29T10:00:00.000Z',
  takenBy: null,
  takenByName: null,
}

vi.mock('@/lib/utils/toast', () => ({ toastMessage }))
vi.mock('@/lib/actions/kosztorys-snapshots', () => ({
  listSnapshotsAction: vi.fn(async () => ({ success: true, data: [SNAPSHOT] })),
  restoreSnapshotAction,
}))

describe('KosztorysVersionsDrawer — a restore whose request never completed (EX-940)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  // The restore may have committed server-side, so the grid must refetch rather than keep — and
  // autosave back — the pre-restore rows.
  it('closes, says so and reseeds the editor with a refetch', async () => {
    restoreSnapshotAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const onOpenChange = vi.fn()
    const onRestored = vi.fn()
    render(
      <KosztorysVersionsDrawer
        investmentId={7}
        investmentName="Mieszkanie"
        open
        onOpenChange={onOpenChange}
        onRestored={onRestored}
      />,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Przywróć' }))
    await user.click(await screen.findByRole('button', { name: 'Przywróć' }))

    await vi.waitFor(() => expect(onRestored).toHaveBeenCalledWith({ refetch: true }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(toastMessage).toHaveBeenCalledWith(
      'Przywracanie przerwane — odświeżam kosztorys',
      'error',
      6000,
    )
  })
})
