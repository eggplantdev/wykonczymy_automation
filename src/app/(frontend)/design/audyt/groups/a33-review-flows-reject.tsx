'use client'

import { Ban, Trash2 } from 'lucide-react'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Label } from '@/components/ui/label'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { Textarea } from '@/components/ui/textarea'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, SURFACE, noop } from './a33-review-flows-shared'

export function A33RejectGroup() {
  return (
    <AuditGroup
      id="A33.3"
      title="Odrzucenie i powód"
      count="4 ekrany · 4 wersje"
      drift={[
        'Powód odrzucenia wpisuje tylko pracownik przy wypłacie (f) i kierownik przy anulowaniu (h); paragony, całe zgłoszenie wydatków (a) i pozycje prac (b) odrzuca się bez słowa.',
        'Dwa dialogi z polem powodu różnią się wszystkim poza FormDialogShell: etykieta („Powód odrzucenia” / „Powód anulowania (wymagany)”), placeholder („Np. brakuje 100 zł” / „Min. 3 znaków”), licznik („Znaków: 12/500” i „Brakuje znaków: 3” / „12/500 znaków” i „Brakuje 3 znaków”), przycisk anulowania („Anuluj” / „Nie”).',
        'Przycisk: destructive sm (a, paragon), destructive default ml-auto (a, całe zgłoszenie), ghost xs tekstowy przełącznik (b), destructiveOutline touch z Trash2 (f), RowActionButton Ban z tekstem (h).',
        'Potwierdzenie: ConfirmDialog alert bez powodu (a, całe zgłoszenie), żadne (a paragon, b), FormDialogShell z polem (f, h).',
        'Ikona: Trash2 przy odrzuceniu wypłaty sugeruje usuwanie; h używa Ban; a i b bez ikony.',
      ]}
      proposal={
        <>
          Jeden <code>RejectReasonDialog</code> (<code>title</code>, <code>subject</code>,{' '}
          <code>reasonLabel</code>, <code>placeholder</code>, <code>minLength=3</code>,{' '}
          <code>maxLength=500</code>, <code>required</code>) z jednym licznikiem i stałym „Anuluj”;
          przycisk odrzucenia w <code>ReviewActions</code> zawsze destructive outline z tą samą
          ikoną.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: destructive sm „Odrzuć” przy paragonie (od razu, bez potwierdzenia), destructive ml-auto „Odrzuć” całego zgłoszenia → ConfirmDialog alert bez powodu`}
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:313',
          'src/components/forms/expense-form/receipt-selection-actions.tsx:29',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:275',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:290',
        ]}
      >
        <div className={MOCK}>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="destructive" size="sm">
              Odrzuć
            </Button>
            <Button type="button" variant="destructive" size="sm">
              Odrzuć zaznaczone
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit">Zapisz</Button>
            <Button type="button" variant="destructive" className="ml-auto">
              Odrzuć
            </Button>
          </div>
          <OpenPreview>
            <ConfirmDialog
              open
              title="Odrzucić zgłoszenie?"
              description="Anna Nowak · Bez inwestycji"
              confirmLabel="Odrzuć"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ghost xs tekstowy przełącznik „Odrzuć” ↔ „Odrzucona · cofnij” (aria-pressed), wiersz dostaje bg-destructive/5; bez powodu i potwierdzenia`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:113',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:406',
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            aria-pressed={false}
            className="text-muted-foreground whitespace-nowrap"
          >
            Odrzuć
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-pressed
            className="text-destructive whitespace-nowrap"
          >
            Odrzucona · cofnij
          </Button>
        </div>
      </AuditVariant>

      <MissingVariant letter="c" note="decyzja tylko w kosztorysie (b)" />
      <MissingVariant letter="d" note="jest tylko „Przenieś do kosza”, nie odrzucenie" />
      <MissingVariant letter="e" note="decyzja zapada w dialogu a" />

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: destructiveOutline touch Trash2 „Odrzuć” → FormDialogShell bez krzyżyka z polem „Powód odrzucenia” (min. 3 znaki, przycisk zablokowany do tego czasu)`}
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:97',
          'src/components/receipt-confirmation/reject-receipt-dialog.tsx:45',
          'src/components/receipt-confirmation/reject-receipt-dialog.tsx:57',
        ]}
      >
        <div className={MOCK}>
          <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
            <Button variant="destructiveOutline" size="touch">
              <Trash2 />
              Odrzuć
            </Button>
          </div>
          <OpenPreview>
            <FormDialogShell
              open
              onOpenChange={noop}
              showCloseButton={false}
              title="Odrzucasz 1 200,00 zł"
              description="Napisz, czego brakuje — kierownik zobaczy ten powód."
              confirmLabel="Odrzuć"
              confirmVariant="destructive"
              onConfirm={noop}
            >
              <div className="grid gap-2">
                <Label htmlFor="a33-reject-receipt-reason">Powód odrzucenia</Label>
                <Textarea
                  id="a33-reject-receipt-reason"
                  placeholder="Np. brakuje 100 zł"
                  rows={3}
                  defaultValue="Brakuje 100 zł"
                />
                <Description withIcon={false} size="xs">
                  Znaków: 14/500
                </Description>
              </div>
            </FormDialogShell>
          </OpenPreview>
        </div>
      </AuditVariant>

      <MissingVariant letter="g" note="tylko łączenie i „Zweryfikuj”" />

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: zamiast odrzucenia anulowanie — RowActionButton Ban „Anuluj” destructive → FormDialogShell „Anulowanie transakcji” z polem „Powód anulowania (wymagany)”, „Nie” / „Tak, anuluj”`}
        sources={[
          'src/components/transfers/cancel-transfer-button.tsx:68',
          'src/components/transfers/cancel-transfer-button.tsx:76',
          'src/components/transfers/cancel-transfer-button.tsx:90',
        ]}
      >
        <div className={MOCK}>
          <RowActionButton icon={Ban} label="Anuluj transakcję" text="Anuluj" tone="destructive" />
          <OpenPreview>
            <FormDialogShell
              open
              onOpenChange={noop}
              showCloseButton={false}
              title="Anulowanie transakcji"
              description="Czy na pewno chcesz anulować transakcję #5120? Operacja jest nieodwracalna."
              cancelLabel="Nie"
              confirmLabel="Tak, anuluj"
              confirmVariant="destructive"
              confirmDisabled
              pendingLabel="Anulowanie..."
              onConfirm={noop}
            >
              <div className="grid gap-2">
                <Label htmlFor="a33-reject-cancel-reason">Powód anulowania (wymagany)</Label>
                <Textarea id="a33-reject-cancel-reason" placeholder="Min. 3 znaków" rows={3} />
                <Description withIcon={false} size="xs">
                  Brakuje 3 znaków
                </Description>
              </div>
            </FormDialogShell>
          </OpenPreview>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
