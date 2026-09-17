'use client'

import { useState, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// The shared vocabulary of a sheet report: a table whose first column is a label and whose rest are
// figures, and a fold that hides a long list behind its own summary line. Both dialogs („Pobierz z
// arkusza" and „Porównaj z arkuszem") are built from these, so a reader who has learned one has
// learned the other.

// `headers` is optional because a list of prace has nothing to head: „Podpowiedź" over a column
// that already says „może chodzi o…" is a label repeating its own contents. The grid is still worth
// sharing without it — that is what puts the two blocks of a report on the same left edge.
export function ReportTable({
  headers,
  className,
  children,
}: {
  headers?: ReactNode[]
  className?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)}>
        {headers && (
          <thead>
            <tr className="text-muted-foreground text-xs">
              {headers.map((header, index) => (
                <th
                  key={index}
                  // The first column carries the name of the thing, the rest carry its figures — one
                  // left edge to scan down, one right edge to compare numbers along.
                  className={`py-1 font-normal ${index === 0 ? 'text-left' : 'pl-3 text-right'}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const SHEET_SIDE = 'Arkusz Google'
const APP_SIDE = 'Ta aplikacja'

// `className` rather than a tone: most cells here are figures and take the numeric defaults, but a
// cell holding PROSE has to be able to drop `text-right`, which a colour-only knob cannot do.
type ReportCellT = { content: ReactNode; className?: string }

export function ReportRow({
  label,
  labelClassName,
  cells,
}: {
  label: ReactNode
  labelClassName?: string
  cells: ReportCellT[]
}) {
  return (
    <tr className="border-border/60 border-t align-middle">
      <td className={cn('py-1', labelClassName)}>{label}</td>
      {cells.map((cell, index) => (
        <td
          key={index}
          className={cn('text-foreground py-1 pl-3 text-right tabular-nums', cell.className)}
        >
          {cell.content}
        </td>
      ))}
    </tr>
  )
}

// Which side said what is the one thing the reader must never have to infer — hence named columns
// rather than a sentence with two numbers in it. Both dialogs put every side-by-side figure through
// this pair, so „Różnica" always means the same subtraction in the same direction.
export function ComparisonTable({
  // Named sides, because not every side-by-side here is arkusz against aplikacja: the sheet's own
  // summary rows are checked against the sheet's own prace, and borrowing „Ta aplikacja" for that
  // column put one and the same figure under opposite headers in the two dialogs.
  sides = [SHEET_SIDE, APP_SIDE],
  // A trailing column for a per-row control. Declared on the table rather than inferred from the
  // rows, because the rows are a `flatMap` over prace: whether the write is offered at all is one
  // decision about the whole report (a read-only viewer), not something to re-answer per wiersz.
  withAction = false,
  children,
}: {
  sides?: [string, string]
  withAction?: boolean
  children: ReactNode
}) {
  const headers = ['', ...sides, 'Różnica', ...(withAction ? [''] : [])]
  return <ReportTable headers={headers}>{children}</ReportTable>
}

export function ComparisonRow({
  label,
  sheet,
  app,
  delta,
  action,
}: {
  label: ReactNode
  sheet: ReactNode
  app: ReactNode
  delta: string | null
  // `null` still opens the cell — under a table with `withAction` every wiersz owes one, and the
  // rows that carry no control are the majority: one praca differs on three liczby and the write
  // is offered once, on the first of them.
  action?: ReactNode
}) {
  const cells: ReportCellT[] = [
    { content: sheet },
    { content: app },
    {
      content: delta ?? 'zgadza się',
      className: delta === null ? 'text-muted-foreground' : 'text-amber-600',
    },
    ...(action !== undefined ? [{ content: action, className: 'whitespace-nowrap' }] : []),
  ]
  return <ReportRow label={label} cells={cells} />
}

// „sekcja · opis", the way both dialogs name a praca they are listing rather than pricing. Built on
// the same `ReportTable` as the figure blocks above it, so „Brak w katalogu" lines up with „Inne
// liczby" instead of reading as a different kind of window. `note` is the per-praca aside („wpisane
// etapy" on a praca an import is about to remove, „może chodzi o…" on one the cennik lacks) and
// `action` the per-praca write; both earn a column only when some item actually carries one, so a
// bare list stays a bare list.
export function ItemList({
  items,
}: {
  items: { section: string; description: string; note?: string; action?: ReactNode }[]
}) {
  const hasNote = items.some((item) => item.note)
  const hasAction = items.some((item) => item.action)
  return (
    <ReportTable className="text-xs">
      {items.map((item, index) => (
        <ReportRow
          key={`${index}-${item.description}`}
          label={
            <span className="text-muted-foreground">
              {item.section} · {item.description}
            </span>
          }
          // Half the row to the opis: left to auto-layout, a long podpowiedź takes the width and the
          // nazwa pracy — the thing being listed — wraps to six lines beside it.
          labelClassName={hasNote ? 'w-1/2' : undefined}
          cells={[
            ...(hasNote ? [{ content: item.note, className: 'text-left text-amber-600' }] : []),
            ...(hasAction ? [{ content: item.action, className: 'whitespace-nowrap' }] : []),
          ]}
        />
      ))}
    </ReportTable>
  )
}

// The count belongs in the summary line and the rows behind a click: these lists run to hundreds of
// prace, and unfolded a single one buries every other line in the dialog.
export function ReportFold({
  summary,
  tone = 'text-amber-600',
  children,
}: {
  summary: ReactNode
  tone?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="space-y-0.5">
      <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
        <ChevronDown
          className={`mt-1 size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${tone}`}
        />
        <span className={tone}>{summary}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <div className="space-y-0.5 pl-4.5">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
