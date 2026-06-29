'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toastMessage } from '@/components/toasts'
import {
  applyMaterialSync,
  previewMaterialSync,
  type MaterialSyncPreviewT,
  type TabSyncPreviewT,
} from '@/lib/actions/sheets-sync'
import { setupSheetAction } from '@/lib/actions/investments'
import { formatPLN } from '@/lib/format-currency'

export function SyncButton({ investmentId }: { investmentId: number }) {
  const [preview, setPreview] = useState<MaterialSyncPreviewT | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const onSetupConfirm = () => {
    startTransition(async () => {
      const setup = await setupSheetAction(investmentId)
      if (!setup.success) {
        toastMessage(setup.error, 'error')
        return
      }
      // Reset wipes the tab — immediately re-sync so the rows come back.
      const applied = await applyMaterialSync(investmentId)
      setSetupOpen(false)
      if (!applied.success) {
        toastMessage(
          `Zakładka zresetowana, ale synchronizacja nie powiodła się: ${applied.error}`,
          'warning',
        )
        return
      }
      // Reset just wiped the tab, so every synced row is an append — `updated` and
      // `removed` are always 0 here (unlike the standalone Synchronizuj path, which
      // runs against a populated tab). Show only +added.
      const { added, errors } = applied.data
      toastMessage(
        `Zakładka zresetowana i zsynchronizowana: +${added}${
          errors.length ? ` · błędy: ${errors.length}` : ''
        }`,
        errors.length ? 'warning' : 'success',
      )
    })
  }

  const onCheck = () => {
    startTransition(async () => {
      const res = await previewMaterialSync(investmentId)
      if (!res.success) {
        toastMessage(res.error, 'error')
        return
      }
      setPreview(res.data)
    })
  }

  const onConfirm = () => {
    if (!preview) return
    startTransition(async () => {
      const res = await applyMaterialSync(investmentId)
      if (!res.success) {
        toastMessage(res.error, 'error')
        return
      }
      const { added, updated, removed, errors } = res.data
      toastMessage(
        `Synchronizacja: +${added} / zaktualizowano ${updated} / usunięto ${removed}${
          errors.length ? ` · błędy: ${errors.length}` : ''
        }`,
        errors.length ? 'warning' : 'success',
      )
      setPreview(null)
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setSetupOpen(true)} disabled={pending}>
        Zresetuj wydatki inwestycyjne
      </Button>
      <Button size="sm" variant="outline" onClick={onCheck} disabled={pending}>
        {pending ? 'Synchronizuję…' : 'Synchronizuj wydatki inwestycyjne'}
      </Button>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zresetować zakładki synchronizowane z aplikacją?</DialogTitle>
            <DialogDescription>
              Zakładki <strong>wydatki inwestycyjne (tylko do odczytu)</strong>,{' '}
              <strong>rozliczone R+M (tylko do odczytu)</strong> i{' '}
              <strong>transfery (tylko do odczytu)</strong> zostaną zbudowane od nowa: aplikacja
              wyczyści całą ich zawartość, w tym wiersze dodane ręcznie (spoza aplikacji). Tej
              operacji nie można cofnąć.
              <strong>
                Jeśli chcesz zachować ręcznie dodane dane, najpierw zrób kopię zakładki
              </strong>
              — aplikacja nie zmienia innych kart, więc taka kopia pozostanie nienaruszona.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={onSetupConfirm} disabled={pending}>
              {pending ? 'Pracuję…' : 'Zresetuj zakładkę'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Synchronizacja wydatków inwestycyjnych</DialogTitle>
            <DialogDescription>
              Do arkusza zostaną dodane nowe wydatki inwestycyjne, a istniejące wiersze zostaną
              odświeżone, aby pasowały do danych z aplikacji. Wiersze dodane ręcznie (spoza
              aplikacji) pozostają bez zmian.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              {pendingChanges(preview) === 0 ? (
                <p className="text-muted-foreground">Wszystko jest już zsynchronizowane.</p>
              ) : (
                <>
                  {preview.tabs.map((t) => (
                    <p key={t.label} className="text-muted-foreground text-xs">
                      {t.label} — do dodania: <strong>{t.toAppend.length}</strong> · do odświeżenia:{' '}
                      <strong>{t.toUpdateCount}</strong> · do usunięcia:{' '}
                      <strong>{t.toRemoveCount}</strong>
                    </p>
                  ))}
                  {preview.tabs
                    .filter((t) => t.toAppend.length > 0)
                    .map((t) => (
                      <Section
                        key={t.label}
                        title={`${t.label} do dodania (${t.toAppend.length})`}
                        items={t.toAppend.map(appendItem)}
                      />
                    ))}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Anuluj
            </Button>
            <Button
              onClick={onConfirm}
              disabled={pending || !preview || pendingChanges(preview) === 0}
            >
              Zsynchronizuj arkusz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// One pending row as a display line for the preview's append sections.
function appendItem(r: TabSyncPreviewT['toAppend'][number]) {
  return {
    key: r.transferId,
    text: `#${r.transferId} · ${r.typ} · ${formatPLN(Number(r.amount))} · ${r.description} [${r.date}]`,
  }
}

// Total state-changing operations a confirm would perform — drives the "nothing
// to do" message and whether the confirm button is enabled (review T3.1). The
// confirm reconciles every tab, so each tab's changes count.
function pendingChanges(p: MaterialSyncPreviewT): number {
  return p.tabs.reduce((sum, t) => sum + t.toAppend.length + t.toUpdateCount + t.toRemoveCount, 0)
}

type SectionPropsT = {
  title: string
  items: Array<{ key: number; text: string }>
}

// Only ever rendered with a non-empty list, so no empty-state branch.
function Section({ title, items }: SectionPropsT) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-medium">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {title}
      </div>
      <ul className="text-muted-foreground space-y-0.5 pl-4 text-xs">
        {items.map((i) => (
          <li key={i.key}>{i.text}</li>
        ))}
      </ul>
    </div>
  )
}
