---
change_id: worker-account
title: Konto pracownika — logowanie na własną stronę, jego kasy i linki do kosztorysów (EX-985)
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: konradantonik/ex-985-konto-pracownika-logowanie-na-wlasna-strone-jego-kasy-i
worktree: .claude/worktrees/ex-985-worker-account
---

## Notes

EX-985 — pracownik loguje się i ląduje na swojej stronie `/pracownicy/<id>` (tylko do odczytu):
jego kasy, transfery, sprzęt i lista kosztorysów z linkami do zgłaszania prac. Wydzielone
2026-10-05 z EX-971 (wydatki pracownika), które jest osobnym change'em
`2026-10-05-worker-expenses` i stoi na tym.

### Stan wyjściowy (sprawdzony 2026-10-05, lokalna kopia bazy)

- Konto `EMPLOYEE` istnieje i loguje się, ale tylko do podglądu: `(dashboard)/page.tsx`
  przekierowuje je na kasę typu `WORKER`, której jest właścicielem, a `/kasa/[id]` pokazuje mu
  wyłącznie jego kasy. Zapis jest zamknięty — `protectedAction` wpuszcza tylko `MANAGEMENT_ROLES`.
- Nikt nie zna hasła pracownika: `createWorker` (`lib/actions/workers.ts`) nadaje `randomUUID()`,
  a w aplikacji nie ma miejsca na ustawienie hasła.
- Pracownik bez kasy `WORKER` dostaje 404 na stronie startowej — 28 z 49 pracowników (np.
  Nikolajewicz: jedyna kasa `AUXILIARY`, id 37).
- Pole „Pracownik" na transakcji mają tylko `PAYOUT` i `BONUS`; wydatek nie ma żadnego powiązania
  z pracownikiem poza właścicielem kasy-źródła.
- Link zgłoszeń prac (EX-947, `/z/<inwestycja>/<pracownik>/<token>`) działa bez logowania, na
  telefonie, z akceptacją managera — alternatywne wejście.

### Kierunek (właściciel, 2026-10-05 — brainstorming)

- Widok kasy dla pracownika znika. Pracownik dostaje **swoją stronę `/pracownicy/[id]`**, tylko
  własną, wyłącznie do odczytu: przypisane kasy z saldem, transfery z filtrem po kasie.
- Dostęp — dziś rola `EMPLOYEE` jest wpuszczana tylko na `(dashboard)` i
  `/kasa/[id]`; każda inna strona `(frontend)` ją odbija.

### Co trzeba rozwiązać (z kodu, 2026-10-05)

- `/pracownicy/[id]` wpuszcza `ADMIN_OR_OWNER_MANAGER_ROLES`; pracownik — tylko `id === własne`,
  inaczej `notFound()`.
- „Transfery" na stronie pracownika to dziś `worker = id`, czyli tylko jego `PAYOUT` / `BONUS`.
  Transakcje jego kas (zaliczki = `REGISTER_TRANSFER` na kasę, wydatki z kasy) tam **nie trafiają**
  — filtr po kasie wymaga poszerzenia zakresu do `worker = id OR kasa ∈ jego kasy`. To zmienia też
  widok managera tej strony.
- Elementy do zdjęcia / zmiany dla pracownika: `EditWorkerDialog`; linki kas do `/kasa/[id]` i
  sprzętu do `/sprzet/[id]` (strony managerskie); filtr kasy już jest na stronie, ale listuje
  wszystkie kasy — zawęzić do jego kas (filtry „Wpisał" / „Pracownik" strona już wyłącza); akcje w wierszu — `canMutateTransfer` daje `true` dla `createdBy === user`, więc szkice wydatków (EX-971)
  pokazałyby edycję/anulowanie.
- Strona startowa: `EMPLOYEE` → `/pracownicy/<własne id>` zamiast kasy `WORKER` (znika też 404 dla
  pracownika bez kasy `WORKER`). `/kasa/[id]` → `MANAGEMENT_ROLES`.
- Już zamknięte: REST Payloada (`transactions.read` = admin/owner, `users`/`cash-registers` =
  management); nawigacja nie ładuje danych dla nie-managera.

### Decyzje (właściciel, 2026-10-05)

1. Lista „Transfery" na stronie pracownika = `worker = id` **OR** kasa (źródło/cel) ∈ jego kasy —
   także w widoku managera.
2. Sekcja sprzętu zostaje u pracownika, bez linków.
3. Linki do inwestycji zostają — klik odbija się od `requireManagementPage` (`/zaloguj` → `/` → jego
   strona). Filtr inwestycji niezawężony: obca inwestycja = 0 wyników.

**Warunek bezpieczeństwa:** zakres łączyć z filtrami z URL przez `and: [zakres, urlFilters]`, nigdy
spreadem — filtr kasy też buduje `where.or` (`transfer-filters.ts`), a spread nadpisałby zakres
(cudza kasa w `?sourceRegister=` → jej transakcje). Ta sama kolizja opisana w `kasa/[id]/page.tsx`.

### Lista kosztorysów pracownika → link do zgłaszania prac (właściciel, 2026-10-05)

Pracownik na swojej stronie widzi kosztorysy, w których jest, i przechodzi z nich prosto do
`/z/<inwestycja>/<pracownik>/<token>`. Fakty z kodu:

- „Jest w kosztorysie" = przypisany do ≥1 etapu (`kosztorys_stage_workers` → `kosztorys_stages.investment_id`).
- Token linku jest per para inwestycja × pracownik (`worker_report_shares`) i powstaje **dopiero na
  klik managera** (`ensureWorkerLinkAction` / `generate` / `revoke`, wszystkie przez
  `protectedAction`); odmowa, gdy zakres pracownika jest zablokowany (`resolveWorkerScope`).
- Lokalnie: 44 pary inwestycja × pracownik, 2 linki. Nikolajewicz: 5 inwestycji (3 aktywne,
  2 zakończone), link na 2.

**Kierunek (właściciel):** link powstaje automatycznie przy przypisaniu pracownika do dowolnego
etapu, jeśli go jeszcze nie ma. Docelowo pracownik dostaje proste dane logowania i ze swojej strony
ma od razu linki do aktywnych inwestycji, do których jest dodany — manager nie rozsyła linków.
Ścieżka z samym tokenem (bez logowania) zostaje, bo części pracowników trzeba będzie obsłużyć bez
logowania.

Rozstrzygnięte (właściciel, 2026-10-05):

- Link powstaje mimo zablokowanego zakresu (`unconfirmed-plane` / `mixed-planes` to legacy etapy,
  wkrótce znikną) — strona `/z/` pokazuje komunikat.
- „Cofnij link" znika, zostaje „Wygeneruj nowy link" (rotacja); zalogowany pracownik zawsze widzi
  aktualny.
- Jednorazowy backfill linków dla istniejących par (lokalnie 44 pary, 2 linki).

Logowanie pracownika (właściciel, 2026-10-05):

- Login = e-mail jak dziś (bez nazwy użytkownika). E-maile pracowników są często atrapami
  (24/49 w `wykonczymy.com.pl`, `test.pl`, `byleco.pl`, literówka `wykocznymy.com.pl`) — do
  poprawienia przez managera w istniejącej edycji pracownika; e-mail nie musi być prawdziwą skrzynką,
  ma być do wpisania.
- **Hasło ustawia pracownik sam** istniejącym „Zapomniane hasło" (`/zaloguj/zapomniane-haslo` →
  `/zaloguj/reset-hasla`, akcje bez bramki roli) — bez nowego kodu. Brak prawdziwej skrzynki to
  sprawa pracownika: podaje managerowi prawdziwy e-mail, manager poprawia go w edycji pracownika.
  Żadnego ustawiania hasła przez managera w aplikacji.
- Logowanie nazwą użytkownika — osobno, poza tym change'em. Sesja zostaje 7 dni (`tokenExpiration` jest per kolekcja).
- Zmiana hasła nie wylogowuje zalogowanego telefonu (auth nie czyta bazy) — natychmiastowe odcięcie
  to „Aktywny" / kosz (EX-918).

Po researchu (właściciel, 2026-10-05) — szczegóły w `research.md`:

- Zakres transferów: `{ ...urlFilters, and: [{ or: [...] }] }` + gałąź `and` w `where-to-sql`
  (forma `and: [zakres, urlFilters]` wywala kafel sumy); bez kas → bez gałęzi kasowych (`IN ()`).
- Faktury / Drukuj dostępne pracownikowi, z zakresem budowanym na serwerze z jego id.
- Lista kosztorysów: tylko aktywne (`active`), bez skasowanych — zawężone po teście właściciela
  2026-10-05 (pierwotnie także planowane i wyceny); bez kolumny statusu.
- Mint linku bezwarunkowy (szablon nie ma etapów, więc nie dotyczy); backfill migracją SQL.
- `/kasa/[id]` dla EMPLOYEE → 404.
- Pracownicy z linkiem bez etapu zostają w menu (rotacja).
