import { Check, CheckIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const IS_ALL_SELECTED = false

const TEMPLATES = [
  { name: 'Mieszkanie 50 m2', sections: 6, selected: 2, isActive: true },
  { name: 'Łazienka standard', sections: 3, selected: 0, isActive: false },
]

const SECTIONS = [
  { name: 'Łazienka', items: 24, isSelected: true },
  { name: 'Kuchnia', items: 18, isSelected: false },
]

const STATUSES = [
  { label: 'W realizacji', isSelected: true },
  { label: 'Zakończona', isSelected: false },
]

export function A18ListRowOptionGroup() {
  return (
    <AuditGroup
      id="A18"
      title="Wiersz wyboru na liście"
      count="7 wystąpień w 4 plikach · 7 wersji"
      drift={[
        'Sygnał wyboru: ptaszek z opacity + aria-pressed vs tło bg-accent + aria-current vs oba naraz.',
        'Etykieta: flex-1 truncate vs min-w-0 flex-1 vs wyszarzona text-xs (wiersz „Zaznacz wszystkie”).',
        'Meta po prawej: text-muted-foreground text-xs vs text-muted-foreground tabular-nums bez text-xs, plus dodatkowy licznik text-primary.',
        'Lista raportów nadpisuje przycisk (hover:bg-muted/50 gap-3 py-2.5) i dokłada strzałkę; wiersz „wstecz” ma gap-1 border-b.',
        'Filtr statusów robi to samo w menu: DropdownMenuItem z ręcznym CheckIcon zamiast DropdownMenuCheckboxItem.',
      ]}
      proposal={
        <>
          <code>ListRowOption</code> na{' '}
          <code>Button variant=&quot;ghost&quot; size=&quot;listRow&quot;</code> (props:{' '}
          <code>label</code>, <code>meta?</code>, <code>selected?</code>, <code>showCheck?</code>,{' '}
          <code>trailing?</code>, <code>onClick</code>) z jednym sygnałem wyboru; w menu —
          istniejący <code>DropdownMenuCheckboxItem</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="szablon (dodaj sekcje): bg-accent + aria-current, licznik text-primary + meta text-xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:130',
        ]}
      >
        <div className="w-full">
          {TEMPLATES.map((template) => (
            <Button
              key={template.name}
              variant="ghost"
              size="listRow"
              align="start"
              aria-current={template.isActive}
              className={cn(template.isActive && 'bg-accent')}
            >
              <span className="flex-1 truncate">{template.name}</span>
              {template.selected > 0 && (
                <span className="text-primary text-xs font-medium">
                  {template.selected}/{template.sections}
                </span>
              )}
              <span className="text-muted-foreground text-xs">{template.sections} sekcji</span>
            </Button>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="sekcja (dodaj sekcje): ptaszek opacity + aria-pressed, meta text-xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:192',
        ]}
      >
        <div className="w-full">
          {SECTIONS.map((section) => (
            <Button
              key={section.name}
              variant="ghost"
              size="listRow"
              align="start"
              aria-pressed={section.isSelected}
            >
              <Check className={cn(section.isSelected ? 'opacity-100' : 'opacity-0')} />
              <span className="flex-1 truncate">{section.name}</span>
              <span className="text-muted-foreground text-xs">{section.items} poz.</span>
            </Button>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="szablon (wczytaj ponownie): ptaszek + bg-accent + aria-pressed, w BORDERED_LIST_CLASS"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:135',
        ]}
      >
        <div className={cn(BORDERED_LIST_CLASS, 'w-full')}>
          {TEMPLATES.map((template) => (
            <Button
              key={template.name}
              variant="ghost"
              size="listRow"
              align="start"
              aria-pressed={template.isActive}
              className={cn(template.isActive && 'bg-accent')}
            >
              <Check className={cn(template.isActive ? 'opacity-100' : 'opacity-0')} />
              <span className="flex-1 truncate">{template.name}</span>
              <span className="text-muted-foreground text-xs">
                {template.sections} sekcji · 86 pozycji
              </span>
            </Button>
          ))}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="„Zaznacz wszystkie”: ptaszek + wyszarzona etykieta text-xs, bez meta"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:176',
        ]}
      >
        <div className="w-full">
          <Button variant="ghost" size="listRow" align="start" aria-pressed={IS_ALL_SELECTED}>
            <Check className={cn(IS_ALL_SELECTED ? 'opacity-100' : 'opacity-0')} />
            <span className="text-muted-foreground flex-1 text-xs">Zaznacz wszystkie</span>
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="raport pracownika: nadpisany hover/gap/py, meta tabular-nums bez text-xs, badge + strzałka"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list.tsx:53',
        ]}
      >
        <ul className={cn(BORDERED_LIST_CLASS, 'w-full')}>
          <li>
            <Button
              variant="ghost"
              size="listRow"
              align="start"
              className="hover:bg-muted/50 gap-3 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">Jan Kowalski</span>
                <span className="text-muted-foreground">
                  {' · do: '}
                  Etap 2
                </span>
              </span>
              <span className="text-muted-foreground tabular-nums">5 prac</span>
              <Badge tone="pending">Oczekuje</Badge>
              <ChevronRight className="text-muted-foreground size-4" />
            </Button>
          </li>
        </ul>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="wiersz „wstecz” do listy szablonów (w źródle sm:hidden — tu pokazany zawsze)"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx:162',
        ]}
      >
        <div className="w-full">
          <Button variant="ghost" size="listRow" align="start" className="gap-1 border-b">
            <ChevronLeft />
            <span className="truncate">Mieszkanie 50 m2</span>
          </Button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="pozycja filtra statusów: treść DropdownMenuItem (ręczny CheckIcon) pokazana bez menu"
        sources={['src/components/investments/status-filter.tsx:65']}
      >
        <div className="flex flex-col gap-1 text-sm">
          {STATUSES.map((status) => (
            <span key={status.label} className="flex items-center gap-2">
              <CheckIcon className={cn(!status.isSelected && 'opacity-0')} />
              {status.label}
            </span>
          ))}
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
