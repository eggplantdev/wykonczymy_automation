'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
} from '@/components/kosztorys/summary-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorPayoutRowT } from '@/types/reference-data'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  investmentId: number
  // „Suma wykonanej pracy" (należne) — executed value at the active view's subcontractor price, pre-rabat.
  dueNet: number
  // Realized PAYOUTs per worker (null-worker bucket kept), name-enriched at the page.
  payouts: SubcontractorPayoutRowT[]
}

// The subcontractor-plane footer, shown in the Z narzędziami / Bez narzędzi views in place of the
// client Podsumowanie: how much the crew is owed from the kosztorys (należne) vs how much has been
// paid out (zaliczki), and what is left. One „Kwota" column, no netto/brutto axis (EX-558:
// subcontractors are paid without VAT). Owner-only by construction — these views are unreachable in
// the client preview, so the per-worker links are always live.
export function SubcontractorSummary({ investmentId, dueNet, payouts }: PropsT) {
  const { payoutsTotal, remaining, rows } = computeSubcontractorSummary(dueNet, payouts)
  const gridTemplateColumns = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`

  return (
    <div className="text-foreground flex flex-wrap items-start gap-x-12 gap-y-8 px-4 pt-2 pb-10 text-sm">
      <div
        // grid-template tracks from shared SUMMARY_* constants — not expressible as a utility; keeps
        // this block's columns aligned with the client Podsumowanie above.
        style={{ gridTemplateColumns }}
        className="border-border bg-border grid w-fit gap-px border"
      >
        <span className={cn(SUMMARY_LABEL_CELL, 'text-muted-foreground text-xs')}>
          Podsumowanie podwykonawców
        </span>
        <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground text-xs')}>Kwota</span>

        <span className={cn(SUMMARY_LABEL_CELL, 'font-medium')}>Suma wykonanej pracy</span>
        <span className={cn(SUMMARY_VALUE_CELL, 'font-medium')}>{formatNet(dueNet)}</span>

        {/* Zaliczki group: a header row, then one row per worker (amounts shown negative — each payout
            draws down the należne), then their razem. Empty payouts → no worker rows, razem 0. */}
        <span className={cn(SUMMARY_LABEL_CELL, 'text-muted-foreground')}>Zaliczki (wypłaty)</span>
        <span className={SUMMARY_VALUE_CELL} />

        {rows.map((row) => (
          <Fragment key={row.workerId ?? 'unassigned'}>
            <span className={cn(SUMMARY_LABEL_CELL, 'pl-6')}>
              {row.workerId === null ? (
                row.name
              ) : (
                <Link
                  href={`/inwestycje/${investmentId}?type=PAYOUT&worker=${row.workerId}`}
                  className="hover:underline"
                >
                  {row.name}
                </Link>
              )}
            </span>
            <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green')}>
              {formatNet(-row.total)}
            </span>
          </Fragment>
        ))}

        <span className={cn(SUMMARY_LABEL_CELL, 'pl-6 font-medium')}>Zaliczki (wypłaty) razem</span>
        <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green font-medium')}>
          {formatNet(-payoutsTotal)}
        </span>

        {/* Pozostało do wypłaty = należne − zaliczki. Negative = the crew has been overpaid — an
            anomaly, so it reads red; a normal positive „still owed" stays neutral bold. */}
        <span className={cn(SUMMARY_LABEL_CELL, 'font-bold')}>Pozostało do wypłaty</span>
        <span className={cn(SUMMARY_VALUE_CELL, 'font-bold', remaining < 0 && 'text-destructive')}>
          {formatNet(remaining)}
        </span>
      </div>
    </div>
  )
}
