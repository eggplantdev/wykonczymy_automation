---
change_id: fleet-sheet-parity
title: Fleet parity with the owner's vehicle-control sheet
status: archived
created: 2026-08-25
updated: 2026-09-02
archived_at: 2026-09-02T08:05:52Z
branch: staging # user asked not to switch branches for this change
worktree: null
---

## Notes

Bring the fleet module to parity with the owner's vehicle-control spreadsheet
(`Kopia Kontrola_przegladow_i_ubezpieczen_samochodow.xlsm`, Drive id
`1Yq8Z1zqUpjtaju15lKNWJsuLQuDFDtpi` — an uploaded Office file, so `scripts/inspect-sheet.mjs`
cannot read it; pull it with the Drive API and unzip).

Five gaps found by comparing the sheet's columns against `vehicles` / `vehicle-inspections`:

1. **Ubezpieczyciel + Nr polisy** — no home in the app. Belongs on the INSURANCE inspection, not on
   the vehicle: both change with each polisa, and the event keeps the history honest.
2. **„bezterminowo"** — no way to mark a scheduled type not-applicable. The Przyczepa Knaus has no
   przegląd techniczny ever; today it reads as a permanent blind spot and `findMissingInspections`
   nags about it in the weekly digest forever.
3. **Uwagi** — a car-level remark ("tarcze i klocki do wymiany, poduszka silnika"). `note` exists
   only per-inspection.
4. **opony** — the tyre set currently ON the car (całoroczne / letnie / zima). The TYRES inspection
   is the change log, not the current state.
5. **aktualny przebieg** — a plain meter reading with no event behind it. `latestOdometer` is
   derived from inspections, so recording one today means inventing a fake inspection.

**Follow-up (owner, 2026-08-26): the weekly missing-data section is gone.** `findMissingInspections`
and its Monday-only digest section were removed outright — a permanent list of blind spots in a mail
about deadlines was noise, and „bezterminowo" (gap 2) covers the only case that had a real answer.
The exemption itself stays: it still silences the deadline columns and the urgency colouring.

**Follow-up (owner, 2026-08-26): the mail no longer fires at 30 days** — only 7, 1 and overdue
(`MAILED_BUCKET_MAX` in `thresholds.ts`). The 30-day bucket is untouched everywhere else: it still
colours the listing amber and is the whole window the „Flota" badge counts.

Sheet data quality (checked against the raw XML, 2026-08-25):

- The sheet is **clean** — an earlier "shifted columns" reading was an artifact of a broken dump
  script (a self-closing empty `<c/>` swallowed the next cell). Do not re-file it.
- `WF 7029W` (VW T4) — przegląd genuinely expired (2026-06-27); no oil history, no insurer, no
  policy number, but it does carry an insurance date.
- `WD776AL` (Przyczepa Knaus) — no VIN, no make/model split, przegląd is the literal text
  „bezterminowo", and it has a **policy number with no insurer**. So insurer must not be required
  alongside the policy number.
- Nr polisy must be **text**: `354E000003305` parses to infinity as a number and
  `22044 4672279` contains a space.
- „opony" is free prose in practice („do wymiany na cały sezon.", „całosezonowe ale do wymiany"),
  not a clean enum — a bare select would lose what the owner actually wrote.
- „aktualny przebieg" is filled on exactly one car (`WF7972X` = 177 500), which is the whole
  argument for a cheap standalone reading rather than a fake inspection.

Import outcome (2026-08-26, local docker DB): **9 vehicles, 25 events** — the plan's Progress box
said 20, which was an arithmetic slip in the criterion, not in the data. The table it verified
against the XML yields 8 TECHNICAL (the przyczepa is exempt) + 9 INSURANCE + 7 OIL_CHANGE
(no oil history for the T4 or the przyczepa) + 1 ODOMETER.

Prod import ran 2026-08-26 against `DB_POSTGRES_URL_PROD`, the migration having already been
applied. The prod fleet was empty beforehand (0 vehicles, 0 events, no registration collisions), so
the run created 9 vehicles and 25 events with nothing updated or skipped — the same 8/9/7/1 split by
type, verified by a separate read rather than by the script's own tally.
`src/scripts/import-fleet-sheet.ts` is therefore deleted, as the decision to leave no permanent
bridge to the sheet required.

Open at archive, never ruled on: an exempt („bezterminowo") inspection type can still be flagged
„do wymiany" (`vehicle-flags.tsx` offers every `PERFORMED_INSPECTION_TYPES` entry), and the prod split
of the Knaus into make `Knaus` / model `Przyczepa` was the importer's guess, not confirmed by the owner.
