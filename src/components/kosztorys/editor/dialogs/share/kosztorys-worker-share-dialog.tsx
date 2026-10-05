'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ShareLinkPanel } from '@/components/kosztorys/editor/dialogs/share/share-link-panel'
import {
  generateWorkerLinkAction,
  revokeWorkerLinkAction,
} from '@/lib/actions/kosztorys-worker-share'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl, workerShareUrl } from '@/lib/kosztorys/worker-view/name-slug'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

const LINK_KINDS = {
  rozpiska: {
    title: 'Link dla pracownika',
    description:
      'Kto ma link, ten widzi kosztorys tego pracownika — bez logowania. Ceny klienta i stawki innych rozliczeń nigdy się w nim nie pojawiają.',
    revokeDescription:
      'Pracownik natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała).',
    url: workerShareUrl,
  },
  report: {
    title: 'Link do zgłoszeń',
    description:
      'Przez ten link pracownik zgłasza wykonane prace — bez logowania. Zgłoszenie czeka na Twoją weryfikację i dopiero po przyjęciu trafia do etapu.',
    revokeDescription:
      'Pracownik natychmiast straci możliwość wysyłania zgłoszeń. Wysłane zgłoszenia zostają. Aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała).',
    url: workerReportShareUrl,
  },
} satisfies Record<WorkerLinkKindT, unknown>

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

  const kind = LINK_KINDS[target?.kind ?? 'rozpiska']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader
          title={`${kind.title} — ${target?.name ?? ''}`}
          description={kind.description}
        />
        {target && (
          <ShareLinkPanel
            loaded={loaded}
            token={token}
            urlFor={(next) => kind.url(FRONTEND_URL, target.name, next)}
            generate={() =>
              generateWorkerLinkAction({ investmentId, workerId: target.id }, target.kind)
            }
            revoke={() =>
              revokeWorkerLinkAction({ investmentId, workerId: target.id }, target.kind)
            }
            onTokenChange={(next) => {
              setShareToken(next)
              if (next === null) dropLinkHolder(target.id, target.kind)
            }}
            blockReason={target.blockReason}
            revokeTitle={`Wyłączyć link dla: ${target.name}?`}
            revokeDescription={kind.revokeDescription}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
