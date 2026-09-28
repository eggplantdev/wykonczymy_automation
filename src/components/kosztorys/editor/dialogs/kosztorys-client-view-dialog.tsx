'use client'

import { useTransition } from 'react'
import { useDraft } from '@/hooks/use-draft'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ClientViewSettingsForm } from '@/components/kosztorys/editor/dialogs/client-view-settings-form'
import { useClientViewModeConfirm } from '@/components/kosztorys/editor/dialogs/use-client-view-mode-confirm'
import {
  saveClientViewDefaultsAction,
  saveClientViewSettingsAction,
} from '@/lib/actions/kosztorys-client-view'
import { sanitizeClientViewConfig } from '@/lib/kosztorys/client-view-settings'
import { OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE } from '@/lib/kosztorys/owner-only-messages'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Nothing is written until „Zapisz": closing the window leaves the client's link exactly as it was,
// so the owner can look through the list without deciding anything.
export function KosztorysClientViewDialog() {
  const { investmentId } = useKosztorysEditorContext()
  const {
    settingsOpen: open,
    setSettingsOpen: onOpenChange,
    clientView: settings,
    setClientView: onSaved,
  } = useKosztorysActions().investor
  const [draft, setDraft] = useDraft(settings)
  const [pending, startTransition] = useTransition()
  const { confirmModeChange, modeConfirmProps } = useClientViewModeConfirm(settings)
  // The same predicate `ownerOnlyAction` refuses by, so a manager learns it before the click instead
  // of from a „saved, but not as default" toast after it.
  const mayWriteDefaults = isAdminOrOwnerRole(useCurrentUser().role)

  const save = (asDefaults: boolean) =>
    startTransition(async () => {
      if (!draft) return
      // „Zapisz jako domyślne" saves this investment too, never only the firm-wide default: the
      // default applies to investments with no settings of their own, so writing it alone would
      // leave the kosztorys the owner is looking at unchanged by the button they just pressed.
      const res = await saveClientViewSettingsAction(investmentId, draft)
      if (!res.success) return toastMessage(res.error, 'error')
      // Published before the second write is attempted: that row IS saved, so leaving the parent on
      // the old value after a failed defaults write would make the editor and the DB disagree. The
      // sanitized copy, not the draft, for the same reason — the server stored that one.
      onSaved(sanitizeClientViewConfig(draft))
      if (asDefaults) {
        const defaults = await saveClientViewDefaultsAction(draft, draft.mode)
        if (!defaults.success) {
          return toastMessage(
            `Zapisano dla tej inwestycji, ale nie jako domyślne: ${defaults.error}`,
            'error',
          )
        }
      }
      toastMessage(
        asDefaults
          ? 'Zapisano — te kolumny są teraz domyślne dla tego wariantu.'
          : 'Zapisano ustawienia.',
        'success',
      )
      onOpenChange(false)
    })

  const requestSave = (asDefaults: boolean) => {
    if (draft) confirmModeChange(draft, () => save(asDefaults))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader
            title="Ustawienia podglądu inwestora"
            // Scoped to the rozpiska on purpose: the setting reaches the grid's columns and pozycje,
            // while the podsumowanie below it keeps its own client projection.
            description="Zaznacz, które kolumny i pozycje inwestor widzi w rozpisce. Ceny podwykonawców nie pojawiają się w niej nigdy."
          />
          <ClientViewSettingsForm value={draft} onChange={setDraft} disabled={pending} />
          {/* A sentence, not a `title`: the disabled Button has pointer-events off, so no tooltip. */}
          {!mayWriteDefaults && (
            <Description size="xs">{OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE}</Description>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={!draft || pending || !mayWriteDefaults}
              onClick={() => requestSave(true)}
            >
              Zapisz jako domyślne
            </Button>
            <Button size="sm" disabled={!draft || pending} onClick={() => requestSave(false)}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...modeConfirmProps} />
    </>
  )
}
