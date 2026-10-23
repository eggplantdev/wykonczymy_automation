'use client'

import { Check } from 'lucide-react'
import { BadgeButton } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, ParagonRow, SURFACE } from './a33-review-flows-shared'

export function A33UndoGroup() {
  return (
    <AuditGroup
      id="A33.12"
      title="Cofnięcie decyzji"
      count="5 ekranów · 5 wersji"
      drift={[
        'Pięć sposobów: outline sm „Cofnij” przy odrzuconym paragonie (a), ghost xs „Odrzucona · cofnij” w tym samym przycisku (b), ponowne kliknięcie BadgeButton (d), outline xs „Przywróć” w historii (e), „Potwierdzam” na odrzuconej karcie (f).',
        'Słowo: „Cofnij” (a), „cofnij” małą literą po kropce środkowej (b), „Przywróć” (e) — dla tej samej czynności.',
        'Cofnąć da się tylko odrzucenie (a, b, e, f); przyjętego paragonu ani przyjętej pozycji prac cofnąć się nie da.',
        'Nieodwracalne bez możliwości cofnięcia: łączenie zgłoszeń (g, mówi to w potwierdzeniu) i anulowanie wypłaty (h, „Operacja jest nieodwracalna.”).',
      ]}
      proposal={
        <>
          <code>ReviewActions</code> po decyzji pokazuje jeden przycisk{' '}
          <code>undoLabel=&quot;Cofnij&quot;</code> (outline, rozmiar wiersza), a historia (e) używa
          tego samego słowa zamiast „Przywróć”.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: outline sm „Cofnij” w miejscu Przyjmij/Odrzuć przy odrzuconym paragonie, tylko w otwartym dialogu`}
        sources={['src/components/forms/expense-form/line-items-field.tsx:348']}
      >
        <div className={MOCK}>
          <ParagonRow
            title="2. Leroy Merlin · 88,00 zł"
            status="rejected"
            action={
              <Button type="button" variant="outline" size="sm">
                Cofnij
              </Button>
            }
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ten sam ghost xs przycisk przełącza się na „Odrzucona · cofnij” (text-destructive, aria-pressed) do czasu zapisu`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:113',
        ]}
      >
        <Button
          variant="ghost"
          size="xs"
          aria-pressed
          className="text-destructive whitespace-nowrap"
        >
          Odrzucona · cofnij
        </Button>
      </AuditVariant>

      <MissingVariant letter="c" note="odrzucone pozycje przyjmuje się ponownie w b" />

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: status kontaktu cofa się ponownym kliknięciem BadgeButton (optymistycznie)`}
        sources={['src/components/tables/leads.tsx:108']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BadgeButton tone="positive">Skontaktowano</BadgeButton>
          <span className="text-muted-foreground text-sm">→</span>
          <BadgeButton tone="muted">Oczekuje</BadgeButton>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: outline xs „Przywróć” przy odrzuconym zgłoszeniu i pominiętym paragonie, bez potwierdzenia`}
        sources={[
          'src/components/worker-expenses/restore-expense-draft-button.tsx:35',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:50',
        ]}
      >
        <div className="flex items-center gap-1">
          <Button size="xs" variant="outline">
            Przywróć
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: na odrzuconej karcie zostaje greenOutline touch „Potwierdzam” — pracownik zmienia zdanie, „Odrzuć” znika`}
        sources={['src/components/receipt-confirmation/receipts-to-confirm.tsx:87']}
      >
        <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
          <Button variant="greenOutline" size="touch">
            <Check />
            Potwierdzam
          </Button>
        </div>
      </AuditVariant>

      <MissingVariant letter="g" note="łączenia nie da się cofnąć" />
      <MissingVariant letter="h" note="anulowanie jest nieodwracalne" />
    </AuditGroup>
  )
}
