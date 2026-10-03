import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExternalChangeReload } from '@/components/kosztorys/editor/hooks/use-external-change-reload'
import { readKosztorysRevision } from '@/lib/queries/kosztorys-revision'

vi.mock('@/lib/queries/kosztorys-revision', () => ({ readKosztorysRevision: vi.fn() }))

function renderReload(revision = 'rev-1') {
  const onChanged = vi.fn()
  const hook = renderHook(
    (props: { revision: string }) =>
      useExternalChangeReload({
        investmentId: 1,
        revision: props.revision,
        enabled: true,
        onChanged,
      }),
    { initialProps: { revision } },
  )
  return { ...hook, onChanged }
}

async function returnToTab() {
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
}

beforeEach(() => vi.clearAllMocks())

describe('useExternalChangeReload', () => {
  it('reloads when another window moved the revision', async () => {
    vi.mocked(readKosztorysRevision).mockResolvedValue('rev-2')
    const { onChanged } = renderReload()

    await returnToTab()

    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('stays put when the revision is the one on screen', async () => {
    vi.mocked(readKosztorysRevision).mockResolvedValue('rev-1')
    const { onChanged } = renderReload()

    await returnToTab()

    expect(onChanged).not.toHaveBeenCalled()
  })

  it("does not reload over this window's own accept", async () => {
    vi.mocked(readKosztorysRevision).mockResolvedValue('rev-2')
    const { result, onChanged } = renderReload()

    act(() => result.current.adoptRevision('rev-2'))
    await returnToTab()

    expect(onChanged).not.toHaveBeenCalled()
  })

  it('reloads once per change, not on every return to the tab', async () => {
    vi.mocked(readKosztorysRevision).mockResolvedValue('rev-2')
    const { onChanged } = renderReload()

    await returnToTab()
    await returnToTab()

    expect(onChanged).toHaveBeenCalledTimes(1)
  })
})
