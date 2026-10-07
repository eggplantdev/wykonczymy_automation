'use client'

import { useTransition } from 'react'
import { useDraft } from '@/hooks/use-draft'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ViewSettingsFields } from '@/components/kosztorys/editor/dialogs/view-settings/view-settings-fields'
import { saveWorkerViewSettingsAction } from '@/lib/actions/kosztorys-worker-view'
import { DocumentColumnOrderButton } from '@/components/kosztorys/editor/dialogs/view-settings/document-column-order-button'
import {
  WORKER_DOCUMENT_COLUMNS,
  WORKER_VIEW_GROUPS,
  workerColumnLabel,
} from '@/lib/kosztorys/worker-view/columns'
import { sanitizeWorkerViewSettings } from '@/lib/kosztorys/worker-view/settings'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function KosztorysWorkerViewDialog() {
  const {
    settingsOpen: open,
    setSettingsOpen: onOpenChange,
    settings,
    setSettings: onSaved,
  } = useKosztorysActions().worker
  const [draft, setDraft] = useDraft(settings)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      if (!draft) return
      const res = await settleAction(() => saveWorkerViewSettingsAction(draft))
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
            <Description size="xs">
              Kolumny rozliczenia — pomiar razem etapy, etapy i ich wartości, wartość wykonana —
              pojawią się u pracownika dopiero po pierwszym wpisie w którymkolwiek z jego etapów.
              Etap bez wpisów pozostaje ukryty.
            </Description>
            <DocumentColumnOrderButton
              keys={WORKER_DOCUMENT_COLUMNS}
              labelFor={workerColumnLabel}
              value={draft}
              onChange={setDraft}
              resetRanks={{}}
              disabled={pending}
            />
            <ViewSettingsFields
              groups={WORKER_VIEW_GROUPS}
              labelFor={workerColumnLabel}
              value={draft}
              onChange={setDraft}
              disabled={pending}
            />
            <div className="flex flex-col gap-0.5 border-t pt-3">
              <p className="text-muted-foreground px-2 text-xs font-medium">Przedmiar</p>
              <CheckboxRow
                checked={draft.hidePlannedOnceExecuted}
                disabled={pending}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, hidePlannedOnceExecuted: checked })
                }
              >
                Ukryj aktualizację przedmiaru i jej wartość, gdy w etapach są już wpisy
              </CheckboxRow>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Wczytywanie…</p>
        )}
        <DialogFooter>
          <Button size="sm" disabled={!draft || pending} onClick={save}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
