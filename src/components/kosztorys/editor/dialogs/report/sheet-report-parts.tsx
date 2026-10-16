'use client'

import { useState, type ReactNode } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
      <table className={cn('w-full text-sm max-sm:text-xs', className)}>
        {headers && (
          <thead>
            <tr className="text-muted-foreground text-xs">
              {headers.map((header, index) => (
                <th
                  key={index}
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

export function ComparisonTable({
  sides = [SHEET_SIDE, APP_SIDE],
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
