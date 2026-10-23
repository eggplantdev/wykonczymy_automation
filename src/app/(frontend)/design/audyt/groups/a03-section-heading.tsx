'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import * as Collapsible from '@/components/ui/collapsible'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { OptionalLink } from '@/components/ui/optional-link'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import {
  EYEBROW_CLASS,
  SECTION_TITLE_CLASS,
  SECTION_TITLE_MD_CLASS,
  SUBSECTION_TITLE_CLASS,
  SectionHeader,
} from '@/components/ui/section-header'
import { Separator } from '@/components/ui/separator'
import { TextButton } from '@/components/ui/text-link'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A03SectionHeadingGroup() {
  return (
    <AuditGroup
      id="A03"
      title="Nagłówek sekcji"
      count="31 wystąpień w 23 plikach · 24 wersje"
      drift={[
        'odstęp nagłówek → treść: gap-1 / gap-1.5 / gap-2 / gap-3 / gap-4, space-y-2, mb-1 / mb-2 na nagłówku albo brak',
        'tag przy tym samym wyglądzie: h2 / h3 / h4 (vehicle-costs: h2 i h3 dla dwóch identycznych sąsiednich bloków)',
        'kolor: brak, text-foreground, text-muted-foreground, text-destructive (też warunkowo)',
        'rozmiar dla tej samej roli: SECTION_TITLE (lg) / SECTION_TITLE_MD / SUBSECTION_TITLE / EYEBROW / surowe text-xs font-medium',
        'wcięcia wbudowane w sekcję: px-4 pt-6 / px-4 py-6 / px-4 py-3 / px-4 py-10 / pb-3 / mt-4; dodatki min-h-7, w-full',
        'SectionHeader (text-foreground mb-2 py-2, zawsze h2) używany w 1 miejscu; CollapsibleSection sm ma font-medium, przebudowa w podsumowaniu font-semibold',
      ]}
      proposal={
        <>
          Rozszerzyć <code>SectionHeader</code> do <code>TitledSection</code>:{' '}
          <code>{'<section>'}</code> + nagłówek ze stałym odstępem, props <code>title</code>,{' '}
          <code>size?: &apos;lg&apos; | &apos;md&apos; | &apos;sm&apos; | &apos;eyebrow&apos;</code>
          , <code>as?: &apos;h2&apos; | &apos;h3&apos; | &apos;h4&apos;</code>,{' '}
          <code>tone?: &apos;default&apos; | &apos;muted&apos; | &apos;destructive&apos;</code>,{' '}
          <code>action?</code>, <code>subtitle?</code>. Wcięcia zewnętrzne zostają po stronie
          rodzica.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="section gap-2 + h3 SUBSECTION"
        sources={[
          'src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:166',
          'src/components/kosztorys/editor/dialogs/acceptance-protocol-dialog.tsx:188',
          'src/components/transfers/duplicate-finder-dialog.tsx:164',
        ]}
      >
        <section className="flex flex-col gap-2">
          <h3 className={SUBSECTION_TITLE_CLASS}>Zakres prac (12)</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="goły div + h2 SUBSECTION mb-2"
        sources={[
          'src/components/fleet/vehicle-costs.tsx:47',
          'src/components/fleet/inspection-history.tsx:107',
          'src/components/fleet/vehicle-costs.tsx:69',
        ]}
      >
        <div>
          <h2 className={`${SUBSECTION_TITLE_CLASS} mb-2`}>Podsumowanie</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="section gap-3 + h3 SUBSECTION"
        sources={[
          'src/components/telmak-check/telmak-check-dialog.tsx:192',
          'src/components/telmak-check/telmak-check-dialog.tsx:216',
        ]}
      >
        <section className="flex flex-col gap-3">
          <h3 className={SUBSECTION_TITLE_CLASS}>Faktury do weryfikacji</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="section mt-4 space-y-2 + h3 SUBSECTION wyszarzony"
        sources={[
          'src/components/leads/lead-answers-dialog.tsx:42',
          'src/components/leads/lead-assets-dialog.tsx:203',
        ]}
      >
        <section className="mt-4 space-y-2">
          <h3 className={`${SUBSECTION_TITLE_CLASS} text-muted-foreground`}>Załączniki</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="section gap-1 + h3 EYEBROW"
        sources={[
          'src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:97',
          'src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:112',
        ]}
      >
        <section className="flex flex-col gap-1">
          <h3 className={EYEBROW_CLASS}>Nazwane wersje</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="section space-y-2 + h2 SUBSECTION"
        sources={['src/app/(frontend)/kosztorysy/page.tsx:63']}
      >
        <section className="space-y-2">
          <h2 className={SUBSECTION_TITLE_CLASS}>Inwestycje bez kosztorysu</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="section space-y-2 + wiersz: h3 SUBSECTION i przycisk po prawej"
        sources={['src/components/leads/lead-assets-dialog.tsx:169']}
      >
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className={SUBSECTION_TITLE_CLASS}>Wybierz pliki (4)</h3>
            <Button type="button" variant="ghost" size="xs">
              Zaznacz wszystkie
            </Button>
          </div>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="section gap-2 + h3 SUBSECTION text-destructive"
        sources={['src/components/transfers/duplicate-finder-dialog.tsx:147']}
      >
        <section className="flex flex-col gap-2">
          <h3 className={cn('text-destructive', SUBSECTION_TITLE_CLASS)}>
            Ta sama kwota i data · 2 wydatki
          </h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="section gap-1.5 pb-3 + h3 SUBSECTION, text-destructive warunkowo (tu włączony)"
        sources={['src/components/worker-expenses/expense-draft-duplicate-hints.tsx:114']}
      >
        <section className="flex flex-col gap-1.5 pb-3">
          <h3 className={cn(SUBSECTION_TITLE_CLASS, 'text-destructive')}>Możliwe duplikaty</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="div gap-1 + surowy h4 text-xs font-medium (bez stałej)"
        sources={['src/components/worker-expenses/expense-draft-duplicate-hints.tsx:119']}
      >
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-medium">Paragon: Leroy Merlin 2026-10-20</h4>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="section gap-2 px-4 pt-6 + h2 SUBSECTION"
        sources={['src/components/kosztorys/worker-report/draft-extra-works.tsx:12']}
      >
        <section className="flex flex-col gap-2 px-4 pt-6">
          <h2 className={SUBSECTION_TITLE_CLASS}>Prace spoza rozpiski</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="section gap-2 px-4 py-6 + h2 SUBSECTION (jak k, ale py-6)"
        sources={['src/components/kosztorys/worker-report/sent-reports.tsx:14']}
      >
        <section className="flex flex-col gap-2 px-4 py-6">
          <h2 className={SUBSECTION_TITLE_CLASS}>Wysłane zgłoszenia</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="section gap-2 + h2 SUBSECTION z flex min-h-7 items-center"
        sources={['src/components/investments/investment-overview.tsx:89']}
      >
        <section className="flex flex-col gap-2">
          <h2 className={cn('flex min-h-7 items-center', SUBSECTION_TITLE_CLASS)}>
            Zdjęcia i pliki
          </h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="section items-start gap-2 px-4 py-3 + h3 SUBSECTION z podtytułem i InfoTooltip"
        sources={['src/components/kosztorys/summary/settings/settings-section.tsx:20']}
      >
        <section className="flex flex-col items-start gap-2 px-4 py-3">
          <div className="flex flex-col items-start gap-0.5">
            <h3 className={SUBSECTION_TITLE_CLASS}>Rabat</h3>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              Kwota rabatu dla inwestora
              <InfoTooltip content="Opis ustawienia" label="Więcej o: Kwota rabatu dla inwestora" />
            </div>
          </div>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="przebudowany nagłówek CollapsibleSection sm bez zwijania: h2 text-foreground SUBSECTION + Separator, treść pt-4"
        sources={['src/components/kosztorys/summary/tabs/summary-overview-tab.tsx:129']}
      >
        <div>
          <div className="w-fit">
            <div className="flex items-center gap-2 py-2 text-left">
              <h2 className={`text-foreground ${SUBSECTION_TITLE_CLASS}`}>
                <OptionalLink href="/design/audyt">Lista wpłat</OptionalLink>
              </h2>
            </div>
            <Separator orientation="horizontal" />
          </div>
          <div className="pt-4">
            <p className="text-sm">Treść sekcji — pierwsza linia.</p>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="div gap-1 + wiersz: h3 SUBSECTION i akcje ml-auto, treść Description"
        sources={['src/components/company-knowledge/knowledge-entry-row.tsx:50']}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className={SUBSECTION_TITLE_CLASS}>Godziny pracy na budowie</h3>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <EditButton label="Edytuj wpis" />
              <DeleteButton label="Usuń wpis" />
            </div>
          </div>
          <Description withIcon={false} className="whitespace-pre-line">
            Treść sekcji — pierwsza linia.
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="section gap-3 + h2 text-foreground SECTION_TITLE_MD"
        sources={['src/components/trash/trash-section.tsx:19']}
      >
        <section className="flex flex-col gap-3">
          <h2 className={cn('text-foreground', SECTION_TITLE_MD_CLASS)}>Inwestycje</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="h3 SECTION_TITLE_MD w wierszu z badge statusu + Description xs (badge przybliżony)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:308',
        ]}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={SECTION_TITLE_MD_CLASS}>Jan Kowalski</h3>
            <Badge tone="pending">Do sprawdzenia</Badge>
          </div>
          <Description withIcon={false} size="xs">
            Wysłano 2026-10-20 14:32
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="s"
        label="div items-start gap-4 px-4 py-10 + h2 SECTION_TITLE (lg)"
        sources={['src/components/kosztorys/worker-report/worker-report-form.tsx:48']}
      >
        <div className="flex flex-col items-start gap-4 px-4 py-10">
          <h2 className={SECTION_TITLE_CLASS}>Zgłoszenie wysłane</h2>
          <Description withIcon={false}>Treść sekcji — pierwsza linia.</Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="t"
        label="pasek narzędzi tabeli: h2 text-foreground w-full SECTION_TITLE (lg) w flex-wrap gap-2"
        sources={['src/components/tables/data-table/data-table-toolbar.tsx:51']}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn('text-foreground w-full', SECTION_TITLE_CLASS)}>Transakcje</h2>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="u"
        label="goła section + h3 EYEBROW mb-1"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:49',
        ]}
      >
        <section>
          <h3 className={cn(EYEBROW_CLASS, 'mb-1')}>2026-10-20</h3>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="v"
        label="goła section + h4 EYEBROW mb-2"
        sources={['src/components/worker-reports/report-preview-dialog.tsx:78']}
      >
        <section>
          <h4 className={`${EYEBROW_CLASS} mb-2`}>Z rozpiski (3)</h4>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </section>
      </AuditVariant>

      <AuditVariant
        letter="w"
        label="h4 EYEBROW owijający TextButton z chevronem + Description xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:405',
        ]}
      >
        <div>
          <h4 className={EYEBROW_CLASS}>
            <TextButton aria-expanded className="flex uppercase">
              Z rozpiski (3)
              <Collapsible.Chevron open className="size-3.5" />
            </TextButton>
          </h4>
          <Description withIcon={false} size="xs">
            Treść sekcji — pierwsza linia.
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="x"
        label="div mb-1 font-medium z zieloną kropką w roli nagłówka"
        sources={['src/components/sheets/sync-button.tsx:191']}
      >
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium">
            <span className="bg-chart-green h-2 w-2 rounded-full" />
            Zsynchronizowano
          </div>
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W"
        label="wzorzec: SectionHeader size lg / md / sm (h2 text-foreground mb-2 py-2)"
        sources={['src/components/equipment/held-equipment-section.tsx:33']}
      >
        <div className="flex w-full flex-col gap-4">
          <div>
            <SectionHeader title="Nagłówek lg" />
            <p className="text-sm">Treść sekcji — pierwsza linia.</p>
          </div>
          <div>
            <SectionHeader size="md" title="Nagłówek md" />
            <p className="text-sm">Treść sekcji — pierwsza linia.</p>
          </div>
          <div>
            <SectionHeader size="sm" title="Nagłówek sm" />
            <p className="text-sm">Treść sekcji — pierwsza linia.</p>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W2"
        label="wzorzec: CollapsibleSection size=sm (h2 text-sm font-medium + chevron + Separator)"
        sources={[
          'src/components/kosztorys/summary/blocks/subcontractor-summary.tsx:74',
          'src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:112',
        ]}
      >
        <CollapsibleSection title="Lista wypłat" size="sm" className="w-full">
          <p className="text-sm">Treść sekcji — pierwsza linia.</p>
        </CollapsibleSection>
      </AuditVariant>
    </AuditGroup>
  )
}
