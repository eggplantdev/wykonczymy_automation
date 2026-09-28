'use client'

import { useState, useTransition } from 'react'
import { useDraft } from '@/hooks/use-draft'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ClientViewSettingsForm } from '@/components/kosztorys/editor/dialogs/client-view-settings-form'
import { useClientViewModeConfirm } from '@/components/kosztorys/editor/dialogs/use-client-view-mode-confirm'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share-link-panel'
import { generateShareLinkAction, revokeShareLinkAction } from '@/lib/actions/kosztorys-share'
import { saveClientViewSettingsAction } from '@/lib/actions/kosztorys-client-view'
import {
  sameClientViewConfig,
  sanitizeClientViewConfig,
} from '@/lib/kosztorys/client-view-settings'
import { FRONTEND_URL } from '@/lib/env'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysShareDialog() {
  const { investmentId } = useKosztorysEditorContext()
  // The token and the settings are fetched by the action on the menu click, not here: Radix fires
  // onOpenChange only for its OWN trigger, never for a programmatic `open`. The settings are the same
  // copy the „Ustawienia podglądu…" window edits, so the two surfaces can never show different answers.
  const {
    shareOpen: open,
    setShareOpen: onOpenChange,
    shareToken: token,
    shareLoaded: loaded,
    setShareToken: onTokenChange,
    clientView: settings,
    setClientView: onSettingsChange,
  } = useKosztorysActions().investor
  const { confirmModeChange, modeConfirmProps } = useClientViewModeConfirm(settings)
  const [pending, startTransition] = useTransition()
  // Every open starts at the settings, including when a link already exists — the point is that
  // nobody hands out a link without having just looked at what it discloses, which a first-run-only
  // wizard would give up after the first share.
  const [step, setStep] = useState<'settings' | 'link'>('settings')
  const [draft, setDraft] = useDraft(settings)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setStep('settings')
  }

  const url = token ? `${FRONTEND_URL}/k/${token}` : ''

  const save = () =>
    startTransition(async () => {
      if (!draft) return
      // „Dalej" on an untouched step writes nothing. A saved row overrides the firm-wide default
      // forever after, so clicking through the review must not silently opt this investment out of
      // a default the owner may change later.
      if (settings && sameClientViewConfig(draft, settings)) return setStep('link')
      const res = await saveClientViewSettingsAction(investmentId, draft)
      if (!res.success) return toastMessage(res.error, 'error')
      onSettingsChange(sanitizeClientViewConfig(draft))
      setStep('link')
    })

  const saveAndContinue = () => {
    if (draft) confirmModeChange(draft, save)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader
            title="Udostępnij inwestorowi"
            description={
              step === 'settings'
                ? 'Najpierw sprawdź, co inwestor zobaczy. Ceny podwykonawców nigdy się w kosztorysie nie pojawiają.'
                : 'Kto ma link, ten widzi kosztorys — bez logowania. Ceny podwykonawców nigdy się w nim nie pojawiają.'
            }
          />
          {step === 'settings' ? (
            <>
              <ClientViewSettingsForm value={draft} onChange={setDraft} disabled={pending} />
              <DialogFooter>
                <Button size="sm" disabled={!draft || pending} onClick={saveAndContinue}>
                  Dalej
                </Button>
              </DialogFooter>
            </>
          ) : (
            <ShareLinkPanel
              loaded={loaded}
              token={token}
              url={url}
              generate={() => generateShareLinkAction(investmentId)}
              revoke={() => revokeShareLinkAction(investmentId)}
              onTokenChange={onTokenChange}
              revokeTitle="Wyłączyć link dla inwestora?"
              revokeDescription="Inwestor natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
            >
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setStep('settings')}
              >
                <ArrowLeft />
                Wróć do ustawień
              </Button>
            </ShareLinkPanel>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...modeConfirmProps} />
    </>
  )
}
