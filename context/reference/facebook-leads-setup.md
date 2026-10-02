# Facebook Lead Ads — self-hosted webhook

Captures leads from FB Lead Ads into this app, **without Zapier and without Tech Provider
verification**. Because we retrieve our OWN page's leads and the user is admin of both the Meta
app and the page, **Standard Access is enough** — no App Review, no Advanced Access.
(Verified: https://developers.facebook.com/docs/development/release/access-verification/)

## How it works

Meta's webhook payload carries only a `leadgen_id` — never the lead fields. The handler
(`src/app/(frontend)/api/webhooks/facebook-leads/route.ts`) makes a second authenticated Graph
call to fetch the actual field data:

```
GET https://graph.facebook.com/v21.0/{leadgen_id}
Authorization: Bearer {META_PAGE_ACCESS_TOKEN}
```

**What happens per lead** (`route.ts` → `captureLead`):

1. **Verify** the `X-Hub-Signature-256` HMAC over the raw body (bad sig → 403).
2. **Fetch** the field data (call above) + the form's questions (`?fields=questions`,
   once per form per request) for the `key→label` map.
3. **Normalize** — lift email/name/phone by field type → key heuristic → email regex;
   a Zod safety net alerts the `opsAlerts` list on an unexpected shape.
4. **Store** once per `(source, externalId)` in the `leads` collection (idempotent — Meta
   redelivers on any non-200), keeping the full `field_data` (`rawData`) + `formQuestions`.
5. **Notify** the `newLead` list (internal heads-up — name/email/phone plus a **"Treść
   formularza"** section with every extra form answer; fields already shown up top are
   de-duplicated) and **auto-reply** the lead from `LEADS_REPLY_FROM` (branded confirmation)
   — each retried 3×, tracked per lead in `notifyStatus` / `autoReplyStatus`. Store-then-notify:
   a mail failure never loses a lead.

Leads surface at **`/zgloszenia`** (table + editable follow-up status + a details modal
rendering each form answer against its real question). Historical leads were loaded with the
manual Graph `curl` calls below (no committed script), not the webhook.

## Key facts

| Thing                  | Value                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Meta app               | `wykonczymy` — App ID `1568997054330916`                                                              |
| FB Page                | `Wykończymy` — Page ID `104897439055542`                                                              |
| Prod domain (THIS app) | `wykonczymy.vercel.app` (NOT the WordPress `wykonczymy.com.pl`)                                       |
| Prod callback URL      | `https://wykonczymy.vercel.app/api/webhooks/facebook-leads`                                           |
| Token expiry           | none — `META_PAGE_ACCESS_TOKEN` is System-User-derived and reports `expires_at: 0` (since 2026-08-10) |

## Links to paste

| Purpose                                  | URL                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| **Test a real lead** (real `leadgen_id`) | https://developers.facebook.com/tools/lead-ads-testing                        |
| Graph API Explorer (generate Page token) | https://developers.facebook.com/tools/explorer                                |
| Debug / extend a token                   | https://developers.facebook.com/tools/debug/accesstoken                       |
| App dashboard                            | https://developers.facebook.com/apps                                          |
| Ads Manager (campaigns)                  | https://business.facebook.com/adsmanager                                      |
| Access verification doc                  | https://developers.facebook.com/docs/development/release/access-verification/ |

## Meta app config

- **Webhooks** (inside the "Capture & manage ad leads" use case):
  - Callback URL: `https://wykonczymy.vercel.app/api/webhooks/facebook-leads`
  - Verify token: value of `META_VERIFY_TOKEN`
  - Subscribe the **Page** object → `leadgen` field
- **Publish requirements** (Basic settings): Privacy policy URL, Data deletion URL, Category,
  1024×1024 app icon. The Tech Provider "Not verified" warning is a **non-blocker** for own-page use.

## Public legal pages (required to publish)

Served from `src/app/(legal)/`, exempted from the login redirect in `src/proxy.ts`:

- Privacy policy: `https://wykonczymy.vercel.app/privacy`
- Data deletion: `https://wykonczymy.vercel.app/usuwanie-danych`
- Terms: `https://wykonczymy.vercel.app/terms`

## Env vars (contract in `src/lib/env/schema.ts`)

Meta: `META_APP_ID`, `META_APP_SECRET`, `META_APP_TOKEN`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`.

Email routing — the two **recipient** lists are no longer env vars. They live in the
`notification-recipients` global and are edited on `/zgloszenia` itself: `newLead` (internal
new-lead heads-up; lists the extra form answers, de-duplicated against the ones shown up top) and
`opsAlerts` (integration shape-alerts: schema fail / no email extracted). A stream with nobody in it
throws rather than mailing the void. Only the _from_-address remains an env var:

- `LEADS_REPLY_FROM` — `From:` on the customer auto-reply; its domain **must** have SPF/DKIM or the
  confirmation spam-folders. The logo in that email loads from `${NEXT_PUBLIC_FRONTEND_URL}/wykonczymy-app-icon.png`,
  so it only renders once deployed to a public prod domain.

All must be in Vercel prod env too; **redeploy after changing** (env changes don't reach existing deployments).

## Testing

Use https://developers.facebook.com/tools/lead-ads-testing → select **Wykończymy** + the form →
**Create lead**. This fires a real `leadgen_id`.

- ✅ Real data appears as `[facebook-leads] Lead data:` in the logs.
- ⚠️ Do NOT use the Webhooks dashboard **"Test"** button — it sends a fake id (`444...`) that always
  400s (`code 100`). Wiring check only, never real data.
- Real production leads only flow once the app is **Published**.

## Backfilling existing leads (no webhook needed)

The webhook only fires for **new** leads. Everything already submitted is retrievable in bulk with the
same page token + `leads_retrieval` scope — the webhook was never needed for history:

```bash
TOKEN=$(grep '^META_PAGE_ACCESS_TOKEN=' .env | sed 's/^META_PAGE_ACCESS_TOKEN=//' | tr -d '"')

# 1. list forms on the page (with lead counts)
curl -s "https://graph.facebook.com/v21.0/104897439055542/leadgen_forms?fields=id,name,status,leads_count,questions&access_token=$TOKEN"

# 2. pull all submissions for a form (paginate via .paging.next)
curl -s "https://graph.facebook.com/v21.0/{FORM_ID}/leads?limit=100&access_token=$TOKEN"
```

A **form submission IS a lead** — there is no separate object. `/leads` returns the submitted answers.

**Retention:** only leads still inside Meta's retention window come back; older ones are dropped
server-side. The `next` pagination URL **embeds the page token in plaintext** — never log or paste it.

## Daily reconcile cron (the webhook's backstop)

`/api/cron/leads-reconcile` runs the same sweep the „Pobierz zgłoszenia" button runs, daily at 04:00
(`vercel.json`). Three facts fixed its shape:

- **Daily is enough because Meta retries a failed lead webhook for ~36h on its own.** A daily run
  lands well inside that window, so the cron only ever catches what Meta itself gave up on — and it
  costs three Graph calls a day (one `leadgen_forms`, plus leads + questions per _active_ form;
  empty forms are skipped, and only 1 of 9 has data). Hourly would buy nothing but rate-limit
  exposure.
- **No token-expiry monitor, deliberately.** The System-User-derived Page token reports
  `expires_at: 0`, so a `debug_token` watchdog would guard a failure mode that no longer exists.
- **No cursor or watermark.** `storeLead` dedupes on `(source, externalId)`, so re-sweeping the same
  recent leads every night is a no-op by construction. The run is bounded by a per-form limit, not
  by history.
- **A deleted lead is erased in place, never `DELETE`d (EX-970).** „Usuń na zawsze" in `/kosz` and
  the 30-day purge null the contact data, answers and files but keep the row with its
  `(source, externalId)` and an `erasedAt`. A real `DELETE` would let tonight's sweep find no match
  and re-create the lead the owner removed. So `findStoredLead` deliberately ignores `trashedAt` /
  `erasedAt`, and `captureLead` skips the notification for an erased row.

A recovery is therefore _itself_ the alarm: if the cron ever inserts a lead, the webhook is not
delivering and the ops mail says so.

## Data shape (for the `leads` Payload collection)

Snapshot from the live page (2026-07-06): **9 forms, but only `899352536400611`
("komercyjnie - wwa - cold | 26") has data — 62 leads** (61 real + 1 test), from 2026-04-09 onward.
The other 8 forms are empty (`leads_count: 0`). A full dump lives at
**`.local/fb-leads/fb_leads_dataset.json`** (form defs + all 62 leads; siblings: `leads_raw.ndjson`,
`fb_forms.json`) — `.local/` is gitignored (real PII), do **not** commit it.

Design constraints this dump proves out:

- **Store `field_data` as a key/value array, not fixed columns.** Field `name`s are raw, per-form,
  and unsanitised (`full name` has a space; `z_jakiej_dzielnicy_warszawy_jesteś?` keeps the `?`).
  Different forms will have different keys, so hardcoded columns break on the next form.
- **The "choice" fields are NOT enums.** In the form definition `z_jakiej_dzielnicy...` and
  `jakie_pomieszczenie...` are Meta type `CUSTOM` = open free-text. Real answers are all over the map
  (`"Lazienka / WC"`, `"tak"`, `"sory a w Bydgoszczy możecie?"`, `"Proszę o ofertę"`). Do **not**
  model them as `select` — store the raw string.
- Meta types the standard fields: `FULL_NAME`, `PHONE`, `EMAIL`. Only these are safe to lift into
  typed top-level columns (name / phone / email); everything else stays in the key/value array.
- The lead-ads testing tool writes values prefixed `<test lead: …>`; these are captured like any
  other lead (no special flag or filtering — the distinction was removed as needless complexity).
- Keep provenance columns: `leadgen_id` (dedupe key, unique), `form_id`, `form_name`, `created_time`.
- Values arrive as a `values` **array**; every field here is single-value, but the shape is a list —
  store `values[0]` or the whole array, don't assume scalar.

## Regenerating the token (only if it is ever revoked)

The live token is **System-User-derived** (2026-08-10) — that is what makes it report `expires_at: 0`
and removes token expiry as a failure mode. Reproduce that path, not the Explorer path:

1. Business settings → **System User** → generate a token for the `wykonczymy` app with **all five**
   scopes: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`,
   **`pages_manage_ads`**. The last is the non-obvious one — `/{page_id}/leadgen_forms` is filed
   under ads management, so without it `listLeadForms()` fails `(#200)` even though reading the
   leads themselves works.
2. **A System User token is not itself usable.** `/{page_id}/leadgen_forms` rejects it with
   `(#190) This method must be called with a Page Access Token`. Derive the Page token —
   `GET /{PAGE_ID}?fields=access_token` with the system user token as Bearer — and it inherits the
   never-expiry. **That derived token is what `META_PAGE_ACCESS_TOKEN` holds.**
3. Put it in `.env` and Vercel prod env → redeploy (env changes don't reach existing deployments).

`META_APP_TOKEN` is the never-expiring `APP_ID|APP_SECRET` form — it needs no regeneration.

Legacy fallback (expiring, ~60–90 days — only if the System User path is unavailable):
Explorer → Get Page Access Token → same scopes → debug tool → **Extend Access Token**. Exchange the
short user token for a long-lived one _first_, then pull the page token; a page token derived from a
long-lived user token outlives one derived from a short one, but still expires.

## Fixed gap: webhook rows carried no `form_id` (until 2026-09-15)

`GET /{leadgen_id}` with no `?fields` returns only `created_time`, `field_data`, `id` — **no
`form_id`** — so from 2026-07-08 every webhook lead was saved without its form and `normalizeLead`
fell back to key heuristics. Fixed in `20a9558d`: `src/lib/leads/fetch-lead.ts` now asks for
`?fields=id,created_time,form_id,field_data`. The ~87 rows saved before the fix keep a null
`form_id` (owner call — not backfilled).
