import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UploadButton } from '@/components/ui/upload-button'

describe('UploadButton', () => {
  it('announces the upload while bytes are moving', () => {
    render(<UploadButton label="Dodaj zdjęcia lub pliki" isUploading onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Przesyłanie...' })).toBeDisabled()
  })
})
