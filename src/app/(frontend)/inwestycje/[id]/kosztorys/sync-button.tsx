'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
  const [pending, startTransition] = useTransition()

  const onSetup = () => {
    startTransition(async () => {
      const res = await setupKosztorysSheetAction(investmentId)
      if (!res.success) {
        toastMessage(res.error, 'error')
        return
      }
      toastMessage(`Arkusz materiały gotowy (${res.data.types.length} typów)`, 'success')
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
      const res = await applyMaterialSync(investmentId, preview)
      if (!res.success) {
        toastMessage(res.error, 'error')
        return
      }
      const { added, skipped, errors } = res.data
      toastMessage(
        `Synchronizacja: +${added} / pominięto ${skipped}${
          errors.length ? ` · błędy: ${errors.length}` : ''
        }`,
        errors.length ? 'warning' : 'success',
      )
      setPreview(null)
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={onSetup} disabled={pending}>
        {pending ? 'Pracuję…' : 'Utwórz arkusz materiały'}
      </Button>
      <Button size="sm" variant="outline" onClick={onCheck} disabled={pending}>
        {pending ? 'Synchronizuję…' : 'Synchronizuj tabelę'}
      </Button>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Podgląd zmian w arkuszu</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <Section
                title={`Do dodania (${preview.toAppend.length})`}
                tone="green"
                items={preview.toAppend.map((r) => ({
                  key: r.transferId,
                  text: `#${r.transferId} · ${r.typ} · ${r.amount} zł · ${r.description} [${r.date}]`,
                }))}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Anuluj
            </Button>
            <Button onClick={onConfirm} disabled={pending}>
              Zatwierdź zmiany
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
