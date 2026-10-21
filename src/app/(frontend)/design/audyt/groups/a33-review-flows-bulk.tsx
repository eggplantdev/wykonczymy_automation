'use client'

import { Trash2 } from 'lucide-react'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { Description } from '@/components/ui/description'
import { DialogFooter } from '@/components/ui/dialog'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import {
  MOCK,
  MissingVariant,
  PARAGON_FOOTER_CLASS,
  SURFACE,
  noop,
} from './a33-review-flows-shared'

export function A33BulkGroup() {
  return (
    <AuditGroup
      id="A33.4"
      title="Akcje zbiorcze"
      count="4 ekrany · 4 wersje"
      drift={[
        'Miejsce paska: sticky stopka dialogu (a), DialogFooter z jednym przyciskiem (b), pasek narzędzi tabeli po prawej (d), slot action nagłówka CollapsibleSection (g).',
        'Zaznacz wszystkie: brak (a — tylko checkbox przy każdym paragonie), „Zaznacz wszystkie” w nagłówku kolumny (b), „Zaznacz wszystkie na stronie” w kolumnie select (d, g).',
        'Przycisk pojawia się: zawsze, wyłączony bez zaznaczenia (a), zawsze (b), dopiero po zaznaczeniu (d), dopiero przy 2+ zaznaczonych (g).',
        'Licznik zaznaczonych w etykiecie: „Suma zaznaczonych (N): kwota” osobnym wierszem (a), w treści przycisku „(N)” (d, g), w liczbie pozycji „Przyjmij N pozycje” (b).',
        'Potwierdzenie: brak (a, b), ConfirmDialog neutral (d, g).',
      ]}
      proposal={
        <>
          <code>ReviewBulkBar</code> w sticky stopce z <code>selectedCount</code>,{' '}
          <code>summary</code> (np. suma kwot) i slotami akcji — jedna reguła widoczności (pokazany
          od 1 zaznaczonego) i jedna kolumna select z „Zaznacz wszystkie”.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: sticky stopka — DecisionProgressBadge jako filtr + podpowiedź, „Suma zaznaczonych”, „Przyjmij zaznaczone” / „Odrzuć zaznaczone” / „Połącz zaznaczone w 1 transakcję”`}
        sources={[
          'src/components/forms/expense-form/paragon-footer.tsx:36',
          'src/components/forms/expense-form/receipt-selection-actions.tsx:17',
          'src/components/forms/expense-form/line-items-field.tsx:340',
        ]}
      >
        <div className={MOCK}>
          <Checkbox aria-label="Zaznacz pozycję 1" checked />
          <div className={PARAGON_FOOTER_CLASS}>
            <div className="space-y-2">
              <DecisionProgressBadge accepted={1} rejected={1} pending={2} onToggle={noop} />
              <Description size="xs">
                Kliknij etykietę, aby ukryć lub pokazać te paragony.
              </Description>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2">
              <p className="text-sm leading-none font-medium">Suma zaznaczonych (2): 500,30 zł</p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" size="sm">
                  Przyjmij zaznaczone
                </Button>
                <Button type="button" variant="destructive" size="sm">
                  Odrzuć zaznaczone
                </Button>
                <Button type="button" variant="outline" size="sm">
                  Połącz zaznaczone w 1 transakcję
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: checkbox „Zaznacz wszystkie” w nagłówku kolumny ✓, zapis jednym przyciskiem w DialogFooter`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:85',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:451',
        ]}
      >
        <div className={MOCK}>
          <Checkbox aria-label="Zaznacz wszystkie" checked="indeterminate" />
          <DialogFooter>
            <p className="text-foreground mr-auto self-center text-sm">Przyjęto 2 z 5.</p>
            <Button>Przyjmij 2 pozycje</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <MissingVariant letter="c" />

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: kolumna select + outline sm Trash2 „Do kosza (N)” w pasku narzędzi → ConfirmDialog neutral`}
        sources={[
          'src/components/tables/leads.tsx:43',
          'src/components/leads/trash-leads-button.tsx:35',
          'src/components/leads/trash-leads-button.tsx:39',
        ]}
      >
        <div className={MOCK}>
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox aria-label="Zaznacz wszystkie na stronie" checked="indeterminate" />
            <Button variant="outline" size="sm">
              <Trash2 />
              Do kosza (2)
            </Button>
          </div>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Przenieść 2 zgłoszenia do kosza?"
              description="Trafią do kosza i po 30 dniach zostaną usunięte na zawsze. Inwestycje utworzone z tych zgłoszeń i ich pliki zostają nietknięte."
              confirmLabel="Przenieś do kosza"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
        </div>
      </AuditVariant>

      <MissingVariant letter="e" />
      <MissingVariant letter="f" />

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: kolumna select + outline sm „Połącz zgłoszenia (N)” w slocie action sekcji, widoczny od 2 zaznaczonych → ConfirmDialog neutral`}
        sources={[
          'src/components/tables/expense-drafts.tsx:83',
          'src/components/worker-expenses/pending-expense-drafts.tsx:107',
          'src/components/worker-expenses/pending-expense-drafts.tsx:123',
        ]}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Wydatki do sprawdzenia"
            hint="Zaznacz kilka zgłoszeń jednego pracownika, z tą samą inwestycją i kasą, aby połączyć je w jedno."
            size="sm"
            withSeparator={false}
            action={
              <Button type="button" size="sm" variant="outline">
                Połącz zgłoszenia (2)
              </Button>
            }
          >
            <Checkbox aria-label="Zaznacz zgłoszenie Jan Kowalski" checked />
          </CollapsibleSection>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Połączyć 2 zgłoszenia w jedno?"
              description="Paragony trafią do najstarszego zgłoszenia, pozostałe znikną. Tego nie da się cofnąć."
              confirmLabel="Połącz"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
        </div>
      </AuditVariant>

      <MissingVariant letter="h" />
    </AuditGroup>
  )
}
