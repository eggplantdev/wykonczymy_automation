'use client'

import { useState, useTransition } from 'react'
import { useDraft } from '@/hooks/use-draft'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ClientViewSettingsForm } from '@/components/kosztorys/editor/dialogs/client-view-settings-form'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share-link-panel'
import { generateShareLinkAction, revokeShareLinkAction } from '@/lib/actions/kosztorys-share'
import { saveClientViewSettingsAction } from '@/lib/actions/kosztorys-client-view'
import {
  sameClientViewSettings,
  sanitizeClientViewSettings,
} from '@/lib/kosztorys/client-view-settings'
import { FRONTEND_URL } from '@/lib/env'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

const investorShareUrl = (token: string) => `${FRONTEND_URL}/k/${token}`

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

  const url = token ? investorShareUrl(token) : ''

  const save = () =>
    startTransition(async () => {
      if (!draft) return
      // An untouched step writes nothing. A saved row overrides the firm-wide default forever after,
      // so clicking through the review must not silently opt this investment out of a default the
      // owner may change later.
      if (!settings || !sameClientViewSettings(draft, settings)) {
        const res = await saveClientViewSettingsAction(investmentId, draft)
        if (!res.success) return toastMessage(res.error, 'error')
        onSettingsChange(sanitizeClientViewSettings(draft))
      }
      // Only mints when none exists — minting over a live token would cut off the investor who holds it.
      let shareToken = token
      if (!shareToken) {
        const res = await generateShareLinkAction(investmentId)
        if (!res.success) return toastMessage(res.error, 'error')
        shareToken = res.data
        onTokenChange(shareToken)
      }
      copyToClipboard(investorShareUrl(shareToken), 'Link skopiowany do schowka.')
      setStep('link')
    })

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
                {/* Gated on `loaded`: before the token read lands, „no token" is indistinguishable
                    from „not checked yet", and the click would mint over a live link. */}
                <Button size="sm" disabled={!draft || !loaded || pending} onClick={save}>
                  {token ? 'Kopiuj link' : 'Wygeneruj i skopiuj link'}
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
    </>
  )
}
