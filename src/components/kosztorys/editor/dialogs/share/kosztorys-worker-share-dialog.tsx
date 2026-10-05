'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share/share-link-panel'
import {
  generateWorkerLinkAction,
  revokeWorkerLinkAction,
} from '@/lib/actions/kosztorys-worker-share'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/name-slug'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// The worker set is firm-wide, so reviewing it here would suggest a per-link choice that does not exist. „Ustawienia widoku…" owns it.
export function KosztorysWorkerShareDialog() {
  const { investmentId } = useKosztorysEditorContext()
  const {
    shareTarget: target,
    shareOpen: open,
    setShareOpen: onOpenChange,
    shareToken: token,
    shareLoaded: loaded,
    setShareToken,
    dropLinkHolder,
  } = useKosztorysActions().worker

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader
          title={`Link do zgłoszeń — ${target?.name ?? ''}`}
          description="Przez ten link pracownik widzi swój kosztorys z rozliczeniem i zgłasza wykonane prace — bez logowania. Ceny klienta i stawki innych rozliczeń nigdy się w nim nie pojawiają. Zgłoszenie czeka na Twoją weryfikację i dopiero po przyjęciu trafia do etapu."
        />
        {target && (
          <ShareLinkPanel
            loaded={loaded}
            token={token}
            urlFor={(next) => workerReportShareUrl(FRONTEND_URL, target.name, next)}
            generate={() => generateWorkerLinkAction({ investmentId, workerId: target.id })}
            revoke={() => revokeWorkerLinkAction({ investmentId, workerId: target.id })}
            onTokenChange={(next) => {
              setShareToken(next)
              if (next === null) dropLinkHolder(target.id)
            }}
            blockReason={target.blockReason}
            revokeTitle={`Wyłączyć link dla: ${target.name}?`}
            revokeDescription="Pracownik natychmiast straci dostęp do kosztorysu i możliwość wysyłania zgłoszeń. Wysłane zgłoszenia zostają. Aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
