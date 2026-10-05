import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScanReportDialog } from '@/components/worker-reports/scan-report-dialog'

const picked = vi.hoisted(() => ({ files: [] as File[] }))
vi.mock('@/components/forms/hooks/use-file-pick-ingest', () => ({
  useFilePickIngest: () => ({
    files: picked.files,
    isIngesting: false,
    inputKey: 0,
    reset: vi.fn(),
    fileInputProps: { disabled: false, onChange: vi.fn() },
  }),
}))

const mockReadPage = vi.fn()
vi.mock('@/lib/utils/read-worker-report-client', () => ({
  readWorkerReportClient: (...args: unknown[]) => mockReadPage(...args),
}))

const mockReadInvestments = vi.fn()
vi.mock('@/lib/queries/worker-reports', () => ({
  readScanWorkerInvestments: (...args: unknown[]) => mockReadInvestments(...args),
}))

const mockCreate = vi.fn()
vi.mock('@/lib/actions/worker-report-scan', () => ({
  createScannedReportAction: (...args: unknown[]) => mockCreate(...args),
}))

const mockUpload = vi.fn()
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploads: (files: File[], submit: (ids: number[]) => unknown) => {
    mockUpload(files)
    return submit([41])
  },
}))

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const PAGE = { rows: [{ ref: '35812-7', qty: 2, isUncertain: false }], extras: [] }
const photo = () => new File(['x'], 'kartka.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vi.clearAllMocks()
  picked.files = []
  URL.createObjectURL = vi.fn(() => 'blob:photo')
  URL.revokeObjectURL = vi.fn()
  mockReadPage.mockResolvedValue(PAGE)
  mockCreate.mockResolvedValue({ success: true, data: { reportId: 77 } })
  mockReadInvestments.mockResolvedValue([{ investmentId: 6, name: 'Mokotów', token: null }])
})

const send = () => screen.getByRole('button', { name: 'Wczytaj' })

describe('ScanReportDialog', () => {
  it('keeps „Wczytaj" disabled until a worker, an investment and a photo are set', async () => {
    const onCreated = vi.fn()
    const { rerender } = render(
      <ScanReportDialog
        open
        onOpenChange={vi.fn()}
        workers={[{ id: 9, name: 'Jan Kowalski' }]}
        onCreated={onCreated}
      />,
    )
    expect(send()).toBeDisabled()

    await userEvent.click(screen.getByRole('combobox', { name: 'Pracownik' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Jan Kowalski' }))
    // The worker's only investment is picked for him.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Inwestycja' })).toHaveTextContent('Mokotów'),
    )
    expect(mockReadInvestments).toHaveBeenCalledWith(9)
    expect(send()).toBeDisabled()

    picked.files = [photo()]
    rerender(
      <ScanReportDialog
        open
        onOpenChange={vi.fn()}
        workers={[{ id: 9, name: 'Jan Kowalski' }]}
        onCreated={onCreated}
      />,
    )
    expect(send()).toBeEnabled()
  })

  it('offers a retry for a failed photo and uploads nothing', async () => {
    picked.files = [photo(), photo()]
    mockReadPage.mockResolvedValueOnce(PAGE).mockRejectedValueOnce(new Error('timeout'))
    render(
      <ScanReportDialog
        open
        onOpenChange={vi.fn()}
        investmentId={6}
        worker={{ id: 9, name: 'Jan Kowalski' }}
        onCreated={vi.fn()}
      />,
    )

    await userEvent.click(send())

    expect(await screen.findByRole('button', { name: 'Ponów' })).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()

    // The retry reads the failed photo alone, then files the zgłoszenie.
    mockReadPage.mockResolvedValueOnce(PAGE)
    await userEvent.click(screen.getByRole('button', { name: 'Ponów' }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockReadPage).toHaveBeenCalledTimes(3)
  })

  it('files the zgłoszenie and hands its id to the entry point', async () => {
    picked.files = [photo()]
    const onCreated = vi.fn()
    render(
      <ScanReportDialog
        open
        onOpenChange={vi.fn()}
        investmentId={6}
        worker={{ id: 9, name: 'Jan Kowalski' }}
        onCreated={onCreated}
      />,
    )

    await userEvent.click(send())

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(77, 6))
    expect(mockCreate).toHaveBeenCalledWith({
      investmentId: 6,
      workerId: 9,
      pages: [PAGE],
      mediaIds: [41],
    })
  })
})
