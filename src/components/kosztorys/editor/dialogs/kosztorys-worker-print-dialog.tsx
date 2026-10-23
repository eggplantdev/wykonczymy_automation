'use client'

import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useWorkerPrint } from '@/components/kosztorys/editor/actions/use-worker-print'
import { buildWorkerPrintHtml } from '@/lib/kosztorys/print/worker'

export function KosztorysWorkerPrintDialog() {
  const {
    printTarget: target,
    printOpen: open,
    setPrintOpen: onOpenChange,
    printOwnWorkOnly: ownWorkOnly,
    setPrintOwnWorkOnly: setOwnWorkOnly,
  } = useKosztorysActions().worker
  const printWorker = useWorkerPrint()

  const print = () => {
    if (!target) return
    printWorker(target.id, (args) => buildWorkerPrintHtml({ ...args, ownWorkOnly }))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-sm">
        <DialogHeader
          title={`Drukuj kosztorys — ${target?.name ?? ''}`}
          description="Zaznaczone: wydruk pomija pozycje, w których etapy pracownika nie mają jeszcze wpisów, a sumy liczą tylko wydrukowane pozycje."
        />
        <CheckboxRow checked={ownWorkOnly} onCheckedChange={setOwnWorkOnly}>
          Tylko pozycje z wykonaną pracą
        </CheckboxRow>
        <DialogFooter>
          <Button size="sm" onClick={print}>
            Drukuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
