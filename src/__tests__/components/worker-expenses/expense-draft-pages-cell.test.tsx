import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const { uploadFiles } = vi.hoisted(() => ({ uploadFiles: vi.fn() }))
vi.mock('@/hooks/use-media-upload', () => ({
  useMediaUpload: () => ({ isUploading: false, uploadFiles }),
}))
vi.mock('@/components/dialogs/media-preview-button', () => ({
  MediaPreviewButton: ({ onAdd }: { onAdd: (close: () => void) => void }) => (
    <button type="button" onClick={() => onAdd(() => {})}>
      Dodaj zdjęcia
    </button>
  ),
}))
vi.mock('@/components/dialogs/media-upload-dialog', () => ({
  MediaUploadDialog: ({ open, onFiles }: { open: boolean; onFiles: (files: File[]) => void }) =>
    open ? (
      <button type="button" onClick={() => onFiles([photo('a.jpg'), photo('b.jpg')])}>
        Wybierz dwa
      </button>
    ) : null,
}))

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const pages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    url: `/m/${i + 1}`,
    filename: `strona-${i + 1}.jpg`,
    mimeType: 'image/jpeg',
  }))

async function addTwoTo(pageCount: number) {
  render(<ExpenseDraftPagesCell draftId={5} media={pages(pageCount)} isEditable />)
  await userEvent.click(screen.getByRole('button', { name: 'Dodaj zdjęcia' }))
  await userEvent.click(screen.getByRole('button', { name: 'Wybierz dwa' }))
}

describe('ExpenseDraftPagesCell — limit zdjęć', () => {
  beforeEach(() => vi.clearAllMocks())

  it('two photos on top of seven are refused before anything goes up', async () => {
    await addTwoTo(7)

    expect(uploadFiles).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith(
      'Najwyżej 8 zdjęć w jednym wydatku — wyślij resztę osobno.',
      'error',
    )
  })

  it('two photos on top of six go up', async () => {
    await addTwoTo(6)

    expect(uploadFiles).toHaveBeenCalledTimes(1)
  })
})
