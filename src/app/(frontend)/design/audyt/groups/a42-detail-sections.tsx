import { ArrowRight, Printer, ReceiptText, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ControlGrid } from '@/components/ui/control-grid'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { OptionalLink } from '@/components/ui/optional-link'
import {
  SECTION_TITLE_CLASS,
  SUBSECTION_TITLE_CLASS,
  SectionHeader,
} from '@/components/ui/section-header'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const REGISTER_COLS = `${SUMMARY_NAME_COL} ${SUMMARY_VALUE_COL}`
const EQUIPMENT_COLS = `${SUMMARY_NAME_COL} auto ${SUMMARY_VALUE_COL}`

function SampleTable() {
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
      [tabela]
    </div>
  )
}

export function A42DetailSectionsGroup() {
  return (
    <AuditGroup
      id="A42"
      title="Sekcje strony szczegółów"
      count="15 wystąpień w 14 plikach · 9 wersji"
      drift={[
        'Na jednej stronie pracownika sekcje są zwijane (CollapsibleSection lg), a „Na stanie” to statyczny SectionHeader nad tą samą SummaryTable.',
        'Transfery: na kasie i inwestycji statyczny <h2> w pasku tabeli (mt-8, pod zwiniętym „Filtry”), na stronie pracownika zwinięta sekcja bez nagłówka w pasku.',
        'Rozmiar tytułu: text-lg (lg, SectionHeader, pasek tabeli) vs text-sm font-medium (compact) vs text-sm font-semibold z mb-2 (pojazd).',
        'defaultOpen: kasy, inwestycje i potwierdzenia otwarte; zgłoszenia, wydatki i transfery zwinięte — bez reguły.',
        'Hint pod tytułem w części sekcji; sm:max-w-lg i className="text-sm" tylko w niektórych.',
      ]}
      proposal={
        <>
          Każda sekcja strony szczegółów to <code>CollapsibleSection</code> z jednym presetem (np.{' '}
          <code>variant=&quot;detail&quot;</code>: lg, bez separatora, <code>hint</code> opcjonalny,
          otwarta, gdy ma treść); <code>SectionHeader</code> i <code>h2</code> w pasku tabeli
          przechodzą na ten preset.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="Transfery na kasie/inwestycji: zwinięte „Filtry” (sm, w-fit), pod nimi statyczny <h2> text-lg w pasku tabeli z mt-8; przełącznik widoku pominięty, akcje odtworzone przyciskami"
        sources={[
          'src/app/(frontend)/kasa/[id]/page.tsx:70',
          'src/app/(frontend)/inwestycje/[id]/page.tsx:90',
          'src/components/transfers/transfer-data-table.tsx:103',
        ]}
      >
        <div className="w-full">
          <CollapsibleSection className="w-fit" title="Filtry" size="sm" defaultOpen={false}>
            <SampleTable />
          </CollapsibleSection>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <h2 className={cn('text-foreground w-full', SECTION_TITLE_CLASS)}>Transfery</h2>
            <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
              <Button variant="outline" size="sm">
                <ReceiptText />
                Faktury
              </Button>
              <Button variant="outline" size="sm">
                <Printer />
                Drukuj
              </Button>
              <Button variant="outline" size="sm">
                <Settings2 />
                Kolumny
              </Button>
            </ControlGrid>
          </div>
          <SampleTable />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="CollapsibleSection lg, withSeparator={false}, hint, defaultOpen={false}"
        sources={[
          'src/components/worker-reports/worker-reports-section.tsx:18',
          'src/components/worker-expenses/worker-expense-drafts-section.tsx:18',
        ]}
      >
        <div className="w-full">
          <CollapsibleSection
            title="Zgłoszenia wykonanych prac"
            hint="Prace, które zgłosiłem kierownikowi, i to, co z nich przyjął."
            defaultOpen={false}
            withSeparator={false}
          >
            <SampleTable />
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="CollapsibleSection lg, withSeparator={false}, hint, otwarta, className sm:max-w-lg"
        sources={[
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:116',
          'src/components/receipt-confirmation/receipts-to-confirm.tsx:127',
        ]}
      >
        <div className="w-full">
          <CollapsibleSection
            title="Do potwierdzenia"
            hint="Potwierdź, że dostałeś te pieniądze — albo odrzuć i napisz, czego brakuje."
            withSeparator={false}
            className="sm:max-w-lg"
          >
            <SampleTable />
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="statyczny <h2> SUBSECTION_TITLE_CLASS mb-2 (text-sm font-semibold) nad tabelą — zakładki pojazdu"
        sources={[
          'src/components/fleet/vehicle-costs.tsx:47',
          'src/components/fleet/inspection-history.tsx:107',
        ]}
      >
        <div>
          <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>Podsumowanie</h2>
          <SummaryTable
            cols={`${SUMMARY_NAME_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}
            className="w-fit"
          >
            <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
            <SummaryHeaderCell>Wpisy</SummaryHeaderCell>
            <SummaryHeaderCell>Koszt</SummaryHeaderCell>
            <SummaryCell>Przegląd</SummaryCell>
            <SummaryCell>2</SummaryCell>
            <SummaryCell>1 111,11 zł</SummaryCell>
          </SummaryTable>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="CollapsibleSection compact, withSeparator={false}, className text-sm, akcja „Edytuj notatkę” obok"
        sources={[
          'src/components/investments/investment-notes.tsx:46',
          'src/components/investments/investment-ai-notes.tsx:10',
        ]}
      >
        <div className="w-full">
          <CollapsibleSection
            title="Notatki"
            size="compact"
            withSeparator={false}
            className="text-sm"
            action={<EditButton label="Edytuj notatkę" text="Edytuj notatkę" showLabel />}
          >
            <p>Klucze u sąsiada spod 4. Płytki odbiór w piątek.</p>
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="CollapsibleSection lg, withSeparator={false}, otwarta, bez hintu — SummaryTable kas"
        sources={['src/components/users/owned-registers-section.tsx:42']}
      >
        <div className="w-full">
          <CollapsibleSection title="Moje kasy" withSeparator={false}>
            <SummaryTable cols={REGISTER_COLS} className="w-fit text-sm">
              <SummaryHeaderCell>Kasa</SummaryHeaderCell>
              <SummaryHeaderCell>Saldo</SummaryHeaderCell>
              <SummaryCell>
                <OptionalLink href="/design/audyt">Kasa Jana</OptionalLink>
              </SummaryCell>
              <SummaryCell>1 111,11 zł</SummaryCell>
              <SummaryCell weight="bold">Razem</SummaryCell>
              <SummaryCell weight="bold">1 111,11 zł</SummaryCell>
            </SummaryTable>
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="CollapsibleSection lg, withSeparator={false}, hint, otwarta — lista linków"
        sources={['src/components/users/worker-investments-section.tsx:27']}
      >
        <div className="w-full">
          <CollapsibleSection
            title="Moje inwestycje"
            hint="Aktywne inwestycje, w których jestem przypisany do któregoś etapu."
            withSeparator={false}
          >
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <OptionalLink href="/design/audyt" className="inline-flex items-center gap-1">
                  Mieszkanie Mokotów, ul. Puławska 12
                  <ArrowRight className="size-4" />
                </OptionalLink>
              </li>
            </ul>
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="Transfery na stronie pracownika: CollapsibleSection lg, withSeparator={false}, defaultOpen={false}, bez hintu"
        sources={['src/app/(frontend)/pracownicy/[id]/page.tsx:189']}
      >
        <div className="w-full">
          <CollapsibleSection
            title="Lista wydatków / zaliczek"
            defaultOpen={false}
            withSeparator={false}
          >
            <SampleTable />
          </CollapsibleSection>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="statyczny SectionHeader (h2 text-lg mb-2 py-2) nad tą samą SummaryTable — „Na stanie” obok zwijanych sekcji"
        sources={['src/components/equipment/held-equipment-section.tsx:33']}
      >
        <div>
          <SectionHeader title="Na stanie" />
          <SummaryTable cols={EQUIPMENT_COLS} className="w-fit text-sm">
            <SummaryHeaderCell>Sprzęt</SummaryHeaderCell>
            <SummaryHeaderCell>Nr seryjny</SummaryHeaderCell>
            <SummaryHeaderCell>Od</SummaryHeaderCell>
            <SummaryCell>Wiertarka Makita</SummaryCell>
            <SummaryCell>SN-2026-0042</SummaryCell>
            <SummaryCell>20.10.2026</SummaryCell>
          </SummaryTable>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
