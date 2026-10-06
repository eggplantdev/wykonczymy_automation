'use client'

import { useState } from 'react'
import { FileSearch, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { DataTable } from '@/components/tables/data-table/data-table'
import { getTransferColumns } from '@/components/tables/transfers'
import {
  getTelmakCheckColumns,
  toTelmakCheckRow,
  type TelmakPackageFileT,
} from '@/components/tables/telmak-check'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toastMessage } from '@/lib/utils/toast'
import { cn } from '@/lib/utils/cn'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'
import { normalizeDocNumber, parseTelmak, type TelmakDocT } from '@/lib/telmak/parse-telmak'
import { compareTelmak, type TelmakCompareT } from '@/lib/telmak/compare-telmak'
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
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<TelmakCompareT | null>(null)
  const [transfers, setTransfers] = useState<Map<number, TransferRowT>>(new Map())
  const [showOk, setShowOk] = useState(false)

  const columns = getTransferColumns([], { referenceData, currentUserId, currentUserRole })

  // The package lives only in this tab's memory: closing the dialog drops it, nothing is uploaded
  // unless one file is explicitly attached to a transaction.
  function dropPackage() {
    for (const p of parsed) URL.revokeObjectURL(p.preview.url)
    setParsed([])
    setResult(null)
    setTransfers(new Map())
  }

  async function handlePicked(files: File[]) {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) return
    dropPackage()
    setBusy(`Czytam ${pdfs.length} plików…`)
    try {
      const { pdfLines } = await import('@/lib/telmak/pdf-lines')
      const out: TelmakPackageFileT[] = []
      for (const file of pdfs) {
        const preview = {
          url: URL.createObjectURL(file),
          filename: file.name,
          mimeType: 'application/pdf',
        }
        let doc: TelmakDocT
        try {
          doc = parseTelmak(await pdfLines(file), file.name)
        } catch {
          doc = {
            fileName: file.name,
            kind: null,
            number: null,
            date: null,
            amount: null,
            remark: null,
            problems: ['nie da się otworzyć PDF-a'],
          }
        }
        out.push({ doc, file, preview })
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
      const dates = out
        .map((p) => p.doc.date)
        .filter((d): d is string => d != null)
        .sort()
      const chosen =
        range.from && range.to
          ? range
          : dates.length > 0
            ? { from: dates[0], to: dates.at(-1) }
            : null
      if (!chosen) return
      setRange(chosen)
      await compare(out, chosen)
    } finally {
      setBusy(null)
    }
  }

  async function loadTransfers(ids: number[]) {
    const rows = await fetchTelmakTransferRows(ids)
    setTransfers((prev) => new Map([...prev, ...rows.map((r) => [r.id, r] as const)]))
  }

  async function compare(pkg: TelmakPackageFileT[], { from, to }: DateRangeT) {
    if (pkg.length === 0 || !from || !to) return
    setBusy('Porównuję z aplikacją…')
    try {
      const docs = pkg.map((p) => p.doc)
      const numbers = [...new Set(docs.map((d) => normalizeDocNumber(d.number)).filter(Boolean))]
      const rows = await fetchTelmakCheckRows(registerId, from, to, numbers)
      const compared = compareTelmak(docs, rows, registerId, from, to)
      setResult(compared)
      setTransfers(new Map())
      await loadTransfers(
        compared.results
          .filter((r) => r.status !== 'ok')
          .flatMap((r) => r.rows.map((row) => row.id)),
      )
    } catch (e) {
      toastMessage(e instanceof Error ? e.message : 'Nie udało się porównać', 'error', 6000)
    } finally {
      setBusy(null)
    }
  }

  const checkColumns = getTelmakCheckColumns((id) => void loadTransfers([id]))
  const checkRows = (result?.results ?? [])
    .filter((r) => showOk || r.status !== 'ok')
    .map((r) => toTelmakCheckRow(r, parsed))
  const problemIds = [
    ...new Set(
      (result?.results ?? [])
        .filter((r) => r.status !== 'ok')
        .flatMap((r) => r.rows.map((row) => row.id)),
    ),
  ]
  const problemTransfers = problemIds
    .map((id) => transfers.get(id))
    .filter((t): t is TransferRowT => t != null)

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
                    getRowClassName={(row) =>
                      row.cancelled ? '[&_td]:line-through [&_td]:text-muted-foreground' : ''
                    }
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
