import { StrictMode, useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TemplateWorkshop, type ServerWorkshopT } from '@/components/presets/template-workshop'
import { openPresetInWorkshopAction } from '@/lib/actions/kosztorys-presets'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

const editorMounts = vi.hoisted(() => ({ count: 0 }))

// The editor stands in as its tree's token, plus a mount counter: the host swaps WHICH tree it
// renders, and a swap that remounted the editor would silently reset the restore latch.
vi.mock('@/components/kosztorys/editor/kosztorys-editor-v2', () => ({
  KosztorysEditorV2: ({ tree }: { tree: KosztorysTreeT }) => {
    useEffect(() => {
      editorMounts.count += 1
    }, [])
    return <div data-testid="editor">{tree.revision}</div>
  },
}))
vi.mock('@/lib/actions/kosztorys-presets', () => ({ openPresetInWorkshopAction: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const PRESET_ID = 5

function tree(token: string): KosztorysTreeT {
  return { revision: token, sections: [] } as unknown as KosztorysTreeT
}

function held(token: string): ServerWorkshopT {
  return { workshop: { investmentId: 1, tree: tree(token) } }
}

function notHeld(): ServerWorkshopT {
  return { workshop: null }
}

function host(server: ServerWorkshopT, autoOpen: boolean) {
  return (
    <TemplateWorkshop
      presetId={PRESET_ID}
      presetName="Łazienka"
      workCatalogue={[]}
      server={server}
      autoOpen={autoOpen}
    />
  )
}

beforeEach(() => {
  vi.mocked(openPresetInWorkshopAction).mockReset()
  editorMounts.count = 0
  window.history.replaceState(null, '', `/szablony/${PRESET_ID}?open=1`)
})

describe('TemplateWorkshop', () => {
  // Every call is a write transaction on the shared warsztat, and dev mounts every effect twice.
  it('auto-opens once under StrictMode and renders the tree the action returned', async () => {
    vi.mocked(openPresetInWorkshopAction).mockResolvedValue({
      success: true,
      data: { investmentId: 1, tree: tree('from-action') },
    })

    render(<StrictMode>{host(notHeld(), true)}</StrictMode>)

    expect(await screen.findByTestId('editor')).toHaveTextContent('from-action')
    expect(openPresetInWorkshopAction).toHaveBeenCalledTimes(1)
    expect(openPresetInWorkshopAction).toHaveBeenCalledWith(PRESET_ID)
  })

  // Left in the url, a reload or a copied link would re-run the write.
  it('strips the open flag once the action settles', async () => {
    vi.mocked(openPresetInWorkshopAction).mockResolvedValue({
      success: true,
      data: { investmentId: 1, tree: tree('from-action') },
    })

    render(host(notHeld(), true))

    await screen.findByTestId('editor')
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe(`/szablony/${PRESET_ID}`)
  })

  it('strips the flag without writing when the warsztat already holds the szablon', () => {
    render(host(held('from-server'), true))

    expect(screen.getByTestId('editor')).toHaveTextContent('from-server')
    expect(openPresetInWorkshopAction).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('falls back to the prompt when the open fails, and its button retries', async () => {
    vi.mocked(openPresetInWorkshopAction)
      .mockResolvedValueOnce({ success: false, error: 'Nie znaleziono szablonu' })
      .mockResolvedValueOnce({ success: true, data: { investmentId: 1, tree: tree('retried') } })
    const user = userEvent.setup()

    render(host(notHeld(), true))

    await user.click(await screen.findByRole('button', { name: 'Otwórz szablon' }))

    expect(await screen.findByTestId('editor')).toHaveTextContent('retried')
    expect(openPresetInWorkshopAction).toHaveBeenCalledTimes(2)
  })

  // A typed url or a stale tab must not take the warsztat from whoever holds it without a click.
  it('writes nothing without the flag until the prompt is clicked', async () => {
    vi.mocked(openPresetInWorkshopAction).mockResolvedValue({
      success: true,
      data: { investmentId: 1, tree: tree('from-action') },
    })
    const user = userEvent.setup()

    render(host(notHeld(), false))

    expect(openPresetInWorkshopAction).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Otwórz szablon' }))
    expect(await screen.findByTestId('editor')).toHaveTextContent('from-action')
  })

  it('takes a later server tree over the action’s, in the same editor', async () => {
    vi.mocked(openPresetInWorkshopAction).mockResolvedValue({
      success: true,
      data: { investmentId: 1, tree: tree('from-action') },
    })
    const { rerender } = render(host(notHeld(), true))
    await screen.findByTestId('editor')

    rerender(host(held('from-server'), false))

    expect(screen.getByTestId('editor')).toHaveTextContent('from-server')
    expect(editorMounts.count).toBe(1)
  })

  // Someone else opened their szablon: editing on would write into a warsztat that holds theirs.
  it('returns to the prompt when a later server render finds the warsztat taken', async () => {
    vi.mocked(openPresetInWorkshopAction).mockResolvedValue({
      success: true,
      data: { investmentId: 1, tree: tree('from-action') },
    })
    const { rerender } = render(host(notHeld(), true))
    await screen.findByTestId('editor')

    rerender(host(notHeld(), false))

    await waitFor(() => expect(screen.queryByTestId('editor')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Otwórz szablon' })).toBeInTheDocument()
  })
})
