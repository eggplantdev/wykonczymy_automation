'use client'

import { Fragment } from 'react'
import { ClipboardCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  WorkerPreviewMenuItem,
  WorkerShareMenuItem,
  WorkerViewSettingsMenuItem,
} from '@/components/kosztorys/editor/actions/worker-actions'
import { WorkerPrintMenuItem } from '@/components/kosztorys/editor/actions/worker-print-action'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { assignedWorkers } from '@/lib/kosztorys/worker-view/assigned-workers'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'

// Mounted inside KosztorysActionsProvider (see KosztorysActionsMenu), which its items and dialogs read from.
export function KosztorysWorkersMenu() {
  const { stages, workers } = useKosztorysEditorContext()
  const { worker, workerReports } = useKosztorysActions()
  const assigned = assignedWorkers(stages, workers, worker.linkHolders)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return
        worker.requestLinkHolders()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Users />
          Pracownicy
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {workerReports && (
          <>
            <DropdownMenuItem onSelect={() => workerReports.openReport()}>
              <ClipboardCheck />
              Zgłoszenia wykonanych prac
              {workerReports.pendingCount > 0 && (
                <span className="text-muted-foreground ml-auto text-xs">
                  {workerReports.pendingCount} do sprawdzenia
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {assigned.length === 0 && (
          <>
            <p className="text-muted-foreground px-2 py-1.5 text-xs">
              Żaden etap nie ma przypisanego pracownika.
            </p>
            <DropdownMenuSeparator />
          </>
        )}
        {assigned.map(({ id, name, scope }) => {
          // Podgląd stays open when blocked: it shows the owner the same notice the worker would get.
          const blockReason =
            scope.kind === 'blocked' ? WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] : undefined
          return (
            <Fragment key={id}>
              <DropdownMenuLabel>{name}</DropdownMenuLabel>
              {blockReason && <p className="text-destructive px-2 pb-1 text-xs">{blockReason}</p>}
              <WorkerPreviewMenuItem target={{ id, name }} />
              {(['rozpiska', 'report'] as const).map((kind) => (
                <WorkerShareMenuItem
                  key={kind}
                  target={{ id, name, kind, blockReason }}
                  disabled={blockReason !== undefined && !worker.holdsLink(id, kind)}
                />
              ))}
              <WorkerPrintMenuItem workerId={id} disabled={blockReason !== undefined} />
              <DropdownMenuSeparator />
            </Fragment>
          )
        })}
        <WorkerViewSettingsMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
