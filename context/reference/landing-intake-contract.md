# Landing intake contract

The one artifact both repos read. `landing_26` sends; `wykonczymy` receives at
`POST /api/webhooks/landing`. The contract is **duplicated, not packaged** (decision, 2026-09-18) —
so this file and the fixture beside it are what keep the two copies from drifting silently.

A byte-identical copy of this file lives in `landing_26`. Change one, change both.

## Endpoint

```
POST https://<wykonczymy>/api/webhooks/landing
Content-Type: application/json
x-landing-signature: sha256=<hex HMAC-SHA256 of the RAW body>
```

The HMAC is computed over the **exact bytes sent**, never over a re-serialised object — a
re-`JSON.stringify` on either side changes key order or spacing and the signature stops matching.
Shared secret: `LANDING_WEBHOOK_SECRET`, the same value in both projects' env.

## Envelope

Strict on what identifies a submission, permissive on the rest: the landing may add a question
without a coordinated deploy here, and an unknown field is ignored rather than rejected.

| Field                                 | Required | Notes                                                                                 |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `submissionId`                        | yes      | uuid, one per submission — this is what makes a replay idempotent                     |
| `submittedAt`                         | no       | ISO 8601                                                                              |
| `locale`, `formId`, `formName`        | no       | recorded as-is                                                                        |
| `name`, `email`, `phone`              | no       | the standard three                                                                    |
| `address`, `scope`, `area`, `message` | no       | the landing's typed answers; `area` is text, because the form invites a range         |
| `rawData`                             | no       | `{ name, values[] }[]` — when omitted, the typed answers above become the answer list |
| `formQuestions`                       | no       | `{ key, label, type? }[]` — key→label for the answers modal                           |
| `assets`                              | no       | `{ url, filename, contentType, size }[]`, at most **15**                              |

Schema and mapping: `src/lib/leads/landing.ts`. Fixture: `src/__tests__/fixtures/landing-submission.ts`.

## Files

The bytes never travel in this request. The visitor uploads straight to the landing's own blob
store, and this handler pulls each file back from its url.

- `url` must be `https:` and its **hostname must equal `LANDING_BLOB_HOST`** exactly. A redirect is
  refused rather than followed — a redirect off the allowlisted host is the bypass the allowlist
  exists to stop.
- Accepted types mirror `media.mimeTypes`: `image/*`, `application/pdf`. Checked on the declared
  `contentType` **and** on the response's.
- Ceiling: **8 MB** per file, enforced on `size`, on `content-length`, and by counting bytes as the
  body streams — the first two are the sender's claims, the third is the fact.

There is **one landing Blob store for every environment** — Preview and Production resolve to the
same host, so `LANDING_BLOB_HOST` carries the same value in both. The consequence is that `leads/`
is a _shared_ prefix: a preview deploy and production stage their uploads side by side and neither
can tell the other's apart by path. Delivery-driven cleanup is unaffected (it names a
`submissionId`, which belongs to exactly one deploy), but anything that deletes by age must run
from production only.

## Callback: delete on confirmed delivery

The landing's copy of a file is staging; the canonical copy is the one this app fetched into
`media`. So once the attach has **committed** — after the `payload.update` that points the lead at
its media rows, not merely after the fetch succeeded — `wykonczymy` tells the landing it may drop
its bytes.

```
POST <LANDING_CLEANUP_URL>
Content-Type: application/json
x-landing-signature: sha256=<hex HMAC-SHA256 of the RAW body>

{ "submissionId": "<uuid>" }
```

Same secret and same scheme as the inbound webhook (`LANDING_WEBHOOK_SECRET`, HMAC over the exact
bytes sent). `LANDING_CLEANUP_URL` is the full endpoint url, held in `wykonczymy`'s env.

**The callback carries no urls.** A delete instruction that names its own targets is a delete
primitive exposed to whoever can forge or replay it; one that names a submission can only ever
destroy the files of a submission that was already delivered. The landing re-derives the target
list by listing its own `leads/<submissionId>/` prefix, so the blast radius is bounded by the
prefix scheme rather than by the caller's honesty.

**It is non-fatal on both ends.** `wykonczymy` catches and logs a failed callback and still answers
`200` to the original webhook — the lead is stored and the assets are attached, so a landing that is
down must not turn a delivered submission into a retried one. The cost of a missed callback is an
orphan, which the landing's age sweep reclaims.

| Situation                                         | Status | What happens                                           |
| ------------------------------------------------- | ------ | ------------------------------------------------------ |
| Bad or missing signature                          | `403`  | nothing is deleted                                     |
| Body is not JSON, or `submissionId` is not a uuid | `400`  | —                                                      |
| Prefix listed and deleted                         | `200`  | the queue row's files are gone                         |
| No such prefix, or already deleted                | `200`  | idempotent — a replay deletes nothing twice            |
| The delete itself failed                          | `500`  | the sweep is the backstop; `wykonczymy` does not retry |

**Partial deliveries are not cleaned up.** A file that landed in `failed[]` is one this app does
_not_ have, so its bytes are the only copy left. The sweep will not take it either — it belongs to a
submission that was delivered. It is deleted by hand once the failure is understood.

## Two rules that live on the landing side

1. **The upload token is minted only after the form validates server-side.** Otherwise the store is
   an open file drop.
2. **The blob host must be the one wykonczymy allowlists** — the same single value in every
   environment.

## Answers

| Situation                           | Status | What happens                                                               |
| ----------------------------------- | ------ | -------------------------------------------------------------------------- |
| Bad or missing signature            | `403`  | nothing is read                                                            |
| Body is not JSON                    | `400`  | —                                                                          |
| Envelope fails the schema           | `400`  | ops alert (`notifyShapeAlert`)                                             |
| Some files could not be pulled      | `200`  | **the lead is stored** with what resolved; ops alert lists the failed urls |
| Same `submissionId` again           | `200`  | no second lead, no second e-mail, no second download                       |
| The lead itself could not be stored | `500`  | the landing should retry                                                   |

`200` means „stop retrying", so it is the answer to everything except a failure to store the lead.
Losing the enquiry is the outcome the landing's queue exists to prevent; an incomplete photo set is
the lesser failure, and the alert makes it visible. Recovery is real, not theoretical: a failed
file's url stays live in the landing's store until its queue row is deleted, so the alert carries
the url and the file can be attached by hand.
