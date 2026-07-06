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

## Regenerating the token (before Sep 4 2026)

1. https://developers.facebook.com/tools/explorer → Get Page Access Token → select scopes
   (`leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`) →
   pick **Wykończymy** in "User or Page".
2. https://developers.facebook.com/tools/debug/accesstoken → paste → Debug → **Extend Access Token**.
3. Put the extended token in `.env` and Vercel prod env → redeploy.

For a **never-expiring** token: exchange the short user token → long-lived user token FIRST, then
pull the page token (a page token derived from a long-lived user token doesn't expire).
