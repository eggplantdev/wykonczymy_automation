import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInvestorActions } from '@/components/kosztorys/editor/actions/investor-actions'
import { investorShareUrl } from '@/lib/kosztorys/investor-share-url'

const toastMessage = vi.hoisted(() => vi.fn())
const readClientViewSettings = vi.hoisted(() => vi.fn())
const getShareLinkAction = vi.hoisted(() => vi.fn())
const generateShareLinkAction = vi.hoisted(() => vi.fn())

vi.mock('@/lib/utils/toast', () => ({ toastMessage }))
// `'use server'` modules — vitest's stub throws on call, so each is named explicitly.
vi.mock('@/lib/queries/client-view-settings-endpoint', () => ({ readClientViewSettings }))
vi.mock('@/lib/actions/kosztorys-share', () => ({ getShareLinkAction, generateShareLinkAction }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({ investmentId: 7 }),
}))

const writeText = vi.fn()
const write = vi.fn()

function setClipboard(withClipboardItem: boolean) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, write },
    configurable: true,
  })
  if (withClipboardItem) {
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(readonly items: Record<string, Promise<Blob>>) {}
      },
    )
  }
}

async function share() {
  const { result } = renderHook(() => useInvestorActions())
  act(() => result.current.requestShare())
  await waitFor(() => expect(result.current.shareLoaded).toBe(true))
  return result
}

describe('useInvestorActions — „Udostępnij"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writeText.mockResolvedValue(undefined)
    write.mockResolvedValue(undefined)
    setClipboard(false)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('mints a link when there is none and copies it', async () => {
    getShareLinkAction.mockResolvedValue({ success: true, data: null })
    generateShareLinkAction.mockResolvedValue({ success: true, data: 'nowy' })

    const result = await share()

    expect(generateShareLinkAction).toHaveBeenCalledTimes(1)
    expect(result.current.shareToken).toBe('nowy')
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(investorShareUrl('nowy')))
    expect(toastMessage).toHaveBeenCalledWith('Link skopiowany do schowka.', 'success')
  })

  // Minting over a live link would cut off the investor who already holds it.
  it('copies the existing link and never mints over it', async () => {
    getShareLinkAction.mockResolvedValue({ success: true, data: 'stary' })

    const result = await share()

    expect(generateShareLinkAction).not.toHaveBeenCalled()
    expect(result.current.shareToken).toBe('stary')
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(investorShareUrl('stary')))
  })

  it('does not read the preview settings', async () => {
    getShareLinkAction.mockResolvedValue({ success: true, data: 'stary' })

    await share()

    expect(readClientViewSettings).not.toHaveBeenCalled()
  })

  // Safari refuses a clipboard write that starts after an await, so it must start on the click.
  it('starts the clipboard write before the link is known', async () => {
    setClipboard(true)
    let resolveRead: (value: unknown) => void = () => {}
    getShareLinkAction.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)))

    const { result } = renderHook(() => useInvestorActions())
    act(() => result.current.requestShare())

    expect(write).toHaveBeenCalledTimes(1)
    const [[item]] = write.mock.calls[0] as [[{ items: Record<string, Promise<Blob>> }]]
    resolveRead({ success: true, data: 'stary' })
    const blob = await item.items['text/plain']
    expect(await blob.text()).toBe(investorShareUrl('stary'))
  })

  // One cause, one toast: the failure is the link, not the clipboard.
  it('reports a failed mint as the action’s error, not as a copy failure', async () => {
    getShareLinkAction.mockResolvedValue({ success: true, data: null })
    generateShareLinkAction.mockResolvedValue({ success: false, error: 'Brak uprawnień' })

    const result = await share()

    expect(result.current.shareToken).toBeNull()
    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith('Brak uprawnień', 'error'))
    expect(toastMessage).not.toHaveBeenCalledWith('Nie udało się skopiować.', 'error')
    expect(writeText).not.toHaveBeenCalled()
  })
})
