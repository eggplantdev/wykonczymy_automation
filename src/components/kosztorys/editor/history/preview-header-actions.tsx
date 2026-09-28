'use client'

import { useState } from 'react'
import { History, Settings } from 'lucide-react'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxRow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HistoryDialog } from '@/components/kosztorys/editor/history/history-dialog'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'

// The investor's history is the investor's: gated on `worker` here as well as at the page, so a
// future caller passing both can't hand it to a crew.
// Item and dialog are siblings, never nested — a dialog inside the menu unmounts with it.
export function PreviewHeaderActions({
  worker,
  history,
  hasRows,
  emptyRowCount,
  showAllRows,
  onShowAllRowsChange,
}: {
  worker?: WorkerAudienceT
  history?: InvestorHistoryT
  hasRows: boolean
  emptyRowCount: number
  showAllRows: boolean
  onShowAllRowsChange: (showAll: boolean) => void
}) {
  const investorHistory = worker ? undefined : history
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {(investorHistory || emptyRowCount > 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" variant="outline">
              <Settings />
              <span className="max-sm:sr-only">Opcje</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {investorHistory && (
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <History />
                Zobacz historię zmian
              </DropdownMenuItem>
            )}
            {emptyRowCount > 0 && (
              <DropdownMenuCheckboxRow
                checked={showAllRows}
                onCheckedChange={onShowAllRowsChange}
                label={`Pokaż wszystkie pozycje (+${emptyRowCount})`}
              />
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* The panel reads today's wpłaty and bilans — beside a past grid it would pair two days. */}
      {!investorHistory?.version && (
        // The panel's open state is persisted per person, not per view, so without this the client
        // view inherits whatever the toolbar last left and can never fold it back.
        <KosztorysTotalsPanelToggle size="lg" disabled={!hasRows} hasRows={hasRows} />
      )}
      {investorHistory && (
        <HistoryDialog
          entries={investorHistory.entries}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}
    </div>
  )
}
