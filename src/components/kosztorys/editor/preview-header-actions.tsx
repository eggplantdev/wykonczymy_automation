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
import { BrandLogo } from '@/components/ui/brand-logo'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'

type PreviewHeaderActionsPropsT = {
  history?: InvestorHistoryT
  hasRows: boolean
  emptyRowCount: number
  showAllRows: boolean
  onShowAllRowsChange: (showAll: boolean) => void
}

export function PreviewHeader({
  investmentName,
  workerName,
  ...actions
}: { investmentName: string; workerName?: string } & PreviewHeaderActionsPropsT) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5 sm:py-5">
      <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-medium max-sm:line-clamp-2 sm:truncate">{investmentName}</h1>
        {workerName && <p className="truncate text-sm font-medium">{workerName}</p>}
      </div>
      <PreviewHeaderActions {...actions} />
    </header>
  )
}

// Item and dialog are siblings, never nested — a dialog inside the menu unmounts with it.
export function PreviewHeaderActions({
  history,
  hasRows,
  emptyRowCount,
  showAllRows,
  onShowAllRowsChange,
}: PreviewHeaderActionsPropsT) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 max-sm:order-last max-sm:grid max-sm:w-full max-sm:auto-cols-fr max-sm:grid-flow-col">
      {(history || emptyRowCount > 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="lg" variant="outline">
              <Settings />
              Opcje
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {history && (
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
      {!history?.version && (
        // The panel's open state is persisted per person, not per view, so without this the client
        // view inherits whatever the toolbar last left and can never fold it back.
        <KosztorysTotalsPanelToggle size="lg" disabled={!hasRows} hasRows={hasRows} />
      )}
      {history && (
        <HistoryDialog entries={history.entries} open={historyOpen} onOpenChange={setHistoryOpen} />
      )}
    </div>
  )
}
