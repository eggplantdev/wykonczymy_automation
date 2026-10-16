'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CopyCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { DataTable } from '@/components/tables/data-table/data-table'
import { getExpenseDuplicateColumns, reasonsLabel } from '@/components/tables/expense-duplicates'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { settleAction } from '@/lib/utils/settle-action'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { pluralize } from '@/lib/utils/polish-plural'
import {
  ALL_TIME,
  isAllTime,
  isClosedRange,
  urlDateRange,
  type DateRangeT,
} from '@/lib/utils/date-range'
import type {
  CandidateT,
  DuplicateGroupT,
  DuplicateGroupsT,
  DuplicateMatchT,
} from '@/lib/expense-duplicates/types'
import type { ActionResultT } from '@/types/action'

type DuplicateFinderDialogPropsT = {
  findGroups: (range: DateRangeT) => Promise<ActionResultT<DuplicateGroupsT<CandidateT>>>
}

type FinderStateT =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; groups: DuplicateGroupsT<CandidateT> }

const IDLE: FinderStateT = { status: 'idle' }
const DOCUMENT_FORMS = ['dokument', 'dokumenty', 'dokumentów'] as const

const columns = getExpenseDuplicateColumns<DuplicateMatchT>({ linkMatch: true })

const toRows = (group: DuplicateGroupT<CandidateT>): DuplicateMatchT[] =>
  group.members.map((member) => ({ ...member, reasons: group.reasons }))

const countLabel = (count: number) => `${count} ${pluralize(count, DOCUMENT_FORMS)}`

export function DuplicateFinderDialog({ findGroups }: DuplicateFinderDialogPropsT) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRangeT>(ALL_TIME)
  const [state, setState] = useState<FinderStateT>(IDLE)
  const request = useLatestRequest()

  const isComplete = Boolean(range.from && range.to)
  const isInverted = isComplete && !isClosedRange(range)
  const canAnalyse = (isAllTime(range) || isClosedRange(range)) && state.status !== 'loading'

  async function analyse() {
    const isLatest = request.start()
    setState({ status: 'loading' })
    const result = await settleAction(() => findGroups(range))
    if (!isLatest()) return
    setState(
      result.success
        ? { status: 'done', groups: result.data }
        : { status: 'error', message: result.error },
    )
  }

  function changeRange(next: DateRangeT) {
    request.disown()
    setRange(next)
    setState(IDLE)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    request.disown()
    setState(IDLE)
    if (!next) return
    const tableRange = urlDateRange(searchParams)
    setRange(isClosedRange(tableRange) ? tableRange : ALL_TIME)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <CopyCheck />
        Szukaj duplikatów
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="gap-8 overflow-auto sm:max-h-[94vh] sm:max-w-[96vw]"
          aria-describedby={undefined}
        >
          <DialogHeader title="Szukaj duplikatów" />

          <section className="flex flex-col gap-3">
            <span className="text-muted-foreground text-sm">
              Sprawdza wydatki z zakresu i z filtrów tabeli oraz paragony z nierozpatrzonych
              zgłoszeń — każdy z wydatkami całej firmy, z dowolnego okresu.
            </span>
            <div className="flex flex-wrap items-end gap-4">
              <DateRangePicker value={range} onChange={changeRange} stacked />
              <Button onClick={() => void analyse()} disabled={!canAnalyse}>
                {state.status === 'loading' && <Loader2 className="animate-spin" />}
                Analizuj
              </Button>
            </div>
            {!isAllTime(range) && !isComplete && (
              <span className="text-muted-foreground text-sm">
                Wybierz obie daty albo wyczyść zakres, żeby sprawdzić cały okres.
              </span>
            )}
            {isInverted && (
              <span className="text-destructive text-sm">Nieprawidłowy zakres dat</span>
            )}
          </section>

          {state.status === 'error' && (
            <div className="flex flex-wrap items-center gap-4" role="alert">
              <span className="text-destructive text-sm">{state.message}</span>
              <Button variant="outline" size="sm" onClick={() => void analyse()}>
                Spróbuj ponownie
              </Button>
            </div>
          )}

          {state.status === 'done' &&
            state.groups.strong.length === 0 &&
            state.groups.weak.length === 0 && (
              <p className="text-muted-foreground text-sm">Nie znaleziono możliwych duplikatów</p>
            )}

          {state.status === 'done' &&
            state.groups.strong.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <h3 className="text-destructive font-medium">
                  {reasonsLabel(group.reasons)} · {countLabel(group.members.length)}
                </h3>
                <DataTable data={toRows(group)} columns={columns} />
              </section>
            ))}

          {state.status === 'done' && state.groups.weak.length > 0 && (
            <CollapsibleSection
              title={`Słabe (${state.groups.weak.length})`}
              size="sm"
              defaultOpen={false}
              hint="Tylko ta sama kwota — zwykle różne zakupy za tyle samo."
            >
              <div className="flex flex-col gap-6 pt-3">
                {state.groups.weak.map((group) => (
                  <section key={group.key} className="flex flex-col gap-2">
                    <h3 className="font-medium">
                      {formatPLNOrDash(group.members[0].amount)} ·{' '}
                      {countLabel(group.members.length)}
                    </h3>
                    <DataTable data={toRows(group)} columns={columns} />
                  </section>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
