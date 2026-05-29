# Kosztorys — sheet inspection tooling

> **Purpose:** read-only inspection of an existing kosztorys Google Sheet so we can
> reverse-engineer its structure (tab names, dimensions, header rows, sample data)
> before designing a DB-backed replacement. **Not** part of the app — these are
> one-off analysis scripts.
>
> Created during the 2026-05-28 design session for "move kosztorys to DB + generate
> sheet from data".

## Prerequisites

Same env vars the app already uses (already set in `.env`, real working credentials
per the `⚠️ TEMPORARY` note in `CLAUDE.md`):

- `GOOGLE_SERVICE_ACCOUNT_JSON` — service-account credential JSON, single line.
- `KOSZTORYS_TEMPLATE_SHEET_ID` — id of the template sheet to inspect.
  Replace with any sheet id to inspect a different file (the SA must be at least
  a Viewer on it).

The script uses the `googleapis` package that's already a runtime dep.

## Scripts

### `scripts/inspect-template.mjs`

Read-only dump of every tab in `KOSZTORYS_TEMPLATE_SHEET_ID`:

- File title and per-tab metadata (gid, row/col count, merge count).
- First 60 rows × 33+ cols of each tab, compacted to non-empty cells with
  column letters preserved (e.g. `r05: A=Prace dodatkowe  |  B=1  |  C=zakup...`).
- Uses `FORMATTED_VALUE` so currency/percent cells come out as the owner sees
  them, not raw numbers.

Scope: `spreadsheets.readonly` (cannot modify the sheet — safe to run on the
real template).

## Run

From the repo root:

```bash
node --env-file=.env scripts/inspect-template.mjs
```

Output goes to stdout. For a large sheet pipe it to a file:

```bash
node --env-file=.env scripts/inspect-template.mjs > /tmp/kosztorys-template-dump.txt
```

### Inspect a different sheet

Override the env var inline:

```bash
KOSZTORYS_TEMPLATE_SHEET_ID=<other-sheet-id> node --env-file=.env scripts/inspect-template.mjs
```

The SA email (`konrad-kosztorys@…iam.gserviceaccount.com` — print via
`node --env-file=.env -e "console.log(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email)"`)
must be shared on the sheet as at least Viewer.

## What the dump tells us (current template, 2026-05-28)

Six tabs, all but `Podsumowanie` and `materiały ` follow a **section / item /
10-etap** layout. The three "scope of work" tabs are the same item catalogue
with different price models (client / subcontractor-with-tools /
subcontractor-our-tools). Full notes live in the design spec at
`docs/superpowers/specs/2026-05-28-kosztorys-db-ownership-design.md` (created
later in the same session).

## Why this isn't in `package.json`

It's a one-shot analysis tool, not part of any user flow. Keeping it out of
`scripts` in `package.json` avoids tempting anyone to run it on every dev start.
Delete the file once the DB-backed design is locked in and we have no more
"what does the template look like?" questions.
