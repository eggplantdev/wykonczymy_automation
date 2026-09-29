'use client'

import { useTransition } from 'react'
import { useDraft } from '@/hooks/use-draft'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings/view-settings-fields'
import { saveWorkerViewSettingsAction } from '@/lib/actions/kosztorys-worker-view'
import { DocumentColumnOrderButton } from '@/components/kosztorys/editor/dialogs/view-settings/document-column-order-button'
import { WORKER_DOCUMENT_COLUMNS, WORKER_VIEW_GROUPS } from '@/lib/kosztorys/worker-view/columns'
import { sanitizeWorkerViewSettings, workerColumnLabel } from '@/lib/kosztorys/worker-view/settings'
import { OWNER_ONLY_WORKER_VIEW_SETTINGS_MESSAGE } from '@/lib/kosztorys/owner-only-messages'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

// One set for every worker link in the firm, so a manager may read it but not change it — the same
// predicate `ownerOnlyAction` refuses by.
export function KosztorysWorkerViewDialog() {
  const {
    settingsOpen: open,
    setSettingsOpen: onOpenChange,
    settings,
    setSettings: onSaved,
  } = useKosztorysActions().worker
  const [draft, setDraft] = useDraft(settings)
  const [pending, startTransition] = useTransition()
  const mayWrite = isAdminOrOwnerRole(useCurrentUser().role)

  const save = () =>
    startTransition(async () => {
      if (!draft) return
      const res = await saveWorkerViewSettingsAction(draft)
      if (!res.success) return toastMessage(res.error, 'error')
      onSaved(sanitizeWorkerViewSettings(draft))
      toastMessage('Zapisano — zmiana obowiązuje na wszystkich linkach pracowników.', 'success')
      onOpenChange(false)
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader
          title="Ustawienia widoku pracownika"
          description="Zaznacz, które kolumny i pozycje widzą pracownicy. Jedno ustawienie dla wszystkich pracowników i inwestycji. Ceny klienta nie pojawiają się w tym widoku nigdy."
        />
        {draft ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <DocumentColumnOrderButton
              keys={WORKER_DOCUMENT_COLUMNS}
              labelFor={workerColumnLabel}
              value={draft}
              onChange={setDraft}
              resetRanks={{}}
              disabled={pending || !mayWrite}
            />
            <ViewSettingsFields
              groups={WORKER_VIEW_GROUPS}
              labelFor={workerColumnLabel}
              value={draft}
              onChange={setDraft}
              disabled={pending || !mayWrite}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Wczytywanie…</p>
        )}
        {/* The disabled Button has pointer-events off, so a `title` would never show. */}
        {!mayWrite && (
          <Description size="xs">{OWNER_ONLY_WORKER_VIEW_SETTINGS_MESSAGE}</Description>
        )}
        <DialogFooter>
          <Button size="sm" disabled={!draft || pending || !mayWrite} onClick={save}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
