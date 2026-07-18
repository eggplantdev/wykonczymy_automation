# Kosztorys bridge — braindump

Free-form capture for this change. Dump anything — rough is fine; planning dedupes.
Sheet vocabulary throughout. Sources: `../kosztorys-parity-gaps/braindump.md` (gap table) +
`missing-features.md`.

## Locked (from shaping, 2026-07-18)

- Bridge is **read-only** — live join, no sync, no write-back; FR-015 write firewall stays.
- Write-back (auto-robocizna from rozpiska, rabat unification) = separate future change.
- Access control unchanged; oferta delivery to client = later stage (probably a file, maybe
  an app→arkusz export script).
- First increment: Podsumowanie Robocizna / Materiały / Łącznie split, materiały summed live
  from the investment's transactions.
- Scope: gap rows #1 oferta view · #2 PDF eksport · #3 Podsumowanie split · #4 pie „% udziału" ·
  #6 suma transzy per etap · #8 suma prac wykonanych · #13 kolumna komentarz · + „aktualnie do
  zapłaty R + M" (needs zaliczki).

## Open questions (owner)

- **Zaliczka model** — several hand-typed advances per etap in the sheet; app has no etap link
  on transfers. Etap-tagged transfers vs kosztorys-side entries?
- **Udział % base** — Przedmiar (canonical sheet) vs executed (test sheet)?
- **Per-etap price base** — client price vs subcontractor payout?
- **„Pozostało/bilans" formula** — still under discussion; don't harden dependents.
- Brutto column placement.

## Dump

- …
