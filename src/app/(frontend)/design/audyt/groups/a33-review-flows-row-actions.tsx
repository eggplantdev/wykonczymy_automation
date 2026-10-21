'use client'

import { Ban, Check, Eye, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MockTable, SURFACE } from './a33-review-flows-shared'

function VerifyButton() {
  return (
    <Button size="xs">
      <Eye />
      Zweryfikuj
    </Button>
  )
}

export function A33RowActionsGroup() {
  return (
    <AuditGroup
      id="A33.6"
      title="Akcje w wierszu"
      count="8 ekranów · 8 wersji"
      drift={[
        'Pozycja kolumny akcji: pierwsza (duplikaty w a, „Spoza rozpiski” w b, g, h), ostatnia (rozpiska w b, c, e), ostatnia do prawej (d), dół karty (f), prawa krawędź wiersza paragonu (a).',
        'Nagłówek kolumny: „Akcje” (a, b, d), „Podgląd” (c, g), „Anuluj” (h), pusty (e).',
        'Rozmiar: sm przy paragonie (a), xs w tabelach (a duplikaty, b, c, e, g), RowActionButton ikonowy (c, d, h), touch na kartach (f).',
        'Otwarcie zgłoszenia: RowActionButton Eye „Podgląd” + outline xs „Otwórz w kosztorysie” (c) vs default xs Eye „Zweryfikuj” (e, g) — ta sama ikona, dwa różne znaczenia.',
        'd trzyma akcje także poza kolumną akcji: „Szczegóły”, Paperclip z liczbą i „Dodaj” to outline xs w zwykłych komórkach.',
      ]}
      proposal={
        <>
          <code>ReviewActions</code> jako jedna kolumna „Akcje” zawsze na końcu, z{' '}
          <code>RowActionButton</code> dla otwarcia/usunięcia i parą przyjmij/odrzuć w jednym
          rozmiarze (<code>xs</code> w tabeli, <code>touch</code> na karcie).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: przy paragonie sm „Przyjmij” + destructive „Odrzuć” (flex shrink-0 gap-2), po odrzuceniu outline sm „Cofnij”; w duplikatach pierwsza kolumna „Akcje” z outline xs „OK, to nie duplikat” + destructive xs „Duplikat”`}
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:303',
          'src/components/forms/expense-form/line-items-field.tsx:348',
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:86',
        ]}
      >
        <div className={MOCK}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm">
                Przyjmij
              </Button>
              <Button type="button" variant="destructive" size="sm">
                Odrzuć
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm">
              Cofnij
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="xs" variant="outline">
              OK, to nie duplikat
            </Button>
            <Button type="button" size="xs" variant="destructive">
              Duplikat
            </Button>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ghost xs „Odrzuć” w kolumnie „Akcje” pośrodku (ostatnia w rozpisce, pierwsza w „Spoza rozpiski”), outline xs Plus „Dodaj do rozpiski” w komórce „Może chodzi o”`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:113',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:373',
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
          <Button variant="outline" size="xs">
            <Plus />
            Dodaj do rozpiski
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: ostatnia kolumna „Podgląd” — RowActionButton Eye + outline xs „Otwórz w kosztorysie” (flex items-center gap-1)`}
        sources={[
          'src/components/tables/worker-reports.tsx:86',
          'src/components/worker-reports/worker-report-row-actions.tsx:29',
        ]}
      >
        <div className="flex items-center gap-1">
          <RowActionButton icon={Eye} label="Podgląd" />
          <Button size="xs" variant="outline">
            Otwórz w kosztorysie
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: „Akcje” do prawej z DeleteButton „Usuń zgłoszenie”; obok w komórkach outline xs „Szczegóły”, Paperclip z liczbą, „Dodaj”`}
        sources={[
          'src/components/tables/leads.tsx:140',
          'src/components/leads/lead-answers-dialog.tsx:22',
          'src/components/leads/lead-assets-dialog.tsx:122',
          'src/components/leads/promote-lead-dialog.tsx:80',
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs">
            Szczegóły
          </Button>
          <Button variant="outline" size="xs" className="min-w-12" aria-label="Załączniki (2)">
            <Paperclip />2
          </Button>
          <Button variant="outline" size="xs">
            Dodaj
          </Button>
          <div className="flex items-center justify-end gap-1">
            <DeleteButton label="Usuń zgłoszenie" />
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: ostatnia kolumna bez nagłówka — outline xs „Przywróć” (odrzucone / pominięte), default xs Eye „Zweryfikuj” (czekające), pusto dla reszty`}
        sources={[
          'src/components/worker-expenses/expense-drafts-data-table.tsx:50',
          'src/components/worker-expenses/restore-expense-draft-button.tsx:35',
          'src/components/worker-expenses/open-expense-draft-button.tsx:14',
        ]}
      >
        <MockTable
          columns={[{ header: 'Status' }, { header: '' }]}
          rows={[
            {
              cells: [
                'odrzucony',
                <div key="actions" className="flex items-center gap-1">
                  <Button size="xs" variant="outline">
                    Przywróć
                  </Button>
                </div>,
              ],
            },
            {
              cells: [
                'czeka',
                <div key="actions" className="flex items-center gap-1">
                  <VerifyButton />
                </div>,
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: na dole karty siatka auto-cols-fr — greenOutline touch Check „Potwierdzam” + destructiveOutline touch Trash2 „Odrzuć”`}
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:86',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:97',
        ]}
      >
        <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
          <Button variant="greenOutline" size="touch">
            <Check />
            Potwierdzam
          </Button>
          <Button variant="destructiveOutline" size="touch">
            <Trash2 />
            Odrzuć
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: druga kolumna (po select) z nagłówkiem „Podgląd” — default xs Eye „Zweryfikuj”`}
        sources={[
          'src/components/tables/expense-drafts.tsx:70',
          'src/components/worker-expenses/open-expense-draft-button.tsx:14',
        ]}
      >
        <MockTable
          columns={[{ header: '☐' }, { header: 'Podgląd' }, { header: 'Pracownik' }]}
          rows={[
            {
              cells: [
                '☐',
                <div key="actions" className="flex items-center gap-1">
                  <VerifyButton />
                </div>,
                'Jan Kowalski',
              ],
            },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: pierwsza kolumna „Anuluj” — RowActionButton Ban destructive z tekstem „Anuluj” (zablokowany z tooltipem disabledReason)`}
        sources={[
          'src/components/receipt-confirmation/rejected-receipts.tsx:21',
          'src/components/transfers/cancel-transfer-button.tsx:55',
          'src/components/transfers/cancel-transfer-button.tsx:68',
        ]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <RowActionButton icon={Ban} label="Anuluj transakcję" text="Anuluj" tone="destructive" />
          <RowActionButton
            icon={Ban}
            label="Anuluj transakcję"
            text="Anuluj"
            tone="destructive"
            tooltip="Tej transakcji nie można już anulować"
            disabled
          />
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
