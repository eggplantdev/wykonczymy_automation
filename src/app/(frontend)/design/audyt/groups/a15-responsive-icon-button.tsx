import Link from 'next/link'
import {
  ArrowLeftRight,
  Building2,
  LogOut,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const EXPANDED_SIDEBAR = 'flex w-64 max-w-full flex-col gap-2 px-3'
const COLLAPSED_SIDEBAR = 'flex w-14 flex-col gap-2 px-2'

export function A15ResponsiveIconButtonGroup() {
  return (
    <AuditGroup
      id="A15"
      title="Przycisk z etykietą chowaną na telefonie"
      count="13 wystąpień w 13 plikach · 11 wersji"
      drift={[
        'próg chowania etykiety: hidden lg:block (1280 px, poza jedynym progiem repo sm) w 3 przyciskach transakcji, max-sm:hidden albo max-sm:sr-only w pozostałych, a w pasku bocznym prop collapsed z {!collapsed && etykieta}',
        'aria-label tylko w części przycisków, które na telefonie zostają samą ikoną; etykieta „Wydatek ” z doklejoną spacją; „Kasa” dwa razy wokół ikony',
        'zwinięty pasek: px-0 w 5 przyciskach, a link nawigacji dodatkowo align center/start i własne klasy max-sm:',
        'aktywny stan: Kosz to active + border-primary/40 border shadow-sm, link nawigacji active bez ramki',
        'etykieta: goły tekst, span min-w-0 text-left albo dwa spany przełączane dark:; ikona size-3.5 w przycisku czyszczenia formularza',
      ]}
      proposal={
        <>
          Jeden <code>ResponsiveIconButton</code> w <code>ui/</code> (props: <code>icon</code>,{' '}
          <code>label</code>, <code>labelHidden?: &apos;mobile&apos; | boolean</code>, reszta
          propsów <code>Button</code>) — etykieta <code>max-sm:sr-only</code> albo ukryta przy{' '}
          <code>collapsed</code>, <code>aria-label</code> zawsze, zwinięcie zawsze <code>px-0</code>
          ; pasek boczny używa go jako <code>SidebarButton</code> z <code>active?</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="pasek boczny, rozwinięty: outline sm + ikona + goły tekst (kontener szerokości paska)"
        sources={[
          'src/components/nav/logout-button.tsx:28',
          'src/components/nav/refresh-data-button.tsx:24',
          'src/components/company-knowledge/company-knowledge-button.tsx:21',
          'src/components/pwa/push-toggle.tsx:70',
          'src/components/nav/admin-button.tsx:21',
          'src/components/nav/theme-toggle.tsx:18',
        ]}
      >
        <div className={EXPANDED_SIDEBAR}>
          <Button variant="outline" size="sm" aria-label="Odśwież dane">
            <RefreshCw />
            Odśwież dane
          </Button>
          <Button variant="outline" size="sm" aria-label="Wyloguj">
            <LogOut />
            Wyloguj
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="pasek boczny, zwinięty: outline sm px-0, sama ikona (kontener w-14 px-2)"
        sources={[
          'src/components/nav/logout-button.tsx:28',
          'src/components/nav/refresh-data-button.tsx:24',
          'src/components/nav/admin-button.tsx:21',
          'src/components/nav/theme-toggle.tsx:18',
        ]}
      >
        <div className={COLLAPSED_SIDEBAR}>
          <Button variant="outline" size="sm" className="px-0" aria-label="Odśwież dane">
            <RefreshCw />
          </Button>
          <Button variant="outline" size="sm" className="px-0" aria-label="Wyloguj">
            <LogOut />
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="greenOutline sm, etykieta hidden lg:block, bez aria-label"
        sources={['src/components/dialogs/deposit-dialog.tsx:18']}
      >
        <Button variant="greenOutline" size="sm">
          <Plus />
          <span className="hidden lg:block">Wpłata</span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="destructiveOutline sm, etykieta hidden lg:block, z aria-label i spacją na końcu etykiety"
        sources={['src/components/dialogs/expense-dialog.tsx:19']}
      >
        <Button variant="destructiveOutline" size="sm" aria-label="Wydatek">
          <Rocket />
          <span className="hidden lg:block">Wydatek </span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="turquoiseOutline sm, dwie etykiety hidden lg:block wokół ikony, bez aria-label"
        sources={['src/components/dialogs/internal-transfer-dialog.tsx:18']}
      >
        <Button variant="turquoiseOutline" size="sm">
          <span className="hidden lg:block">Kasa</span>
          <ArrowLeftRight />
          <span className="hidden lg:block">Kasa</span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="blueOutline sm, max-sm:hidden + ręczne max-sm:size-9 p-0, ikona size-3.5 (pozycjonowany absolutnie — tu w kontenerze relative)"
        sources={['src/components/forms/form-components/form-clear-button.tsx:10']}
      >
        <div className="relative h-16">
          <Button
            type="button"
            variant="blueOutline"
            size="sm"
            className="absolute top-4 right-14 z-10 max-sm:size-9 max-sm:p-0"
            aria-label="Wyczyść formularz"
          >
            <RotateCcw className="size-3.5" />
            <span className="max-sm:hidden">Wyczyść formularz</span>
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="g"
        label="outline lg, etykieta max-sm:sr-only, bez aria-label"
        sources={['src/components/kosztorys/worker-report/report-bar.tsx:34']}
      >
        <div className="flex">
          <Button size="lg" variant="outline" className="ml-auto shrink-0">
            <Settings />
            <span className="max-sm:sr-only">Opcje</span>
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="h"
        label="pasek boczny, rozwinięty: Kosz aktywny (active + border-primary/40 border shadow-sm); nieaktywny wygląda jak a"
        sources={['src/components/nav/trash-button.tsx:24']}
      >
        <div className={EXPANDED_SIDEBAR}>
          <Button variant="active" size="sm" className="border-primary/40 border shadow-sm" asChild>
            <Link href="#" aria-current="page">
              <Trash2 />
              Kosz
            </Link>
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="i"
        label="pasek boczny, zwinięty: Kosz aktywny px-0"
        sources={['src/components/nav/trash-button.tsx:24']}
      >
        <div className={COLLAPSED_SIDEBAR}>
          <Button
            variant="active"
            size="sm"
            className="border-primary/40 border px-0 shadow-sm"
            asChild
          >
            <Link href="#" aria-current="page">
              <Trash2 />
            </Link>
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="j"
        label="pasek boczny, rozwinięty: link nawigacji ghost / active, align start, etykieta w span min-w-0 text-left"
        sources={['src/components/nav/nav-link-item.tsx:25']}
      >
        <div className="flex w-64 max-w-full flex-col gap-1 px-3">
          <Button
            variant="active"
            size="sm"
            align="start"
            className="relative h-auto min-h-8 py-1.5 whitespace-normal max-sm:min-h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base"
            asChild
          >
            <Link href="#" aria-current="page">
              <Building2 className="size-4 max-sm:size-6" />
              <span className="min-w-0 text-left">Inwestycje</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            align="start"
            className="relative h-auto min-h-8 py-1.5 whitespace-normal max-sm:min-h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base"
            asChild
          >
            <Link href="#">
              <Wallet className="size-4 max-sm:size-6" />
              <span className="min-w-0 text-left">Kasy</span>
            </Link>
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="k"
        label="pasek boczny, zwinięty: link nawigacji px-0, align center"
        sources={['src/components/nav/nav-link-item.tsx:25']}
      >
        <div className="flex w-14 flex-col gap-1 px-2">
          <Button
            variant="active"
            size="sm"
            align="center"
            className="relative px-0 max-sm:min-h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base"
            asChild
          >
            <Link href="#" aria-current="page">
              <Building2 className="size-4 max-sm:size-6" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            align="center"
            className="relative px-0 max-sm:min-h-10 max-sm:gap-3 max-sm:px-4 max-sm:text-base"
            asChild
          >
            <Link href="#">
              <Wallet className="size-4 max-sm:size-6" />
            </Link>
          </Button>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
