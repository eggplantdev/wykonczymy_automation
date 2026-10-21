'use client'

import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SECTION_TITLE_MD_CLASS } from '@/components/ui/section-header'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'
import { MOCK, SURFACE } from './a33-review-flows-shared'

const PAGE_RESET = 'p-0 sm:p-0 lg:p-0'

export function A33HeaderGroup() {
  return (
    <AuditGroup
      id="A33.1"
      title="Nagłówek i liczniki"
      count="8 ekranów · 6 wersji"
      drift={[
        'Cztery rodzaje nagłówka: tytuł dialogu (a, b), h1 strony przez PageWrapper (c, d, e), CollapsibleSection domyślna lg (f) i CollapsibleSection sm (g, h).',
        'Imię pracownika: w tytule dialogu po „·” (a) albo w osobnym h3 text-base wewnątrz dialogu o ogólnym tytule (b).',
        'Licznik decyzji DecisionProgressBadge stoi przy imieniu (b), w sticky stopce (a) albo w kolumnie tabeli (c, e, g); stron d, f, h nie ma — d liczy „N nowych” zwykłym Description pod h1.',
        'Podpis pod nagłówkiem: notatka pracownika jako opis dialogu (a), „Wysłano · sprawdzono (kto)” xs bez ikony (b), Description z ikoną (c, d), hint sekcji (f, g, h), nic (e).',
      ]}
      proposal={
        <>
          <code>ReviewHeader</code> z propsami <code>title</code>, <code>subject</code> (imię),{' '}
          <code>progress</code> (liczniki do <code>DecisionProgressBadge</code>) i <code>meta</code>{' '}
          („Wysłano · sprawdzono”) — ten sam w dialogu i w sekcji; sekcje na pulpicie i stronie
          pracownika na jednym rozmiarze CollapsibleSection.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label={`${SURFACE.a}: tytuł „Zgłoszenie wydatków · {imię}”, notatka jako opis; licznik dopiero w stopce`}
        sources={['src/components/worker-expenses/use-expense-draft-acceptance.tsx:209']}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-2xl">
              <DialogHeader
                title="Zgłoszenie wydatków · Jan Kowalski"
                description="Paragony z Castoramy, budowa na Mokotowie"
              />
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label={`${SURFACE.b}: ogólny tytuł dialogu, w środku h3 z imieniem + DecisionProgressBadge, linia „Wysłano · sprawdzono” i „Dodano do: Etap”`}
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog.tsx:40',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:305',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:311',
        ]}
      >
        <OpenPreview>
          <Dialog>
            <DialogContent className="sm:max-w-dialog-3xl sm:max-h-[95vh]">
              <DialogHeader title="Zgłoszenia prac" />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={SECTION_TITLE_MD_CLASS}>Jan Kowalski</h3>
                    <DecisionProgressBadge accepted={3} rejected={1} pending={1} />
                  </div>
                  <Description withIcon={false} size="xs">
                    Wysłano 20.10.2026, 14:05 · sprawdzono 20.10.2026, 16:30 (Marek Zieliński)
                  </Description>
                </div>
                <p className="text-sm">
                  Dodano do: <span className="font-medium">Etap 2 — Gładzie</span>
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label={`${SURFACE.c}: PageWrapper h1 + Description z ikoną (długie wyjaśnienie kolejki)`}
        sources={[
          'src/app/(frontend)/zgloszenia-prac/page.tsx:23',
          'src/app/(frontend)/zgloszenia-prac/page.tsx:24',
        ]}
      >
        <PageWrapper title="Zgłoszenia prac" className={PAGE_RESET}>
          <Description>
            Bez sortowania na górze zgłoszenia czekające na decyzję, niżej rozpatrzone — w nich też
            można jeszcze przyjąć odrzucone pozycje. „Podgląd” pokazuje zgłoszenie na miejscu, a
            „Otwórz w kosztorysie” otwiera rozpiskę inwestycji z tym zgłoszeniem.
          </Description>
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label={`${SURFACE.d}: ta sama wersja co c — h1 + Description, tu jako licznik „N nowych”`}
        sources={[
          'src/app/(frontend)/zgloszenia/page.tsx:37',
          'src/app/(frontend)/zgloszenia/page.tsx:38',
        ]}
      >
        <PageWrapper title="Zapytania z formularzy" className={PAGE_RESET}>
          <Description>3 nowych</Description>
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label={`${SURFACE.e}: sam h1, bez opisu i bez licznika`}
        sources={['src/app/(frontend)/zgloszenia-wydatkow/page.tsx:30']}
      >
        <PageWrapper title="Zgłoszenia wydatków" className={PAGE_RESET} />
      </AuditVariant>

      <AuditVariant
        letter="f"
        label={`${SURFACE.f}: CollapsibleSection w rozmiarze domyślnym (lg), hint, bez separatora, sm:max-w-lg`}
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:116',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:127',
        ]}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Do potwierdzenia"
            hint="Potwierdź, że dostałeś te pieniądze — albo odrzuć i napisz, czego brakuje."
            withSeparator={false}
            className="sm:max-w-lg"
          >
            {null}
          </CollapsibleSection>
          <CollapsibleSection
            title="Odrzucone"
            hint="Czekają na wyjaśnienie z kierownikiem. Nadal możesz je potwierdzić albo poczekać, aż kierownik je anuluje."
            withSeparator={false}
            className="sm:max-w-lg"
          >
            {null}
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label={`${SURFACE.g}: CollapsibleSection sm, hint, akcja zbiorcza w slocie action`}
        sources={['src/components/worker-expenses/pending-expense-drafts.tsx:99']}
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
            {null}
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label={`${SURFACE.h}: ta sama wersja co g — CollapsibleSection sm z hintem, bez action`}
        sources={['src/components/receipt-confirmation/rejected-receipts.tsx:106']}
      >
        <div className={MOCK}>
          <CollapsibleSection
            title="Odrzucone przez pracowników"
            hint="Trzeba je wyjaśnić z pracownikiem lub anulować."
            size="sm"
            withSeparator={false}
          >
            {null}
          </CollapsibleSection>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
