'use client'

import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
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
  AlertDialogFooter,
  AlertDialogHeader,
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
import { OpenPreview } from '../open-preview'

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

function noop() {}

function SampleDialogContent() {
  return (
    <DialogContent>
      <DialogHeader
        title="Tytuł dialogu"
        description={
          <>
            Opis dialogu jako ReactNode:
            <br />— druga linia.
          </>
        }
      />
      <DialogBody>
        <p className="text-sm">Treść dialogu w DialogBody.</p>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Zamknij</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}

function SampleActionsDialogContent({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent showCloseButton={false}>
      <DialogHeader title="Bez przycisku X" description="showCloseButton={false}" />
      <DialogActions
        confirmLabel="Usuń"
        confirmVariant="destructive"
        onConfirm={onClose}
        onCancel={onClose}
      />
    </DialogContent>
  )
}

function SampleAlertDialogContent() {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>AlertDialog</AlertDialogTitle>
        <AlertDialogDescription>Złożony bezpośrednio z prymitywów.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Anuluj</AlertDialogCancel>
        <AlertDialogAction>OK</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}

const SHELL_PROPS = {
  title: 'Nowa pozycja',
  description: 'Formularz w powłoce dialogu.',
  confirmLabel: 'Zapisz',
  children: <Input placeholder="Nazwa" />,
}

const SHELL_OPTIONS_PROPS = {
  title: 'Usuń pozycję',
  description: 'confirmVariant, cancelLabel i showCloseButton={false}.',
  confirmLabel: 'Usuń',
  confirmVariant: 'destructive',
  cancelLabel: 'Wróć',
  showCloseButton: false,
  children: <p className="text-sm">Tej operacji nie można cofnąć.</p>,
} as const

const SHELL_STATE_PROPS = {
  pending: {
    ...SHELL_PROPS,
    description: 'pending + pendingLabel',
    pending: true,
    pendingLabel: 'Zapisywanie…',
  },
  confirmDisabled: { ...SHELL_PROPS, description: 'confirmDisabled', confirmDisabled: true },
}

type ShellStateT = keyof typeof SHELL_STATE_PROPS

const SHELL_STATES = Object.keys(SHELL_STATE_PROPS) as ShellStateT[]

const CONFIRM_PROPS = {
  title: 'Na pewno?',
  description: 'Tej operacji nie można cofnąć.',
}

const ORDER_DESCRIPTION = 'Przeciągnij, aby zmienić kolejność kolumn.'

export function DialogsSection() {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isShellOpen, setIsShellOpen] = useState(false)
  const [isShellOptionsOpen, setIsShellOptionsOpen] = useState(false)
  const [openShellState, setOpenShellState] = useState<ShellStateT | null>(null)
  const [confirmVariant, setConfirmVariant] = useState<ConfirmVariantT | null>(null)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [isOrderOpen, setIsOrderOpen] = useState(false)
  const [ranks, setRanks] = useState<ColumnRanksT>({})

  function setRank(key: string, rank: number) {
    setRanks((previous) => ({ ...previous, [key]: rank }))
  }

  return (
    <ShowcaseSection id="dialogs">
      <ShowcaseRow title="Dialog" source="ui/dialog.tsx (DialogBody), ui/dialog-actions.tsx">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Dialog
            </Button>
          </DialogTrigger>
          <SampleDialogContent />
        </Dialog>
        <Dialog open={isActionsOpen} onOpenChange={setIsActionsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Dialog + DialogActions
            </Button>
          </DialogTrigger>
          <SampleActionsDialogContent onClose={() => setIsActionsOpen(false)} />
        </Dialog>
        <OpenPreview>
          <Dialog>
            <SampleDialogContent />
          </Dialog>
          <Dialog>
            <SampleActionsDialogContent onClose={noop} />
          </Dialog>
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="FormDialogShell" source="ui/form-dialog-shell.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsShellOpen(true)}>
          FormDialogShell
        </Button>
        <FormDialogShell
          {...SHELL_PROPS}
          open={isShellOpen}
          onOpenChange={setIsShellOpen}
          onConfirm={() => setIsShellOpen(false)}
        />
        <OpenPreview>
          <FormDialogShell {...SHELL_PROPS} open onOpenChange={noop} onConfirm={noop} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="FormDialogShell — opcje"
        source="ui/form-dialog-shell.tsx confirmVariant, cancelLabel, showCloseButton"
      >
        <Button variant="outline" size="sm" onClick={() => setIsShellOptionsOpen(true)}>
          Destrukcyjny, bez X
        </Button>
        <FormDialogShell
          {...SHELL_OPTIONS_PROPS}
          open={isShellOptionsOpen}
          onOpenChange={setIsShellOptionsOpen}
          onConfirm={() => setIsShellOptionsOpen(false)}
        />
        <OpenPreview>
          <FormDialogShell {...SHELL_OPTIONS_PROPS} open onOpenChange={noop} onConfirm={noop} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="FormDialogShell — stany przycisku"
        source="ui/form-dialog-shell.tsx, ui/dialog-actions.tsx pending, pendingLabel, confirmDisabled"
      >
        {SHELL_STATES.map((state) => (
          <Button key={state} variant="outline" size="sm" onClick={() => setOpenShellState(state)}>
            {state}
          </Button>
        ))}
        {openShellState && (
          <FormDialogShell
            {...SHELL_STATE_PROPS[openShellState]}
            open
            onOpenChange={() => setOpenShellState(null)}
            onConfirm={() => setOpenShellState(null)}
          />
        )}
        <OpenPreview>
          {SHELL_STATES.map((state) => (
            <FormDialogShell
              key={state}
              {...SHELL_STATE_PROPS[state]}
              open
              onOpenChange={noop}
              onConfirm={noop}
            />
          ))}
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="ConfirmDialog — warianty" source="ui/confirm-dialog.tsx">
        {CONFIRM_VARIANTS.map((variant) => (
          <Button
            key={variant}
            variant="outline"
            size="sm"
            onClick={() => setConfirmVariant(variant)}
          >
            variant={variant}
          </Button>
        ))}
        <ConfirmDialog
          {...CONFIRM_PROPS}
          open={confirmVariant !== null}
          variant={confirmVariant ?? undefined}
          onConfirm={() => setConfirmVariant(null)}
          onCancel={() => setConfirmVariant(null)}
        />
        <OpenPreview>
          {CONFIRM_VARIANTS.map((variant) => (
            <ConfirmDialog
              key={variant}
              {...CONFIRM_PROPS}
              open
              variant={variant}
              onConfirm={noop}
              onCancel={noop}
            />
          ))}
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="AlertDialog" source="ui/alert-dialog.tsx">
        <Button variant="outline" size="sm" onClick={() => setIsAlertOpen(true)}>
          AlertDialog
        </Button>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <SampleAlertDialogContent />
        </AlertDialog>
        <OpenPreview>
          <AlertDialog>
            <SampleAlertDialogContent />
          </AlertDialog>
        </OpenPreview>
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
          onSetRank={setRank}
          onReset={() => setRanks({})}
          description={ORDER_DESCRIPTION}
        />
        <OpenPreview>
          <ColumnOrderDialog
            open
            onOpenChange={noop}
            items={ORDER_ITEMS}
            ranks={ranks}
            baseRanks={{}}
            onSetRank={setRank}
            onReset={() => setRanks({})}
            description={ORDER_DESCRIPTION}
          />
        </OpenPreview>
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
