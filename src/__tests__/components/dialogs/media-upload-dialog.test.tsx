import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'

// `FileInput` hides its real input (`sr-only`) behind a styled drop target, so there is no role or
// label to reach it by — the element itself is the only handle.
function fileInput() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!
}

function pickedFile() {
  return new File([new Uint8Array(4)], 'rzut.pdf', { type: 'application/pdf' })
}

function openDialog(props: Partial<React.ComponentProps<typeof MediaUploadDialog>> = {}) {
  const onFiles = vi.fn()
  render(<MediaUploadDialog open onOpenChange={vi.fn()} onFiles={onFiles} {...props} />)
  return { onFiles }
}

describe('MediaUploadDialog — znacznik „to jest rzut"', () => {
  // A faktura is never a rysunek, so an invoice surface must not even be offered the choice.
  it('is absent unless the surface asks for it', () => {
    openDialog()

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  // The pick IS the confirmation, so the marker has to be read at that moment — a checkbox whose
  // state the pick ignored would label nothing while looking like it did.
  it('rides along with the pick when checked', async () => {
    const user = userEvent.setup()
    const { onFiles } = openDialog({ allowPlanMarker: true })

    await user.click(screen.getByRole('checkbox'))
    await user.upload(fileInput(), pickedFile())

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'rzut.pdf' })], true)
  })

  // The dialog stays mounted when Radix unmounts its content, so a tick left behind by a cancelled
  // pick would silently stamp the next upload as a rzut.
  it('forgets the tick when the dialog is closed without a pick', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button onClick={() => setOpen(true)}>otwórz</button>
          <MediaUploadDialog open={open} onOpenChange={setOpen} onFiles={vi.fn()} allowPlanMarker />
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('checkbox'))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'otwórz' }))

    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('stays off when the marker was offered but not checked', async () => {
    const user = userEvent.setup()
    const { onFiles } = openDialog({ allowPlanMarker: true })

    await user.upload(fileInput(), pickedFile())

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'rzut.pdf' })], false)
  })
})
