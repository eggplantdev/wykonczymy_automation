'use client'

import { Fragment } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { assignedWorkers } from '@/lib/kosztorys/worker-view/assigned-workers'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/constants'

// The investor menu's twin, one block per worker who holds an etap. Mounted inside
// KosztorysActionsProvider (see KosztorysActionsMenu), which its items and dialogs read from.
export function KosztorysWorkersMenu() {
  const { stages, workers } = useKosztorysEditorContext()
  const assigned = assignedWorkers(stages, workers)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Users />
          Pracownicy
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
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
              <WorkerPreviewMenuItem workerId={id} />
              <WorkerShareMenuItem target={{ id, name }} disabled={blockReason !== undefined} />
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
