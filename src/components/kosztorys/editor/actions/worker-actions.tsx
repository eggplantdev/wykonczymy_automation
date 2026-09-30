'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardPen, Eye, Settings2, Share2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useLatestRequest } from '@/hooks/use-latest-request'
import {
  readWorkerShareHolders,
  readWorkerShareToken,
} from '@/lib/queries/worker-share-link-endpoint'
import { readWorkerViewSettings } from '@/lib/queries/worker-view-settings-endpoint'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import { toastMessage } from '@/lib/utils/toast'
import { workerPreviewSegment } from '@/lib/kosztorys/worker-view/name-slug'

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
    void readWorkerShareToken({ investmentId, workerId: target.id }, target.kind)
      .then((token) => {
        if (isCurrent()) setShareToken(token)
      })
      .catch(() => {
        if (!isCurrent()) return
        toastMessage('Nie udało się sprawdzić linku', 'error')
        setShareOpen(false)
      })
      .finally(() => {
        if (isCurrent()) setShareLoaded(true)
      })
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
