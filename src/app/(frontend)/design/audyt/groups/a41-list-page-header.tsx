import type { ReactNode } from 'react'
import {
  CalendarDays,
  CircleDot,
  Copy,
  HardHat,
  Landmark,
  Plus,
  Search,
  Settings2,
  WandSparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ControlGrid } from '@/components/ui/control-grid'
import { Description } from '@/components/ui/description'
import { ExternalLink } from '@/components/ui/external-link'
import { Input } from '@/components/ui/input'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const FILTER_TRIGGER = 'overflow-hidden sm:min-w-40'

function SampleTable() {
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
      [tabela]
    </div>
  )
}

function SampleToolbar({ search, actions }: { search?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
          <div className="relative col-span-2 w-full sm:w-56 lg:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
            <Input placeholder={search} className="h-8 pl-8" />
          </div>
        </ControlGrid>
      )}
      <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
        {actions}
        {search && (
          <Button variant="outline" size="sm">
            <Settings2 />
            Kolumny
          </Button>
        )}
      </ControlGrid>
    </div>
  )
}

function SampleQueueFilters({ withDuplicates }: { withDuplicates?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <ControlGrid>
        <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
          <CircleDot />
          <span className="truncate">Status</span>
        </Button>
        <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
          <Landmark />
          <span className="truncate">Inwestycja</span>
        </Button>
        <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
          <HardHat />
          <span className="truncate">Pracownik</span>
        </Button>
        {withDuplicates && (
          <Button variant="outline" size="sm" align="start" className={FILTER_TRIGGER}>
            <Copy />
            <span className="truncate">Duplikaty</span>
          </Button>
        )}
        <Button variant="outline" size="sm" align="start" disabled className={FILTER_TRIGGER}>
          <X />
          <span className="truncate">Wyczyść filtry</span>
        </Button>
      </ControlGrid>
      <Button variant="outline" size="sm" className="w-fit">
        <CalendarDays />
        Od – Do
      </Button>
    </div>
  )
}

export function A41ListPageHeaderGroup() {
  return (
    <AuditGroup
      id="A41"
      title="Nagłówek strony listy"
      count="16 wystąpień w 16 plikach · 6 wersji"
      drift={[
        'Podtytuł: dziecko <Description> (ikona Info, text-sm) vs prop description w PageWrapper (<p> text-muted-foreground mt-1 bez ikony) — na stronach sprzętu i floty listy mają jedno, a szczegóły drugie.',
        'Akcje strony: w prawym ControlGrid paska tabeli (DataTableToolbar actions) vs osobny wiersz flex justify-end gap-3 nad tabelą (Kosztorysy v1) vs pasek tabeli bez wyszukiwarki, tylko z akcją, pod blokiem filtrów (Zgłoszenia prac).',
        'Filtry: w pasku tabeli obok wyszukiwarki vs osobny blok QueueFilters (ControlGrid + daty) nad tabelą, bez wyszukiwarki.',
        'Treść podtytułu: licznik („3 nowych”, „5 sztuk w użyciu”) vs akapit instrukcji vs marka i model pojazdu.',
      ]}
      proposal={
        <>
          <code>PageWrapper</code> dostaje sloty <code>description?: ReactNode</code> (zawsze jako{' '}
          <code>Description</code>) i <code>actions?: ReactNode</code> w jednym wierszu z tytułem;
          akcje strony zostają w <code>DataTableToolbar actions</code>, a osobny wiersz{' '}
          <code>justify-end</code> znika.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="sam tytuł → od razu pasek tabeli (wyszukiwarka i filtry z lewej, akcje i Kolumny z prawej); filtry pominięte, akcja odtworzona przyciskiem"
        sources={[
          'src/app/(frontend)/katalog-prac/page.tsx:18',
          'src/app/(frontend)/inwestycje/page.tsx:17',
          'src/app/(frontend)/kasy/page.tsx:16',
          'src/app/(frontend)/pracownicy/page.tsx:39',
          'src/app/(frontend)/szablony/page.tsx:11',
        ]}
      >
        <PageWrapper title="Inwestycje" className="w-full">
          <SampleToolbar
            search="Szukaj..."
            actions={
              <Button variant="outline" size="sm">
                <Plus />
                Nowa inwestycja
              </Button>
            }
          />
          <SampleTable />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="tytuł + licznik jako dziecko <Description> (z ikoną Info) → pasek tabeli"
        sources={[
          'src/app/(frontend)/zgloszenia/page.tsx:38',
          'src/app/(frontend)/sprzet/page.tsx:34',
          'src/app/(frontend)/flota/page.tsx:30',
        ]}
      >
        <PageWrapper title="Sprzęt" className="w-full">
          <Description>5 sztuk w użyciu</Description>
          <SampleToolbar
            search="Szukaj sprzętu..."
            actions={
              <Button variant="outline" size="sm">
                <Plus />
                Dodaj sprzęt
              </Button>
            }
          />
          <SampleTable />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="strona szczegółów: podtytuł przez prop description PageWrapper (<p> mt-1, bez ikony)"
        sources={[
          'src/app/(frontend)/sprzet/[id]/page.tsx:37',
          'src/app/(frontend)/flota/[id]/page.tsx:39',
        ]}
      >
        <PageWrapper title="WX 12345" description="Ford Transit · 2021" className="w-full">
          <SampleTable />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="tytuł + akapit instrukcji w <Description> → blok QueueFilters nad tabelą → pasek tabeli tylko z akcją AI (bez wyszukiwarki); daty odtworzone przyciskiem"
        sources={[
          'src/app/(frontend)/zgloszenia-prac/page.tsx:24',
          'src/components/worker-reports/worker-reports-data-table.tsx:66',
        ]}
      >
        <PageWrapper title="Zgłoszenia prac" className="w-full">
          <Description>
            Bez sortowania na górze zgłoszenia czekające na decyzję, niżej rozpatrzone — w nich też
            można jeszcze przyjąć odrzucone pozycje.
          </Description>
          <SampleQueueFilters />
          <SampleToolbar
            actions={
              <Button variant="ai" size="sm" className="max-sm:col-span-2">
                <WandSparkles className="text-neon-cyan" />
                <span className="text-neon-cyan font-semibold">
                  Wczytaj zgłoszenie z kartki (AI)
                </span>
              </Button>
            }
          />
          <SampleTable />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="sam tytuł → zwijana kolejka „Wydatki do sprawdzenia” → QueueFilters nad tabelą, tabela bez paska (brak wyszukiwarki i akcji)"
        sources={[
          'src/app/(frontend)/zgloszenia-wydatkow/page.tsx:30',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:77',
        ]}
      >
        <PageWrapper title="Zgłoszenia wydatków" className="w-full">
          <section>
            <CollapsibleSection title="Wydatki do sprawdzenia" size="sm" withSeparator={false}>
              <SampleTable />
            </CollapsibleSection>
          </section>
          <SampleQueueFilters withDuplicates />
          <SampleTable />
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="tytuł → osobny wiersz flex justify-end gap-3 z linkiem zewnętrznym → pasek tabeli z akcją „Nowy kosztorys”"
        sources={[
          'src/app/(frontend)/kosztorysy/page.tsx:56',
          'src/components/sheets/kosztorys-data-table.tsx:33',
        ]}
      >
        <PageWrapper title="Kosztorysy v1" className="w-full">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ExternalLink href="https://docs.google.com/spreadsheets">
              Otwórz arkusze google ↗
            </ExternalLink>
          </div>
          <SampleToolbar
            search="Szukaj..."
            actions={
              <Button variant="outline" size="sm">
                <Plus />
                Nowy kosztorys
              </Button>
            }
          />
          <SampleTable />
        </PageWrapper>
      </AuditVariant>
    </AuditGroup>
  )
}
