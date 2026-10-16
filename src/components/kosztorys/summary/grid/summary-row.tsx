import { Fragment, type ReactNode } from 'react'
import { SummaryLabelCell, SummaryValueCell } from '@/components/ui/summary-grid'
import type { LabelHintT } from '@/components/ui/label-hint-icon'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'

export type SummaryRowOptsT = {
  emphasize?: boolean
  bold?: boolean
  discount?: boolean
  danger?: boolean | { net: boolean; gross: boolean }
  hint?: string
  mismatch?: string
}

type SummaryRowPropsT = SummaryRowOptsT & {
  label: ReactNode
  line: MoneyPairT
  axis: MoneyAxisT
}

/** Wrapping the row in an element of its own would break the gridlines. */
export function SummaryRow({ label, line, axis, ...opts }: SummaryRowPropsT) {
  const { net: showNet, gross: showGross } = axisShows(axis)
  const weight = opts.bold ? 'bold' : opts.emphasize ? 'medium' : 'default'
  const toneFor = (axis: 'net' | 'gross') => {
    if (opts.discount) return 'success' as const
    const danger = typeof opts.danger === 'object' ? opts.danger[axis] : opts.danger
    return danger ? ('error' as const) : ('default' as const)
  }
  const note = opts.hint ? { text: opts.hint, tone: 'muted' as const } : undefined
  const hints: LabelHintT[] = opts.mismatch
    ? [{ variant: 'mismatch' as const, content: opts.mismatch }]
    : []

  return (
    <Fragment>
      <SummaryLabelCell weight={weight} hints={hints}>
        {label}
      </SummaryLabelCell>
      {showNet && (
        <SummaryValueCell weight={weight} tone={toneFor('net')} note={note}>
          {formatNet(line.net)}
        </SummaryValueCell>
      )}
      {showGross && (
        <SummaryValueCell weight={weight} tone={toneFor('gross')} note={showNet ? undefined : note}>
          {formatNet(line.gross)}
        </SummaryValueCell>
      )}
    </Fragment>
  )
}
