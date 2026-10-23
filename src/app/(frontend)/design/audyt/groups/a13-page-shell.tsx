import Link from 'next/link'
import { Settings } from 'lucide-react'
import { AuthLink } from '@/components/ui/auth-link'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'
import { BrandLogo } from '@/components/ui/brand-logo'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const LAYOUT_ROW = 'flex flex-col gap-0.5'
const LAYOUT_KEY = 'text-muted-foreground text-xs'
const LAYOUT_CODE = 'text-xs break-all'

function LayoutCard({ rows }: { rows: { name: string; value: string }[] }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {rows.map((row) => (
        <div key={row.name} className={LAYOUT_ROW}>
          <span className={LAYOUT_KEY}>{row.name}</span>
          <code className={LAYOUT_CODE}>{row.value}</code>
        </div>
      ))}
    </div>
  )
}

function SampleBrandedHeader() {
  return (
    <header className="border-border flex items-center gap-4 border-b px-4 py-3 sm:py-5">
      <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
      <div className="min-w-0 flex-1">
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm">
          <dt className="text-muted-foreground">Inwestycja</dt>
          <dd className="min-w-0 truncate">Mieszkanie Mokotów, ul. Puławska 12</dd>
          <dt className="text-muted-foreground">Pracownik</dt>
          <dd className="min-w-0 truncate">Jan Kowalski</dd>
        </dl>
      </div>
      <div className="shrink-0 self-start">
        <span className="text-muted-foreground text-xs">[przełącznik języka]</span>
      </div>
    </header>
  )
}

export function A13PageShellGroup() {
  return (
    <AuditGroup
      id="A13"
      title="Powłoka stron publicznych i logowania"
      count="35 wystąpień w 17 plikach · 12 wersji"
      drift={[
        'Nagłówek z logo: `px-4 py-3 sm:py-5` vs `sm:px-5`; `border-border border-b` vs samo `border-b`; flex z `gap-4`, flex-wrap z `gap-x-4 gap-y-1` albo bez flexa (not-found); logo z `shrink-0` lub bez.',
        'Treść strony udostępnianej: `flex flex-col gap-4 px-4 py-10 text-sm` vs `<p className="px-4 py-10 text-sm">` vs `flex flex-col items-start gap-4 px-4 py-10` (bez text-sm).',
        'Layouty `<html>/<body>`: `overscroll-none` raz na html, raz na body; `scroll-smooth` tylko w (frontend) i (auth); `enableSystem` false vs true; (legal) bez fontu, tokenów kolorów i `antialiased`; `ToastContainer` z `zIndex: 10001` skopiowany dwa razy.',
        'Formularz logowania: `className={`text-base`}` (template literal) vs `"text-base"`; w logowaniu stan sukcesu zmienia tekst przycisku, w pozostałych podmienia formularz na `AuthSuccessCard`.',
        'Typografia stron prawnych jest identyczna w każdej kopii — różnicy nie ma, jest tylko powielony ciąg klas.',
        '`global-error.tsx` renderuje surowe `<h2>` i `<button>` bez żadnego CSS, a siostrzany `(frontend)/error.tsx` używa `EmptyState` + `Button variant="outline"`.',
      ]}
      proposal={
        <>
          <code>SharePageShell header body</code> + <code>BrandBar meta actions</code> dla stron
          udostępnianych, <code>RootDocument</code> trzymający klasy html/body i{' '}
          <code>ToastContainer</code>, <code>AuthForm</code> (guard, błąd, przycisk); typografię
          prawną przenieść do <code>(legal)/layout.tsx</code>, a <code>global-error</code> oprzeć na{' '}
          <code>EmptyState</code> + <code>Button</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="typografia stron prawnych: h1, h2, link wewnętrzny i mailto (identyczne kopie)"
        sources={[
          'src/app/(legal)/privacy/page.tsx:6',
          'src/app/(legal)/terms/page.tsx:6',
          'src/app/(legal)/usuwanie-danych/page.tsx:6',
          'src/app/(legal)/privacy/page.tsx:13',
          'src/app/(legal)/privacy/page.tsx:19',
          'src/app/(legal)/privacy/page.tsx:26',
          'src/app/(legal)/privacy/page.tsx:32',
          'src/app/(legal)/privacy/page.tsx:42',
          'src/app/(legal)/terms/page.tsx:13',
          'src/app/(legal)/terms/page.tsx:19',
          'src/app/(legal)/terms/page.tsx:29',
          'src/app/(legal)/usuwanie-danych/page.tsx:13',
          'src/app/(legal)/privacy/page.tsx:36',
          'src/app/(legal)/terms/page.tsx:23',
          'src/app/(legal)/usuwanie-danych/page.tsx:25',
          'src/app/(legal)/privacy/page.tsx:45',
          'src/app/(legal)/terms/page.tsx:32',
          'src/app/(legal)/usuwanie-danych/page.tsx:16',
        ]}
      >
        <div className="max-w-2xl leading-relaxed">
          <h1 className="mb-6 text-2xl font-semibold">Polityka prywatności</h1>
          <h2 className="mt-8 mb-2 text-lg font-semibold">Twoje prawa</h2>
          <p className="mb-4">
            Aby usunąć swoje dane, zapoznaj się z instrukcją na stronie{' '}
            <Link className="underline" href="/usuwanie-danych">
              Usuwanie danych
            </Link>
            .
          </p>
          <h2 className="mt-8 mb-2 text-lg font-semibold">Kontakt</h2>
          <p>
            Napisz na adres:{' '}
            <a className="underline" href="mailto:kontakt@wykonczymy.pl">
              kontakt@wykonczymy.pl
            </a>
            .
          </p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="strona udostępniana — komunikat: main + BrandedHeader + <p> (bez min-h-dvh w podglądzie, przycisk wstecz i przełącznik języka pominięte)"
        sources={[
          'src/components/kosztorys/worker-report/worker-report-view.tsx:16',
          'src/components/kosztorys/worker-report/branded-header.tsx:18',
          'src/components/kosztorys/worker-report/report-notice.tsx:8',
        ]}
      >
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          <SampleBrandedHeader />
          <p className="px-4 py-10 text-sm">Ten link wygasł. Poproś kierownika o nowy.</p>
        </main>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="strona udostępniana — not-found: własna kopia nagłówka (bez flexa, logo bez shrink-0), treść z text-sm (bez min-h-dvh w podglądzie)"
        sources={[
          'src/app/(share)/z/not-found.tsx:7',
          'src/app/(share)/z/not-found.tsx:8',
          'src/app/(share)/z/not-found.tsx:11',
        ]}
      >
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          <header className="border-border border-b px-4 py-3 sm:py-5">
            <BrandLogo height={54} priority className="max-sm:h-11" />
          </header>
          <div className="flex flex-col gap-4 px-4 py-10 text-sm">
            <p lang="pl">Nie znaleziono raportu. Sprawdź link od kierownika.</p>
            <p lang="uk">Звіт не знайдено. Перевірте посилання від керівника.</p>
          </div>
        </main>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="strona udostępniana — „wysłano”: main + BrandedHeader + treść items-start bez text-sm (bez min-h-dvh w podglądzie)"
        sources={[
          'src/components/kosztorys/worker-report/worker-report-form.tsx:45',
          'src/components/kosztorys/worker-report/worker-report-form.tsx:47',
        ]}
      >
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          <SampleBrandedHeader />
          <div className="flex flex-col items-start gap-4 px-4 py-10">
            <h2 className={SECTION_TITLE_CLASS}>Raport wysłany</h2>
            <Description withIcon={false}>Wysłano 3 pozycje do kierownika.</Description>
            <Button variant="outline">Nowy raport</Button>
          </div>
        </main>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label='formularz auth: guard pending + flex-col gap-4 + błąd + AuthSubmitButton, input className="text-base" (field.Input bez kontekstu formularza — odtworzony z Field + Input)'
        sources={[
          'src/app/(auth)/zaloguj/zapomniane-haslo/forgot-password-form.tsx:40',
          'src/app/(auth)/zaloguj/reset-hasla/reset-password-form.tsx:69',
        ]}
      >
        <form className="flex w-full max-w-sm flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="a13-forgot-email">Email</FieldLabel>
            <Input id="a13-forgot-email" type="email" autoComplete="email" className="text-base" />
          </Field>
          <Description tone="error">Nie udało się wysłać linku.</Description>
          <AuthSubmitButton isPending={false} idleText="Wyślij link" pendingText="Wysyłanie..." />
        </form>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="PreviewHeader: flex-wrap gap-x-4 gap-y-1, dodatkowe sm:px-5, samo border-b, h1 z nazwą inwestycji (akcje odtworzone przyciskiem Opcje)"
        sources={['src/components/kosztorys/editor/preview-header-actions.tsx:35']}
      >
        <header className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5 sm:py-5">
          <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-medium max-sm:line-clamp-2 sm:truncate">
              Mieszkanie Mokotów, ul. Puławska 12
            </h1>
            <p className="truncate text-sm font-medium">Jan Kowalski</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 max-sm:order-last max-sm:grid max-sm:w-full max-sm:auto-cols-fr max-sm:grid-flow-col">
            <Button size="lg" variant="outline">
              <Settings />
              Opcje
            </Button>
          </div>
        </header>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="formularz logowania: to samo co e, ale className={`text-base`} (template literal), stan sukcesu w przycisku i link pod przyciskiem"
        sources={['src/app/(auth)/zaloguj/login-form.tsx:40']}
      >
        <form className="flex w-full max-w-sm flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="a13-login-email">Email</FieldLabel>
            <Input id="a13-login-email" type="email" autoComplete="email" className={`text-base`} />
          </Field>
          <Field>
            <FieldLabel htmlFor="a13-login-password">Hasło</FieldLabel>
            <Input
              id="a13-login-password"
              type="password"
              autoComplete="current-password"
              className={`text-base`}
            />
          </Field>
          <Description tone="error">Nieprawidłowy e-mail lub hasło.</Description>
          <AuthSubmitButton
            isPending={false}
            isSuccess
            idleText="Zaloguj"
            pendingText="Logowanie..."
            successText="Zalogowano"
          />
          <AuthLink href="/zaloguj/zapomniane-haslo">Nie pamiętasz hasła?</AuthLink>
        </form>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="layout (frontend) — nie da się wyrenderować <html>/<body>, pokazane ciągi klas"
        sources={['src/app/(frontend)/layout.tsx:49']}
      >
        <LayoutCard
          rows={[
            {
              name: '<html>',
              value: "cn(spaceMono.variable, 'overscroll-none antialiased') + style fontSize",
            },
            {
              name: '<body>',
              value: 'bg-background text-foreground relative min-h-screen scroll-smooth',
            },
            {
              name: 'ThemeProvider',
              value: 'attribute="class" defaultTheme="light" enableSystem={false}',
            },
            { name: 'ToastContainer', value: 'style={{ zIndex: 10001 }}' },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="layout (auth) — overscroll-none na body, min-h-screen na main, enableSystem={true}; pokazane ciągi klas"
        sources={['src/app/(auth)/layout.tsx:17']}
      >
        <LayoutCard
          rows={[
            { name: '<html>', value: "cn(spaceMono.variable, 'antialiased')" },
            {
              name: '<body>',
              value: 'bg-background text-foreground relative overscroll-none scroll-smooth',
            },
            {
              name: 'ThemeProvider',
              value: 'attribute="class" defaultTheme="light" enableSystem={true}',
            },
            { name: '<main>', value: 'flex min-h-screen items-center justify-center' },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="layout (share) — bez ThemeProvider i scroll-smooth; pokazane ciągi klas"
        sources={['src/app/(share)/layout.tsx:16']}
      >
        <LayoutCard
          rows={[
            { name: '<html>', value: "cn(spaceMono.variable, 'overscroll-none antialiased')" },
            { name: '<body>', value: 'bg-background text-foreground relative min-h-screen' },
            { name: 'ToastContainer', value: 'style={{ zIndex: 10001 }}' },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="layout (legal) — bez fontu, tokenów kolorów i antialiased; pokazane ciągi klas"
        sources={['src/app/(legal)/layout.tsx:11']}
      >
        <LayoutCard
          rows={[
            { name: '<html>', value: 'lang="pl" (bez className)' },
            { name: '<body>', value: 'mx-auto max-w-2xl px-6 py-16 leading-relaxed' },
          ]}
        />
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="global-error: surowe <h2> i <button> (na żywo bez żadnego CSS — tu dostają style strony)"
        sources={['src/app/global-error.tsx:18']}
      >
        <div>
          <h2>Coś poszło nie tak!</h2>
          <button type="button">Spróbuj ponownie</button>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="W"
        label="wzorzec: (frontend)/error.tsx — EmptyState + Button outline"
        sources={['src/app/(frontend)/error.tsx:23']}
      >
        <EmptyState title="Coś poszło nie tak">
          <Button variant="outline">Spróbuj ponownie</Button>
        </EmptyState>
      </AuditVariant>
    </AuditGroup>
  )
}
