'use client'

import { useState } from 'react'
import { InvestmentStatusSelect } from '@/components/investments/investment-status-select'
import {
  ExpenseDraftDuplicateStatus,
  type DuplicateHintsStateT,
} from '@/components/worker-expenses/expense-draft-duplicate-status'
import { KosztorysProgressCounter } from '@/components/kosztorys/summary/charts/kosztorys-progress-counter'
import { ReceiptsToConfirm } from '@/components/receipt-confirmation/receipts-to-confirm'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { ReceiptToConfirmT } from '@/lib/db/receipt-confirmation'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'
import { OpenPreview } from '../open-preview'

const DUPLICATE_STATES: DuplicateHintsStateT[] = [
  { status: 'reading' },
  { status: 'checking' },
  { status: 'no-read' },
  { status: 'error', retry: () => {} },
]

const PROGRESS_SAMPLES = [
  { doneNet: 0, plannedNet: 48_000 },
  { doneNet: 21_500, plannedNet: 48_000 },
  { doneNet: 48_000, plannedNet: 48_000 },
  { doneNet: 55_000, plannedNet: 48_000 },
] as const

const RECEIPTS: ReceiptToConfirmT[] = [
  {
    id: 900_001,
    date: '2026-10-14',
    amount: 1250,
    description: 'Zaliczka za tydzień 42',
    investmentName: 'Mieszkanie Testowa 12',
    status: 'pending',
    rejectionReason: null,
  },
  {
    id: 900_002,
    date: '2026-10-07',
    amount: 800,
    description: 'Wypłata za płytki w łazience',
    investmentName: null,
    status: 'rejected',
    rejectionReason: 'Kwota się nie zgadza — umawialiśmy 900 zł.',
  },
]

export function StatusesSection() {
  const [status, setStatus] = useState<InvestmentStatusT>('active')

  return (
    <ShowcaseSection id="statuses">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">A. Wybór statusu</h3>
      <ShowcaseRow
        title="InvestmentStatusSelect (BadgeSelect z InvestmentStatusBadge)"
        source="investments/investment-status-select.tsx"
      >
        <InvestmentStatusSelect value={status} onValueChange={setStatus} />
        <InvestmentStatusSelect value={status} onValueChange={setStatus} hideChevron />
        <InvestmentStatusSelect value={status} onValueChange={setStatus} disabled />
        <OpenPreview backdrop={false} className="h-72 justify-start">
          <InvestmentStatusSelect value={status} onValueChange={setStatus} />
        </OpenPreview>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">B. Stan procesu</h3>
      <ShowcaseRow
        title="ExpenseDraftDuplicateStatus — reading / checking / no-read / error"
        source="worker-expenses/expense-draft-duplicate-status.tsx"
        className="flex-col items-start"
      >
        {DUPLICATE_STATES.map((state) => (
          <ExpenseDraftDuplicateStatus key={state.status} state={state} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="KosztorysProgressCounter — 0%, częściowo, 100%, ponad plan"
        source="kosztorys/summary/charts/kosztorys-progress-counter.tsx"
        className="flex-col items-start"
      >
        {PROGRESS_SAMPLES.map((sample) => (
          <KosztorysProgressCounter key={sample.doneNet} {...sample} />
        ))}
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">C. Decyzja pracownika</h3>
      <ShowcaseRow
        title="ReceiptsToConfirm — do potwierdzenia i odrzucone"
        source="receipt-confirmation/receipts-to-confirm.tsx"
        className="flex-col items-stretch"
      >
        <ReceiptsToConfirm receipts={RECEIPTS} />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
