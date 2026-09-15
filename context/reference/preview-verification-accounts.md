# Konta do weryfikacji manualnej na stagingu (preview DB)

Ręczna weryfikacja slice'a często potrzebuje **dwóch ról naraz** — czegoś, czego nie da się zrobić
jednym kontem, a czego nie chcemy robić kontem prawdziwego pracownika (preview DB to przywrócony
dump produkcji, więc wszystkie konta w niej to realni ludzie). Stąd para kont technicznych, która
zostaje w preview DB na stałe:

| e-mail                                 | rola      | hasło                  |
| -------------------------------------- | --------- | ---------------------- |
| `verify-owner-ex748@wykonczymy.test`   | `OWNER`   | `Ex748-verify-preview` |
| `verify-manager-ex748@wykonczymy.test` | `MANAGER` | `Ex748-verify-preview` |

Nazwa niesie EX-748, bo tam powstały; **nie są związane z tym slice'em** — to ogólna para do
przeklikiwania uprawnień. Domena `.test` jest zarezerwowana (RFC 2606), więc żaden mail nigdy do
nikogo nie wyjdzie.

**Gdzie żyją i gdzie nie.** Tylko w **preview** DB (`DB_POSTGRES_URL_PREVIEW`). Nie ma ich na
produkcji i nie wolno ich tam zakładać. `pnpm db:import` / `db:import:test` odtwarzają lokalną i
testową bazę z dumpu **produkcji**, więc tam ich też nie będzie — i dobrze, lokalnie jest
`src/scripts/seed-e2e-user.ts`, który celowo odmawia pracy na zdalnym hoście (`assertLocalDb`).

**Hasło jest jawne świadomie.** Konta są bezwartościowe: preview DB bywa nadpisywana świeżym dumpem,
a wtedy oba konta znikają. Odtwarza się je skryptem jednorazowym (`payload.create`/`update` z
`overrideAccess`), uruchomionym z `DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW"` — nie ma dla nich
skryptu w repo, bo commit hasła do `src/scripts/` jest dokładnie tym, czemu `assertLocalDb`
zapobiega po stronie lokalnej.

**Staging chowa się za Vercel SSO**, więc do przeklikania potrzeba przeglądarki z sesją vercel.com —
`curl` dostanie stronę logowania, nie aplikację.

---

# Realia środowiska weryfikacyjnego

Zdestylowane z `context/foundation/manual-checks.md` przy jego przycięciu 2026-09-15 (pełny rejestr:
`context/archive/manual-checks/2026-09-15-pelny-rejestr.md`). To są rzeczy, na które kolejny
weryfikator straci godzinę, jeśli ich nie przeczyta.

## Stałe blokady — czego na stagingu zweryfikować się NIE DA

Cztery powody trzymają praktycznie każdy niezaznaczony boks w rejestrze. Żaden nie jest defektem i
żadnego nie usunie kolejne podejście:

1. **`/raporty` jest wyłączone** do czasu EX-598 — `src/app/(frontend)/raporty/page.tsx` renderuje
   bezwarunkowy `EmptyState` „W budowie". Każdy boks mówiący „sprawdź na raportach" jest tym zablokowany.
2. **Poczta nie wychodzi poza produkcją** (`EMAIL_HOST` = `disabled.invalid`, patrz AGENTS.md).
3. **Trasy cronowe stoją za Vercel Preview SSO** i dodatkowo wymagają `CRON_SECRET`.
4. **Nie ma dostępu do skrzynki odbiorczej**, więc „czy mail dotarł i jak wygląda" jest poza zasięgiem.

Boks zablokowany którymś z powyższych zostawia się **niezaznaczony z podanym powodem** — nie zaznacza
się go „bo kod wygląda dobrze" i nie kasuje.

## Techniki

**Cron przez SSO: `fetch()` z wnętrza sesji przeglądarki.** Gołe `curl` na trasę cronową dostaje
stronę logowania Vercela, a nie handler. Uruchom `fetch()` **w już zalogowanej sesji Playwright** —
ciasteczka same-origin przechodzą przez SSO i handler odpowiada naprawdę. (Powiązane:
`clearCookies()` w Playwright kasuje bypass SSO — czyść wyłącznie `payload-token`.)

**`500` z crona przypomnień to dowód, że wysyłka została osiągnięta.** Przy niepustym dygeście
wysyłka pada na DNS-ie `disabled.invalid` i handler oddaje **500**. To nie jest awaria do zgłoszenia:
to bramka pocztowa, a przy okazji dowód, że `stampNotified` słusznie NIE został wykonany (odbiorca
nic nie dostał, więc nie wolno stemplować jako powiadomionego). Pusty dygest odda 200 — więc 200 nie
mówi nic o wysyłce.

**Nie czyść pola przez `el.value = ''` + zdarzenie `input`.** React śledzi wartość kontrolowanego
inputa własnym trackerem; ustawienie `value` z zewnątrz go nie rusza, zdarzenie zostaje uznane za
brak zmiany i formularz **cicho zapisuje starą wartość**. Używaj `fill('')` Playwrighta.

**`FilterMultiSelect` ma odwrotną semantykę przy pustym filtrze.** `deriveSelected()` renderuje
wszystkie opcje jako zaznaczone, gdy nic nie jest wybrane — więc kliknięcie „zaznaczonej" opcji ją
**odznacza**. Dwa przebiegi weryfikacji dały się na to nabrać i zgłosiły nieistniejący defekt.

**Nigdy nie klikaj prawdziwego przycisku drukowania z Playwrighta.** `window.print()` zawiesza
zautomatyzowanego Chromium bezterminowo (zaobserwowane ~30 min bez powrotu).

**Zapchany dysk VM Dockera udaje zawieszoną bazę.** `No space left on device (os error 28)` wiesza
`docker ps` i **nowe** połączenia `psql` do 5435, podczas gdy już otwarty pool odpowiada normalnie —
więc objawem jest „baza działa, ale nie da się do niej podłączyć". Wolne miejsce na dysku hosta nie
jest sygnałem; liczy się dysk maszyny wirtualnej Docker Desktop.

**Fikstury preview są zmienne.** Inwestycje 135/136/137 pojawiają się i znikają przy kolejnych
reseedach — identyfikator z poprzedniego przebiegu weryfikacji nie jest stałą.
