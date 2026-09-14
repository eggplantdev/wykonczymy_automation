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
