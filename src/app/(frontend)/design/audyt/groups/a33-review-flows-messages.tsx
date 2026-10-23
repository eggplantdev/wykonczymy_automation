'use client'

import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, MissingVariant, SURFACE, ToastList, noop } from './a33-review-flows-shared'

export function A33MessagesGroup() {
  return (
    <AuditGroup
      id="A33.9"
      title="Potwierdzenia i komunikaty"
      count="7 ekranów · 7 wersji"
      drift={[
        'ConfirmDialog raz alert (odrzucenie zgłoszenia w a, zamknięcie bez zapisu w b), raz neutral (kosz w d, potwierdzenie odbioru w f, łączenie w g) — bez reguły, kiedy który.',
        'Toast sukcesu w różnych formach: rzeczownik + imiesłów („Paragon przyjęty”, „Zgłoszenie odrzucone”), czasownik + liczba („Przyjęto 3”, „Połączono 2 zgłoszenia”), pełne zdanie z kropką („Zgłoszenie przeniesione do kosza.”, „Przeniesiono do kosza: 2 zgłoszenia.”), samo „Odrzucono” (f).',
        '„To zgłoszenie zostało już rozpatrzone.” pojawia się jako ostrzeżenie w dwóch miejscach (a, g) z tego samego klucza — reszta ekranów nie łapie wyścigu dwóch kierowników.',
        'Błędy wczytania: „Nie udało się wczytać zgłoszeń” bez kropki (b) vs „Nie udało się odświeżyć paragonów — otwórz zgłoszenie ponownie” (a).',
        'e i h kończą się samym toastem bez żadnego potwierdzenia, a g pyta o łączenie, choć też nie da się go cofnąć.',
      ]}
      proposal={
        <>
          Jedna reguła: <code>ConfirmDialog variant=&quot;alert&quot;</code> tylko dla
          nieodwracalnych (odrzucenie, łączenie, anulowanie), <code>neutral</code> dla reszty;
          toasty z jednego słownika <code>REVIEW_TOASTS</code> w formie „Przyjęto N” / „Odrzucono N”
          / „Przywrócono”.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: ConfirmDialog alert przy odrzuceniu całego zgłoszenia + toasty decyzji, ostrzeżenia i błędy`}
        sources={[
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:167',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:197',
          'src/components/worker-expenses/use-expense-draft-acceptance.tsx:290',
          'src/components/forms/expense-form/use-paragon-decisions.ts:83',
          'src/components/forms/expense-form/use-paragon-decisions.ts:94',
          'src/components/forms/expense-form/use-paragon-decisions.ts:136',
          'src/components/forms/expense-form/use-paragon-decisions.ts:165',
          'src/components/forms/expense-form/use-paragon-decisions.ts:195',
          'src/components/forms/expense-form/expense-form.tsx:232',
          'src/components/forms/expense-form/expense-form.tsx:266',
        ]}
      >
        <div className={MOCK}>
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
          <ToastList
            items={[
              { kind: 'success', text: 'Paragon przyjęty' },
              { kind: 'success', text: 'Przyjęto 3' },
              { kind: 'success', text: 'Paragon odrzucony' },
              { kind: 'success', text: 'Odrzucono 2' },
              { kind: 'success', text: 'Zgłoszenie odrzucone' },
              { kind: 'success', text: 'Zgłoszenie odrzucone jako duplikat' },
              { kind: 'success', text: 'Transakcje dodane' },
              { kind: 'warning', text: 'Nie odczytano zdjęć zgłoszenia' },
              { kind: 'warning', text: 'To zgłoszenie zostało już rozpatrzone.' },
              { kind: 'warning', text: 'Uzupełnij pozycję' },
              { kind: 'warning', text: 'Poczekaj na przetworzenie plików.' },
              {
                kind: 'error',
                text: 'Nie udało się odświeżyć paragonów — otwórz zgłoszenie ponownie',
              },
            ]}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ConfirmDialog alert przy zamykaniu niezapisanego zgłoszenia + toasty zapisu i błędy wczytania`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:52',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:95',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:107',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:297',
        ]}
      >
        <div className={MOCK}>
          <OpenPreview>
            <ConfirmDialog
              open
              title="Zamknąć bez zapisywania?"
              description="Zmiany w tym zgłoszeniu nie zostały zapisane i przepadną."
              confirmLabel="Zamknij bez zapisywania"
              cancelLabel="Wróć do zgłoszenia"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
          <ToastList
            items={[
              { kind: 'success', text: 'Zgłoszenie przyjęte do rozpiski' },
              { kind: 'success', text: 'Zapisano zmiany w zgłoszeniu' },
              { kind: 'error', text: 'Nie udało się wczytać zgłoszeń' },
              { kind: 'error', text: 'Tego zgłoszenia już nie ma' },
            ]}
          />
        </div>
      </AuditVariant>

      <MissingVariant letter="c" note="strona niczego nie zmienia" />

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: dwa ConfirmDialog neutral (kosz jednego / wielu) + toasty z kropką`}
        sources={[
          'src/components/trash/trash-row-button.tsx:41',
          'src/components/tables/leads.tsx:143',
          'src/components/leads/trash-leads-button.tsx:39',
          'src/components/leads/trash-leads-button.tsx:29',
          'src/components/leads/promote-lead-dialog.tsx:116',
        ]}
      >
        <div className={MOCK}>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Przenieść do kosza?"
              description={
                'Przenieść „Ewa Lewandowska" do kosza? Po 30 dniach zostanie usunięte na zawsze. Inwestycja utworzona z tego zgłoszenia i jej pliki zostają nietknięte.'
              }
              confirmLabel="Przenieś do kosza"
              onConfirm={noop}
              onCancel={noop}
            />
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
          <ToastList
            items={[
              { kind: 'success', text: 'Zgłoszenie przeniesione do kosza.' },
              { kind: 'success', text: 'Przeniesiono do kosza: 2 zgłoszenia.' },
              { kind: 'success', text: 'Inwestycja utworzona' },
            ]}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: bez potwierdzenia, sam toast po „Przywróć”`}
        sources={[
          'src/components/worker-expenses/expense-drafts-data-table.tsx:57',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:65',
        ]}
      >
        <ToastList
          items={[
            { kind: 'success', text: 'Paragon przywrócony' },
            { kind: 'success', text: 'Zgłoszenie przywrócone' },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: ConfirmDialog neutral przed potwierdzeniem odbioru + toasty`}
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:138',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:43',
          'src/components/receipt-confirmation/reject-receipt-dialog.tsx:39',
        ]}
      >
        <div className={MOCK}>
          <OpenPreview>
            <ConfirmDialog
              open
              variant="neutral"
              title="Potwierdzasz odbiór?"
              description="Potwierdzasz, że dostałeś 1 200,00 zł."
              confirmLabel="Potwierdzam"
              onConfirm={noop}
              onCancel={noop}
            />
          </OpenPreview>
          <ToastList
            items={[
              { kind: 'success', text: 'Odbiór potwierdzony' },
              { kind: 'success', text: 'Odrzucono' },
            ]}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: ConfirmDialog neutral przed łączeniem + toast i ostrzeżenie przy linku do rozpatrzonego zgłoszenia`}
        sources={[
          'src/components/worker-expenses/pending-expense-drafts.tsx:123',
          'src/components/worker-expenses/pending-expense-drafts.tsx:87',
          'src/components/worker-expenses/pending-expense-drafts.tsx:74',
        ]}
      >
        <div className={MOCK}>
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
          <ToastList
            items={[
              { kind: 'success', text: 'Połączono 2 zgłoszenia' },
              { kind: 'warning', text: 'To zgłoszenie zostało już rozpatrzone.' },
            ]}
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: toast po anulowaniu (dialog z powodem w A33.3)`}
        sources={['src/components/transfers/cancel-transfer-button.tsx:46']}
      >
        <ToastList items={[{ kind: 'success', text: 'Transakcja została anulowana' }]} />
      </AuditVariant>
    </AuditGroup>
  )
}
