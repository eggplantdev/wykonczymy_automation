'use client'

import { ReportNotice } from '@/components/kosztorys/worker-report/report-notice'
import { KosztorysLockedBanner } from '@/components/kosztorys/editor/kosztorys-locked-banner'
import { TemplateCatalogueBanner } from '@/components/kosztorys/editor/template-catalogue-banner'
import { SettlementPlaneWarning } from '@/components/kosztorys/summary/blocks/settlement-plane-warning'
import { HistoryBanner } from '@/components/kosztorys/editor/history/history-banner'
import { ZeroVatWarning } from '@/components/kosztorys/summary/settings/zero-vat-warning'
import { VAT_PLANES } from '@/lib/constants/transfers'
import type { InvestmentLockT } from '@/lib/constants/investment-lock'
import type { ReportNoticeKeyT } from '@/lib/kosztorys/worker-report/refusals'
import type { ItemChangeT, ItemRefT, PastVersionT } from '@/lib/kosztorys/history/types'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import type { DepositTransactionRowT } from '@/types/transfers'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const LOCKS: InvestmentLockT[] = ['completed', 'trashed']

const REPORT_NOTICES: ReportNoticeKeyT[] = [
  'unknownToken',
  'closed',
  'inactiveWorker',
  'stagesCompleted',
]

const OFF_PLANE_DEPOSITS: DepositTransactionRowT[] = [
  { id: 900_101, date: '2026-09-02', amount: 5000, netAmount: null, vatPlane: 'GROSS' },
  { id: 900_102, date: '2026-09-30', amount: 3200, netAmount: null, vatPlane: 'GROSS' },
]

const EMPTY_TREE: KosztorysTreeT = {
  sections: [],
  stages: [],
  progress: [],
  globalCoeffs: { wTools: 1, ownTools: 1 },
  vatRate: 0.08,
  settlementMode: 'NET',
  materialsNetRate: null,
  globalDiscount: { type: null, value: 0 },
  revision: 'design',
}

const TILES_ITEM: ItemRefT = {
  id: 900_201,
  sectionName: 'Łazienka',
  description: 'Układanie płytek ściennych',
  unit: 'm2',
  plannedQty: 24,
}

const PAINT_ITEM: ItemRefT = {
  id: 900_202,
  sectionName: 'Salon',
  description: 'Malowanie ścian dwukrotne',
  unit: 'm2',
  plannedQty: 60,
}

const VERSION_WITH_CHANGES: PastVersionT = {
  tree: EMPTY_TREE,
  id: 900_301,
  label: 'Oferta dla klienta',
  day: '2026-09-15',
  diff: {
    added: [PAINT_ITEM],
    removed: [],
    changed: new Map<number, ItemChangeT>([
      [
        TILES_ITEM.id,
        {
          item: TILES_ITEM,
          fields: [
            { field: 'plannedQty', before: 24, after: 28 },
            { field: 'price', before: 120, after: 135 },
          ],
        },
      ],
    ]),
    addedStages: [],
    discount: { state: 'same' },
  },
}

const VERSION_WITHOUT_CHANGES: PastVersionT = {
  tree: EMPTY_TREE,
  id: 900_302,
  label: null,
  day: '2026-08-01',
  diff: {
    added: [],
    removed: [],
    changed: new Map<number, ItemChangeT>(),
    addedStages: [],
    discount: { state: 'unknown' },
  },
}

export function BannersSection() {
  return (
    <ShowcaseSection id="banners">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. Paski nad edytorem kosztorysu
      </h3>
      <ShowcaseRow
        title="KosztorysLockedBanner — zakończona / w koszu"
        source="kosztorys/editor/kosztorys-locked-banner.tsx"
        className="flex-col items-stretch"
      >
        {LOCKS.map((lock) => (
          <KosztorysLockedBanner key={lock} lock={lock} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="TemplateCatalogueBanner (edycja szablonu)"
        source="kosztorys/editor/template-catalogue-banner.tsx"
        className="flex-col items-stretch"
      >
        <TemplateCatalogueBanner />
      </ShowcaseRow>
      <ShowcaseRow
        title="HistoryBanner — wersja z różnicami / bez różnic, rabat nieznany"
        source="kosztorys/editor/history/history-banner.tsx"
        className="flex-col items-stretch"
      >
        <HistoryBanner version={VERSION_WITH_CHANGES} />
        <HistoryBanner version={VERSION_WITHOUT_CHANGES} />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Ostrzeżenia w podsumowaniu
      </h3>
      <ShowcaseRow
        title="SettlementPlaneWarning — rozliczenie netto / brutto"
        source="kosztorys/summary/blocks/settlement-plane-warning.tsx"
        className="flex-col items-start"
      >
        {VAT_PLANES.map((mode) => (
          <SettlementPlaneWarning key={mode} rows={OFF_PLANE_DEPOSITS} mode={mode} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="ZeroVatWarning (WarningBanner)"
        source="kosztorys/summary/settings/zero-vat-warning.tsx"
        className="max-w-lg"
      >
        <ZeroVatWarning />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        C. Komunikaty strony zgłoszeń pracownika
      </h3>
      <ShowcaseRow
        title="ReportNotice — odmowy zgłoszenia"
        source="kosztorys/worker-report/report-notice.tsx"
        className="flex-col items-stretch gap-0 divide-y"
      >
        {REPORT_NOTICES.map((key) => (
          <ReportNotice key={key} messageKey={key} />
        ))}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
