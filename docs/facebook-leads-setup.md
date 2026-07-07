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
GET https://graph.facebook.com/v21.0/{leadgen_id}?access_token={META_PAGE_ACCESS_TOKEN}
```

**Current state:** the handler only `console.log`s the lead. Nothing is persisted yet.
Next feature: store `field_data` in a Payload `leads` collection.

## Key facts

| Thing                  | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| Meta app               | `wykonczymy` — App ID `1568997054330916`                                   |
| FB Page                | `Wykończymy` — Page ID `104897439055542`                                   |
| Prod domain (THIS app) | `wykonczymy.vercel.app` (NOT the WordPress `wykonczymy.com.pl`)            |
| Prod callback URL      | `https://wykonczymy.vercel.app/api/webhooks/facebook-leads`                |
| Token expiry           | `META_PAGE_ACCESS_TOKEN` **expires Sep 4 2026** — leads silently stop then |

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

## Env vars (see `.env.copy`)

`META_APP_ID`, `META_APP_SECRET`, `META_APP_TOKEN`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`.
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
- **Filter test leads on import** — the lead-ads testing tool writes values prefixed `<test lead: …>`.
- Keep provenance columns: `leadgen_id` (dedupe key, unique), `form_id`, `form_name`, `created_time`.
- Values arrive as a `values` **array**; every field here is single-value, but the shape is a list —
  store `values[0]` or the whole array, don't assume scalar.

## Regenerating the token (before Sep 4 2026)

1. https://developers.facebook.com/tools/explorer → Get Page Access Token → select scopes
   (`leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`) →
   pick **Wykończymy** in "User or Page".
2. https://developers.facebook.com/tools/debug/accesstoken → paste → Debug → **Extend Access Token**.
3. Put the extended token in `.env` and Vercel prod env → redeploy.

For a **never-expiring** token: exchange the short user token → long-lived user token FIRST, then
pull the page token (a page token derived from a long-lived user token doesn't expire).
