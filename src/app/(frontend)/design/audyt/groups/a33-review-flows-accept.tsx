'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, SURFACE } from './a33-review-flows-shared'

export function A33AcceptGroup() {
  return (
    <AuditGroup
      id="A33.2"
      title="Przycisk akceptacji"
      count="3 ekrany · 3 wersje"
      drift={[
        'Trzy różne przyciski: default sm „Przyjmij” przy paragonie (a), default „Przyjmij N pozycje” w stopce dialogu (b), greenOutline touch z ikoną Check „Potwierdzam” (f).',
        'Zielony kolor akceptacji ma tylko f; a i b używają koloru primary.',
        'Słowo: „Przyjmij” (a, b), „Zapisz” (a bez paragonów, b po pierwszym przyjęciu „Zapisz zmiany”), „Potwierdzam” w pierwszej osobie (f).',
        'W b akceptacja pozycji to zaznaczenie checkboxa w wierszu, przycisk w stopce tylko zapisuje — w a każdy klik od razu idzie na serwer.',
        'Pięć ekranów (c, d, e, g, h) nie ma akceptacji — kolejki tylko otwierają dialog.',
      ]}
      proposal={
        <>
          <code>ReviewActions</code> z <code>acceptLabel</code> i jednym wariantem przycisku
          akceptacji (np. <code>greenOutline</code> z Check) w trzech rozmiarach: <code>sm</code>{' '}
          przy wierszu, <code>default</code> w stopce, <code>touch</code> na telefonie.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: default sm „Przyjmij” przy paragonie, „Przyjmij zaznaczone” w stopce, a bez paragonów default „Zapisz”`}
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:305',
          'src/components/forms/expense-form/receipt-selection-actions.tsx:21',
          'src/components/forms/expense-form/expense-form.tsx:499',
        ]}
      >
        <div className={MOCK}>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm">
              Przyjmij
            </Button>
            <Button type="button" size="sm">
              Przyjmij zaznaczone
            </Button>
            <Button type="submit">Zapisz</Button>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: checkbox „Przyjmij: {opis}” w wierszu + default „Przyjmij N pozycje” / „Zapisz zmiany” w DialogFooter obok zdania o postępie`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:97',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:451',
        ]}
      >
        <div className={MOCK}>
          <Checkbox aria-label="Przyjmij: Gładź gipsowa ścian" checked />
          <DialogFooter>
            <p className="text-foreground mr-auto self-center text-sm">Przyjęto 3 z 5.</p>
            <Button>Przyjmij 3 pozycje</Button>
          </DialogFooter>
          <DialogFooter>
            <p className="text-foreground mr-auto self-center text-sm">Rozpatrzono 5 z 5.</p>
            <Button>Zapisz zmiany</Button>
          </DialogFooter>
        </div>
      </AuditVariant>

      <MissingVariant letter="c" note="tylko „Podgląd” i „Otwórz w kosztorysie”" />
      <MissingVariant letter="d" note="zamiast decyzji przełącznik „Status kontaktu”" />
      <MissingVariant letter="e" note="decyzja zapada w dialogu a" />

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: greenOutline touch z ikoną Check „Potwierdzam”, w siatce auto-cols-fr obok „Odrzuć”`}
        sources={['src/components/receipt-confirmation/receipts-to-confirm.tsx:87']}
      >
        <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
          <Button variant="greenOutline" size="touch">
            <Check />
            Potwierdzam
          </Button>
        </div>
      </AuditVariant>

      <MissingVariant letter="g" note="„Zweryfikuj” otwiera dialog a" />
      <MissingVariant letter="h" note="kierownik może tylko anulować" />
    </AuditGroup>
  )
}
