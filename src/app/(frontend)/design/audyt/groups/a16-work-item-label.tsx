import { ArrowRight, ChevronDown, GripVertical, Slash, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { ExternalLink } from '@/components/ui/external-link'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A16WorkItemLabelGroup() {
  return (
    <AuditGroup
      id="A16"
      title="Etykieta pozycji kosztorysu"
      count="13 wystąpień w 13 plikach · 13 wersji"
      drift={[
        'Kolejność: „sekcja · opis (j.m.)” vs odwrócona „opis (j.m.) · sekcja” vs sekcja w drugiej linii pod opisem.',
        'Co jest wyszarzone: tylko sekcja / sekcja i j.m. / cała etykieta / nic.',
        'Jednostka: „(m2)” wyszarzona w nawiasie vs surowa w osobnym spanie text-xs vs kolumna w-16 wyrównana do prawej.',
        'Opis: font-medium w 3 kopiach, zwykły w pozostałych; „(bez opisu)” jako zastępstwo tylko w jednej.',
        'Karta podpowiedzi katalogu: prawa strona to licznik tabular-nums albo przycisk link; „może chodzi o:” w fragmencie razem z listą vs osobno.',
        'Etykieta rozliczenia z ikoną: gap-1 + ikona size-3.5 vs gap-2 + ikona domyślna.',
        'Po fazie 1: oprawa karty podpowiedzi (a, b) zostaje skopiowana — wspólna renderowałaby pusty div w space-y-1, co bez podpowiedzi dodaje 0.25rem odstępu w uncatalogued-usage-list.',
      ]}
      proposal={
        <>
          Jeden <code>WorkItemLabel</code> w <code>kosztorys/</code> (props:{' '}
          <code>description</code>, <code>unit?</code>, <code>section?</code>,{' '}
          <code>rowNumber?</code>,{' '}
          <code>emphasis?: &apos;description&apos; | &apos;none&apos;</code>), na nim{' '}
          <code>CatalogueHintCard</code> (<code>label</code>, <code>aside</code>, <code>hints</code>
          ) i osobny <code>PlaneLabel</code> (<code>plane</code>, <code>size?</code>) obok{' '}
          <code>planeIcon</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="karta „brak w katalogu” w kosztorysie: sekcja · opis (j.m.) + przycisk link"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:45',
        ]}
      >
        <div className="w-full space-y-2 text-xs">
          <div className="border-border/60 space-y-1 border-t pt-1.5 pb-1">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="text-muted-foreground">Łazienka · </span>
                <span className="font-medium">Montaż płytek ściennych</span>
                <span className="text-muted-foreground"> (m2)</span>
              </span>
              <Button variant="link" size="inlineXs" className="shrink-0">
                Dodaj do katalogu
              </Button>
            </div>
            <p className="text-muted-foreground pl-4">może chodzi o:</p>
            <div className="pl-4">
              <Button variant="ghost" size="row" className="items-baseline">
                <ArrowRight className="text-warning shrink-0 self-start" />
                <span className="min-w-0 flex-1 text-left">Układanie płytek na ścianie</span>
                <span className="text-muted-foreground w-16 shrink-0 text-right">m2</span>
                <span className="w-20 shrink-0 text-right tabular-nums">120,00 zł</span>
              </Button>
            </div>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="karta „używane, a brak w katalogu”: opis (j.m.) bez sekcji + licznik"
        sources={['src/components/work-catalogue/uncatalogued-usage-list.tsx:15']}
      >
        <div className="w-full space-y-2 text-xs">
          <div className="border-border/60 space-y-1 border-t pt-1.5 pb-1">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="font-medium">Montaż płytek ściennych</span>
                <span className="text-muted-foreground"> (m2)</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">kosztorysy: 3</span>
            </div>
            <>
              <p className="text-muted-foreground pl-4">może chodzi o:</p>
              <div className="pl-4">
                <div className="flex items-baseline gap-2 px-1 py-1">
                  <span className="w-4 shrink-0 self-start" />
                  <span className="min-w-0 flex-1 text-left">Układanie płytek na ścianie</span>
                  <span className="text-muted-foreground w-16 shrink-0 text-right">m2</span>
                  <span className="w-20 shrink-0 text-right tabular-nums">120,00 zł</span>
                </div>
              </div>
            </>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="komórka tabeli różnic: font-medium na td + wyszarzona (j.m.)"
        sources={['src/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx:155']}
      >
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-border/60 border-t align-middle">
              <td className="py-1 font-medium" colSpan={4}>
                Montaż płytek ściennych
                <span className="text-muted-foreground"> (m2)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="historia zmian: wyszarzona sekcja · zwykły opis, bez j.m."
        sources={['src/components/kosztorys/editor/history/history-changes-table.tsx:12']}
      >
        <span className="text-sm">
          <>
            <span className="text-muted-foreground">Łazienka · </span>
            Montaż płytek ściennych
          </>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="raport arkusza: cała etykieta wyszarzona"
        sources={['src/components/kosztorys/editor/dialogs/report/sheet-report-parts.tsx:131']}
      >
        <span className="text-xs">
          <span className="text-muted-foreground">Łazienka · Montaż płytek ściennych</span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="porównanie z arkuszem: link do komórki · sekcja · opis, nic nie wyszarzone"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog.tsx:358']}
      >
        <span className="text-xs">
          <>
            <ExternalLink href="https://docs.google.com/spreadsheets">komórka N42</ExternalLink> ·
            Łazienka · Montaż płytek ściennych
          </>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="opcja selecta (string): odwrócona kolejność opis (j.m.) · sekcja — pokazana jako tekst"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:198',
        ]}
      >
        <span className="text-sm">Montaż płytek ściennych (m2) · Łazienka</span>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="podtytuł dialogu: „Zgłoszono: „opis” (j.m.)” w Description"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog.tsx:74',
        ]}
      >
        <Description withIcon={false} className="px-4 pt-1">
          Zgłoszono: „Montaż płytek ściennych” (m2)
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="lista przestawiania: nr wiersza + opis (truncate) + surowa j.m. text-xs"
        sources={['src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx:337']}
      >
        <div className="shadow-section-rail hover:bg-muted/50 flex w-full cursor-grab items-center gap-2 border-b px-2 py-1 text-sm last:border-b-0">
          <GripVertical className="text-muted-foreground size-4 shrink-0" />
          <Checkbox checked={false} tabIndex={-1} className="pointer-events-none" />
          <span className="text-muted-foreground w-8 shrink-0 text-right tabular-nums">12</span>
          <span className="min-w-0 flex-1 truncate">Montaż płytek ściennych</span>
          <span className="text-muted-foreground shrink-0 text-xs">m2</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="wiersz kandydata z katalogu: opis + j.m. w kolumnie w-16"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row.tsx:24',
        ]}
      >
        <div className="flex w-full items-baseline gap-2 px-1 py-1 text-xs">
          <span className="w-4 shrink-0 self-start" />
          <span className="min-w-0 flex-1 text-left">Montaż płytek ściennych</span>
          <span className="text-muted-foreground w-16 shrink-0 text-right">m2</span>
          <span className="w-20 shrink-0 text-right tabular-nums">120,00 zł</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="stawki z arkusza: opis, a sekcja w drugiej linii text-xs"
        sources={['src/components/kosztorys/editor/dialogs/sheet/sheet-rates-block.tsx:49']}
      >
        <span className="text-xs">
          <>
            <span>Montaż płytek ściennych</span>
            <span className="text-muted-foreground block text-xs">Łazienka</span>
          </>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="etykieta rozliczenia (ustawienia globalne): gap-1, ikona size-3.5"
        sources={['src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx:41']}
      >
        <span className="inline-flex items-center gap-1">
          <Wrench className="size-3.5" />Z narzędziami (podwykonawca)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="relative inline-flex shrink-0">
            <Wrench className="size-3.5" />
            <Slash className="absolute inset-0" />
            <Slash className="absolute inset-0 -scale-x-100" />
          </span>
          Bez narzędzi (pracownik)
        </span>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="nagłówek etapu: gap-2, ikona domyślna + HeaderLabel"
        sources={['src/components/kosztorys/editor/grid/stage-header.tsx:107']}
      >
        <span className="flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-2">
            <Wrench />
            <HeaderLabel>Etap 1</HeaderLabel>
            <ChevronDown className="opacity-50" />
          </span>
        </span>
      </AuditVariant>
    </AuditGroup>
  )
}
