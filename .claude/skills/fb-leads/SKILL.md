---
name: fb-leads
description: Fetch the most recent Facebook Lead Ads leads for THIS project straight from the Meta Graph API — the source of truth for what Meta actually captured, independent of whether our webhook stored them in the DB. Use whenever the user asks to "check the FB leads endpoint", "get the last N leads", "show recent Facebook leads", "what leads came in", "pull leads from Facebook", or wants to verify the lead pipeline / a specific leadgen form. Prefer this over querying the local/prod DB — the DB is downstream and can be stale or missing leads.
---

# FB Leads — fetch recent leads from Meta

The `leads` DB collection only holds what our webhook (`/api/webhooks/facebook-leads`)
managed to store. To answer "what are the latest leads" truthfully, go to Meta directly.
The bundled script does exactly that using `META_PAGE_ACCESS_TOKEN` / `META_PAGE_ID`
from `.env`.

## Usage

Run from anywhere in the repo:

```bash
python3 .claude/skills/fb-leads/scripts/fetch_leads.py [N] [--form FORM_ID] [--json]
```

- `N` — number of recent leads (default 3)
- `--form FORM_ID` — target a specific leadgen form; omit to auto-pick the active form with the most leads
- `--json` — raw JSON instead of the formatted table

The script auto-decodes Meta's `\uXXXX` escapes (Polish chars, `@`), so names/emails print clean.

## What it does

1. Lists the page's `leadgen_forms` (id, name, leads_count, status) and picks the active one with the most leads — unless `--form` is given.
2. Fetches the N newest leads from that form's `/leads` edge with `field_data`.
3. Prints name / phone / email plus any extra form answers (dzielnica, pomieszczenie, …).

## Notes

- Read-only Graph calls — nothing is written to Meta or the DB.
- If the user wants **all** forms or a non-default form, list forms first:
  `python3 .claude/skills/fb-leads/scripts/fetch_leads.py --json` shows the auto-pick, or query
  `{PAGE_ID}/leadgen_forms` directly to see every form id.
- Token health: if a call returns an OAuth/190 error the page token has expired — that's the
  thing to report, since a dead token silently breaks the live webhook too.
- To cross-check whether a Meta lead actually landed in our DB, that's a separate step
  (query the `leads` collection); this skill deliberately does not touch the DB.
