'use client'

import { HistoryDialog } from '@/components/kosztorys/editor/history/history-dialog'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'

// The investor's history is the investor's: gated on `worker` here as well as at the page, so a
// future caller passing both can't hand it to a crew.
export function PreviewHeaderActions({
  worker,
  history,
  hasRows,
}: {
  worker?: WorkerAudienceT
  history?: InvestorHistoryT
  hasRows: boolean
}) {
  const investorHistory = worker ? undefined : history
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {investorHistory && <HistoryDialog entries={investorHistory.entries} />}
      {/* The panel reads today's wpłaty and bilans — beside a past grid it would pair two days. */}
      {!investorHistory?.version && (
        // The panel's open state is persisted per person, not per view, so without this the client
        // view inherits whatever the toolbar last left and can never fold it back.
        <KosztorysTotalsPanelToggle size="lg" disabled={!hasRows} hasRows={hasRows} />
      )}
    </div>
  )
}
