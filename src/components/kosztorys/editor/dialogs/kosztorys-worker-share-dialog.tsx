'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share-link-panel'
import {
  generateWorkerShareLinkAction,
  revokeWorkerShareLinkAction,
} from '@/lib/actions/kosztorys-worker-share'
import { FRONTEND_URL } from '@/lib/env'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// No settings step, unlike the investor's: the worker set is firm-wide, so reviewing it here would
// suggest a per-link choice that does not exist. „Ustawienia widoku…" owns it.
export function KosztorysWorkerShareDialog() {
  const { investmentId } = useKosztorysEditorContext()
  const {
    shareTarget: target,
    shareOpen: open,
    setShareOpen: onOpenChange,
    shareToken: token,
    shareLoaded: loaded,
    setShareToken: onTokenChange,
  } = useKosztorysActions().worker

  const url = token ? `${FRONTEND_URL}/p/${token}` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader
          title={`Link dla pracownika — ${target?.name ?? ''}`}
          description="Kto ma link, ten widzi kosztorys tego pracownika — bez logowania. Ceny klienta i stawki innych rozliczeń nigdy się w nim nie pojawiają."
        />
        {target && (
          <ShareLinkPanel
            loaded={loaded}
            token={token}
            url={url}
            generate={() => generateWorkerShareLinkAction({ investmentId, workerId: target.id })}
            revoke={() => revokeWorkerShareLinkAction({ investmentId, workerId: target.id })}
            onTokenChange={onTokenChange}
            revokeTitle={`Wyłączyć link dla: ${target.name}?`}
            revokeDescription="Pracownik natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
