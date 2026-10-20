'use client'

import { Lock } from 'lucide-react'
import { InfoList } from '@/components/ui/info-list'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'
import { InvestmentAiNotes } from '@/components/investments/investment-ai-notes'
import { InvestmentNotes } from '@/components/investments/investment-notes'
import { InvestmentStatusInlineSelect } from '@/components/investments/investment-status-inline-select'
import { InvestmentSiteManagerSelect } from '@/components/investments/investment-site-manager-select'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { ContractDialog } from '@/components/investments/contract-dialog'
import { RequestReviewButton } from '@/components/investments/request-review-button'
import { SheetButton } from '@/components/investments/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import { OrderButton } from '@/components/orders/order-button'
import { toOrderInvestment } from '@/components/orders/order-dialog'
import { investmentLockOf, isOfferedForBooking } from '@/lib/constants/investment-lock'
import { useOrderSettings, useReferenceData } from '@/hooks/use-reference-data'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'

type PropsT = {
  investment: InvestmentWithDetailsT
  trashed: boolean
  assets?: MediaFileT[]
  showKosztorysButton?: boolean
}

export function InvestmentOverview({ investment, trashed, assets, showKosztorysButton }: PropsT) {
  const referenceData = useReferenceData()
  const orderSettings = useOrderSettings()

  return (
    <>
      {trashed && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden />
          Inwestycja jest w koszu — tylko do odczytu. Aby ją zmienić, przywróć ją z Kosza.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!trashed && <EditInvestmentDialog investment={investment} showSiteManager showLabel />}
        {!trashed && <ContractDialog investment={investment} />}
        {investmentLockOf({ status: investment.status, trashed }) === 'completed' && (
          <RequestReviewButton investment={investment} showLabel />
        )}
        {investment.hasSheet && <SheetButton investmentId={investment.id} hasSheet size="sm" />}
        {showKosztorysButton && <OpenKosztorysV2Button investmentId={investment.id} size="sm" />}
        {!trashed && isOfferedForBooking(investment) && referenceData && orderSettings && (
          <OrderButton
            investment={toOrderInvestment(investment)}
            referenceData={referenceData}
            orderSettings={orderSettings}
          />
        )}
      </div>
      <div className="grid gap-2">
        <InfoList
          items={[
            ...buildInvestmentInfoFields(investment, { isReadOnly: trashed, hideStatus: !trashed }),
            ...(trashed || !referenceData
              ? []
              : [
                  {
                    label: 'Kierownik budowy',
                    value: (
                      <InvestmentSiteManagerSelect
                        investmentId={investment.id}
                        siteManagerId={investment.siteManagerId}
                        workers={referenceData.workers}
                      />
                    ),
                  },
                ]),
          ]}
        />
        {!trashed && (
          <div className="flex min-h-7 items-center">
            <InvestmentStatusInlineSelect investment={investment} />
          </div>
        )}
        <InvestmentNotes investment={investment} readOnly={trashed} />
        <InvestmentAiNotes aiNotes={investment.aiNotes} />
        {assets && (
          <section className="flex flex-col gap-2">
            <h2 className={cn('flex min-h-7 items-center', SUBSECTION_TITLE_CLASS)}>
              Zdjęcia i pliki
            </h2>
            <InvestmentAssetsControl investmentId={investment.id} assets={assets} />
          </section>
        )}
      </div>
    </>
  )
}
