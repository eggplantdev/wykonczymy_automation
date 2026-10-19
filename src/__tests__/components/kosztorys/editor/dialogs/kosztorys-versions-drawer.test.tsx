import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysVersionsDrawer } from '@/components/kosztorys/editor/dialogs/kosztorys-versions-drawer'
import { restoreSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import { fetchKosztorysSnapshots, type SnapshotListItemT } from '@/lib/queries/snapshot-list'
import { toastMessage } from '@/lib/utils/toast'

const SNAPSHOT: SnapshotListItemT = {
  id: 3,
  kind: 'manual',
  label: 'Przed zmianą zakresu',
  takenAt: '2026-09-29T10:00:00.000Z',
  takenBy: null,
  takenByName: null,
}

vi.mocked(fetchKosztorysSnapshots).mockResolvedValue({ success: true, data: [SNAPSHOT] })

describe('KosztorysVersionsDrawer — a restore whose request never completed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // The restore may have committed server-side, so the grid must refetch rather than keep — and
  // autosave back — the pre-restore rows.
  it('closes, says so and reseeds the editor with a refetch', async () => {
    vi.mocked(restoreSnapshotAction).mockRejectedValue(new TypeError('Failed to fetch'))
    const onOpenChange = vi.fn()
    const onRestored = vi.fn()
    render(
      <KosztorysVersionsDrawer
        investmentId={7}
        investmentName="Mieszkanie"
        open
        onOpenChange={onOpenChange}
        onRestored={onRestored}
        flushPendingSaves={async () => {}}
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
