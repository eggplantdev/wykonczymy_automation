'use client'

import type { ReactNode } from 'react'
import { Badge, type BadgeToneT } from '@/components/ui/badge'
import * as Collapsible from '@/components/ui/collapsible'
import { DECISION_TONE } from '@/components/ui/decision-progress-badge'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { cn } from '@/lib/utils/cn'
import { AuditVariant } from '../audit-variant'

export const noop = () => {}

export const SURFACE = {
  a: 'Dialog zgłoszenia wydatków',
  b: 'Dialog „Zgłoszenia prac” w kosztorysie',
  c: 'Strona /zgloszenia-prac',
  d: 'Strona /zgloszenia (zapytania)',
  e: 'Strona /zgloszenia-wydatkow — historia',
  f: 'Wypłaty do potwierdzenia (pracownik)',
  g: 'Kolejka „Wydatki do sprawdzenia”',
  h: 'Odrzucone przez pracowników',
} as const

export type SurfaceLetterT = keyof typeof SURFACE

export const COLUMN_BORDERS =
  '[&_td+td]:border-border [&_th+th]:border-border [&_td+td]:border-l [&_th+th]:border-l'
export const PARAGON_FOOTER_CLASS =
  'bg-background sticky -bottom-4 z-10 -mx-4 mt-6 -mb-4 flex flex-wrap items-center gap-2 px-4 pt-3 pb-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6'
export const MOCK = 'flex w-full min-w-0 flex-col gap-3'
export const STEPS = 'ml-4 list-decimal text-sm'

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const
const TEXT_SIZE = {
  sm: { body: 'text-sm max-sm:text-xs', header: 'text-sm', description: 'text-xs' },
  xs: { body: 'text-xs', header: 'text-xs', description: 'text-2xs' },
} as const

export type MockColumnT = { header: ReactNode; align?: keyof typeof ALIGN; description?: string }
export type MockRowT = { cells: ReactNode[]; className?: string }

type MockTablePropsT = {
  columns: MockColumnT[]
  rows: MockRowT[]
  textSize?: keyof typeof TEXT_SIZE
  className?: string
  toolbar?: ReactNode
}

export function MockTable({ columns, rows, textSize = 'sm', className, toolbar }: MockTablePropsT) {
  const sizes = TEXT_SIZE[textSize]
  return (
    <div className={cn('space-y-2 max-sm:space-y-6', className)}>
      {toolbar}
      <div className={cn(BORDERED_LIST_CLASS, 'overflow-x-auto rounded-lg')}>
        <table className={cn('w-full', sizes.body)}>
          <thead>
            <tr className="border-border bg-muted/50 border-b">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(
                    'text-muted-foreground px-3 py-2 text-left font-medium',
                    sizes.header,
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                  )}
                >
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    {column.header}
                  </span>
                  {column.description && (
                    <span
                      className={cn(
                        'block w-max max-w-40 font-normal whitespace-normal',
                        sizes.description,
                      )}
                    >
                      {column.description}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  Brak danych
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={cn('border-border border-b last:border-b-0', row.className)}
                >
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'text-foreground px-3 py-2',
                        ALIGN[columns[cellIndex]?.align ?? 'left'],
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PARAGON_LABEL = {
  pending: 'Do sprawdzenia',
  accepted: 'Przyjęty',
  rejected: 'Odrzucony',
} as const

type ParagonRowPropsT = {
  title: string
  status: keyof typeof PARAGON_LABEL
  action?: ReactNode
  leading?: ReactNode
}

export function ParagonRow({ title, status, action, leading }: ParagonRowPropsT) {
  const isOpen = status === 'pending'
  return (
    <Collapsible.Root open={isOpen}>
      <div className={cn('flex items-center gap-2', status !== 'pending' && 'opacity-60')}>
        {leading}
        <Collapsible.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left">
          <Collapsible.Chevron open={isOpen} className="text-muted-foreground size-4" />
          <span
            className={cn(
              'min-w-0 truncate text-sm font-medium',
              status === 'rejected' && 'line-through',
            )}
          >
            {title}
          </span>
          <Badge tone={DECISION_TONE[status]} className="shrink-0">
            {PARAGON_LABEL[status]}
          </Badge>
        </Collapsible.Trigger>
        {action}
      </div>
    </Collapsible.Root>
  )
}

const TOAST_KIND = {
  success: { tone: 'positive', label: 'sukces' },
  error: { tone: 'negative', label: 'błąd' },
  warning: { tone: 'pending', label: 'ostrzeżenie' },
} as const satisfies Record<string, { tone: BadgeToneT; label: string }>

export type ToastItemT = { kind: keyof typeof TOAST_KIND; text: string }

export function ToastList({ title = 'Toasty', items }: { title?: string; items: ToastItemT[] }) {
  return (
    <div className="flex w-full flex-col gap-1">
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </span>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item.text} className="flex items-center gap-2">
            <Badge tone={TOAST_KIND[item.kind].tone} className="shrink-0">
              {TOAST_KIND[item.kind].label}
            </Badge>
            <span>„{item.text}”</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MissingVariant({ letter, note }: { letter: SurfaceLetterT; note?: string }) {
  return (
    <AuditVariant
      letter={letter}
      label={`${SURFACE[letter]} — brak${note ? ` (${note})` : ''}`}
      sources={[]}
    >
      {null}
    </AuditVariant>
  )
}
