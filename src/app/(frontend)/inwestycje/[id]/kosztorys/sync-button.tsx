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
} from '@/lib/actions/sheets-sync'
import { setupKosztorysSheetAction } from '@/lib/actions/investments'

export function SyncButton({ investmentId }: { investmentId: number }) {
  const [preview, setPreview] = useState<MaterialSyncPreviewT | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const onSetupConfirm = () => {
    startTransition(async () => {
      const setup = await setupKosztorysSheetAction(investmentId)
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
      const { added, updated, errors } = applied.data
      toastMessage(
        `Zakładka zresetowana i zsynchronizowana: +${added} / zaktualizowano ${updated}${
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
      const { added, updated, errors } = res.data
      toastMessage(
        `Synchronizacja: +${added} / zaktualizowano ${updated}${
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
        Zresetuj zakładkę materiały
      </Button>
      <Button size="sm" variant="outline" onClick={onCheck} disabled={pending}>
        {pending ? 'Synchronizuję…' : 'Synchronizuj wydatki inwestycyjne'}
      </Button>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Zresetować zakładkę „wydatki inwestycyjne (tylko do odczytu)"?
            </DialogTitle>
            <DialogDescription>
              Zakładka <strong>wydatki inwestycyjne (tylko do odczytu)</strong> zostanie zbudowana
              od nowa: aplikacja wyczyści całą jej zawartość. Wiersze dodane ręcznie (spoza
              aplikacji) zostaną bezpowrotnie utracone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button onClick={onSetupConfirm} disabled={pending}>
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
              {preview.toAppend.length === 0 ? (
                <p className="text-muted-foreground">
                  Wszystko jest już zsynchronizowane — brak nowych pozycji do dodania.
                </p>
              ) : (
                <Section
                  title={`Wydatki do dodania (${preview.toAppend.length})`}
                  tone="green"
                  items={preview.toAppend.map((r) => ({
                    key: r.transferId,
                    text: `#${r.transferId} · ${r.typ} · ${r.amount} zł · ${r.description} [${r.date}]`,
                  }))}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Anuluj
            </Button>
            <Button onClick={onConfirm} disabled={pending || preview?.toAppend.length === 0}>
              Dodaj do arkusza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type SectionPropsT = {
  title: string
  tone: 'green' | 'red' | 'yellow'
  items: Array<{ key: number; text: string }>
}

function Section({ title, tone, items }: SectionPropsT) {
  const dot = { green: 'bg-emerald-500', red: 'bg-red-500', yellow: 'bg-amber-500' }[tone]
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-medium">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-muted-foreground pl-4 text-xs">— brak —</div>
      ) : (
        <ul className="text-muted-foreground space-y-0.5 pl-4 text-xs">
          {items.map((i) => (
            <li key={i.key}>{i.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
