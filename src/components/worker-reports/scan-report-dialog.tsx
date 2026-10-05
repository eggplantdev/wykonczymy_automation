'use client'

import { useState } from 'react'
import Image from 'next/image'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { useObjectUrls } from '@/hooks/use-object-urls'
import { createScannedReportAction } from '@/lib/actions/worker-report-scan'
import type { ScanWorkerT, WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import { MAX_SCAN_PHOTOS } from '@/lib/kosztorys/worker-report/constants'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { readScanWorkerInvestments } from '@/lib/queries/worker-reports'
import { cn } from '@/lib/utils/cn'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { readWorkerReportClient } from '@/lib/utils/read-worker-report-client'
import { toastMessage } from '@/lib/utils/toast'
import { usePendingStore } from '@/stores/pending-store'

const READ_CONCURRENCY = 3
const READ_PENDING_KEY = 'worker-report-scan'

type PageReadT = ScanPageT | 'failed' | undefined

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Whichever the entry point already knows; the rest is picked here.
  investmentId?: number
  worker?: ScanWorkerT
  // The choice when `worker` is not given.
  workers?: ScanWorkerT[]
  onCreated: (reportId: number, investmentId: number) => void
}

export function ScanReportDialog({
  open,
  onOpenChange,
  investmentId,
  worker,
  workers = [],
  onCreated,
}: PropsT) {
  const [workerId, setWorkerId] = useState(worker ? String(worker.id) : '')
  const [pickedInvestmentId, setPickedInvestmentId] = useState(
    investmentId === undefined ? '' : String(investmentId),
  )
  const [investments, setInvestments] = useState<WorkerStageInvestmentT[]>([])
  // Keyed by the picked File, so a new pick never inherits the previous photos' reads.
  const [reads, setReads] = useState<ReadonlyMap<File, PageReadT>>(new Map())
  const [isSending, setIsSending] = useState(false)
  const { files, isIngesting, inputKey, reset, fileInputProps } = useFilePickIngest()
  const urls = useObjectUrls(files)
  const investmentsRequest = useLatestRequest()

  const picksWorker = worker === undefined
  const picksInvestment = investmentId === undefined

  const isTooMany = files.length > MAX_SCAN_PHOTOS
  const canSend =
    workerId !== '' &&
    pickedInvestmentId !== '' &&
    files.length > 0 &&
    !isTooMany &&
    !isIngesting &&
    !isSending

  function close() {
    onOpenChange(false)
    reset()
    setReads(new Map())
    if (picksWorker) setWorkerId('')
    if (picksInvestment) setPickedInvestmentId('')
  }

  function handleOpenChange(next: boolean) {
    if (isSending) return
    if (!next) close()
  }

  function pickWorker(next: string) {
    setWorkerId(next)
    if (!picksInvestment) return
    setPickedInvestmentId('')
    setInvestments([])
    const isCurrent = investmentsRequest.start()
    void readScanWorkerInvestments(Number(next))
      .then((options) => {
        if (!isCurrent()) return
        setInvestments(options)
        if (options.length === 1) setPickedInvestmentId(String(options[0]?.investmentId))
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się wczytać inwestycji pracownika', 'error')
      })
  }

  async function readPage(file: File): Promise<PageReadT> {
    try {
      return await readWorkerReportClient(file, Number(pickedInvestmentId), Number(workerId))
    } catch (error) {
      const position = files.indexOf(file) + 1
      toastMessage(
        `Zdjęcie ${position}: ${error instanceof Error ? error.message : 'błąd odczytu'}`,
        'error',
      )
      return 'failed'
    }
  }

  // Only the photos not read yet: a retry after one failed photo re-reads that photo alone.
  async function readMissing(): Promise<PageReadT[]> {
    const missing = files.filter((file) => {
      const read = reads.get(file)
      return read === undefined || read === 'failed'
    })
    const results = await mapWithConcurrency(missing, READ_CONCURRENCY, readPage)
    const next = new Map(reads)
    missing.forEach((file, position) => next.set(file, results[position]))
    setReads(next)
    return files.map((file) => next.get(file))
  }

  async function handleSend() {
    if (!canSend) return
    setIsSending(true)
    usePendingStore.getState().start(READ_PENDING_KEY, 'Odczytywanie kartki…')
    try {
      const pages = await readMissing()
      if (pages.some((page) => page === undefined || page === 'failed')) return

      const target = { investmentId: Number(pickedInvestmentId), workerId: Number(workerId) }
      const result = await submitWithUploads(
        files,
        (mediaIds) =>
          createScannedReportAction({
            ...target,
            pages: pages as ScanPageT[],
            mediaIds,
          }),
        'inne',
      )
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      close()
      onCreated(result.data.reportId, target.investmentId)
    } finally {
      usePendingStore.getState().stop(READ_PENDING_KEY)
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader title={worker ? `Wczytaj z kartki — ${worker.name}` : 'Wczytaj z kartki'} />
        <div className="flex flex-col gap-4">
          {picksWorker && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="scan-worker">Pracownik</Label>
              <SearchSelect
                id="scan-worker"
                value={workerId}
                onChange={pickWorker}
                items={workers.map((option) => ({ value: String(option.id), label: option.name }))}
                placeholder="Wybierz pracownika"
                disabled={isSending}
              />
            </div>
          )}
          {picksInvestment && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="scan-investment">Inwestycja</Label>
              <SearchSelect
                id="scan-investment"
                value={pickedInvestmentId}
                onChange={setPickedInvestmentId}
                items={investments.map((option) => ({
                  value: String(option.investmentId),
                  label: option.name,
                }))}
                placeholder="Wybierz inwestycję"
                disabled={workerId === '' || isSending}
              />
            </div>
          )}
          <FileInput
            key={inputKey}
            label="Zdjęcia kartki"
            accept="image/*"
            multiple
            className="h-28 flex-col"
            {...fileInputProps}
            disabled={fileInputProps.disabled || isSending}
          />
          {isTooMany && (
            <p className="text-destructive text-sm">
              Maksymalnie {MAX_SCAN_PHOTOS} zdjęć na jedno zgłoszenie.
            </p>
          )}
          {urls.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {files.slice(0, urls.length).map((file, index) => (
                <li key={urls[index]} className="relative">
                  <Image
                    src={urls[index]}
                    alt={`Zdjęcie ${index + 1}`}
                    width={96}
                    height={96}
                    unoptimized
                    className={cn(
                      'aspect-square w-full rounded-md border object-cover',
                      reads.get(file) === 'failed' && 'border-destructive',
                    )}
                  />
                  {reads.get(file) === 'failed' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute inset-x-1 bottom-1"
                      disabled={isSending}
                      onClick={handleSend}
                    >
                      <RotateCw />
                      Ponów
                    </Button>
                  )}
                  <span className="sr-only">{file.name}</span>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? 'Odczytywanie kartki…' : 'Wczytaj'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
