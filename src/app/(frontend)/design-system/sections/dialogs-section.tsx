'use client'

import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ColumnOrderDialog, type ColumnToggleItemT } from '@/components/ui/column-order-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import type { ColumnRanksT } from '@/lib/table/column-order'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type ConfirmVariantT = NonNullable<ComponentProps<typeof ConfirmDialog>['variant']>

const CONFIRM_VARIANTS = Object.keys({
  alert: true,
  neutral: true,
} satisfies Record<ConfirmVariantT, true>) as ConfirmVariantT[]

const ORDER_ITEMS: ColumnToggleItemT[] = [
  { id: 'date', label: 'Data', visible: true },
  { id: 'amount', label: 'Kwota', visible: true },
  { id: 'note', label: 'Opis', visible: false },
]

export function DialogsSection() {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isShellOpen, setIsShellOpen] = useState(false)
  const [confirmVariant, setConfirmVariant] = useState<ConfirmVariantT | null>(null)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [isOrderOpen, setIsOrderOpen] = useState(false)
  const [ranks, setRanks] = useState<ColumnRanksT>({})

  return (
    <ShowcaseSection id="dialogs">
      <ShowcaseRow title="Dialog" source="ui/dialog.tsx, ui/dialog-actions.tsx">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader title="Tytuł dialogu" description="Opis dialogu." />
            <p className="text-sm">Treść dialogu.</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Zamknij</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isActionsOpen} onOpenChange={setIsActionsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Dialog + DialogActions
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader title="Bez przycisku X" description="showCloseButton={false}" />
            <DialogActions
              confirmLabel="Usuń"
              confirmVariant="destructive"
              onConfirm={() => setIsActionsOpen(false)}
              onCancel={() => setIsActionsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </ShowcaseRow>
      <ShowcaseRow title="FormDialogShell" source="ui/form-dialog-shell.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsShellOpen(true)}>
          FormDialogShell
        </Button>
        <FormDialogShell
          open={isShellOpen}
          onOpenChange={setIsShellOpen}
          title="Nowa pozycja"
          description="Formularz w powłoce dialogu."
          confirmLabel="Zapisz"
          onConfirm={() => setIsShellOpen(false)}
        >
          <Input placeholder="Nazwa" />
        </FormDialogShell>
      </ShowcaseRow>
      <ShowcaseRow title="ConfirmDialog — warianty" source="ui/confirm-dialog.tsx">
        {CONFIRM_VARIANTS.map((variant) => (
          <Button key={variant} variant="outline" size="sm" onClick={() => setConfirmVariant(variant)}>
            variant={variant}
          </Button>
        ))}
        <ConfirmDialog
          open={confirmVariant !== null}
          variant={confirmVariant ?? undefined}
          title="Na pewno?"
          description="Tej operacji nie można cofnąć."
          onConfirm={() => setConfirmVariant(null)}
          onCancel={() => setConfirmVariant(null)}
        />
      </ShowcaseRow>
      <ShowcaseRow title="AlertDialog" source="ui/alert-dialog.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsAlertOpen(true)}>
          AlertDialog
        </Button>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>AlertDialog</AlertDialogTitle>
            <AlertDialogDescription>Złożony bezpośrednio z prymitywów.</AlertDialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </ShowcaseRow>
      <ShowcaseRow title="ColumnOrderDialog" source="ui/column-order-dialog.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsOrderOpen(true)}>
          ColumnOrderDialog
        </Button>
        <ColumnOrderDialog
          open={isOrderOpen}
          onOpenChange={setIsOrderOpen}
          items={ORDER_ITEMS}
          ranks={ranks}
          baseRanks={{}}
          onSetRank={(key, rank) => setRanks((previous) => ({ ...previous, [key]: rank }))}
          onReset={() => setRanks({})}
          description="Przeciągnij, aby zmienić kolejność kolumn."
        />
      </ShowcaseRow>
      <ShowcaseRow title="Command" source="ui/command.tsx">
        <Command className="max-w-sm border">
          <CommandInput placeholder="Szukaj…" />
          <CommandList>
            <CommandEmpty>Brak wyników</CommandEmpty>
            <CommandGroup heading="Inwestycje">
              <CommandItem>Mokotów</CommandItem>
              <CommandItem>Wilanów</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Akcje">
              <CommandItem>
                Nowy przelew
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
