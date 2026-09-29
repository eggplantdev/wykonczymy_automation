'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, Settings2, Share2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { ensureShareLinkAction } from '@/lib/actions/kosztorys-share'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { ColumnRanksT } from '@/lib/table/column-order'
import { copyToClipboardAsync } from '@/lib/utils/copy-to-clipboard'
import { investorShareUrl } from '@/lib/kosztorys/client-view/share-url'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

// Carries an action's own error text past the promise chain, so the toast names what failed.
class ShareLinkError extends Error {}

export type InvestorActionsT = {
  clientView: ClientViewSettingsT | null
  setClientView: (settings: ClientViewSettingsT) => void
  defaultColumnRanks: ColumnRanksT
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  requestSettings: () => void
  shareOpen: boolean
  setShareOpen: (open: boolean) => void
  shareToken: string | null
  setShareToken: (token: string | null) => void
  shareLoaded: boolean
  requestShare: () => void
}

export function useInvestorActions(): InvestorActionsT {
  const { investmentId } = useKosztorysEditorContext()
  const [clientView, setClientView] = useState<ClientViewSettingsT | null>(null)
  const [defaultColumnRanks, setDefaultColumnRanks] = useState<ColumnRanksT>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareLoaded, setShareLoaded] = useState(false)
  const settingsRequest = useLatestRequest()
  const shareRequest = useLatestRequest()

  // Fetch on the click, not inside the dialog: Radix onOpenChange never fires for a programmatic
  // `open`, so the dialog can't fetch itself. Re-read on every open, so the window never shows a set
  // that another session has since changed.
  // Latest-wins: a slow first read landing after a second one would put a stale set back into the
  // dialog — and the next „Zapisz" would write that stale set over what the owner had just saved.
  function readSettings() {
    const isCurrent = settingsRequest.start()
    setClientView(null)
    void readClientViewSettings(investmentId)
      .then((read) => {
        if (!isCurrent()) return
        setClientView(read.settings)
        setDefaultColumnRanks(read.defaultColumnRanks)
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
      })
  }

  function requestSettings() {
    setSettingsOpen(true)
    readSettings()
  }

  // Same Radix reason as readSettings — and re-reading on each open avoids showing a link that may
  // have been rotated or revoked elsewhere since last time as though it were still live.
  function requestShare() {
    const isCurrent = shareRequest.start()
    setShareOpen(true)
    setShareLoaded(false)
    const token = ensureShareLinkAction(investmentId).then((result) => {
      if (!result.success) throw new ShareLinkError(result.error)
      if (isCurrent()) setShareToken(result.data)
      return result.data
    })
    token
      .catch((error: unknown) => {
        if (!isCurrent()) return
        setShareToken(null)
        toastMessage(
          error instanceof ShareLinkError ? error.message : 'Nie udało się przygotować linku',
          'error',
        )
      })
      .finally(() => {
        if (isCurrent()) setShareLoaded(true)
      })
    copyToClipboardAsync(token.then(investorShareUrl), 'Link skopiowany do schowka.')
  }

  return {
    clientView,
    setClientView,
    defaultColumnRanks,
    settingsOpen,
    setSettingsOpen,
    requestSettings,
    shareOpen,
    setShareOpen,
    shareToken,
    setShareToken,
    shareLoaded,
    requestShare,
  }
}

export function InvestorPreviewMenuItem() {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <DropdownMenuItem asChild>
      <Link href={`/podglad-inwestora/${investmentId}`} target="_blank">
        <Eye />
        <MenuItemBody label="Podgląd" description="Zobacz kosztorys tak, jak widzi go inwestor." />
      </Link>
    </DropdownMenuItem>
  )
}

export function ClientViewSettingsMenuItem() {
  const { investor } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={investor.requestSettings}>
      <Settings2 />
      <MenuItemBody
        label="Ustawienia podglądu…"
        description="Zdecyduj, które kolumny i pozycje widzi inwestor."
      />
    </DropdownMenuItem>
  )
}

export function ShareMenuItem() {
  const { investor } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={investor.requestShare}>
      <Share2 />
      <MenuItemBody
        label="Udostępnij"
        description="Skopiuj link, którym inwestor otworzy kosztorys bez logowania."
      />
    </DropdownMenuItem>
  )
}
