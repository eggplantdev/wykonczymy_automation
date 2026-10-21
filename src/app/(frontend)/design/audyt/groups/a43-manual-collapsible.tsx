import Link from 'next/link'
import { ChevronDown, ChevronRight, GripVertical, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import * as Collapsible from '@/components/ui/collapsible'
import { Description } from '@/components/ui/description'
import { EYEBROW_CLASS } from '@/components/ui/section-header'
import { TextButton, TextLink } from '@/components/ui/text-link'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

function SampleTable() {
  return (
    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
      [tabela]
    </div>
  )
}

function SampleReorderSection({
  name,
  count,
  isCollapsed,
}: {
  name: string
  count: number
  isCollapsed: boolean
}) {
  return (
    <div className="bg-muted shadow-section-rail sticky top-0 z-1 flex cursor-grab items-center gap-2 border-b px-2 py-1.5 text-sm font-medium">
      <GripVertical className="text-muted-foreground size-4 shrink-0" />
      <Checkbox checked={false} />
      <Button
        variant="ghost"
        size="inline"
        align="start"
        aria-expanded={!isCollapsed}
        className="min-w-0 flex-1 gap-1 text-left hover:bg-transparent"
      >
        {isCollapsed ? (
          <ChevronRight className="size-4 shrink-0" />
        ) : (
          <ChevronDown className="size-4 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </Button>
      <span className="text-muted-foreground w-8 text-right text-xs font-normal">{count}</span>
    </div>
  )
}

export function A43ManualCollapsibleGroup() {
  return (
    <AuditGroup
      id="A43"
      title="Ręcznie zwijany wiersz"
      count="6 wystąpień w 6 plikach · 6 wersji"
      drift={[
        'Wyzwalacz: Collapsible.Trigger (3×) vs TextButton z aria-expanded i własnym Set w stanie vs Button ghost size="inline" vs <div role="button"> z onKeyDown.',
        'Strzałka: Collapsible.Chevron (obrót ChevronDown) vs podmiana ChevronRight ↔ ChevronDown; rozmiar size-4 vs size-3.5 (+ mt-1 przy wyrównaniu do góry).',
        'Pozycja strzałki: przed etykietą (5×) vs za etykietą i licznikami (pasek sekcji w siatce kosztorysu).',
        'Kolor strzałki: text-muted-foreground vs dziedziczony vs ton przekazany propem (text-warning / text-muted-foreground) razem z etykietą.',
        'Odstępy: gap-2 py-1 vs gap-1 vs gap-1 items-start vs gap-2 px-2; treść pt-2 vs mt-1 vs pl-4.5 vs wiersze renderowane warunkowo bez Collapsible.Content (brak animacji).',
      ]}
      proposal={
        <>
          <code>CollapsibleRow</code> w <code>ui/</code> (Root + Trigger + Chevron + Content) z
          propami <code>label</code>, <code>size: &apos;sm&apos; | &apos;xs&apos;</code> (size-4 /
          size-3.5), <code>tone</code>, <code>chevron: &apos;start&apos; | &apos;end&apos;</code> i{' '}
          <code>leading</code>/<code>action</code>; dialogi przeglądu i kolejności przechodzą z
          ręcznego aria-expanded na niego.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="pozycja wydatku: Collapsible.Trigger gap-2 py-1, Chevron size-4 muted przed tytułem, Badge statusu, treść w fieldset pt-2 (rozpatrzona: opacity-60 + line-through)"
        sources={['src/components/forms/expense-form/collapsible-line-item.tsx:39']}
      >
        <div className="flex w-full flex-col gap-2">
          <Collapsible.Root open>
            <div className="flex items-center gap-2">
              <Checkbox aria-label="Zaznacz pozycję 1" checked={false} />
              <Collapsible.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left">
                <Collapsible.Chevron open className="text-muted-foreground size-4" />
                <span className="min-w-0 truncate text-sm font-medium">1. Klej do płytek C2TE</span>
                <Badge tone="pending" className="shrink-0">
                  Do sprawdzenia
                </Badge>
              </Collapsible.Trigger>
            </div>
            <Collapsible.Content>
              <fieldset className="min-w-0 pt-2">
                <SampleTable />
              </fieldset>
            </Collapsible.Content>
          </Collapsible.Root>
          <Collapsible.Root open={false}>
            <div className="flex items-center gap-2 opacity-60">
              <Collapsible.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left">
                <Collapsible.Chevron open={false} className="text-muted-foreground size-4" />
                <span className="min-w-0 truncate text-sm font-medium line-through">
                  2. Fuga szara
                </span>
                <Badge tone="negative" className="shrink-0">
                  Odrzucony
                </Badge>
              </Collapsible.Trigger>
            </div>
          </Collapsible.Root>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="baner wersji historycznej: Collapsible.Trigger gap-1 font-medium, Chevron size-4 bez koloru, treść mt-1 max-h-64 overflow-auto"
        sources={['src/components/kosztorys/editor/history/history-banner.tsx:44']}
      >
        <div
          role="status"
          className="bg-muted/50 border-border flex w-full shrink-0 flex-col gap-1 border-b px-4 py-2 text-sm sm:px-5"
        >
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <History className="size-4 shrink-0" aria-hidden />
            <span className="font-medium">Wersja z 20.10.2026</span>
            <span className="text-muted-foreground">— porównanie z bieżącą ·</span>
            <TextLink asChild className="font-medium">
              <Link href="/design/audyt">Wróć do bieżącej</Link>
            </TextLink>
          </p>
          <Collapsible.Root open>
            <Collapsible.Trigger className="flex cursor-pointer items-center gap-1 font-medium">
              <Collapsible.Chevron open className="size-4" />3 różnice względem bieżącej
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-1 max-h-64 overflow-auto">
              <SampleTable />
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="ReportFold w raporcie arkusza: items-start gap-1, Chevron mt-1 size-3.5 w kolorze etykiety (tone text-warning / text-muted-foreground), treść pl-4.5"
        sources={['src/components/kosztorys/editor/dialogs/report/sheet-report-parts.tsx:158']}
      >
        <div className="flex w-full flex-col gap-2 text-sm">
          <Collapsible.Root open={false} className="space-y-0.5">
            <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
              <Collapsible.Chevron open={false} className={cn('mt-1 size-3.5', 'text-warning')} />
              <span className="text-warning">Stawki inne niż w cenniku (4) — zobacz które</span>
            </Collapsible.Trigger>
          </Collapsible.Root>
          <Collapsible.Root open className="space-y-0.5">
            <Collapsible.Trigger className="flex w-full cursor-pointer items-start gap-1 text-left">
              <Collapsible.Chevron open className={cn('mt-1 size-3.5', 'text-muted-foreground')} />
              <span className="text-muted-foreground">
                Stawki z jednego cennika (2) — druga zakładka nie ma tej pracy
              </span>
            </Collapsible.Trigger>
            <Collapsible.Content className="space-y-0.5 pl-4.5">
              <SampleTable />
            </Collapsible.Content>
          </Collapsible.Root>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="grupa w przeglądzie zgłoszenia: h4 EYEBROW + TextButton aria-expanded (flex uppercase), Chevron size-3.5 za etykietą, hint xs; wiersze ukrywane warunkowo"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:406',
        ]}
      >
        <section className="w-full">
          <h4 className={EYEBROW_CLASS}>
            <TextButton aria-expanded className="flex uppercase">
              Do decyzji (3 z 5)
              <Collapsible.Chevron open className="size-3.5" />
            </TextButton>
          </h4>
          <Description withIcon={false} size="xs">
            Pozycje, które czekają na przyjęcie lub odrzucenie.
          </Description>
          <SampleTable />
        </section>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="sekcja w dialogu kolejności: Button ghost size=inline z aria-expanded, podmiana ChevronRight ↔ ChevronDown size-4, gap-1; pozycje renderowane warunkowo"
        sources={['src/components/kosztorys/editor/dialogs/reorder/reorder-dialog.tsx:280']}
      >
        <div className="w-full rounded-md border">
          <SampleReorderSection name="Łazienka" count={12} isCollapsed={false} />
          <div className="border-b px-8 py-1.5 text-sm">Skucie płytek</div>
          <SampleReorderSection name="Kuchnia" count={7} isCollapsed />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="pasek sekcji w siatce kosztorysu: <div role=button> z onKeyDown, podmiana ChevronRight ↔ ChevronDown size-4 muted ZA etykietą i licznikami"
        sources={['src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:109']}
      >
        <div className="border-border h-9 w-full overflow-hidden border">
          <div
            role="button"
            tabIndex={0}
            aria-expanded
            className="grid-band-text hover:bg-accent/50 flex h-full w-max cursor-pointer items-center gap-2 px-2 font-semibold"
          >
            <span className="bg-section-rail size-2.5 shrink-0 rounded-full" />
            <span className="shrink-0 whitespace-nowrap">Łazienka</span>
            <span className="text-muted-foreground grid-cell-text shrink-0 font-normal">
              (12 poz.)
            </span>
            <span className="grid-cell-text shrink-0 whitespace-nowrap">
              <span className="font-medium tabular-nums">12 345,67 zł</span>
              <span className="text-muted-foreground font-normal"> netto</span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </div>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
