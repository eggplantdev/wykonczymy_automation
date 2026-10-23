'use client'

import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { STEPS, SURFACE, type SurfaceLetterT } from './a33-review-flows-shared'

type FlowT = { letter: SurfaceLetterT; label: string; sources: string[]; steps: string[] }

const FLOWS: FlowT[] = [
  {
    letter: 'a',
    label: 'decyzja per paragon, od razu na serwer; dialog zamyka się sam',
    sources: [
      'src/components/worker-expenses/open-expense-draft-button.tsx:14',
      'src/components/forms/expense-form/line-items-field.tsx:303',
      'src/components/forms/expense-form/use-paragon-decisions.ts:108',
    ],
    steps: [
      'Kierownik klika „Zweryfikuj” w kolejce (g) albo w historii (e) i otwiera dialog.',
      'Sprawdza ramkę „Możliwe duplikaty” — „OK, to nie duplikat” albo „Duplikat”.',
      'Przy każdym paragonie „Przyjmij” albo „Odrzuć”, albo zaznacza kilka i używa paska w stopce.',
      'Odrzucony paragon można „Cofnij”, dopóki dialog jest otwarty.',
      'Po ostatniej decyzji dialog zamyka się sam; bez paragonów zostaje „Zapisz” albo „Odrzuć” całego zgłoszenia z potwierdzeniem.',
    ],
  },
  {
    letter: 'b',
    label: 'lista → przegląd → zaznaczenie → jeden zapis w stopce',
    sources: [
      'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:53',
      'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:330',
      'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:451',
    ],
    steps: [
      'Kierownik otwiera „Zgłoszenia prac” w kosztorysie i wybiera zgłoszenie z listy (wg daty lub pracownika).',
      'Wybiera etap w „Dodaj do” (i „Rozliczenie”, gdy trzeba).',
      'Prace „Spoza rozpiski” najpierw „Dodaj do rozpiski”, inaczej nie da się ich przyjąć.',
      'W „Z rozpiski” zaznacza pozycje, poprawia „Przyjmuję”, resztę „Odrzuć”.',
      '„Przyjmij N pozycje” zapisuje wszystko naraz; zamknięcie bez zapisu pyta o potwierdzenie.',
    ],
  },
  {
    letter: 'c',
    label: 'tylko przegląd i przejście do kosztorysu',
    sources: [
      'src/components/worker-reports/worker-reports-data-table.tsx:56',
      'src/components/worker-reports/worker-report-row-actions.tsx:29',
    ],
    steps: [
      'Kierownik zawęża kolejkę filtrami Status / Inwestycja / Pracownik / daty.',
      '„Podgląd” pokazuje zgłoszenie w dialogu tylko do odczytu.',
      '„Otwórz w kosztorysie” przenosi do b, gdzie zapada decyzja.',
    ],
  },
  {
    letter: 'd',
    label: 'bez decyzji przyjmij/odrzuć — kontakt, inwestycja, kosz',
    sources: [
      'src/components/tables/leads.tsx:108',
      'src/components/leads/promote-lead-dialog.tsx:80',
      'src/components/tables/leads.tsx:141',
    ],
    steps: [
      'Kierownik przegląda zapytanie („Szczegóły”, „Załączniki”).',
      'Klika status kontaktu, by przełączyć „Oczekuje” ↔ „Skontaktowano”.',
      '„Dodaj” w kolumnie „Inwestycja” tworzy inwestycję ze zgłoszenia.',
      'Niechciane zgłoszenie usuwa do kosza (pojedynczo albo zaznaczone, z potwierdzeniem).',
    ],
  },
  {
    letter: 'e',
    label: 'historia — otwarcie czekającego albo przywrócenie odrzuconego',
    sources: [
      'src/components/worker-expenses/expense-drafts-data-table.tsx:50',
      'src/components/worker-expenses/restore-expense-draft-button.tsx:35',
    ],
    steps: [
      'Kierownik filtruje historię (także „Tylko duplikaty”).',
      'Czekające zgłoszenie otwiera „Zweryfikuj” → dialog a.',
      'Odrzucone zgłoszenie albo pominięty paragon wraca przez „Przywróć” — od razu, bez potwierdzenia.',
    ],
  },
  {
    letter: 'f',
    label: 'pracownik potwierdza albo odrzuca z powodem',
    sources: [
      'src/components/receipt-confirmation/receipts-to-confirm.tsx:87',
      'src/components/receipt-confirmation/receipts-to-confirm.tsx:138',
      'src/components/receipt-confirmation/reject-receipt-dialog.tsx:45',
    ],
    steps: [
      'Pracownik widzi kartę wypłaty w „Do potwierdzenia”.',
      '„Potwierdzam” → potwierdzenie „Potwierdzasz odbiór?”.',
      'Albo „Odrzuć” → wpisuje powód (min. 3 znaki), karta przechodzi do „Odrzucone”.',
      'Odrzuconą wypłatę nadal może „Potwierdzam”, dopóki kierownik jej nie anuluje.',
    ],
  },
  {
    letter: 'g',
    label: 'kolejka — łączenie i otwarcie do weryfikacji',
    sources: [
      'src/components/worker-expenses/pending-expense-drafts.tsx:107',
      'src/components/worker-expenses/pending-expense-drafts.tsx:74',
      'src/components/worker-expenses/open-expense-draft-button.tsx:14',
    ],
    steps: [
      'Kierownik zaznacza 2+ zgłoszenia jednego pracownika z tą samą inwestycją i kasą.',
      '„Połącz zgłoszenia (N)” → potwierdzenie, paragony trafiają do najstarszego.',
      '„Zweryfikuj” otwiera dialog a (także z linku ?zgloszenie= — rozpatrzone daje ostrzeżenie).',
    ],
  },
  {
    letter: 'h',
    label: 'kierownik wyjaśnia albo anuluje odrzuconą wypłatę',
    sources: [
      'src/components/receipt-confirmation/rejected-receipts.tsx:93',
      'src/components/transfers/cancel-transfer-button.tsx:76',
    ],
    steps: [
      'Kierownik czyta „Powód” w tabeli na pulpicie.',
      'Wyjaśnia sprawę z pracownikiem poza aplikacją — wtedy pracownik sam potwierdza w f.',
      'Albo „Anuluj” → wpisuje powód anulowania i „Tak, anuluj” (nieodwracalne).',
    ],
  },
]

export function A33StepsGroup() {
  return (
    <AuditGroup
      id="A33.10"
      title="Przebieg"
      count="8 ekranów · 8 wersji"
      drift={[
        'Decyzja zapada od razu przy każdym kliknięciu (a, f, d) albo dopiero przy zapisie całości (b) — w b zamknięcie bez zapisu gubi pracę, w a nie ma czego zgubić.',
        'Kolejki (c, e, g) prowadzą do decyzji w innym miejscu: c do kosztorysu na osobnej stronie, e i g do dialogu nad tabelą.',
        'Powód odrzucenia zbiera tylko przebieg wypłat (f, h); pozostałe nie dają pracownikowi informacji, czemu coś odrzucono.',
        'Cofnięcie: w trakcie dialogu (a, b), po fakcie (e „Przywróć”, f ponowne potwierdzenie), wcale (g łączenie, h anulowanie).',
      ]}
      proposal={
        <>
          Jeden przebieg <code>ReviewFlow</code>: kolejka → otwórz → decyzja przy pozycji (od razu)
          → pusty stan „Nic nie czeka” — z <code>RejectReasonDialog</code> wszędzie, gdzie
          odrzucenie trafia do pracownika.
        </>
      }
    >
      {FLOWS.map((flow) => (
        <AuditVariant
          key={flow.letter}
          letter={flow.letter}
          label={`${SURFACE[flow.letter]}: ${flow.label}`}
          sources={flow.sources}
        >
          <ol className={STEPS}>
            {flow.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </AuditVariant>
      ))}
    </AuditGroup>
  )
}
