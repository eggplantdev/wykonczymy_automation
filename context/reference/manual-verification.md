# Manual verification — project profile

The profile the global `verify-manual-checks` skill reads before a pass. The skill is the engine and
stays the same in every repo; everything specific to this one lives here. When a command below stops
working, fix it here as part of the pass.

## Registry

`context/foundation/manual-checks.md` — a `##` section per slice. A slice with unticked boxes is not
`Done` (Linear project „Wykonczymy"; an open finding keeps the issue out of Done).

## Local target

- **Safe DB:** the isolated `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, db
  `wykonczymy-test`) — the one the E2E suite uses. Never the dev DB on 5433 (holds work entered since
  the last dump), never `DB_POSTGRES_URL_PROD`.
  - Reset: `pnpm db:import:test` (prod dump → test DB; also starts the container).
  - Migrate: `pnpm db:migrate:test` — run from the worktree. The dump is often behind the branch.
  - Seed kosztorys content (not in the dump): `pnpm seed:kosztorys:test` (synthetic ~1000-row, no
    external calls; `INV=<id>` picks the investment). `src/scripts/seed-kosztorys.ts` reads the **live**
    Google Sheet — only deliberately, and it wipes that investment's kosztorys. Other planes:
    `seed:deposits:test`, `seed:materials-net:test` (see AGENTS.md → Databases).
- **Boot:** `NEXT_DIST_DIR=.next-e2e DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec next dev --turbo -p 3010`
  (after `set -a; source .env; set +a`). `.next-e2e` is gitignored — never use an un-ignored dist dir:
  Tailwind v4 scans the root and poisons the user's server CSS (`Parsing CSS source code failed`;
  recover by clearing that server's `.next`). The user's dev server runs on 3000/3001 — never kill it.
  `next dev` reformats `tsconfig.json` and injects the dist dir — `git checkout tsconfig.json` at
  teardown.
- **Login:** `/zaloguj`. OWNER from `DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm seed:e2e`,
  credentials in `src/scripts/e2e-user-credentials.ts`. `ADMIN`/`PASS` in `.env` are dead. Most
  kosztorys/stage controls need `MANAGEMENT_ROLES` (OWNER/MANAGER); a role-gated page without the role
  answers with a bare 404/redirect.

## Staging target

- **URL:** `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app` (Vercel SSO in front).
- **DB:** `DB_POSTGRES_URL_PREVIEW` — a restored prod dump with real people's data.
  `set -a; source .env; set +a; psql "$DB_POSTGRES_URL_PREVIEW" -c '…'`. After merging a migration
  into staging, `pnpm db:migrate:preview`.
- **Deploy check:** `npx vercel ls` fails here (project-link error). Use
  `gh api repos/eggplantdev/wykonczymy_automation/commits/<sha>/status --jq '.statuses[] | .context + " " + .state'`
  for `git rev-parse origin/staging` — the Vercel context must be `success`.
- **Login:** `pnpm qa:staging-user` first, every pass. It upserts OWNER `STAGING_QA_EMAIL`
  (`qa-staging@wykonczymy.test`) on the preview DB with `STAGING_QA_PASSWORD` from `.env`, re-creating
  it after a restore wiped it, and refuses any DB but the preview one. A Nodemailer
  `getaddrinfo disabled.invalid` on the way out is the mail gate, not a failure. Then from the page:
  `fetch('/api/users/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password})})`
  and assert `user.role === 'OWNER'`. Never write a throwaway reset script, never mint another OWNER.
  For two-role checks use the pair below.
- **Investor share links point at production by default** (owner, 2026-09-15). `/k/<token>` is built
  from `NEXT_PUBLIC_FRONTEND_URL`, deliberately not derived from the branch URL; the one exception is
  a Preview value scoped to the `staging` branch. `NEXT_PUBLIC_*` is fixed at build time, so a change
  needs a redeploy.
- **Cron routes:** from the page, `fetch('/api/cron/<route>', {headers: {Authorization: 'Bearer <CRON_SECRET from .env>'}})`.
- **Known noise, not a finding:** an `[OPTIONS] … => 400` on every page load is the `vercel.live`
  preview toolbar's preflight, not app code.

## Repo-specific traps

- **Print:** every document prints from a popup via `src/lib/utils/print-window.ts` — stub `print` on
  the popup (the skill's snippet), never the page.
- **Kosztorys view switcher:** the view is the `role="radio"` items (`data-state="checked"`); the
  „Widok inwestora" dropdown next to it is a button, not state.
- **react-datasheet-grid:** virtualised both ways — a column at the right edge (e.g. „Pozostało" on
  the worker preview) is not in the DOM until `.dsg-container` is scrolled. Driving it:
  `context/foundation/lessons.md` → "Driving react-datasheet-grid in a QA pass".
- **Test layers:** unit / DOM specs under `src/__tests__/` (mirrored path), e2e under `e2e/` against
  5435 — AGENTS.md → Testing.

---

## Konta do weryfikacji dwóch ról na stagingu (preview DB)

Zwykły przebieg loguje się kontem z `pnpm qa:staging-user` (wyżej). Ręczna weryfikacja slice'a
czasem potrzebuje jednak **dwóch ról naraz** — czegoś, czego nie da się zrobić
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

## Realia środowiska weryfikacyjnego

Zdestylowane z `context/foundation/manual-checks.md` przy jego przycięciu 2026-09-15 (pełny rejestr:
`git show d426e567^:context/foundation/manual-checks.md`). To są rzeczy, na które kolejny
weryfikator straci godzinę, jeśli ich nie przeczyta.

### Stałe blokady — czego na stagingu zweryfikować się NIE DA

Te powody trzymają praktycznie każdy niezaznaczony boks w rejestrze. Żaden nie jest defektem i
żadnego nie usunie kolejne podejście:

1. **`/raporty` jest wyłączone** do czasu EX-598 — `src/app/(frontend)/raporty/page.tsx` renderuje
   bezwarunkowy `EmptyState` „W budowie". Każdy boks mówiący „sprawdź na raportach" jest tym zablokowany.
2. **Poczta nie wychodzi poza produkcją** (`EMAIL_HOST` = `disabled.invalid`, patrz AGENTS.md).
3. **Nie ma dostępu do skrzynki odbiorczej**, więc „czy mail dotarł i jak wygląda" jest poza zasięgiem.

Boks zablokowany którymś z powyższych zostawia się **niezaznaczony z podanym powodem** — nie zaznacza
się go „bo kod wygląda dobrze" i nie kasuje.

### Techniki

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
zautomatyzowanego Chromium bezterminowo (zaobserwowane ~30 i ~40 min bez powrotu). Stub na popupie —
patrz „Repo-specific traps" wyżej.

**Zapchany dysk VM Dockera udaje zawieszoną bazę.** `No space left on device (os error 28)` wiesza
`docker ps` i **nowe** połączenia `psql` do 5435, podczas gdy już otwarty pool odpowiada normalnie —
więc objawem jest „baza działa, ale nie da się do niej podłączyć". Wolne miejsce na dysku hosta nie
jest sygnałem; liczy się dysk maszyny wirtualnej Docker Desktop.

**Fikstury preview są zmienne.** Inwestycje 135/136/137 pojawiają się i znikają przy kolejnych
reseedach — identyfikator z poprzedniego przebiegu weryfikacji nie jest stałą.

**Undo coalescing defeats per-call edits.** Grid undo merges edits within `UNDO_COALESCE_MS` (700 ms),
and each separate Playwright MCP call is slower (`browser_type` alone takes >1 s). To check that
several edits undo in one step, make them inside one `browser_evaluate`.

**The kosztorys „Filtry" menu is inverted too.** Every option starts ticked; unticking hides those
rows (chip „Ukryto: …"), it never narrows to them. Only „Problemy" means show-only („Tylko: …").

**Grid resize handles capture the pointer** (`setPointerCapture`). `browser_drag` never shows the
intermediate state; send `pointerdown` → `pointermove`×N → `pointerup` to the `role="separator"`
handle from `browser_evaluate`.

**Forcing a failed save without going offline:** fail only POSTs carrying a `next-action` header —
`page.route` + `abort()`, or, where the MCP has no `page.route`, a `window.fetch` patch returning 500
for them. Page loads keep working; check the toast and the revert, then confirm with psql that
nothing was written.

**Blob deletion:** list the store (`list({ prefix })`). Re-fetching the file URL still answers `200`
from the browser's HTTP cache right after the delete.

**Nav badges clear themselves.** Loading a stream's own page (`/flota`, `/flota/[id]`, `/sprzet`,
`/zgloszenia`) calls `markSeen`, so any UI path that creates the fixture also marks it read. Insert
the row by SQL, check the badge from a page outside that stream, then delete the row.

**Grid paste under headless Playwright.** The OS clipboard is blocked. For a selected, not-editing
cell dispatch `new ClipboardEvent('paste', {clipboardData})` on `document` (dsg listens there and
routes through `cellPaste`); for an open cell use `document.execCommand('insertText', …)`, since dsg
skips its paste route while editing.

**Scroll-during-edit is reproducible.** dsg re-scrolls only when the active cell changes, so
`page.mouse.wheel()` over `.dsg-container` genuinely unmounts the row being edited. PageDown moves
focus and ends the edit first.
