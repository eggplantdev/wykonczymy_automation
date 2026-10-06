'use client'

import { useEffect, useState } from 'react'
import { FileSearch, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { DataTable } from '@/components/tables/data-table/data-table'
import { getTransferColumns, transferRowClassName } from '@/components/tables/transfers'
import { getTelmakCheckColumns } from '@/components/tables/telmak-check'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { toastMessage } from '@/lib/utils/toast'
import { cn } from '@/lib/utils/cn'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'
import { normalizeDocNumber } from '@/lib/telmak/parse-telmak'
import { compareTelmak, type TelmakCompareT } from '@/lib/telmak/compare-telmak'
import { problemRowIds, toTelmakCheckRow, type TelmakPackageFileT } from '@/lib/telmak/check-row'
import { fetchTelmakCheckRows, fetchTelmakTransferRows } from '@/lib/queries/telmak-check'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { TransferRowT } from '@/types/transfers'

type TelmakCheckDialogPropsT = {
  registerId: number
  referenceData: ReferenceDataBaseT
}

export function TelmakCheckDialog({ registerId, referenceData }: TelmakCheckDialogPropsT) {
  const { id: currentUserId, role: currentUserRole } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [parsed, setParsed] = useState<TelmakPackageFileT[]>([])
  const [range, setRange] = useState<DateRangeT>(ALL_TIME)
  const [rangePicked, setRangePicked] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [check, setCheck] = useState<{ result: TelmakCompareT; flagged: TransferRowT[] } | null>(
    null,
  )
  const [showOk, setShowOk] = useState(false)
  const request = useLatestRequest()

  const columns = getTransferColumns([], { referenceData, currentUserId, currentUserRole })

  useEffect(
    () => () => {
      for (const p of parsed) URL.revokeObjectURL(p.preview.url)
    },
    [parsed],
  )

  // The package lives only in this tab's memory: closing the dialog drops it, nothing is uploaded
  // unless one file is explicitly attached to a transaction.
  function dropPackage() {
    request.disown()
    setParsed([])
    setCheck(null)
  }

  async function handlePicked(files: File[]) {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) return
    dropPackage()
    const isLatest = request.start()
    setBusy(`Czytam ${pdfs.length} plików…`)
    try {
      const { readTelmakPackage } = await import('@/lib/telmak/read-package')
      const out = await readTelmakPackage(pdfs)
      if (!isLatest()) {
        for (const p of out) URL.revokeObjectURL(p.preview.url)
        return
      }
      setParsed(out)
      const rejected = out.filter((p) => p.doc.problems.length > 0)
      if (rejected.length > 0) {
        // TODO(EX-449) SENTRY-REQUIRED: a Telmak document the parser rejects means the supplier's
        // layout may have changed — capture file name + problems once Sentry is wired.
        toastMessage(
          `${rejected.length} z ${out.length} faktur ma nieznany format — Telmak mógł zmienić wzór dokumentu. Zgłoś to, proszę.`,
          'error',
          10000,
        )
      }
      let chosen = range
      if (!rangePicked) {
        const dates = out
          .map((p) => p.doc.date)
          .filter((d): d is string => d != null)
          .sort()
        if (dates.length === 0) return
        chosen = { from: dates[0], to: dates.at(-1) }
        setRange(chosen)
      }
      await compare(out, chosen)
    } finally {
      if (isLatest()) setBusy(null)
    }
  }

  async function compare(pkg: TelmakPackageFileT[], { from, to }: DateRangeT) {
    if (pkg.length === 0 || !from || !to) return
    const isLatest = request.start()
    setBusy('Porównuję z aplikacją…')
    try {
      const docs = pkg.map((p) => p.doc)
      const numbers = [...new Set(docs.map((d) => normalizeDocNumber(d.number)).filter(Boolean))]
      const rows = await fetchTelmakCheckRows(registerId, from, to, numbers)
      const result = compareTelmak(docs, rows, registerId, from, to)
      const ids = problemRowIds(result.results)
      const flagged = ids.length > 0 ? await fetchTelmakTransferRows(ids) : []
      if (!isLatest()) return
      flagged.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      setCheck({ result, flagged })
    } catch (e) {
      if (!isLatest()) return
      toastMessage(e instanceof Error ? e.message : 'Nie udało się porównać', 'error', 6000)
    } finally {
      if (isLatest()) setBusy(null)
    }
  }

  const result = check?.result
  const checkColumns = getTelmakCheckColumns(() => void compare(parsed, range))
  const checkRows = (result?.results ?? [])
    .filter((r) => showOk || r.status !== 'ok')
    .map((r) => toTelmakCheckRow(r, parsed))
  const problemTransfers = check?.flagged ?? []

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSearch />
        Sprawdź faktury
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            dropPackage()
            setRange(ALL_TIME)
            setRangePicked(false)
            setBusy(null)
          }
          setOpen(next)
        }}
      >
        <DialogContent
          className="gap-8 overflow-auto sm:max-h-[94vh] sm:max-w-[96vw]"
          aria-describedby={undefined}
        >
          <DialogHeader title="Sprawdź faktury Telmak" />

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Wybierz zakres dat wystawienia faktur</span>
              <span className="text-muted-foreground text-sm">
                Puste ustawi się samo z dat w paczce. Transakcje z kasy w tym zakresie, których nie
                ma w paczce, pokażą się jako „Brak faktury w paczce”.
              </span>
            </div>
            <DateRangePicker
              value={range}
              onChange={(next) => {
                setRange(next)
                setRangePicked(Boolean(next.from && next.to))
                void compare(parsed, next)
              }}
            />
          </section>

          <FileInput
            multiple
            accept="application/pdf"
            placeholder="Wrzuć paczkę faktur PDF"
            className="h-20 flex-col"
            onChange={(e) => void handlePicked([...(e.target.files ?? [])])}
          />

          {busy && (
            <span className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {busy}
            </span>
          )}

          {parsed.length > 0 && !result && (
            <p className="text-sm">
              Odczytano {parsed.filter((p) => p.doc.problems.length === 0).length} z {parsed.length}{' '}
              plików.
            </p>
          )}

          {result && (
            <>
              <section className="flex flex-col gap-3">
                <h3 className="font-medium">Faktury do weryfikacji</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span>
                    Faktur w paczce: <b>{result.counts.documents}</b>
                  </span>
                  <span>
                    Wydatków w aplikacji w zakresie: <b>{result.counts.appRows}</b>
                  </span>
                  <span>
                    Zgodne: <b>{result.counts.ok}</b>
                  </span>
                  <span className={cn(result.counts.problems > 0 && 'text-destructive')}>
                    Rozjazdy: <b>{result.counts.problems}</b>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setShowOk((v) => !v)}>
                    {showOk ? 'Pokaż tylko rozjazdy' : 'Pokaż wszystkie'}
                  </Button>
                </div>

                <DataTable data={checkRows} columns={checkColumns} />
              </section>

              {problemTransfers.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="font-medium">Transakcje do weryfikacji</h3>
                  <DataTable
                    data={problemTransfers}
                    columns={columns}
                    storageKey="transfers"
                    getRowClassName={transferRowClassName}
                  />
                </section>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
