import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UploadButton } from '@/components/ui/upload-button'

describe('UploadButton', () => {
  // The gallery withholds the picker while a REMOVAL is in flight too, and it used to do that by
  // feeding the combined flag to `isUploading` — so deleting the last file left the empty state
  // announcing „Przesyłanie…" for a delete. The two reasons to be disabled are now separate props.
  it('stays disabled for an unrelated reason without claiming an upload', () => {
    render(
      <UploadButton
        label="Dodaj zdjęcia lub pliki"
        isUploading={false}
        disabled
        onClick={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Dodaj zdjęcia lub pliki' })
    expect(button).toBeDisabled()
    expect(screen.queryByText('Przesyłanie...')).not.toBeInTheDocument()
  })

  it('announces the upload while bytes are moving', () => {
    render(<UploadButton label="Dodaj zdjęcia lub pliki" isUploading onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Przesyłanie...' })).toBeDisabled()
  })
})
