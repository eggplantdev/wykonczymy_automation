# Efekty wychodzące a izolacja środowisk

Każda baza nieprodukcyjna to **przywrócony zrzut produkcji**, więc localhost, preview i `db-test`
niosą prawdziwe identyfikatory arkuszy, prawdziwe adresy pracowników i prawdziwe leady. Sprawdzenie
środowiska w kodzie tego nie zatrzyma, bo maszyna deweloperska trzyma sekrety produkcji — flaga jest
tak mocna jak maszyna, która ją liczy. **Bramką jest zawsze poświadczenie:** odmawia dostawca, nie
nasz kod.

Ustalone 2026-08-26/27 przy zmianie `sheet-write-env-guard`; źródło pierwotne (z błędami poprawionymi
niżej) to `context/archive/*-sheet-write-env-guard/research.md`.

## Stan bramek

| efekt         | bramka                  | jak działa                                                                                          |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| Vercel Blob   | **jest**                | token niesie w sobie id store'a; `blobTokenRefusal` (`src/lib/env/schema.ts`) odmawia w obie strony |
| Google Sheets | **jest**                | dwa konta usługi — poza produkcją aplikacja ma tylko Przeglądającego, zapis odrzuca Google (`403`)  |
| Poczta SMTP   | **jest**                | `EMAIL_HOST` poza produkcją wskazuje na `disabled.invalid` — wysyłka pada na DNS                    |
| OpenRouter    | brak — **świadomie**    | patrz niżej                                                                                         |
| Meta Graph    | brak — **niepotrzebna** | patrz niżej                                                                                         |
| crony         | brak — **niepotrzebna** | patrz niżej                                                                                         |

## Poczta

Jedno firmowe konto SMTP obsługiwało wszystkie środowiska. Aplikacja jest **klientem** SMTP —
loguje się do `wykonczymy.com.pl` i to ten serwer wysyła, więc IP laptopa nigdy nie jest nadawcą.
SPF (`redirect=_spf-h50.microhost.pl`) i DMARC (`p=quarantine; adkim=s`) przechodzą, bo mail
naprawdę wychodzi z autoryzowanej infrastruktury. **Mail z localhosta był nie do odróżnienia od
produkcyjnego** — trafiał do skrzynki odbiorczej, nie do spamu.

Bramka: `EMAIL_HOST` = `disabled.invalid` w `.env`, Vercel Preview i Vercel Development; prawdziwy
host **wyłącznie** w Production. `.invalid` to zarezerwowany TLD (RFC 2606), więc nigdy się nie
rozwiąże. Pusta wartość nie zadziała — `serverEnv` wymaga `.min(1)`. Prawdziwy host stoi
zakomentowany tuż nad aktywną linią w `.env`; do pracy nad szablonami maila podmienia się go ręcznie.
`EMAIL_USER` / `EMAIL_PASS` zostają wspólne — bez hosta nie mają dokąd się połączyć.

**Listy odbiorców żyją w bazie, nie w env.** Global Payloada `notification-recipients`
(`src/globals/notification-recipients.ts`), czytany przez `src/lib/email/recipients.ts`. Konsekwencja:
po każdym `db:import` każde środowisko ma prawdziwe adresy prawdziwych pracowników, a
`requireRecipients` (rzuca na pustej liście) nigdy nie zadziała jako ochrona. Stare
`LEADS_NOTIFY_EMAIL` / `LEADS_ALERT_EMAIL` / `FLEET_NOTIFICATION_EMAIL` siedzą jeszcze w `.env`, ale
są **martwe** — nie ma ich ani w `serverSchema`, ani w żadnym pliku `src/`.

### Co dokąd wysyła

Do **klienta** wychodzi jedna ścieżka: `sendAutoReply` („Dziękujemy za kontakt") na `lead.email`,
wołana z `captureLead` z domyślnym `autoReply: 'send'`. Jedyni wołający z tym domyślnym to dwa
webhooki — `/api/webhooks/facebook-leads` i `/api/webhooks/wpforms`. To ruch **przychodzący**,
trafia tam, gdzie wskazuje `callback_url` u Mety i w WPForms, czyli na produkcję.

**`runLeadReconcileSweep` autorespondera NIE wysyła** — przekazuje jawnie `autoReply: 'skip'`
(`src/lib/leads/reconcile-sweep.ts`, uzasadnienie EX-660: „Backfill is silent to the CUSTOMER, never
to sales"). Sweep ma dziś jednego wołającego — cron `/api/cron/leads-reconcile`; ręczny przycisk
„Pobierz z Facebooka" wraz z akcją `reconcileLeads` został usunięty (nie miał wyzwalacza: pusta
tabela wygląda tak samo jak brak zgłoszeń, a cron i tak alarmuje, gdy coś odzyskał). Do sprzedaży
idzie z niego samo `notifyNewLead` — hałas wewnętrzny, nie kontakt z klientem.

Jedyna droga autorespondera do klienta spoza produkcji to **przestawienie `callback_url` webhooka na
tunel dewelopera** — zdarzyło się raz (ngrok, `context/foundation/lessons.md`). Akt świadomy, nie
wypadek.

Reszta ścieżek pisze do pracowników: `notifyNewLead`, `notifyShapeAlert`, `notifyReconcileRecovery` /
`Failure` (`src/lib/leads/notify.ts`), `notifyFleetDigest` (`src/lib/fleet/notify.ts` — **już wyszedł
raz z localhosta**), reset hasła (`src/collections/users.ts` ← `src/lib/actions/auth.ts`) oraz
`/api/test-email?to=` (ADMIN-only, świadome narzędzie).

## OpenRouter — świadomie bez bramki

Szkodą są **pieniądze, zakapowane limitem wydatków** na koncie, czyli pozycja w budżecie, nie
incydent. Do OpenRoutera lecą własne faktury firmy — nie ma wycieku danych, którego nie byłoby
z produkcji. A bez klucza w środowisku deweloperskim nie da się rozwijać skanowania paragonów
(`POST /api/extract-receipt`). Odwrotnie niż przy arkuszach, gdzie szkoda była nieodwracalna,
nielimitowana i niewidoczna.

**Nie zakładać tu bramki** i nie zgłaszać tego ponownie jako dziury.

## Meta Graph — bramka niepotrzebna

W repo **nie ma ani jednego zapisu** do Graph API, wyłącznie GET-y (`fetch-lead.ts`,
`fetch-recent-leads.ts`, `fetch-form-questions.ts`). Po stronie Facebooka szkody wyrządzić nie można.
Efekt uboczny sweepa poza produkcją — prawdziwe leady lądują w bazie deweloperskiej — jest tym samym,
co robi `db:import`, czyli warunkiem już zaakceptowanym, nie nowym problemem.

## Crony — bramka niepotrzebna

`vercel.json` deklaruje trzy harmonogramy, a Vercel odpala crony **wyłącznie na deploymentach
produkcyjnych**. Poza produkcją nie zadziała żaden. Zostaje ręczny `curl` ze wspólnym `CRON_SECRET`,
ale to akt świadomy, a i tak: `cleanup` sprząta własną bazę (nieszkodliwe), a `leads-reconcile`
i `fleet-reminders` sprowadzają się do wysyłki maila — czyli do bramki, która już stoi.

## Porzucona ścieżka: bramka na fladze

Pierwsza wersja bramki arkuszowej była predykatem `sheetWriteRefusal(VERCEL_ENV, spreadsheetId,
allowlist)` — poza produkcją klient zapisowy powstawał wyłącznie dla arkusza wpisanego na
`GOOGLE_SHEETS_WRITE_ALLOWLIST`. Wdrożona i skasowana w tej samej zmianie (`d09c59c9` … `3b8f3bfd`).
Padła, bo ta maszyna trzyma sekrety produkcji, więc **żadne sprawdzenie środowiska nie odróżni
produkcji od developera, który ustawił zmienne**. Bramka w poświadczeniu jest egzekwowana przez
Google, poza maszyną, i nie da się jej przegadać.

Kolejność podmiany wynikała z tego samego rachunku: dotychczasowe konto **zostało** piszącym (było
już Edytorem na wszystkich 56 arkuszach, więc zero ponownego udostępniania i ani chwili, w której
produkcja traci zapis), a nowe, czytające, dostało wyłącznie addytywne nadania Przeglądającego.

## Zasada

Nowy efekt wychodzący dostaje bramkę wtedy i tylko wtedy, gdy szkoda jest **nieodwracalna albo
dotyka osoby z zewnątrz**. Koszt zamknięty limitem, zapis do własnej bazy nieprodukcyjnej i odczyt
z cudzego API — nie kwalifikują się. Bramka zawsze siedzi w poświadczeniu, nigdy we fladze.
