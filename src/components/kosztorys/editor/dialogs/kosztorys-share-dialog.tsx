'use client'

import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share-link-panel'
import { generateShareLinkAction, revokeShareLinkAction } from '@/lib/actions/kosztorys-share'
import { investorShareUrl } from '@/lib/kosztorys/investor-share-url'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysShareDialog() {
  const { investmentId } = useKosztorysEditorContext()
  // The token is read — and minted when missing — by the action on the menu click, not here: Radix
  // fires onOpenChange only for its OWN trigger, never for a programmatic `open`.
  const {
    shareOpen: open,
    setShareOpen: onOpenChange,
    shareToken: token,
    shareLoaded: loaded,
    setShareToken: onTokenChange,
    requestSettings,
  } = useKosztorysActions().investor

  const openSettings = () => {
    onOpenChange(false)
    requestSettings()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader
          title="Udostępnij inwestorowi"
          description="Kto ma link, ten widzi kosztorys — bez logowania. Ceny podwykonawców nigdy się w nim nie pojawiają."
        />
        <ShareLinkPanel
          loaded={loaded}
          token={token}
          url={token ? investorShareUrl(token) : ''}
          generate={() => generateShareLinkAction(investmentId)}
          revoke={() => revokeShareLinkAction(investmentId)}
          onTokenChange={onTokenChange}
          revokeTitle="Wyłączyć link dla inwestora?"
          revokeDescription="Inwestor natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
        >
          <Button variant="ghost" size="sm" className="self-start" onClick={openSettings}>
            <Settings2 />
            Ustawienia podglądu…
          </Button>
        </ShareLinkPanel>
      </DialogContent>
    </Dialog>
  )
}
