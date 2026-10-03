'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardPen, Eye, Settings2, Share2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { ensureWorkerLinkAction } from '@/lib/actions/kosztorys-worker-share'
import { FRONTEND_URL } from '@/lib/env'
import {
  readWorkerShareHolders,
  readWorkerShareToken,
} from '@/lib/queries/worker-share-link-endpoint'
import { readWorkerViewSettings } from '@/lib/queries/worker-view-settings-endpoint'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import { copyToClipboardAsync } from '@/lib/utils/copy-to-clipboard'
import { toastMessage } from '@/lib/utils/toast'
import {
  workerPreviewSegment,
  workerReportShareUrl,
  workerShareUrl,
} from '@/lib/kosztorys/worker-view/name-slug'
import { settleAction } from '@/lib/utils/settle-action'

// Carries an action's own error text past the promise chain, so the toast names what failed.
class ShareLinkError extends Error {}

const LINK_URL: Record<WorkerLinkKindT, typeof workerShareUrl> = {
  rozpiska: workerShareUrl,
  report: workerReportShareUrl,
}

export type WorkerShareTargetT = {
  id: number
  name: string
  kind: WorkerLinkKindT
  blockReason?: string
}

export type WorkerActionsT = {
  settings: WorkerViewSettingsT | null
  setSettings: (settings: WorkerViewSettingsT) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  requestSettings: () => void
  shareTarget: WorkerShareTargetT | null
  shareOpen: boolean
  setShareOpen: (open: boolean) => void
  shareToken: string | null
  setShareToken: (token: string | null) => void
  shareLoaded: boolean
  requestShare: (target: WorkerShareTargetT) => void
  // Either kind — who the menu keeps listing.
  linkHolders: ReadonlySet<number>
  holdsLink: (workerId: number, kind: WorkerLinkKindT) => boolean
  requestLinkHolders: () => void
  dropLinkHolder: (workerId: number, kind: WorkerLinkKindT) => void
}

// Fetched on the click, not by the dialogs, for the Radix reason `useInvestorActions` gives.
export function useWorkerActions(): WorkerActionsT {
  const { investmentId } = useKosztorysEditorContext()
  const [settings, setSettings] = useState<WorkerViewSettingsT | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<WorkerShareTargetT | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoaded, setShareLoaded] = useState(false)
  const [holdersByKind, setHoldersByKind] = useState<Record<WorkerLinkKindT, ReadonlySet<number>>>({
    rozpiska: new Set(),
    report: new Set(),
  })
  const linkHolders = new Set([...holdersByKind.rozpiska, ...holdersByKind.report])
  const settingsRequest = useLatestRequest()
  // Latest-wins: with one dialog serving every worker, a slow read for the first landing after a
  // click on the second would put the first worker's link under the second one's name.
  const shareRequest = useLatestRequest()
  const holdersRequest = useLatestRequest()

  function requestSettings() {
    const isCurrent = settingsRequest.start()
    setSettingsOpen(true)
    setSettings(null)
    void readWorkerViewSettings()
      .then((next) => {
        if (isCurrent()) setSettings(next)
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się odczytać ustawień widoku', 'error')
      })
  }

  function requestShare(target: WorkerShareTargetT) {
    const isCurrent = shareRequest.start()
    setShareTarget(target)
    setShareOpen(true)
    setShareToken(null)
    setShareLoaded(false)
    const key = { investmentId, workerId: target.id }

    function show(token: Promise<string | null>) {
      void token
        .then((next) => {
          if (isCurrent()) setShareToken(next)
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return
          toastMessage(
            error instanceof ShareLinkError ? error.message : 'Nie udało się przygotować linku',
            'error',
          )
          setShareOpen(false)
        })
        .finally(() => {
          if (isCurrent()) setShareLoaded(true)
        })
    }

    // A blocked worker's link opens only to be switched off, so it is read, never minted or copied.
    if (target.blockReason !== undefined) return show(readWorkerShareToken(key, target.kind))

    const token = settleAction(() => ensureWorkerLinkAction(key, target.kind)).then((result) => {
      if (!result.success) throw new ShareLinkError(result.error)
      return result.data
    })
    show(token)
    copyToClipboardAsync(
      token.then((next) => LINK_URL[target.kind](FRONTEND_URL, target.name, next)),
      'Link skopiowany do schowka.',
    )
  }

  function requestLinkHolders() {
    const isCurrent = holdersRequest.start()
    void readWorkerShareHolders(investmentId)
      .then((holders) => {
        if (isCurrent()) {
          setHoldersByKind({ rozpiska: new Set(holders.rozpiska), report: new Set(holders.report) })
        }
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się sprawdzić linków pracowników', 'error')
      })
  }

  function dropLinkHolder(workerId: number, kind: WorkerLinkKindT) {
    // A read already in flight answers from before the revoke and would put the worker back.
    holdersRequest.start()
    setHoldersByKind((holders) => {
      const next = new Set(holders[kind])
      next.delete(workerId)
      return { ...holders, [kind]: next }
    })
  }

  return {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    requestSettings,
    shareTarget,
    shareOpen,
    setShareOpen,
    shareToken,
    setShareToken,
    shareLoaded,
    requestShare,
    linkHolders,
    holdsLink: (workerId, kind) => holdersByKind[kind].has(workerId),
    requestLinkHolders,
    dropLinkHolder,
  }
}

export function WorkerPreviewMenuItem({
  target,
}: {
  target: Pick<WorkerShareTargetT, 'id' | 'name'>
}) {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <DropdownMenuItem asChild>
      <Link
        href={`/podglad-pracownika/${workerPreviewSegment(target.name, target.id)}/${investmentId}`}
        target="_blank"
      >
        <Eye />
        Podgląd
      </Link>
    </DropdownMenuItem>
  )
}

const SHARE_MENU_LABEL: Record<WorkerLinkKindT, string> = {
  rozpiska: 'Link',
  report: 'Link do zgłoszeń',
}

export function WorkerShareMenuItem({
  target,
  disabled,
}: {
  target: WorkerShareTargetT
  disabled: boolean
}) {
  const { worker } = useKosztorysActions()
  const Icon = target.kind === 'report' ? ClipboardPen : Share2
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => worker.requestShare(target)}>
      <Icon />
      {SHARE_MENU_LABEL[target.kind]}
    </DropdownMenuItem>
  )
}

export function WorkerViewSettingsMenuItem() {
  const { worker } = useKosztorysActions()
  return (
    <DropdownMenuItem onSelect={worker.requestSettings}>
      <Settings2 />
      <MenuItemBody
        label="Ustawienia widoku…"
        description="Zdecyduj, które kolumny i pozycje widzą pracownicy — jedno ustawienie dla wszystkich."
      />
    </DropdownMenuItem>
  )
}
